/**
 * Offline mutation queue — device-local SQLite schema.
 *
 * This is the storage contract that the queue types in this directory mirror.
 * `packages/core` is zero-dependency, so the schema ships as plain SQL strings;
 * the mobile app opens the database (expo-sqlite) and executes them.
 */

/** Table holding pending mutations awaiting replay against the server. */
export const OFFLINE_QUEUE_TABLE = 'offline_queue';

/**
 * Column contract:
 * - `id`          TEXT PK  — client-generated idempotency key; never server-assigned.
 * - `op`          TEXT     — mutation discriminator (e.g. a job transition name).
 * - `payload`     TEXT     — JSON-encoded mutation body.
 * - `occurred_at` TEXT     — ISO-8601 device clock at the moment of the action.
 * - `status`      TEXT     — lifecycle: 'pending' | 'inflight' | 'failed'.
 * - `attempts`    INTEGER  — replay attempts made so far.
 */
export const CREATE_OFFLINE_QUEUE_TABLE = `
create table if not exists offline_queue (
  id text primary key not null,
  op text not null,
  payload text not null,
  occurred_at text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  error_class text,
  next_attempt_at text,
  inflight_at text
);
`;

/** Current offline_queue schema version (v2 adds the four retry/diagnostic columns). */
export const OFFLINE_QUEUE_SCHEMA_VERSION = 2;

/** Upgrade statements keyed by the version they migrate TO. */
export const OFFLINE_QUEUE_MIGRATIONS: Record<number, string[]> = {
  2: [
    'ALTER TABLE offline_queue ADD COLUMN last_error TEXT',
    'ALTER TABLE offline_queue ADD COLUMN error_class TEXT',
    'ALTER TABLE offline_queue ADD COLUMN next_attempt_at TEXT',
    'ALTER TABLE offline_queue ADD COLUMN inflight_at TEXT',
  ],
};

/** Read-through cache table DDL (one statement per entry). */
export const CREATE_READ_CACHE_TABLE: string[] = [
  `CREATE TABLE IF NOT EXISTS read_cache (
  key TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  params TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  bytes INTEGER NOT NULL
)`,
  'CREATE INDEX IF NOT EXISTS read_cache_user_query ON read_cache (user_id, query)',
  'CREATE INDEX IF NOT EXISTS read_cache_fetched_at ON read_cache (fetched_at)',
];

/** Replay order is device-clock order, so the queue is read by `occurred_at`. */
export const CREATE_OFFLINE_QUEUE_INDEX = `
create index if not exists offline_queue_status_occurred_at
  on offline_queue (status, occurred_at);
`;

/** Every statement required to bring a fresh database to the current schema. */
export const OFFLINE_QUEUE_SCHEMA: readonly string[] = [
  CREATE_OFFLINE_QUEUE_TABLE,
  CREATE_OFFLINE_QUEUE_INDEX,
];
