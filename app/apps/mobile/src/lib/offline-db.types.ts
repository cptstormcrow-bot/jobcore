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

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  /** Rows that failed permanently and need attention (Sync issues screen). */
  failedCount: number;
  isSyncing: boolean;
  lastDrainAt: string | null;
  lastError: string | null;
  refresh(): void;
  /** Put every failed row back to pending, clear the error, and drain. */
  retryAll(): Promise<void>;
}
