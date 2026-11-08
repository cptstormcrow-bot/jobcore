// supabase/functions/lead-intake/index.ts
//
// Deno entrypoint: website lead intake. POST jobcore-job-v1 (JSON or one-row
// CSV) with header `x-intake-key`. Inserts a `leads` row (never a job) using the
// service role, because leads RLS covers org staff only. See DEPLOY.md.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleIntake, type IntakeStore, type LeadInsert } from "./handler.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const store: IntakeStore = {
  async findOrgByKeyHash(hash: string) {
    const { data, error } = await supabase
      .from("lead_intake_keys")
      .select("organization_id")
      .eq("key_hash", hash)
      .eq("active", true)
      .maybeSingle();
    if (error || !data) return null;
    return data.organization_id as string;
  },
  async insertLead(row: LeadInsert) {
    const { error } = await supabase.from("leads").insert(row);
    if (!error) return "inserted";
    // 23505 = unique_violation on (organization_id, lead_id): already received.
    if (error.code === "23505") return "duplicate";
    throw new Error(error.message);
  },
};

Deno.serve(async (req: Request) => {
  try {
    const body = req.method === "POST" ? await req.text() : "";
    const res = await handleIntake({ method: req.method, headers: req.headers, body }, store);
    return new Response(JSON.stringify(res.body), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ ok: false, error: "Server error." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
