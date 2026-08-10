import type { JobStatus } from '@jobcore/core';
/**
 * Every JobStatus gets a distinct colour. The Record<JobStatus, string> annotation
 * is load-bearing: adding a member to the union breaks this file at compile time.
 */
export declare const JOB_STATUS_COLORS: Record<JobStatus, string>;
//# sourceMappingURL=job-status-colors.d.ts.map