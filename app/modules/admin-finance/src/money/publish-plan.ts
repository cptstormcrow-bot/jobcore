/**
 * Pure publish-planning for the admin-finance money core (P3i.1).
 *
 * `planPublish` describes — it never executes. The RPC `publish_price_sheet`
 * (P3i.2b) is the thing that actually flips rows in Postgres; this function
 * only produces the data description of what that RPC should do.
 *
 * CRITICAL INVARIANT: `sheet.version` is assigned once, AT DRAFT CREATION
 * (`max(version) + 1` over the organization's existing sheets), never at
 * publish time. `planPublish` therefore NEVER assigns, mutates, or
 * recomputes `version` on either sheet in the plan — it only reads
 * `sheet.version` to validate ordering against `priorPublished.version`.
 * Rewriting `version` at publish would collide with
 * `price_sheets_organization_id_version_key unique (organization_id,
 * version)` (`app/supabase/0005_money.sql:89`).
 *
 * The DB's `publication_status` enum (`app/supabase/0005_money.sql:11-15`)
 * uses `'draft' | 'published' | 'superseded'`. This module's
 * `PriceSheetStatus` (`./types.ts`) is the existing, reused vocabulary and
 * is mirrored exactly as declared there — no new status type is introduced
 * here.
 *
 * No Date, no Math.random, no I/O. `now` arrives as a parameter (an ISO
 * timestamp string) so this stays deterministic and unit-testable with zero
 * setup, matching `commission.ts`'s discipline.
 */

import type { PriceSheet, PriceSheetStatus, CalculationResult } from './types';

/** One side of a publish plan: a price sheet's id, its target status, and the timestamp to stamp. */
export interface PublishPlanEntry {
  priceSheetId: string;
  status: PriceSheetStatus;
  publishedAt: string | null;
}

/**
 * The data description of a publish transition: the draft moving to
 * `published`, and — if one existed — the prior published sheet moving to
 * its superseded-equivalent status, both stamped with the same `now`. The
 * RPC (P3i.2b) is the sole executor of this plan.
 */
export interface PublishPlan {
  toPublish: PublishPlanEntry;
  toSupersede: PublishPlanEntry | null;
}

/**
 * Plans the publish of `sheet` given the organization's current
 * `priorPublished` sheet (or `null` if none) and a caller-supplied `now`.
 *
 * Rejects (does not throw) when:
 * - `sheet.status` is not `'draft'`
 * - `priorPublished` belongs to a different organization than `sheet`
 * - `priorPublished.version >= sheet.version`
 *
 * Never assigns or recomputes `version` on either side of the plan — see
 * the file-top JSDoc invariant.
 */
export function planPublish(
  sheet: PriceSheet,
  priorPublished: PriceSheet | null,
  now: string,
): CalculationResult<PublishPlan> {
  if (sheet.status !== 'draft') {
    return {
      ok: false,
      reason: `price sheet ${sheet.id} is '${sheet.status}', not 'draft'`,
    };
  }

  if (priorPublished) {
    if (priorPublished.organizationId !== sheet.organizationId) {
      return {
        ok: false,
        reason: `prior published price sheet ${priorPublished.id} belongs to organization ${priorPublished.organizationId}, not ${sheet.organizationId}`,
      };
    }

    if (priorPublished.version >= sheet.version) {
      return {
        ok: false,
        reason: `prior published price sheet ${priorPublished.id} has version ${priorPublished.version}, which is not less than draft version ${sheet.version}`,
      };
    }
  }

  const plan: PublishPlan = {
    toPublish: {
      priceSheetId: sheet.id,
      status: 'published',
      publishedAt: now,
    },
    toSupersede: priorPublished
      ? {
          priceSheetId: priorPublished.id,
          status: 'archived',
          publishedAt: priorPublished.publishedAt,
        }
      : null,
  };

  return { ok: true, value: plan };
}
