// P2e.2c - job_status colour map. Moved into packages/ui so both apps/mobile
// and modules/field-tech can import it via @jobcore/ui instead of a deep
// cross-app relative path. packages/ui now declares a real @jobcore/core
// dependency (see package.json) to support the JobStatus type import below.
import type { JobStatus } from '@jobcore/core';
import { colors } from './tokens';

/**
 * Every JobStatus gets a colour plus a glyph (JOB_STATUS_GLYPHS below). Several
 * navy shades repeat, so the glyph is the non-colour cue. The Record<JobStatus, string>
 * annotation on both maps is load-bearing: adding a member to the union breaks this
 * file at compile time.
 */
export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  new: colors.textMuted,
  qualified: colors.info,
  scheduled: colors.primaryLight,
  assigned: colors.primary,
  accepted: colors.primaryLight,
  en_route: colors.primary,
  in_progress: colors.primaryDark,
  completed: colors.success,
  paid: colors.primaryDark,
  closed: colors.primaryDark,
  declined: colors.danger,
  needs_reschedule: colors.warning,
  cancelled: colors.textLight,
  archived: colors.textMutedDark,
};

export const JOB_STATUS_GLYPHS: Record<JobStatus, string> = {
  new: 'N',
  qualified: 'Q',
  scheduled: 'S',
  assigned: 'A',
  accepted: 'Ac',
  en_route: 'ER',
  in_progress: 'IP',
  completed: '✓',
  paid: '$',
  closed: 'C',
  declined: '✕',
  needs_reschedule: '!',
  cancelled: '–',
  archived: 'Ar',
};
