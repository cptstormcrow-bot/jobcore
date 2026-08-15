// supabase/functions/price-sheet-current/index.ts
//
// Deno-runtime Supabase Edge Function: public price-sheet feed.
//
// GET-only transport. Fetches `price_sheets` + `price_sheet_rates` via a
// SERVICE-ROLE Supabase client only (never anon/authenticated), because both
// tables' RLS policies (see supabase/0005_money.sql) are admin-only in every
// direction and this endpoint is a public, unauthenticated feed. No auth
// check is added by design, matching the stripe-webhook/paypal-webhook
// pattern of an unauthenticated-caller function whose access control is the
// service-role DB credential, not a JWT.
//
// The actual published-sheet selection and row->feed mapping is done by the
// pure buildFeed() function in ./handler.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFeed, type PriceSheetRow, type PriceSheetRateRow } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Short public cache — the feed changes only on publish, but a short TTL
// keeps a stale window small without hammering the DB on every page load.
// See DEPLOY.md for the rationale.
const CACHE_CONTROL = "public, max-age=60";

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: sheets, error: sheetsError } = await supabase
    .from("price_sheets")
    .select("id, organization_id, version, effective_from, published_at, status")
    .eq("status", "published");

  if (sheetsError) {
    return new Response(JSON.stringify({ error: sheetsError.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const sheetRows = (sheets ?? []) as PriceSheetRow[];
  const sheetIds = sheetRows.map((s) => s.id);

  let rateRows: PriceSheetRateRow[] = [];
  if (sheetIds.length > 0) {
    const { data: rates, error: ratesError } = await supabase
      .from("price_sheet_rates")
      .select("price_sheet_id, service_id, attach_timing, amount_cents")
      .in("price_sheet_id", sheetIds);

    if (ratesError) {
      return new Response(JSON.stringify({ error: ratesError.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    rateRows = (rates ?? []) as PriceSheetRateRow[];
  }

  const feed = buildFeed(sheetRows, rateRows);

  if (!feed) {
    return new Response(JSON.stringify({ error: "No published price sheet" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify(feed), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": CACHE_CONTROL,
    },
  });
});
