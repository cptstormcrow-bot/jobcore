import type { JobStatus } from '@jobcore/core';
import { HELP_CARDS } from './help-content';

export type WalkthroughStepId =
  | 'create'
  | 'assign'
  | 'contact'
  | 'approve_estimate'
  | 'arrive'
  | 'complete'
  | 'paid'
  | 'payroll_rollup'
  | 'af_overview'
  | 'af_leads'
  | 'af_jobs'
  | 'af_assignments'
  | 'af_price_sheets'
  | 'af_payments'
  | 'af_review'
  | 'af_time_off'
  | 'af_calendar'
  | 'af_reports'
  | 'af_employees'
  | 'job_closeout'
  | 'job_reschedule'
  | 'job_inactive'
  | 'job_create'
  | 'jobs_list'
  | 'test_jobs'
  | 'ft_overview'
  | 'ft_jobs'
  | 'ft_time_off'
  | 'ft_prems'
  | 'ft_reviews'
  | 'sm_overview'
  | 'sm_pitch'
  | 'sm_composer'
  | 'sm_reporting'
  | 'sm_callbacks'
  | 'sm_reviews'
  | 'calendar'
  | 'account'
  | 'profile'
  | 'settings'
  | 'help_general';

export type ScreenKey =
  | 'job-detail' | 'jobs-list' | 'admin-finance' | 'qualify-lead' | 'job-create' | 'calendar' | 'account' | 'profile' | 'settings' | 'test-jobs'
  | 'af-overview' | 'af-leads' | 'af-jobs' | 'af-assignments' | 'af-price-sheets' | 'af-payments' | 'af-review' | 'af-time-off' | 'af-calendar' | 'af-reports' | 'af-employees'
  | 'ft-overview' | 'ft-jobs' | 'ft-time-off' | 'ft-prems' | 'ft-reviews' | 'ft-job-detail'
  | 'sm-overview' | 'sm-pitch' | 'sm-composer' | 'sm-reporting' | 'sm-callbacks' | 'sm-reviews';

export interface WalkthroughStepContext {
  screens: ScreenKey[];
  jobStatuses?: JobStatus[];
}

export interface WalkthroughStep {
  id: WalkthroughStepId;
  kind: 'action' | 'info';
  title: string;
  body: string;
  whereScreen?: string;
  whereHint?: string;
  context?: WalkthroughStepContext;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'create',
    kind: 'action',
    title: 'Create the Lead',
    body: 'Every job starts as a lead. Open the lead from the Leads list, choose its Source, Payer, Attach timing and Service Area, then qualify it into a real job.',
    whereScreen: 'Qualify Lead',
    whereHint: 'In Admin & Finance, tap "Leads", open the lead, then on Qualify Lead pick a service area and tap "Qualify" to turn it into a job.',
    context: { screens: ['qualify-lead', 'af-leads'] },
  },
  {
    id: 'assign',
    kind: 'action',
    title: 'Assign Your Techs',
    body: 'Pick a Prem Tech for the pre-estimate visit and a Service Tech for the actual work. Assigning does not change the job status.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, tap Prem Tech or Service Tech in the header to pick someone, or open the job menu and choose "Assign" (admins only).',
    context: { screens: ['job-detail', 'ft-job-detail'], jobStatuses: ['new', 'qualified'] },
  },
  {
    id: 'contact',
    kind: 'action',
    title: 'Contact the Customer',
    body: 'Before heading out, reach the customer to confirm the appointment, and log that contact was made.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, open the job menu and choose "Contact" to call the customer and record the attempt.',
    context: { screens: ['job-detail', 'ft-job-detail'], jobStatuses: ['scheduled', 'assigned'] },
  },
  {
    id: 'approve_estimate',
    kind: 'action',
    title: 'Approve the Estimate',
    body: 'The customer accepted, so the estimate needs to be approved to lock in price and scope before work starts.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, open the job menu, choose "Estimate", and answer "Yes" on the approval prompt.',
    context: { screens: ['job-detail', 'ft-job-detail'], jobStatuses: ['accepted'] },
  },
  {
    id: 'arrive',
    kind: 'action',
    title: 'Arrive On-Site',
    body: 'When the installer gets to the customer, mark arrival so the clock starts and the office can see progress. Arrive is greyed out until a Service Tech is assigned.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, open the job menu and choose "Start". If it is greyed out, set a Service Tech in the header first.',
    context: { screens: ['job-detail', 'ft-job-detail'], jobStatuses: ['en_route'] },
  },
  {
    id: 'complete',
    kind: 'action',
    title: 'Mark Job Complete',
    body: 'When the work is finished, mark the job complete so the office knows it is ready to close out and bill.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, open the job menu and choose "Complete".',
    context: { screens: ['job-detail', 'ft-job-detail'], jobStatuses: ['in_progress'] },
  },
  {
    id: 'paid',
    kind: 'action',
    title: 'Mark Job Paid',
    body: 'After the customer pays, an owner or admin marks the job paid so it stops showing as outstanding. Techs do not see this item.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, open the job menu, choose "Paid", and confirm "Yes" once payment is collected.',
    context: { screens: ['job-detail', 'ft-job-detail'], jobStatuses: ['completed'] },
  },
  {
    id: 'payroll_rollup',
    kind: 'info',
    title: 'Payroll Totals',
    body: 'Payroll totals appear here once pay runs are set up',
    context: { screens: ['af-payments'] },
  },
];

function matchesHelpContext(step: WalkthroughStep, screenKey: ScreenKey, jobStatus?: JobStatus): boolean {
  if (!step.context) return false;
  if (!step.context.screens.includes(screenKey)) return false;
  if (step.context.jobStatuses && (!jobStatus || !step.context.jobStatuses.includes(jobStatus))) return false;
  return true;
}

export function getHelpStep(screenKey: ScreenKey, jobStatus?: JobStatus): WalkthroughStep | undefined {
  return (
    WALKTHROUGH_STEPS.find((step) => matchesHelpContext(step, screenKey, jobStatus)) ??
    HELP_CARDS.find((step) => matchesHelpContext(step, screenKey, jobStatus)) ??
    HELP_CARDS.find((step) => step.id === 'help_general')
  );
}
