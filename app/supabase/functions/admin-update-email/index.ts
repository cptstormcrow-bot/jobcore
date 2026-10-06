// supabase/functions/admin-update-email/index.ts
//
// Deno-runtime Supabase Edge Function: lets an owner/admin change another
// employee's login email (auth.users.email) within the same organization.
//
// Auth pattern follows `meta-publish`: identity is established with
// `auth.getUser` against the caller's bearer token (anon client), then a
// service-role client does every DB read and the auth admin update.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/** Roles permitted to change another user's login email. */
const ALLOWED_ROLES = ["owner", "admin"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: { userId?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Malformed payload" }, 400);
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!userId || !email) {
    return jsonResponse({ error: "userId and email are required" }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "Invalid email" }, 400);
  }

  // Identity: verify the caller's bearer token.
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: "Unauthenticated" }, 401);
  }
  const callerId = userData.user.id;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: caller, error: callerError } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", callerId)
    .single();
  if (callerError || !caller || !ALLOWED_ROLES.includes(caller.role)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError || !target || target.organization_id !== caller.organization_id) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  if (userId === callerId) {
    return jsonResponse({ error: "Cannot change your own email here" }, 400);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });
  if (updateError) {
    const msg = (updateError.message ?? "").toLowerCase();
    const code = (updateError as { code?: string }).code;
    const status = (updateError as { status?: number }).status;
    if (
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      code === "email_exists" ||
      status === 422
    ) {
      return jsonResponse({ error: "email_taken" }, 409);
    }
    return jsonResponse({ error: updateError.message ?? "Update failed" }, 500);
  }

  return jsonResponse({ ok: true, email }, 200);
});
