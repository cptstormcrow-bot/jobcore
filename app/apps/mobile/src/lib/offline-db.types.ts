export type QueueStatus = 'pending' | 'inflight' | 'done' | 'failed';

export interface QueueRow {
  id: string;
  op: string;
  payload: string;
  occurred_at: string;
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  error_class: string | null;
  next_attempt_at: string | null;
  inflight_at: string | null;
  created_at?: string;
}

/** Sync history log row (#0100). */
export type SyncLogKind = 'sent' | 'retry' | 'failed' | 'pass';

export interface SyncLogRow {
  id: number;
  at: string;
  kind: SyncLogKind;
  op: string | null;
  row_id: string | null;
  attempts: number | null;
  error_class: string | null;
  message: string | null;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  /** Rows that failed permanently and need attention (Sync issues screen). */
  failedCount: number;
  /** Failed rows plus pending rows retried twice or more (stuck popup #0099). */
  stuckCount: number;
  isSyncing: boolean;
  lastDrainAt: string | null;
  lastError: string | null;
  refresh(): void;
  /** Put every failed row back to pending, clear the error, and drain. */
  retryAll(): Promise<void>;
  /** Unstick every row (failed and retried-pending back to fresh pending), clear the error, and drain. */
  unstickAll(): Promise<void>;
}
