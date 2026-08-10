import { colors } from '@jobcore/ui';
/**
 * Every JobStatus gets a distinct colour. The Record<JobStatus, string> annotation
 * is load-bearing: adding a member to the union breaks this file at compile time.
 */
export const JOB_STATUS_COLORS = {
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
