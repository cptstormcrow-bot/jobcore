import { requireOnline } from '../lib/online';
/**
 * Handoff token issuance (P5.S5).
 *
 * Thin wrapper around the `issue_handoff_token` RPC declared in
 * `app/supabase/0011_handoff_token_issue.sql` — mirrors
 * `modules/admin-finance/src/data/payout-batch-repo.ts`'s
 * `SupabaseRpcClient`-minimal-client discipline (just `rpc`, not the full
 * `SupabaseClient` type, no hard `@supabase/supabase-js` import) rather than
 * `field-tech/src/data/ports.ts`'s host-injected-repository shape, since this
 * is a single RPC call with no row mapping to speak of.
 *
 * QR *rendering* is out of scope for this slice — see the TODO below.
 */

/**
 * Minimal shape of the Supabase client surface this file depends on — see
 * `payout-batch-repo.ts`'s `SupabaseRpcClient` for the pattern this mirrors.
 */
export interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Base URL the public handoff page is served from. No such constant exists
 * elsewhere in the repo yet, so this is a documented placeholder — swap for
 * the real deployed URL (or wire through app config/env) when the public
 * handoff page (payment/review capture) lands.
 */
export const HANDOFF_BASE_URL = 'https://handoff.jobcore.app';

/**
 * Issues a handoff token for `jobId` via the `issue_handoff_token` RPC
 * (0011) and builds the QR-encodable URL from it. Throws with the RPC's
 * error message on failure, matching `payout-batch-repo.ts`'s error
 * surfacing style at the boundary where a thrown error is appropriate (this
 * function has no `CalculationResult`-shaped caller to return an `ok: false`
 * to, unlike `persistPayoutBatchViaRpc`).
 *
 * TODO(P5 follow-up): QR rendering itself is deferred — no QR rendering
 * primitive exists yet in packages/ui, and pulling in a new QR library
 * dependency for this slice risks the bloat this slice was scoped to avoid.
 * A future slice renders `url` below to a scannable QR code.
 */
export async function issueHandoffToken(
  client: SupabaseRpcClient,
  jobId: string,
): Promise<{ token: string; url: string }> {
  requireOnline('Issuing a handoff link');
  const { data, error } = await client.rpc('issue_handoff_token', {
    p_job_id: jobId,
  });
  if (error) {
    throw new Error(error.message);
  }
  const token = data as string;
  return { token, url: `${HANDOFF_BASE_URL}/${token}` };
}
