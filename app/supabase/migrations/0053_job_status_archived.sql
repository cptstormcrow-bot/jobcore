-- Adds 'archived' to the job_status enum (Close-Outs feature, Slice 5).
-- Postgres requires ALTER TYPE ... ADD VALUE to run in its own migration
-- file/transaction, separate from any statement that uses the new value.
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'archived';
