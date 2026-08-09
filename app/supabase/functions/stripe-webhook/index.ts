// supabase/functions/stripe-webhook/index.ts
//
// Deno-runtime Supabase Edge Function: Stripe webhook receiver.
//
// Verifies the Stripe signature on every inbound POST using a manual
// HMAC-SHA256 check per Stripe's documented webhook-signing spec
// (https://stripe.com/docs/webhooks/signatures#verify-manually), since the
// stripe-node SDK is not available in the Deno edge runtime here. No card
// data (PAN, CVV, card_number) is ever read, touched, or logged — only the
// event type and payment/session identifiers are used.
//
// On a valid `checkout.session.completed` or `payment_intent.succeeded`
// event, the matching `payments` row (looked up by `external_ref`) is
// updated to status='confirmed', with `confirmed_at` set to now and
// `external_ref` re-affirmed from the event payload.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

// Stripe tolerates signatures within this window (seconds) to guard replay attacks.
const TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe `Stripe-Signature` header against the raw request body
 * using the documented manual HMAC-SHA256 scheme:
 *   signed_payload = "{timestamp}.{raw_body}"
 *   expected_sig    = HMAC-SHA256(webhook_secret, signed_payload)
 * https://stripe.com/docs/webhooks/signatures#verify-manually
 */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts["t"];
  const providedSig = parts["v1"];
  if (!timestamp || !providedSig) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;

  const keyData = new TextEncoder().encode(secret);
  const msgData = new TextEncoder().encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const expectedSig = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expectedSig, providedSig);
}

/** Constant-time string comparison to avoid timing side-channels on signature check. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Extract the external reference (session id or payment intent id) from a Stripe event. */
function extractExternalRef(event: any): string | null {
  const obj = event?.data?.object;
  if (!obj) return null;
  // checkout.session.completed -> session id; payment_intent.succeeded -> PI id.
  return obj.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("stripe-signature");

  const isValid = await verifyStripeSignature(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Malformed payload", { status: 400 });
  }

  const handledTypes = ["checkout.session.completed", "payment_intent.succeeded"];
  if (!handledTypes.includes(event?.type)) {
    // Acknowledge unrelated events without processing them.
    return new Response(JSON.stringify({ received: true, ignored: event?.type ?? "unknown" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const externalRef = extractExternalRef(event);
  if (!externalRef) {
    return new Response("Missing external reference on event object", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase
    .from("payments")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      external_ref: externalRef,
    })
    .eq("external_ref", externalRef);

  if (error) {
    return new Response(JSON.stringify({ received: true, db_error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
