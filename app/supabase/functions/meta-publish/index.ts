// supabase/functions/meta-publish/index.ts
//
// Deno-runtime Supabase Edge Function: Meta (Facebook/Instagram) Graph API
// publisher (JobCore P6 plan §3).
//
// Unlike `stripe-webhook` (a public webhook receiver authenticated by an
// HMAC signature), this function is invoked directly by an authenticated
// app client via `supabase.functions.invoke('meta-publish', ...)`, so
// identity is established with `supabase.auth.getUser` against the caller's
// bearer token first. A second, service-role client is then used for every
// database read/write — the role/org check, the `post_drafts`/`post_targets`
// row loads, the `social_providers.enabled` check, the token read from
// `social_provider_credentials` (RLS has zero `authenticated`-role policies
// on that table — only the service-role key can reach it), the Graph API
// call, and finally the `post_targets` update plus `campaign_log` insert.
//
// This function is the SOLE writer of `post_targets.status` /
// `platform_post_id` / `error` and of `campaign_log` rows for the API path
// — no client code writes either, so AC-5/AC-6 hold regardless of what the
// client does after receiving the returned `PostResult`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

/** Roles permitted to trigger a Meta publish — matches `is_org_sales_or_above()` (0012_marketing.sql). */
const ALLOWED_ROLES = ["owner", "admin", "sales"];

type PostResult =
  | { status: "posted"; platformPostId: string; postedAt: string }
  | { status: "failed"; error: string };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function failAndRecord(
  admin: ReturnType<typeof createClient>,
  draftId: string,
  platform: string,
  errorMessage: string,
  httpStatus: number,
): Promise<Response> {
  await admin
    .from("post_targets")
    .update({ status: "failed", error: errorMessage })
    .eq("draft_id", draftId)
    .eq("platform", platform);

  const result: PostResult = { status: "failed", error: errorMessage };
  return jsonResponse(result, httpStatus);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: { draftId?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ status: "failed", error: "Malformed payload" } satisfies PostResult, 400);
  }

  const { draftId, platform } = body;
  if (!draftId || !platform) {
    return jsonResponse(
      { status: "failed", error: "draftId and platform are required" } satisfies PostResult,
      400,
    );
  }

  // Step 1: identity — verify the caller's bearer token via a client scoped
  // to their own Authorization header (not the service role).
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ status: "failed", error: "Unauthenticated" } satisfies PostResult, 401);
  }
  const callerId = userData.user.id;

  // Step 2 onward: every DB operation runs under the service role. RLS is
  // bypassed deliberately — the role/org check below re-implements what
  // `is_org_sales_or_above()` does for client-side RLS, since a service-role
  // client is not itself subject to RLS.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", callerId)
    .single();

  if (profileError || !profile || !ALLOWED_ROLES.includes(profile.role)) {
    return jsonResponse({ status: "failed", error: "Forbidden" } satisfies PostResult, 403);
  }
  const organizationId = profile.organization_id as string;

  // Step 3: load the post_drafts / post_targets rows, scoped to the caller's org.
  const { data: draft, error: draftError } = await admin
    .from("post_drafts")
    .select("id, organization_id, caption")
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .single();

  if (draftError || !draft) {
    return jsonResponse({ status: "failed", error: "Draft not found" } satisfies PostResult, 404);
  }

  const { data: target, error: targetError } = await admin
    .from("post_targets")
    .select("draft_id, platform, status")
    .eq("draft_id", draftId)
    .eq("platform", platform)
    .single();

  if (targetError || !target) {
    return jsonResponse({ status: "failed", error: "Post target not found" } satisfies PostResult, 404);
  }

  // Step 4: social_providers.enabled gate — the API path never fires when off.
  const { data: providerConfig, error: providerConfigError } = await admin
    .from("social_providers")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("provider_id", "meta-publish")
    .eq("platform", platform)
    .single();

  if (providerConfigError || !providerConfig || providerConfig.enabled !== true) {
    return failAndRecord(admin, draftId, platform, "Meta publishing is not enabled for this platform", 403);
  }

  // Step 5: token lookup — service-role only; social_provider_credentials has
  // zero authenticated-role RLS policies, so this table is unreachable from
  // any client-side query regardless of role.
  const { data: credentials, error: credentialsError } = await admin
    .from("social_provider_credentials")
    .select("access_token, page_id, ig_business_id, expires_at")
    .eq("organization_id", organizationId)
    .eq("provider_id", "meta-publish")
    .single();

  if (credentialsError || !credentials?.access_token) {
    return failAndRecord(admin, draftId, platform, "No Meta credentials configured", 400);
  }

  if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
    return failAndRecord(admin, draftId, platform, "Meta credentials expired", 400);
  }

  // Step 6: call the Graph API. Facebook Page posts and Instagram Business
  // posts use different endpoints/object ids; both are keyed off the same
  // stored credentials row.
  const targetObjectId = platform === "instagram" ? credentials.ig_business_id : credentials.page_id;
  if (!targetObjectId) {
    return failAndRecord(
      admin,
      draftId,
      platform,
      `No ${platform === "instagram" ? "IG Business" : "Page"} id configured`,
      400,
    );
  }

  let graphResponse: Response;
  try {
    graphResponse = await fetch(
      `${GRAPH_API_BASE}/${targetObjectId}/feed`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: draft.caption,
          access_token: credentials.access_token,
        }),
      },
    );
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : "Graph API request failed";
    return failAndRecord(admin, draftId, platform, message, 502);
  }

  let graphBody: { id?: string } | null | undefined;
  try {
    graphBody = await graphResponse.json();
  } catch {
    return failAndRecord(admin, draftId, platform, "Malformed Graph API response", 502);
  }

  if (!graphResponse.ok || !graphBody?.id) {
    const message = graphBody?.error?.message ?? `Graph API error (${graphResponse.status})`;
    return failAndRecord(admin, draftId, platform, message, 502);
  }

  // Step 7: sole writer of the result — post_targets update + campaign_log insert.
  const postedAt = new Date().toISOString();
  const platformPostId = String(graphBody.id);

  const { error: updateError } = await admin
    .from("post_targets")
    .update({ status: "posted", posted_platform_id: platformPostId, error: null })
    .eq("draft_id", draftId)
    .eq("platform", platform);

  if (updateError) {
    return jsonResponse(
      { status: "failed", error: `Posted to Meta but failed to record result: ${updateError.message}` } satisfies PostResult,
      500,
    );
  }

  await admin.from("campaign_log").insert({
    organization_id: organizationId,
    draft_id: draftId,
    platform,
    channel: "api",
    platform_post_id: platformPostId,
    posted_at: postedAt,
  });

  const result: PostResult = { status: "posted", platformPostId, postedAt };
  return jsonResponse(result, 200);
});
