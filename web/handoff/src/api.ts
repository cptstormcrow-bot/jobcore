/**
 * Typed data-fetch client stub for the handoff page (Jobcore P5.S7a).
 *
 * No existing HTTP API client pattern exists for a public, unauthenticated,
 * token-scoped page like this one (the `app/` workspace's Supabase clients
 * assume an authenticated session) — this is a documented placeholder
 * hitting a same-origin `/api/handoff/*` surface that does not exist yet.
 * A later slice wires the real endpoint (Supabase Edge Function, or a thin
 * server validating `handoff_tokens` per `app/supabase/migrations/0011_handoff_token_issue.sql`)
 * behind this exact function signature.
 */

import type { HandoffAction, HandoffJobData } from './types';

const API_BASE = '/api/handoff';

/** Fetches the job/provider data a `handoff_token` resolves to. */
export async function fetchHandoffJobData(token: string): Promise<HandoffJobData> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error(`fetchHandoffJobData: request failed (${res.status})`);
  }
  return (await res.json()) as HandoffJobData;
}

/** Requests the `HandoffAction` for a chosen provider, driving the `awaiting_payment` picker. */
export async function requestHandoffAction(
  token: string,
  providerId: string,
): Promise<HandoffAction> {
  const res = await fetch(
    `${API_BASE}/${encodeURIComponent(token)}/providers/${encodeURIComponent(providerId)}/handoff`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(`requestHandoffAction: request failed (${res.status})`);
  }
  return (await res.json()) as HandoffAction;
}
