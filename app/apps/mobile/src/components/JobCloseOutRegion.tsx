import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import type { Ctx, Job } from '@jobcore/core';
import { EmptyState } from '@jobcore/ui';
import { CloseOutReviewScreen } from '../../../../modules/admin-finance/src/screens/CloseOutReviewScreen';
import type { CloseOutPhoto } from '../../../../modules/admin-finance/src/screens/CloseOutReviewScreen';
import { awaitingCloseOut } from '../../../../modules/admin-finance/src/domain/closeout';
import { closeOutJob } from '../../../../modules/admin-finance/src/flows/close-out-job';
import { buildAdminFinancePorts } from '../lib/admin-finance-repos';
import { useSession } from '../lib/session';

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
  const awaiting = awaitingCloseOut(job);

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
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      const uri = result.canceled ? undefined : result.assets[0]?.uri;
      if (!uri) {
        return;
      }
      const photo = await ports.closeOutPhotos.add(job.id, uri);
      setPhotos((prev) => [...prev, photo]);
    } catch {
      // Errors are not surfaced, matching the original close-out handlers.
    }
  }, [ports.closeOutPhotos, job.id]);

  const handleRemovePhoto = useCallback(
    (photoId: string) => {
      void ports.closeOutPhotos.remove(photoId).then(() => {
        setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
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
      void closeOutJob(target, {
        ctx,
        jobs: ports.jobs,
        calendarEvents: ports.calendarEvents,
        priceSheetRepository: ports.priceSheets,
        // TODO(forward contract): no per-actor CompensationPolicy repository/field
        // exists yet on ModuleSession or ModulePorts — placeholder zero-policy
        // used until one is wired up.
        compensationPolicy: {
          id: '',
          organizationId: session.organization.id,
          commissionBasisPercent: 0,
          hourlyRate: 0,
        },
        rates: [],
        commissionRepository: ports.commissions,
        closedByUserId: session.profile.id,
      }).then((result) => {
        if (result.ok) {
          onClosed(result.job);
        }
      });
    },
    [session, ctx, ports, onClosed],
  );

  // After every hook: closeOutBlockers is empty for a non-awaiting job, so the
  // screen would otherwise offer an enabled close button.
  if (!awaiting) {
    return <EmptyState title="Close-out" message="Close-out opens once the job is completed." />;
  }

  return (
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
      hoursLogged={undefined}
      techPayouts={undefined}
      contractorPayouts={undefined}
      customerContacts={undefined}
    />
  );
}

export default JobCloseOutRegion;
