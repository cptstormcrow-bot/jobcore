import { supabase } from './supabase';
import { createPayrollRepos } from './payroll-repos';
import { buildPayrollAdminMembers } from './payroll-admin-repos';
import { loadFinePrintTemplate } from './admin-finance-repos';
import { WARM_ROLES, makeWarmGate, warmRanges } from './warm-cache-plan';

/* ------------------------------------------------------------------ *
 * Fills saved data that only a screen visit would otherwise fill, so
 * these work offline without opening them online first:
 *   #0065 Settings estimate fine print,
 *   #0088 Payroll (admin) timesheets and #0087 Payroll Run clock hours
 *   (this pay week and last).
 * Runs after a sync pass while online, at most once per WARM_EVERY_MS.
 * Every read goes through the normal saved-data path; failures are ignored.
 * ------------------------------------------------------------------ */

export interface WarmSession {
  orgId: string;
  userId: string;
  role: string;
}

const gate = makeWarmGate();

export async function warmSavedData(s: WarmSession): Promise<void> {
  if (!WARM_ROLES.includes(s.role) || !gate()) return;
  const session = { orgId: s.orgId, userId: s.userId };
  const payroll = { ...createPayrollRepos(supabase, session), ...buildPayrollAdminMembers(supabase, session) };
  const jobs: Promise<unknown>[] = [loadFinePrintTemplate(s.orgId)];
  try {
    const settings = await payroll.getSettings();
    for (const range of warmRanges(new Date(), settings.payWeek.weekStartDow)) {
      jobs.push(payroll.listTeamEntries(range), payroll.listSystemHours(range));
    }
  } catch {
    // no pay settings saved or reachable: fine print still fills
  }
  await Promise.allSettled(jobs);
}
