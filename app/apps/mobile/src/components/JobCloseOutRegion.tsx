import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Ctx, Job } from '@jobcore/core';
import { EmptyState, colors, spacing } from '@jobcore/ui';
import { CloseOutReviewScreen } from '../../../../modules/admin-finance/src/screens/CloseOutReviewScreen';
import type { CloseOutPhoto } from '../../../../modules/admin-finance/src/screens/CloseOutReviewScreen';
import { awaitingCloseOut } from '../../../../modules/admin-finance/src/domain/closeout';
import { settledTotalCents } from '../../../../modules/admin-finance/src/domain/payments';
import type { JobTimelineItem } from '../../../../modules/admin-finance/src/domain/job-timeline';
import type { CustomerContact, CustomerJobHistoryItem } from '../../../../modules/admin-finance/src/data/ports';
import { closeOutJob } from '../../../../modules/admin-finance/src/flows/close-out-job';
import { buildAdminFinancePorts } from '../lib/admin-finance-repos';
import { useSession } from '../lib/session';
import { photoMetaFrom } from '../lib/photo-asset-meta';

export type JobCloseOutRegionProps = {
  job: Job;
  role: Ctx['role'];
  onClosed: (job: Job) => void;
};

export function JobCloseOutRegion({ job, role, onClosed }: JobCloseOutRegionProps) {
  const session = useSession();
  const ports = useMemo(() => buildAdminFinancePorts(), []);
  const ctx = useMemo<Ctx>(() => ({ role, now: () => new Date().toISOString() }), [role]);
  const [photos, setPhotos] = useState<CloseOutPhoto[]>([]);
  const [notes, setNotes] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<JobTimelineItem[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [jobHistory, setJobHistory] = useState<CustomerJobHistoryItem[]>([]);
  const [techPayouts, setTechPayouts] = useState<{ techName: string; amount: number; basis: 'hourly' | 'commission' }[]>([]);
  const awaiting = awaitingCloseOut(job);

  useEffect(() => {
    const customerId = job.customerId;
    if (!customerId) {
      setContacts([]);
      setJobHistory([]);
      return undefined;
    }
    let cancelled = false;
    ports.customers
      .listContacts(customerId)
      .then((rows) => {
        if (!cancelled) {
          setContacts(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContacts([]);
        }
      });
    ports.customers
      .listJobHistory(customerId)
      .then((rows) => {
        if (!cancelled) {
          setJobHistory(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setJobHistory([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.customerId, ports.customers]);

  useEffect(() => {
    let cancelled = false;
    ports.jobTimeline
      .listForJob(job.id)
      .then((items) => {
        if (!cancelled) {
          setTimeline(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTimeline([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.id, ports.jobTimeline]);

  useEffect(() => {
    if (session.status !== 'authenticated') {
      setTechPayouts([]);
      return undefined;
    }
    let cancelled = false;
    ports.commissions
      .listForOrganization(session.organization.id)
      .then((rows) => {
        if (!cancelled) {
          setTechPayouts(
            rows
              .filter((row) => row.jobId === job.id)
              .map((row) => ({ techName: 'Technician', amount: row.amount / 100, basis: 'commission' as const })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTechPayouts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.id, ports.commissions, session]);

  useEffect(() => {
    if (!awaiting) {
      return undefined;
    }
    let cancelled = false;
    Promise.all([ports.closeOutPhotos.listForJob(job.id), ports.closeOutNotes.getForJob(job.id)]).then(
      ([loadedPhotos, loadedNotes]) => {
        if (!cancelled) {
          setPhotos(loadedPhotos);
          setNotes(loadedNotes);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [awaiting, job.id, ports.closeOutPhotos, ports.closeOutNotes]);

  // Library picker (not camera): works on web too. Lives here, not in the module.
  const handleAddPhoto = useCallback(async () => {
    setPhotoError(null);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPhotoError('Photo library permission was denied. Enable it in Settings to add photos.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset?.uri) {
        return;
      }
      const photo = await ports.closeOutPhotos.add(job.id, asset.uri, photoMetaFrom(asset));
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      setPhotoError(`Could not add photo: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [ports.closeOutPhotos, job.id]);

  const handleRemovePhoto = useCallback(
    (photoId: string) => {
      setPhotoError(null);
      void ports.closeOutPhotos
        .remove(photoId)
        .then(() => {
          setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
        })
        .catch((err: unknown) => {
          setPhotoError(`Could not remove photo: ${err instanceof Error ? err.message : String(err)}`);
        });
    },
    [ports.closeOutPhotos],
  );

  const handleChangeNotes = useCallback(
    (next: string) => {
      setNotes(next);
      void ports.closeOutNotes.upsert(job.id, next);
    },
    [ports.closeOutNotes, job.id],
  );

  const handleCloseOut = useCallback(
    (target: Job) => {
      if (session.status !== 'authenticated') {
        return;
      }
      setPhotoError(null);
      void (async () => {
        try {
          const policy = await ports.compensationPolicy.getForOrganization(session.organization.id);
          if (!policy) {
            setPhotoError('No compensation policy is configured for this organization. Ask an admin to set one up before closing out.');
            return;
          }
          const paymentRows = await ports.payments.listForJob(target.id);
          const settled = settledTotalCents(paymentRows) > 0;
          const result = await closeOutJob(target, {
            ctx: { ...ctx, hasPaymentRecord: () => settled },
            jobs: ports.jobs,
            calendarEvents: ports.calendarEvents,
            priceSheetRepository: ports.priceSheets,
            compensationPolicy: policy,
            rates: [],
            commissionRepository: ports.commissions,
            closedByUserId: session.profile.id,
          });
          if (result.ok) {
            onClosed(result.job);
          }
        } catch (err) {
          setPhotoError(`Could not close out: ${err instanceof Error ? err.message : String(err)}`);
        }
      })();
    },
    [session, ctx, ports, onClosed],
  );

  // After every hook: closeOutBlockers is empty for a non-awaiting job, so the
  // screen would otherwise offer an enabled close button.
  if (!awaiting) {
    return <EmptyState title="Close-out" message="Close-out opens once the job is completed." />;
  }

  return (
    <>
    {photoError ? <Text style={{ color: colors.danger, padding: spacing.sm }}>{photoError}</Text> : null}
    <CloseOutReviewScreen
      embedded
      job={job}
      ctx={ctx}
      photos={photos}
      notes={notes}
      onAddPhoto={() => void handleAddPhoto()}
      onRemovePhoto={handleRemovePhoto}
      onChangeNotes={handleChangeNotes}
      onCloseOut={handleCloseOut}
      hoursLogged={job.totalLaborSeconds > 0 ? job.totalLaborSeconds / 3600 : undefined}
      techPayouts={techPayouts}
      // No job-scoped contractor payout source exists yet.
      contractorPayouts={undefined}
      customerContacts={contacts.map((c) => ({ label: c.label ?? c.kind, value: c.value }))}
      jobHistory={jobHistory}
      timeline={timeline}
    />
    </>
  );
}

export default JobCloseOutRegion;
