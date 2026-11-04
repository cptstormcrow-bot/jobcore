// Background fill of saved data. After each finished sync pass while online, this loads
// what the role's screens show so they open in airplane mode even if never visited:
// owners and admins get #0065 fine print and #0088 / #0087 team timesheets and clock
// hours; every role gets its own #0084 / #0085 hours, #0057 price sheet rates and its
// assigned open jobs for #0054 Overview and #0027 Job Detail. Reads only, never writes.
import { supabase } from './supabase';
import { createPayrollRepos } from './payroll-repos';
import { buildPayrollAdminMembers } from './payroll-admin-repos';
import { createPriceSheetRatesRepository, createPriceSheetRepository, loadFinePrintTemplate } from './admin-finance-repos';
import {
  createChecklistRepository,
  createEstimateRepository,
  createJobInvestigationRepository,
  createJobNoteRepository,
  createJobPhotoRepository,
  createJobPlanTaskRepository,
  createTechJobRepository,
} from './field-tech-repos';
import { makeWarmGate, openJobIds, warmPlanFor, warmRanges } from './warm-cache-plan';

export interface WarmSession {
  orgId: string;
  userId: string;
  role: string;
}

const gate = makeWarmGate();

async function warmPayroll(s: WarmSession, admin: boolean): Promise<void> {
  const session = { orgId: s.orgId, userId: s.userId };
  const self = createPayrollRepos(supabase, session);
  const settings = await self.getSettings();
  const jobs: Promise<unknown>[] = [];
  const team = admin ? buildPayrollAdminMembers(supabase, session) : null;
  for (const range of warmRanges(new Date(), settings.payWeek.weekStartDow)) {
    jobs.push(self.listEntries(range));
    if (team) jobs.push(team.listTeamEntries(range), team.listSystemHours(range));
  }
  await Promise.allSettled(jobs);
}

async function warmRates(orgId: string): Promise<void> {
  const sheet = await createPriceSheetRepository().getActive(orgId);
  if (sheet) await createPriceSheetRatesRepository().list(sheet.id);
}

async function warmAssignedJobs(userId: string): Promise<void> {
  const techJobs = createTechJobRepository();
  const ids = openJobIds(await techJobs.listAssignedToTech(userId));
  const checklists = createChecklistRepository();
  const photos = createJobPhotoRepository();
  const notes = createJobNoteRepository();
  const estimates = createEstimateRepository();
  const investigations = createJobInvestigationRepository();
  const plan = createJobPlanTaskRepository();
  // One job at a time so a weak signal is not flooded; each job's reads run together.
  for (const jobId of ids) {
    await Promise.allSettled([
      techJobs.getById(jobId, userId),
      notes.listForJob(jobId),
      photos.listForJob(jobId),
      checklists.getInstanceForJob(jobId, 'start'),
      checklists.getInstanceForJob(jobId, 'completion'),
      estimates.getForJob(jobId),
      investigations.getForJob(jobId),
      plan.listForJob(jobId),
    ]);
  }
}

export async function warmSavedData(s: WarmSession): Promise<void> {
  const plan = warmPlanFor(s.role);
  if (!(plan.adminPayroll || plan.ownTime || plan.rates || plan.assignedJobs) || !gate()) return;
  const jobs: Promise<unknown>[] = [];
  if (plan.adminPayroll) jobs.push(loadFinePrintTemplate(s.orgId));
  if (plan.adminPayroll || plan.ownTime) jobs.push(warmPayroll(s, plan.adminPayroll));
  if (plan.rates) jobs.push(warmRates(s.orgId));
  if (plan.assignedJobs) jobs.push(warmAssignedJobs(s.userId));
  await Promise.allSettled(jobs);
}
