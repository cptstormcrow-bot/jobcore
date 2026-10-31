import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { Ctx, Job } from '@jobcore/core';
import { useRouter } from 'expo-router';
import { EmptyState, PayrollButton, colors, spacing } from '@jobcore/ui';
import { CloseOutReviewScreen } from '../../../../modules/admin-finance/src/screens/CloseOutReviewScreen';
import type { CloseOutPhoto } from '../../../../modules/admin-finance/src/screens/CloseOutReviewScreen';
import { awaitingCloseOut } from '../../../../modules/admin-finance/src/domain/closeout';
import { settledTotalCents, invoiceTotalCents, balanceCents } from '../../../../modules/admin-finance/src/domain/payments';
import { computeTotals } from '../../../../modules/admin-finance/src/domain/estimate-layout';
import type { JobTimelineItem } from '../../../../modules/admin-finance/src/domain/job-timeline';
import { computeJobPayLines, centsToDollars, postableJobPayLines } from '../../../../modules/admin-finance/src/money/job-pay';
import type { JobPayTech } from '../../../../modules/admin-finance/src/money/job-pay';
import { closeOutJob } from '../../../../modules/admin-finance/src/flows/close-out-job';
import { buildAdminFinancePorts } from '../lib/admin-finance-repos';
import { useSession } from '../lib/session';
import { photoMetaFrom } from '../lib/photo-asset-meta';
import { PhotoNoteField } from './PhotoNoteField';

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
  const router = useRouter();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<JobTimelineItem[]>([]);
  const [payment, setPayment] = useState<{ paid: boolean; amountCents: number } | null>(null);
  type TechPayoutLine = { techName: string; amount: number; basis: 'hourly' | 'commission' | 'prem-bonus' | 'dev-flat' | 'none'; note?: string; techId?: string; status?: 'pending' | 'included' };
  type ContractorPayoutLine = { contractorName: string; amount: number; basis?: TechPayoutLine['basis']; note?: string; techId?: string };
  const [techPayouts, setTechPayouts] = useState<TechPayoutLine[]>([]);
  const [contractorPayouts, setContractorPayouts] = useState<ContractorPayoutLine[]>([]);
  const [contractorStored, setContractorStored] = useState(false);
  const awaiting = awaitingCloseOut(job);
  const isClosedJob = job.status === 'closed';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [est, rows, items] = await Promise.all([
          ports.estimates.getForJob(job.id),
          ports.payments.listForJob(job.id),
          ports.estimates.listLineItems(job.id),
        ]);
        if (cancelled) return;
        if (!est) {
          setPayment(null);
          return;
        }
        const invoice = items.length > 0 ? Math.round(computeTotals(items, []).total * 100) : invoiceTotalCents(est);
        const balance = balanceCents(invoice, rows);
        const paid = (invoice > 0 && balance <= 0) || job.status === 'paid' || job.status === 'closed';
        setPayment({ paid, amountCents: paid ? settledTotalCents(rows) : balance });
      } catch {
        if (!cancelled) setPayment(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, job.status, ports.estimates, ports.payments]);

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
      setContractorPayouts([]);
      return undefined;
    }
    let cancelled = false;
    const orgId = session.organization.id;
    const isClosed = job.status === 'closed';
    void (async () => {
      try {
        const [policy, assignments, hours, profiles, estimate, commissions, stored, storedLines] = await Promise.all([
          ports.compensationPolicy.getForOrganization(orgId),
          ports.jobAssignments.listForJob(job.id),
          ports.timeEntries.hoursByTechForJob(job.id),
          ports.employees.listEmployees(orgId),
          ports.estimates.getForJob(job.id),
          isClosed ? ports.commissions.listForOrganization(orgId) : Promise.resolve([]),
          isClosed ? ports.contractorPayouts.listForJob(job.id) : Promise.resolve([]),
          isClosed ? ports.jobPayoutLines.listForJob(job.id) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const byId = new Map(profiles.map((p) => [p.id, p]));
        const nameOf = (id: string) => byId.get(id)?.fullName || 'Technician';
        const commissionRows = commissions.filter((row) => row.jobId === job.id);
        const hasStored = isClosed && stored.length > 0;
        setContractorStored(hasStored);
        let employeeLines: TechPayoutLine[] = [];
        let contractorLines: ContractorPayoutLine[] = [];
        if (isClosed && storedLines.length > 0) {
          // What close-out actually posted (job_payout_lines): shown as stored, never recomputed.
          const basisOf = { dev_flat: 'dev-flat', prem_bonus: 'prem-bonus', commission: 'commission' } as const;
          employeeLines = storedLines.map((row) => ({
            techName: nameOf(row.techId),
            amount: centsToDollars(row.amountCents),
            basis: basisOf[row.basis],
            techId: row.techId,
            status: row.status,
          }));
        } else if (isClosed && commissionRows.length > 0) {
          employeeLines = commissionRows.map((row) => ({
            techName: nameOf((row as { userId?: string }).userId ?? ''),
            amount: row.amount / 100,
            basis: 'commission' as const,
          }));
        }
        if (hasStored) {
          contractorLines = stored.map((row) => ({
            contractorName: nameOf(row.techId),
            amount: centsToDollars(row.amountCents),
            techId: row.techId,
          }));
        }
        if (policy && (!isClosed || !hasStored)) {
          const techIds = Array.from(new Set(assignments.map((a) => a.techId)));
          const techs: JobPayTech[] = techIds.map((id) => {
            const p = byId.get(id);
            return {
              techId: id,
              name: p?.fullName || 'Technician',
              workerType: p?.workerType ?? 'employee',
              techRole: p?.techRole ?? null,
              devPayMode: p?.devPayMode ?? null,
              hourlyRateCents: p?.defaultHourlyRateCents ?? null,
              hoursWorked: hours[id] ?? 0,
              commissionEnabled: p?.commissionEnabled === true,
              commissionPercent: p?.commissionPercent ?? null,
            };
          });
          const lines = computeJobPayLines({
            jobTotalCents: Math.round((estimate?.totalCost ?? 0) * 100),
            policy: {
              hourlyRateCents: policy.hourlyRate ?? 0,
              premBonusFlatCents: policy.premBonusFlat ?? 0,
              premBonusPercent: policy.premBonusPercent ?? 0,
              devDefaultCommissionPercent: policy.devDefaultCommissionPercent ?? 0,
            },
            techs,
            laborTotalCents: Math.round((estimate?.laborCost ?? 0) * 100),
          });
          if (!isClosed) {
            employeeLines = lines
              .filter((l) => l.workerType === 'employee')
              .map((l) => ({ techName: l.name, amount: centsToDollars(l.amountCents), basis: l.basis, note: l.note, techId: l.techId }));
          }
          if (!hasStored) {
            contractorLines = lines
              .filter((l) => l.workerType === 'contractor')
              .map((l) => ({ contractorName: l.name, amount: centsToDollars(l.amountCents), basis: l.basis, note: l.note, techId: l.techId }));
          }
        }
        setTechPayouts(employeeLines);
        setContractorPayouts(contractorLines);
      } catch {
        if (!cancelled) {
          setTechPayouts([]);
          setContractorPayouts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, job.status, ports, session]);

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
          const sheet = await ports.priceSheets.getActive(session.organization.id);
          const rates = sheet ? await ports.priceSheetRates.list(sheet.id) : [];
          const result = await closeOutJob(target, {
            ctx: { ...ctx, hasPaymentRecord: () => settled },
            jobs: ports.jobs,
            calendarEvents: ports.calendarEvents,
            priceSheetRepository: ports.priceSheets,
            compensationPolicy: policy,
            rates,
            commissionRepository: ports.commissions,
            closedByUserId: session.profile.id,
          });
          if (!result.ok) {
            setPhotoError(`Could not close out: ${result.reason}`);
            return;
          }
          const payRows = contractorPayouts
            .filter((c) => c.techId && Math.round(c.amount * 100) > 0)
            .map((c) => ({ techId: c.techId as string, amountCents: Math.round(c.amount * 100) }));
          const failures: string[] = [];
          if (payRows.length > 0 && !contractorStored) {
            try {
              await ports.contractorPayouts.createForJob(target.id, payRows);
            } catch (err) {
              failures.push(`Job closed, but contractor payouts could not be saved: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          const employeePostable = postableJobPayLines(
            techPayouts
              .filter((t) => t.techId && (t.basis === 'prem-bonus' || t.basis === 'commission'))
              .map((t) => ({
                techId: t.techId as string,
                name: t.techName,
                workerType: 'employee' as const,
                techRole: null,
                basis: t.basis as 'prem-bonus' | 'commission',
                amountCents: Math.round(t.amount * 100),
                note: t.note ?? '',
              })),
          );
          if (employeePostable.length > 0) {
            try {
              await ports.jobPayoutLines.postForJob(target.id, employeePostable);
            } catch {
              failures.push('Job closed, but employee pay lines were not saved.');
            }
          }
          if (failures.length > 0) setPhotoError(failures.join(' '));
          onClosed(result.job);
        } catch (err) {
          setPhotoError(`Could not close out: ${err instanceof Error ? err.message : String(err)}`);
        }
      })();
    },
    [session, ctx, ports, onClosed, contractorPayouts, contractorStored, techPayouts],
  );

  // After every hook: closeOutBlockers is empty for a non-awaiting job, so the
  // screen would otherwise offer an enabled close button.
  if (!awaiting && !isClosedJob) {
    return <EmptyState title="Close-out" message="Close-out opens once the job is completed." />;
  }

  return (
    <>
    {photoError ? <Text style={{ color: colors.danger, padding: spacing.sm }}>{photoError}</Text> : null}
    {photoError?.startsWith('No compensation policy') ? <PayrollButton label="Compensation Policy" onPress={() => router.push(`/m/admin-finance?view=compensationPolicy&ts=${Date.now()}` as never)} /> : null}
    <CloseOutReviewScreen
      embedded
      readOnly={isClosedJob}
      job={job}
      ctx={ctx}
      photos={photos}
      renderPhotoExtra={(p) => <PhotoNoteField photo={{ id: p.id, uri: p.uri, storagePath: p.storagePath }} />}
      notes={notes}
      onAddPhoto={() => void handleAddPhoto()}
      onRemovePhoto={handleRemovePhoto}
      onChangeNotes={handleChangeNotes}
      onCloseOut={handleCloseOut}
      hoursLogged={job.totalLaborSeconds > 0 ? job.totalLaborSeconds / 3600 : undefined}
      techPayouts={techPayouts}
      contractorPayouts={contractorPayouts}
      payment={payment}
      timeline={timeline}
    />
    </>
  );
}

export default JobCloseOutRegion;
