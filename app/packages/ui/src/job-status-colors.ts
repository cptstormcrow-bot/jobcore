// P2e.2c - job_status colour map. Moved into packages/ui so both apps/mobile
// and modules/field-tech can import it via @jobcore/ui instead of a deep
// cross-app relative path. packages/ui now declares a real @jobcore/core
// dependency (see package.json) to support the JobStatus type import below.
import type { JobStatus } from '@jobcore/core';
import { colors } from './tokens';

/**
 * Every JobStatus gets a distinct colour. The Record<JobStatus, string> annotation
 * is load-bearing: adding a member to the union breaks this file at compile time.
 */
export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  new: colors.textMuted,
  qualified: colors.info,
  scheduled: colors.primaryLight,
  assigned: colors.primary,
  accepted: colors.accent,
  en_route: colors.secondaryLight,
  in_progress: colors.secondary,
  completed: colors.success,
  paid: colors.secondaryDark,
  closed: colors.primaryDark,
  declined: colors.danger,
  needs_reschedule: colors.warning,
  cancelled: colors.textLight,
};
