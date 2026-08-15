// supabase/functions/handoff-resolve/index.ts
//
// Deno-runtime Supabase Edge Function: public, unauthenticated handoff
// token resolver for the standalone handoff page (Jobcore P5.S7a/S7b).
//
// Serves the two routes `web/handoff/src/api.ts` calls:
//   GET  /:token                                  -> HandoffJobData
//   POST /:token/providers/:providerId/handoff     -> HandoffAction
//
// No Supabase auth session exists for the customer holding the QR code
// (supabase/0010_payment_review.sql, handoff_tokens RLS comment), so this
// function runs entirely under the service role, same rationale as
// stripe-webhook/paypal-webhook. No card data (PAN, CVV, card number) is
// ever read, touched, or logged here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Mirrors `Money` in app/modules/payment-review/src/domain/providers/types.ts. */
const CURRENCY = "USD";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

// ---------------------------------------------------------------------------
// Inline shapes — reimplemented (not imported) to match
// app/modules/payment-review/src/domain/providers/types.ts field-for-field.
// Edge Functions run under Deno outside the npm/tsc workspace tree
// (apps/*, packages/*, modules/* only), so these are restated here.
// ---------------------------------------------------------------------------

/** A monetary amount. Mirrors `Money` in providers/types.ts. */
interface Money {
  amount: number;
  currency: string;
}

/**
 * The action a provider hands back to drive the customer through payment.
 * Mirrors `HandoffAction` in providers/types.ts.
 */
interface HandoffAction {
  kind: "qr" | "link" | "in_app";
  url?: string;
  label: string;
}

/**
 * A trimmed, page-facing view of a provider's capabilities. Mirrors
 * `capabilities` on `PaymentProvider` in providers/types.ts, plus the
 * identifying fields `ProviderSummary` in web/handoff/src/types.ts needs.
 */
interface ProviderCapabilities {
  id: string;
  displayName: string;
  capabilities: { inApp: boolean; qrHandoff: boolean; webhookConfirm: boolean };
}

// ---------------------------------------------------------------------------
// Provider registry — exactly the 5 provider ids this function serves.
// ---------------------------------------------------------------------------

const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  cash: {
    id: "cash",
    displayName: "Cash",
    capabilities: { inApp: true, qrHandoff: false, webhookConfirm: false },
  },
  check: {
    id: "check",
    displayName: "Check",
    capabilities: { inApp: true, qrHandoff: false, webhookConfirm: false },
  },
  "p2p-link": {
    id: "p2p-link",
    displayName: "P2P Link (Venmo/Zelle/CashApp)",
    capabilities: { inApp: false, qrHandoff: true, webhookConfirm: false },
  },
  paypal: {
    id: "paypal",
    displayName: "PayPal",
    capabilities: { inApp: false, qrHandoff: true, webhookConfirm: true },
  },
  "stripe-link": {
    id: "stripe-link",
    displayName: "Card (Stripe)",
    capabilities: { inApp: false, qrHandoff: true, webhookConfirm: true },
  },
};

// ---------------------------------------------------------------------------
// Response helpers — flat { error: string } envelope for errors.
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

/** Builds the `HandoffAction` a chosen provider hands back for the picker. */
function buildHandoffAction(providerId: string, amount: Money): HandoffAction {
  const provider = PROVIDER_CAPABILITIES[providerId];

  if (!provider) {
    return { kind: "in_app", label: "Unknown provider" };
  }

  switch (providerId) {
    case "cash":
      return { kind: "in_app", label: `Pay ${amount.currency} ${amount.amount} in cash` };
    case "check":
      return { kind: "in_app", label: `Pay ${amount.currency} ${amount.amount} by check` };
    case "p2p-link":
      return { kind: "link", label: "Pay via P2P link", url: undefined };
    case "paypal":
      return { kind: "link", label: "Pay with PayPal", url: undefined };
    case "stripe-link":
      return { kind: "link", label: "Pay with card", url: undefined };
    default:
      return { kind: "in_app", label: provider.displayName };
  }
}

/** Normalizes a job's `payer` column to the `'customer' | 'partner'` union `HandoffJobData` expects. */
function normalizePayer(payer: string | null): "customer" | "partner" {
  return payer === "partner" ? "partner" : "customer";
}

interface ResolvedToken {
  tokenId: string;
  organizationId: string;
  jobId: string;
}

/**
 * Looks up a `handoff_tokens` row by its raw token value.
 * Returns `{ status: "not_found" }` for an unknown token, `{ status: "expired" }`
 * for one that is past `expires_at` or has `revoked_at` set (consumed), and
 * `{ status: "ok", token }` otherwise.
 */
async function resolveToken(
  token: string,
): Promise<{ status: "not_found" } | { status: "expired" } | { status: "ok"; token: ResolvedToken }> {
  const { data, error } = await supabase
    .from("handoff_tokens")
    .select("id, organization_id, job_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { status: "not_found" };
  }

  const isExpired = new Date(data.expires_at).getTime() <= Date.now();
  const isRevoked = data.revoked_at !== null;
  if (isExpired || isRevoked) {
    return { status: "expired" };
  }

  return {
    status: "ok",
    token: { tokenId: data.id, organizationId: data.organization_id, jobId: data.job_id },
  };
}

/**
 * Finds the `review_requests` row tied to this handoff token, creating one
 * in the `'awaiting_payment'` state (matching the column default) if none
 * exists yet.
 */
async function findOrCreateReviewRequest(resolved: ResolvedToken): Promise<{ id: string; state: string }> {
  const { data: existing, error: selectError } = await supabase
    .from("review_requests")
    .select("id, state")
    .eq("handoff_token_id", resolved.tokenId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: insertError } = await supabase
    .from("review_requests")
    .insert({
      organization_id: resolved.organizationId,
      job_id: resolved.jobId,
      handoff_token_id: resolved.tokenId,
    })
    .select("id, state")
    .single();

  if (insertError) {
    throw insertError;
  }

  return created;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** GET /:token — returns `HandoffJobData` (web/handoff/src/types.ts). */
async function handleGetJobData(token: string): Promise<Response> {
  const resolved = await resolveToken(token);
  if (resolved.status === "not_found") {
    return errorResponse("Unknown handoff token", 404);
  }
  if (resolved.status === "expired") {
    return errorResponse("Handoff token expired or already consumed", 410);
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, payer")
    .eq("id", resolved.token.jobId)
    .maybeSingle();

  if (jobError) {
    return errorResponse(jobError.message, 500);
  }
  if (!job) {
    return errorResponse("Unknown handoff token", 404);
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("amount")
    .eq("job_id", resolved.token.jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    return errorResponse(paymentError.message, 500);
  }

  const { data: providerRows, error: providersError } = await supabase
    .from("payment_providers")
    .select("provider_id")
    .eq("organization_id", resolved.token.organizationId)
    .eq("enabled", true);

  if (providersError) {
    return errorResponse(providersError.message, 500);
  }

  const providers = (providerRows ?? [])
    .map((row) => PROVIDER_CAPABILITIES[row.provider_id])
    .filter((provider): provider is ProviderCapabilities => Boolean(provider))
    .map(({ id, displayName, capabilities }) => ({ id, displayName, capabilities }));

  const amount: Money = { amount: payment ? Number(payment.amount) : 0, currency: CURRENCY };

  return jsonResponse({
    jobId: job.id,
    payer: normalizePayer(job.payer),
    amount,
    providers,
  });
}

/** POST /:token/providers/:providerId/handoff — records the handoff action, returns `HandoffAction`. */
async function handlePostHandoffAction(token: string, providerId: string): Promise<Response> {
  const resolved = await resolveToken(token);
  if (resolved.status === "not_found") {
    return errorResponse("Unknown handoff token", 404);
  }
  if (resolved.status === "expired") {
    return errorResponse("Handoff token expired or already consumed", 410);
  }

  const provider = PROVIDER_CAPABILITIES[providerId];
  if (!provider) {
    return errorResponse(`Unknown provider id: ${providerId}`, 409);
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, payer")
    .eq("id", resolved.token.jobId)
    .maybeSingle();

  if (jobError) {
    return errorResponse(jobError.message, 500);
  }
  if (!job) {
    return errorResponse("Unknown handoff token", 404);
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, provider_id, status, amount")
    .eq("job_id", resolved.token.jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    return errorResponse(paymentError.message, 500);
  }

  if (payment && payment.status !== "pending" && payment.provider_id !== providerId) {
    return errorResponse(
      `Payment already in progress with provider '${payment.provider_id}' (status='${payment.status}')`,
      409,
    );
  }

  const { error: upsertError } = payment
    ? await supabase.from("payments").update({ provider_id: providerId }).eq("id", payment.id)
    : await supabase.from("payments").insert({
        organization_id: resolved.token.organizationId,
        job_id: resolved.token.jobId,
        provider_id: providerId,
        amount: 0,
        status: "pending",
      });

  if (upsertError) {
    return errorResponse(upsertError.message, 500);
  }

  try {
    await findOrCreateReviewRequest(resolved.token);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err), 500);
  }

  const amount: Money = { amount: payment ? Number(payment.amount) : 0, currency: CURRENCY };
  const action = buildHandoffAction(providerId, amount);

  return jsonResponse(action);
}

// ---------------------------------------------------------------------------
// Path routing
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  // Trim the function-name path segment if present (local `functions serve`
  // vs. deployed routing both land here with a leading `/handoff-resolve`).
  const segments = url.pathname.split("/").filter(Boolean);
  const trimmed = segments[0] === "handoff-resolve" ? segments.slice(1) : segments;

  try {
    // GET /:token
    if (req.method === "GET" && trimmed.length === 1) {
      return await handleGetJobData(trimmed[0]);
    }

    // POST /:token/providers/:providerId/handoff
    if (
      req.method === "POST" &&
      trimmed.length === 4 &&
      trimmed[1] === "providers" &&
      trimmed[3] === "handoff"
    ) {
      return await handlePostHandoffAction(trimmed[0], trimmed[2]);
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Unexpected error", 500);
  }
});
