// Device-local persistence adapter for the offline mutation queue.
// packages/core stays zero-dependency and knows nothing about SQLite or
// Expo — it defines the schema/shape and receives persistence as injected
// callbacks (see replayQueue). This module is the one place in the app
// that owns the actual on-device database.

import * as SQLite from 'expo-sqlite';
import {
  OFFLINE_QUEUE_TABLE,
  OFFLINE_QUEUE_SCHEMA,
  replayQueue,
} from '@jobcore/core';
import type {
  QueuedMutation,
  NewQueuedMutation,
  ReplayResult,
} from '@jobcore/core';
import { logSyncFailure } from './log';
import { supabase } from './supabase';

export const OFFLINE_DB_NAME = 'jobcore-offline.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(OFFLINE_DB_NAME);
      for (const statement of OFFLINE_QUEUE_SCHEMA) {
        await db.execAsync(statement);
      }
      return db;
    })();
  }
  return dbPromise;
}

export async function countPending(): Promise<number> {
  const db = await getOfflineDb();
  // 'failed' rows are deliberately EXCLUDED from this count — they surface
  // through the indicator's separate error channel, not the pending count.
  const row = await db.getFirstAsync<{ n: number }>(
    `select count(*) as n from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight')`
  );
  return row?.n ?? 0;
}

export async function enqueue(mutation: NewQueuedMutation): Promise<void> {
  try {
    const db = await getOfflineDb();
    await db.runAsync(
      `insert into ${OFFLINE_QUEUE_TABLE} (id, op, payload, occurred_at) values (?, ?, ?, ?)`,
      mutation.id,
      mutation.op,
      mutation.payload,
      mutation.occurredAt
    );
  } catch (err) {
    logSyncFailure('offline-db.enqueue', err instanceof Error ? err.message : String(err), { mutation });
    throw err;
  }
}

interface OfflineQueueRow {
  id: string;
  op: string;
  payload: string;
  occurred_at: string;
  status: QueuedMutation['status'];
  attempts: number;
}

export async function listPending(): Promise<QueuedMutation[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<OfflineQueueRow>(
    `select id, op, payload, occurred_at, status, attempts from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight') order by occurred_at asc`
  );
  return rows.map((row) => ({
    id: row.id,
    op: row.op,
    payload: row.payload,
    occurredAt: row.occurred_at,
    status: row.status,
    attempts: row.attempts,
  }));
}

export async function markDone(id: string): Promise<void> {
  const db = await getOfflineDb();
  // A delivered mutation is removed rather than tombstoned — the durable
  // record of what happened lives in the server-side audit trail.
  await db.runAsync(`delete from ${OFFLINE_QUEUE_TABLE} where id = ?`, id);
}

export async function markFailed(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'failed', attempts = attempts + 1 where id = ?`,
    id
  );
}

export async function replayPending(
  send: (mutation: QueuedMutation) => Promise<void>
): Promise<ReplayResult> {
  const pending = await listPending();
  // send is injected by the caller; replayOfflineQueue below supplies the
  // Supabase transport.
  return replayQueue(pending, {
    send,
    markDone: (id) => markDone(id),
    markFailed: (id) => markFailed(id),
  });
}

// ---------------------------------------------------------------------------
// Supabase transport. Every handler is an `update ... eq(id)` that re-applies
// the same values, so replaying a row whose direct write already landed is
// harmless. Mappings mirror the inline ones in admin-finance-repos.ts.
// Create-style ops are NOT replayable: their drafts carry no client-side id,
// so an insert/upsert would duplicate the row; they throw (row -> failed).
// ---------------------------------------------------------------------------

type Json = Record<string, any>;

async function applyUpdate(table: string, id: string, values: Json): Promise<void> {
  if (Object.keys(values).length === 0) return;
  const { error } = await supabase.from(table).update(values).eq('id', id);
  if (error) throw new Error(`${table} update failed: ${error.message}`);
}

export async function send(row: QueuedMutation): Promise<void> {
  const p = JSON.parse(row.payload) as Json;
  switch (row.op) {
    case 'job.patch_scheduling':
      return applyUpdate('jobs', p.jobId, {
        assigned_tech_id: p.patch.assignedTechId,
        scheduled_start: p.patch.scheduledStart,
        scheduled_end: p.patch.scheduledEnd,
        requested_window: p.patch.requestedWindow,
      });
    case 'job.patch_lifecycle': {
      const u: Json = {};
      if (p.patch.enRouteAt !== undefined) u.en_route_at = p.patch.enRouteAt;
      if (p.patch.inProgressAt !== undefined) u.in_progress_at = p.patch.inProgressAt;
      if (p.patch.completedAt !== undefined) u.completed_at = p.patch.completedAt;
      return applyUpdate('jobs', p.jobId, u);
    }
    case 'job.markBeta':
      return applyUpdate('jobs', p.jobId, { is_beta: p.isBeta });
    case 'job.update_details': {
      const u: Json = {
        address: p.patch.address,
        description: p.patch.description,
        house_age_years: p.patch.houseAgeYears,
        ingress_instructions: p.patch.ingressInstructions,
        scheduled_start: p.patch.scheduledStart,
        scheduled_end: p.patch.scheduledEnd,
        service_area_id: p.patch.serviceAreaId,
        permit_status: p.patch.permitStatus,
        parking_available: p.patch.parkingAvailable,
        rooms: p.patch.rooms,
        panel_info: p.patch.panelInfo,
        considerations: p.patch.considerations,
      };
      if (p.patch.customerId !== undefined) u.customer_id = p.patch.customerId;
      return applyUpdate('jobs', p.jobId, u);
    }
    case 'job.update_status':
      return applyUpdate('jobs', p.jobId, { status: p.status });
    case 'lead.mark_qualified':
      return applyUpdate('leads', p.leadId, {
        qualified_at: p.qualifiedAt,
        converted_job_id: p.jobId,
      });
    case 'employee.update': {
      const m: Record<string, string> = {
        fullName: 'full_name',
        phone: 'phone',
        isTest: 'is_test',
        address: 'address',
        driversLicenseNumber: 'drivers_license_number',
        vehicleStatus: 'vehicle_status',
        toolStatus: 'tool_status',
        paidTravel: 'paid_travel',
        paidTravelPolicyMessage: 'paid_travel_policy_message',
        defaultHourlyRateCents: 'hourly_rate_cents',
        testJobsOnly: 'test_jobs_only',
      };
      const u: Json = {};
      for (const [k, col] of Object.entries(m)) {
        if (p.updates[k] !== undefined) u[col] = p.updates[k];
      }
      return applyUpdate('profiles', p.profileId, u);
    }
    case 'employee.deactivate':
      return applyUpdate('profiles', p.profileId, { active: false });
    case 'employee.reactivate':
      return applyUpdate('profiles', p.profileId, { active: true });
    case 'time_off_request.cancel':
      return applyUpdate('time_off_requests', p.requestId, { status: 'cancelled' });
    case 'customer.update':
      return applyUpdate('customers', p.id, p.patch);
    case 'payout_batch.approve':
      return applyUpdate('payout_batches', p.batchId, { status: 'approved' });
    case 'payout_batch.mark_paid':
      return applyUpdate('payout_batches', p.batchId, { status: 'paid' });
    default:
      throw new Error(
        `offline replay: no idempotent handler for op "${row.op}" (create-style or unmapped ops are not replayable)`
      );
  }
}

export const replayOfflineQueue = (): Promise<ReplayResult> => replayPending(send);
