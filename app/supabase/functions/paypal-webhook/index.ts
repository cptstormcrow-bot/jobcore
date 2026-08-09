// supabase/functions/paypal-webhook/index.ts
//
// Deno-runtime Supabase Edge Function: PayPal webhook receiver.
//
// Verifies every inbound POST using PayPal's documented server-side
// "Verify webhook signature" API
// (https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature),
// since the paypal-checkout-server-sdk is not available in the Deno edge
// runtime here. That API takes the transmission-id, transmission-time,
// cert-url, auth-algo and transmission-sig headers (plus webhook-id and the
// raw event body) and returns a verification_status of SUCCESS/FAILURE — no
// local X.509/cert parsing is needed. No card data (PAN, CVV, card number)
// is ever read, touched, or logged — only the event type and
// order/capture identifiers are used.
//
// On a valid `PAYMENT.CAPTURE.COMPLETED` or `CHECKOUT.ORDER.APPROVED`
// event, the matching `payments` row (looked up by `external_ref`) is
// updated to status='confirmed', with `confirmed_at` set to now and
// `external_ref` re-affirmed from the event payload.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";

// https://developer.paypal.com/api/rest/production-vs-sandbox/
const PAYPAL_API_BASE = Deno.env.get("PAYPAL_API_BASE") ?? "https://api-m.paypal.com";

/** Fetch a short-lived OAuth2 access token via PayPal's client-credentials grant. */
async function getPayPalAccessToken(): Promise<string | null> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return null;

  const basicAuth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json?.access_token ?? null;
}

/**
 * Verify a PayPal webhook using the documented server-side
 * "Verify webhook signature" API. Requires the transmission-id,
 * transmission-time, cert-url, auth-algo and transmission-sig headers plus
 * the configured webhook id and the raw (parsed) event body.
 * https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature
 */
async function verifyPayPalWebhook(
  headers: Headers,
  event: unknown,
): Promise<boolean> {
  if (!PAYPAL_WEBHOOK_ID) return false;

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  const accessToken = await getPayPalAccessToken();
  if (!accessToken) return false;

  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });

  if (!res.ok) return false;
  const json = await res.json();
  return json?.verification_status === "SUCCESS";
}

/**
 * Extract the external reference (order id or capture id) from a PayPal
 * webhook event resource.
 */
function extractExternalRef(event: any): string | null {
  const resource = event?.resource;
  if (!resource) return null;
  // PAYMENT.CAPTURE.COMPLETED -> capture id; CHECKOUT.ORDER.APPROVED -> order id.
  return resource.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Malformed payload", { status: 400 });
  }

  const isValid = await verifyPayPalWebhook(req.headers, event);
  if (!isValid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const handledTypes = ["PAYMENT.CAPTURE.COMPLETED", "CHECKOUT.ORDER.APPROVED"];
  if (!handledTypes.includes(event?.event_type)) {
    // Acknowledge unrelated events without processing them.
    return new Response(
      JSON.stringify({ received: true, ignored: event?.event_type ?? "unknown" }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const externalRef = extractExternalRef(event);
  if (!externalRef) {
    return new Response("Missing external reference on event resource", { status: 400 });
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
