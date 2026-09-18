import type { JobStatus } from '@jobcore/core';

export type WalkthroughStepId =
  | 'create'
  | 'assign'
  | 'contact'
  | 'approve_estimate'
  | 'arrive'
  | 'complete'
  | 'paid'
  | 'payroll_rollup';

export type ScreenKey = 'job-detail' | 'jobs-list' | 'admin-finance' | 'qualify-lead';

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
    body: 'Every job starts as a lead. An admin or dispatcher enters the customer, address, and requested date, then qualifies the lead into a real job by picking a service area.',
    whereScreen: 'Qualify Lead',
    whereHint: "On the Qualify Lead screen, fill in the lead details and service area, then tap the \"Qualify\" button to turn it into a job.",
    context: { screens: ['qualify-lead'] },
  },
  {
    id: 'assign',
    kind: 'action',
    title: 'Assign an Investigator',
    body: 'Once a job exists, a dispatcher assigns an investigator to it for a pre-estimate visit — this doesn\'t change the job\'s status or set the tech who\'ll do the work; that installer assignment happens later, after the estimate is approved.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, switch to the "Assign" region to pick which tech is responsible for the job.',
    context: { screens: ['job-detail'], jobStatuses: ['new', 'qualified'] },
  },
  {
    id: 'contact',
    kind: 'action',
    title: 'Contact the Customer',
    body: 'Before heading out, the assigned tech reaches out to the customer to confirm the appointment and log that contact was made.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, tap the "Contact" tab to call the customer and record the contact attempt.',
    context: { screens: ['job-detail'], jobStatuses: ['scheduled', 'assigned'] },
  },
  {
    id: 'approve_estimate',
    kind: 'action',
    title: 'Approve the Estimate',
    body: 'Before work proceeds, the estimate for the job needs to be reviewed and approved so pricing is locked in and everyone agrees on scope and cost.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, open the "Estimate" region and confirm "Yes" on the approval prompt to approve it.',
    context: { screens: ['job-detail'], jobStatuses: ['accepted'] },
  },
  {
    id: 'arrive',
    kind: 'action',
    title: 'Installer Arrives On-Site',
    body: 'Once the estimate is approved, dispatch assigns an installer to the job — the tech who actually does the work. When that installer shows up at the customer\'s location, they mark themselves as arrived, which opens a time segment so dispatch and admin can see real-time job progress.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, tap the "Arrive" button when you get on-site to mark arrival.',
    context: { screens: ['job-detail'], jobStatuses: ['en_route'] },
  },
  {
    id: 'complete',
    kind: 'action',
    title: 'Mark Job Complete',
    body: 'Once the work is finished, the tech marks the job complete, which signals the office the job is done and ready to be closed out and billed.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, tap the "Complete" button after finishing the work to mark it done.',
    context: { screens: ['job-detail'], jobStatuses: ['in_progress'] },
  },
  {
    id: 'paid',
    kind: 'action',
    title: 'Mark Job Paid',
    body: 'After the customer pays, an admin marks the job as paid, closing out the financial side of the job so it stops showing up as outstanding.',
    whereScreen: 'Job Detail',
    whereHint: 'On Job Detail, tap the "Paid" button and confirm "Yes" once payment has been collected.',
    context: { screens: ['job-detail'], jobStatuses: ['completed'] },
  },
  {
    id: 'payroll_rollup',
    kind: 'info',
    title: 'Payroll Rollup Runs',
    body: 'Paid jobs automatically feed into the payroll rollup in the background, so completed and paid work is reflected in tech payroll without anyone needing to click anything. There\'s nothing to do here — it just happens.',
  },
];

export function getHelpStep(screenKey: ScreenKey, jobStatus?: JobStatus): WalkthroughStep | undefined {
  return WALKTHROUGH_STEPS.find((step) => {
    if (!step.context) return false;
    if (!step.context.screens.includes(screenKey)) return false;
    if (step.context.jobStatuses && (!jobStatus || !step.context.jobStatuses.includes(jobStatus))) return false;
    return true;
  });
}
