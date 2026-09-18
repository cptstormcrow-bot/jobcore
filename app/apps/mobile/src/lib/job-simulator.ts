import type { Job, Profile } from '@jobcore/core';
import { DEFAULT_HOURLY_RATE_CENTS } from '@jobcore/core';
import {
  createJobRepository,
  createCustomerRepository,
  createEmployeeRepository,
  createJobAssignmentRepository,
  createCalendarEventRepository,
  createPriceSheetRepository,
  createEstimateRepository,
  createPaymentsRepository,
} from './admin-finance-repos';
import { qualifyLead } from '../../../../modules/admin-finance/src/flows/qualify-lead';
import { approveEstimate } from '../../../../modules/admin-finance/src/flows/approve-estimate';
import { assignJob } from '../../../../modules/admin-finance/src/flows/assign-job';
import { transitionJob } from '../../../../modules/admin-finance/src/domain/transition';
import { rollUpPeriodPay, type PayrollTech, type PayPeriod } from '../../../../modules/admin-finance/src/money/rollup';
import type { Lead } from '../../../../modules/admin-finance/src/domain/lead';
import type { CompensationPolicy, PriceSheetRate, TimeSegment } from '../../../../modules/admin-finance/src/money/types';

export type DryRunStage =
  | 'create'
  | 'assign'
  | 'contact'
  | 'arrive'
  | 'complete'
  | 'approve_estimate'
  | 'assign_installer'
  | 'paid'
  | 'payroll_rollup';

export type DryRunStageResult = {
  stage: DryRunStage;
  ok: boolean;
  detail: string;
  jobStatusAfter?: string;
};

export type DryRunReport = {
  jobId: string | null;
  startedAt: string;
  finishedAt: string;
  stages: DryRunStageResult[];
  cleanedUp: boolean;
};

export async function runJobSimulator(organizationId: string, actorProfile: Profile): Promise<DryRunReport> {
  const startedAt = new Date().toISOString();
  const stages: DryRunStageResult[] = [];
  let job: Job | null = null;

  // actorProfile resolution: caller passes actorProfile, but per spec we
  // must independently confirm a test employee profile exists before
  // proceeding with any stage.
  const employees = await createEmployeeRepository().listEmployees(organizationId);
  const testTech = employees.find((e) => e.isTest === true);
  if (!testTech) {
    stages.push({
      stage: 'create',
      ok: false,
      detail: 'No test employee profile found; provision one manually before running the Dry Run.',
    });
    return {
      jobId: null,
      startedAt,
      finishedAt: new Date().toISOString(),
      stages,
      cleanedUp: false,
    };
  }

  // --- create ---
  try {
    const existingJobs = await createJobRepository().listForOrganization(organizationId);
    if (existingJobs.length > 0) {
      job = existingJobs[0];
      stages.push({
        stage: 'create',
        ok: true,
        detail: `Using existing job ${job.id} (skipped synthetic lead creation).`,
        jobStatusAfter: job.status,
      });
    } else {
    const priceSheet = await createPriceSheetRepository().getActive(organizationId);
    if (!priceSheet) {
      stages.push({ stage: 'create', ok: false, detail: 'No active price sheet found for organization.' });
    } else {
      const lead: Lead = {
        id: `sim-${Date.now()}`,
        organizationId,
        sourceForm: 'job-simulator',
        name: 'Job Simulator Dry Run',
        phone: null,
        email: null,
        service: null,
        preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        preferredTime: '09:00',
        address: '123 Simulator Way, Carlsbad, CA',
        projectDetails: 'Synthetic dry-run job created by job-simulator.ts',
        source: 'job-simulator',
        payer: 'customer',
        attachTiming: 'now',
        qualifiedAt: null,
        convertedJobId: null,
        createdAt: new Date().toISOString(),
      } as unknown as Lead;

      const result = await qualifyLead(lead, null, {
        jobs: createJobRepository(),
        leads: {
          markQualified: async () => undefined,
        } as any,
        customers: createCustomerRepository(),
        calendarEvents: createCalendarEventRepository(),
        ctx: { role: actorProfile.role, now: () => new Date().toISOString() },
      });

      if (!result.ok) {
        stages.push({ stage: 'create', ok: false, detail: result.reason });
      } else {
        job = result.job;
        await createJobRepository().markBeta(job.id, true);
        stages.push({
          stage: 'create',
          ok: true,
          detail: `Created job ${job.id} via qualifyLead and marked isBeta=true.`,
          jobStatusAfter: job.status,
        });
      }
    }
    }
  } catch (err) {
    stages.push({ stage: 'create', ok: false, detail: err instanceof Error ? err.message : 'create failed' });
  }

  // --- assign ---
  try {
    if (!job) {
      stages.push({ stage: 'assign', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else {
      // Mirrors handleAssign = estimate?.status === 'approved' ? handleAssignInstaller : handleAssignInvestigator.
      // No estimate exists yet at this point in the flow, so this replicates
      // the investigator branch (job_assignments row, kind: 'investigator').
      await createJobAssignmentRepository().create(organizationId, {
        jobId: job.id,
        techId: testTech.id,
        assignedAt: new Date().toISOString(),
        kind: 'investigator',
      });
      stages.push({
        stage: 'assign',
        ok: true,
        detail: `Assigned investigator ${testTech.id} to job ${job.id} (no approved estimate yet).`,
        jobStatusAfter: job.status,
      });
    }
  } catch (err) {
    stages.push({ stage: 'assign', ok: false, detail: err instanceof Error ? err.message : 'assign failed' });
  }

  // --- contact ---
  try {
    if (!job) {
      stages.push({ stage: 'contact', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else {
      // handleContact only opens a tel: URL when customer.phone is present;
      // it performs no repository write. Nothing to replicate server-side.
      stages.push({
        stage: 'contact',
        ok: true,
        detail: 'handleContact performs no repository write (Linking.openURL only); nothing to simulate.',
        jobStatusAfter: job.status,
      });
    }
  } catch (err) {
    stages.push({ stage: 'contact', ok: false, detail: err instanceof Error ? err.message : 'contact failed' });
  }

  // --- approve_estimate ---
  let approvedTotalCost = 0;
  try {
    if (!job) {
      stages.push({ stage: 'approve_estimate', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else {
      const estimates = createEstimateRepository();
      const synthetic = await estimates.upsertForJob(job.id, {
        status: 'submitted',
        summary: 'Job Simulator synthetic estimate',
        materialsCost: 5000,
        laborCost: 10000,
        otherCost: 0,
        totalCost: 15000,
      });
      approvedTotalCost = synthetic.totalCost;
      const result = await approveEstimate(synthetic, 'approved', {
        estimates,
        ctx: { role: actorProfile.role, now: () => new Date().toISOString() },
        now: () => new Date().toISOString(),
      });
      if (!result.ok) {
        stages.push({ stage: 'approve_estimate', ok: false, detail: result.reason });
      } else {
        approvedTotalCost = result.estimate.totalCost;
        stages.push({
          stage: 'approve_estimate',
          ok: true,
          detail: `Estimate ${job.id} approved with totalCost=${approvedTotalCost}.`,
          jobStatusAfter: job.status,
        });
      }
    }
  } catch (err) {
    stages.push({ stage: 'approve_estimate', ok: false, detail: err instanceof Error ? err.message : 'approve_estimate failed' });
  }

  // --- assign_installer ---
  try {
    if (!job) {
      stages.push({ stage: 'assign_installer', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else if (!approvedTotalCost) {
      stages.push({
        stage: 'assign_installer',
        ok: false,
        detail: 'approve_estimate did not succeed; skipping installer assignment.',
        jobStatusAfter: job.status,
      });
    } else {
      // Mirrors handleAssign = estimate?.status === 'approved' ? handleAssignInstaller : handleAssignInvestigator.
      // Estimate is now approved, so this replicates the installer branch
      // (handleAssignInstaller in [jobId].tsx), which calls assignJob().
      const result = await assignJob(job, testTech.id, {
        jobs: createJobRepository(),
        assignments: createJobAssignmentRepository(),
        calendarEvents: createCalendarEventRepository(),
        ctx: { role: actorProfile.role, now: () => new Date().toISOString() },
      });
      if (!result.ok) {
        stages.push({ stage: 'assign_installer', ok: false, detail: result.reason, jobStatusAfter: job.status });
      } else {
        job = result.job;
        stages.push({
          stage: 'assign_installer',
          ok: true,
          detail: `Assigned installer ${testTech.id} to job ${job.id} via assignJob() (estimate approved).`,
          jobStatusAfter: job.status,
        });
      }
    }
  } catch (err) {
    stages.push({ stage: 'assign_installer', ok: false, detail: err instanceof Error ? err.message : 'assign_installer failed' });
  }

  // --- arrive ---
  try {
    if (!job) {
      stages.push({ stage: 'arrive', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else {
      const jobs = createJobRepository();
      let detail = '';
      const afterEnRoute = await jobs.patchLifecycle(job.id, { enRouteAt: new Date().toISOString() });
      await jobs.updateStatus(job.id, 'in_progress');
      detail += 'Resume/normal Arrive path: patched enRouteAt, updateStatus(in_progress). ';
      const afterInProgress = await jobs.patchLifecycle(afterEnRoute.id, { inProgressAt: new Date().toISOString() });
      await jobs.updateStatus(job.id, 'in_progress');
      detail += 'Second Arrive path: patched inProgressAt, updateStatus(in_progress). ';
      // Stop-for-reason (lunch) sub-check: production [jobId].tsx's Arrive
      // flow has no dedicated "stop for lunch" repository write of its own
      // (reason-coded stop/resume lives in the time-segments migrations,
      // not in handleArrive) -- recorded here as a no-op sub-check.
      detail += 'Stop-for-reason (lunch) sub-check: no dedicated handleArrive write path found; recorded as no-op.';
      job = afterInProgress;
      stages.push({ stage: 'arrive', ok: true, detail, jobStatusAfter: job.status });
    }
  } catch (err) {
    stages.push({ stage: 'arrive', ok: false, detail: err instanceof Error ? err.message : 'arrive failed' });
  }

  // --- complete ---
  try {
    if (!job) {
      stages.push({ stage: 'complete', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else {
      const jobs = createJobRepository();
      const updated = await jobs.patchLifecycle(job.id, { completedAt: new Date().toISOString() });
      await jobs.updateStatus(job.id, 'completed');
      job = { ...updated, status: 'completed' as Job['status'] };
      stages.push({
        stage: 'complete',
        ok: true,
        detail: `Patched completedAt and updateStatus(completed) on job ${job.id}.`,
        jobStatusAfter: job.status,
      });
    }
  } catch (err) {
    stages.push({ stage: 'complete', ok: false, detail: err instanceof Error ? err.message : 'complete failed' });
  }

  // --- paid ---
  try {
    if (!job) {
      stages.push({ stage: 'paid', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else {
      const payments = createPaymentsRepository();
      const existing = await payments.listForJob(job.id);
      const SETTLED_PAYMENT_STATUSES = ['settled', 'paid'];
      const settled = existing.some((p) => SETTLED_PAYMENT_STATUSES.includes(p.status));
      const amount = approvedTotalCost || 0;
      if (!settled) {
        await payments.recordManualPayment(job.organizationId, job.id, amount);
      }
      const updated = await transitionJob(job, 'paid', {
        role: actorProfile.role,
        now: () => new Date().toISOString(),
        hasPaymentRecord: () => true,
      });
      await createJobRepository().updateStatus(job.id, 'paid');
      job = { ...updated, status: 'paid' as Job['status'] };
      stages.push({
        stage: 'paid',
        ok: true,
        detail: `PaymentSimulationNotice auto-acknowledged (no UI in this context); recordManualPayment(${amount}) + transitionJob('paid') + updateStatus('paid') on job ${job.id}.`,
        jobStatusAfter: job.status,
      });
    }
  } catch (err) {
    stages.push({ stage: 'paid', ok: false, detail: err instanceof Error ? err.message : 'paid failed' });
  }

  // --- payroll_rollup ---
  try {
    if (!job) {
      stages.push({ stage: 'payroll_rollup', ok: false, detail: 'No job available; create stage did not succeed.' });
    } else {
      const priceSheet = await createPriceSheetRepository().getActive(organizationId);
      if (!priceSheet) {
        stages.push({ stage: 'payroll_rollup', ok: false, detail: 'No active price sheet found for organization.' });
      } else {
        const rates: PriceSheetRate[] = [];
        const jobRepo = createJobRepository();
        const freshJob = (await jobRepo.getById(job.id)) ?? job;

        const tech: PayrollTech = {
          ...(testTech as unknown as Profile),
          paidTravel: false,
        };
        const period: PayPeriod = { start: startedAt, end: new Date().toISOString() };
        const policy: CompensationPolicy = {
          id: 'sim-policy',
          organizationId,
          commissionBasisPercent: 0,
          hourlyRate: testTech.defaultHourlyRateCents ?? DEFAULT_HOURLY_RATE_CENTS,
        };

        const timeSegments: TimeSegment[] = [
          {
            id: `sim-segment-${freshJob.id}`,
            organizationId,
            techId: testTech.id,
            jobId: freshJob.id,
            reasonCode: 'job_labor',
            startedAt,
            endedAt: new Date(
              new Date(startedAt).getTime() + freshJob.totalLaborSeconds * 1000,
            ).toISOString(),
            source: 'manual',
            createdAt: new Date().toISOString(),
          },
        ];

        const rollupResult = rollUpPeriodPay(
          tech,
          period,
          [
            {
              job: freshJob,
              priceSheet,
              rates,
              hours: { segments: timeSegments },
              reimbursementCents: 0,
            },
          ],
          policy,
        );

        stages.push({
          stage: 'payroll_rollup',
          ok: rollupResult.ok,
          detail: rollupResult.ok
            ? `rollUpPeriodPay succeeded: total=${rollupResult.value.total} (hours=${rollupResult.value.hoursAmount}, commission=${rollupResult.value.commissionAmount}, bonus=${rollupResult.value.bonusAmount}, reimbursement=${rollupResult.value.reimbursementAmount}).`
            : rollupResult.reason,
          jobStatusAfter: freshJob.status,
        });
      }
    }
  } catch (err) {
    stages.push({ stage: 'payroll_rollup', ok: false, detail: err instanceof Error ? err.message : 'payroll_rollup failed' });
  }

  return {
    jobId: job ? job.id : null,
    startedAt,
    finishedAt: new Date().toISOString(),
    stages,
    cleanedUp: false,
  };
}
