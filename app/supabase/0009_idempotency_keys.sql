-- Client-generated idempotency keys for offline-queue replay dedup.
-- See packages/core/src/offline/replay.ts (dedup assumes a client-generated
-- key on queued records) and packages/core/src/offline/* (makeIdempotencyKey).

alter table public.audit_log
  add column idempotency_key uuid;

create unique index audit_log_idempotency_key_idx
  on public.audit_log (idempotency_key)
  where idempotency_key is not null;

alter table public.job_photos
  add column idempotency_key uuid;

create unique index job_photos_idempotency_key_idx
  on public.job_photos (idempotency_key)
  where idempotency_key is not null;
