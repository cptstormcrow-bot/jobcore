// supabase/functions/ups-track/index.ts
//
// Deno-runtime Supabase Edge Function: UPS tracking lookup.
// POST { trackingNumber } -> { ok, status, delivered, deliveredAt? }.
// JWT verification stays on. Secrets come from env only and are never logged.

const UPS_CLIENT_ID = Deno.env.get("UPS_CLIENT_ID") ?? "";
const UPS_CLIENT_SECRET = Deno.env.get("UPS_CLIENT_SECRET") ?? "";
const UPS_API_BASE = Deno.env.get("UPS_API_BASE") ?? "https://onlinetools.ups.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

let cached: { token: string; exp: number } | null = null;

/** Client-credentials token; cached in module scope until expires_in - 60s. */
async function getToken(): Promise<string | number> {
  if (cached && Date.now() < cached.exp) return cached.token;
  let res: Response;
  try {
    res = await fetch(`${UPS_API_BASE}/security/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${UPS_CLIENT_ID}:${UPS_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  } catch {
    return -1;
  }
  if (!res.ok) return res.status;
  const j = await res.json().catch(() => null);
  const token = j?.access_token;
  if (typeof token !== "string" || !token) return -1;
  const ttl = Number(j?.expires_in) || 3600;
  cached = { token, exp: Date.now() + Math.max(ttl - 60, 0) * 1000 };
  return token;
}

// deno-lint-ignore no-explicit-any
function mapStatus(pkg: any): string {
  const s = pkg?.currentStatus ?? pkg?.activity?.[0]?.status ?? {};
  const type = String(s.type ?? "").toUpperCase();
  const text = `${s.description ?? ""} ${s.simplifiedTextDescription ?? ""}`;
  if (type === "D" && /out for delivery/i.test(text)) return "Out for delivery";
  if (type === "D" && /deliver/i.test(text)) return "Delivered";
  if (type === "X" || /exception/i.test(text)) return "Exception";
  if (/label|manifest|ready for ups/i.test(text)) return "Label created";
  return "In transit";
}

// deno-lint-ignore no-explicit-any
function deliveredAt(pkg: any): string | undefined {
  // deno-lint-ignore no-explicit-any
  const d = (pkg?.deliveryDate ?? []).find((x: any) => x?.type === "DEL")?.date;
  const t = pkg?.deliveryTime;
  const end = t?.type === "DEL" ? t?.endTime : undefined;
  if (!/^\d{8}$/.test(String(d ?? "")) || !/^\d{6}$/.test(String(end ?? ""))) return undefined;
  const ds = String(d), ts = String(end);
  return `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}T${ts.slice(0, 2)}:${ts.slice(2, 4)}:${ts.slice(4, 6)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405);

  let tn = "";
  try {
    const body = await req.json();
    tn = String(body?.trackingNumber ?? "").trim();
  } catch { /* fall through to validation */ }
  if (!/^[A-Za-z0-9]{8,40}$/.test(tn)) return json({ ok: false, error: "invalid-tracking-number" }, 400);

  if (!UPS_CLIENT_ID || !UPS_CLIENT_SECRET) return json({ ok: false, error: "ups-not-configured" });

  const token = await getToken();
  if (typeof token !== "string") {
    return json({ ok: false, error: `ups-upstream-${token === -1 ? "network" : token}` });
  }

  let res: Response;
  try {
    res = await fetch(`${UPS_API_BASE}/api/track/v1/details/${encodeURIComponent(tn)}`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "transId": crypto.randomUUID(),
        "transactionSrc": "jobcore",
      },
    });
  } catch {
    return json({ ok: false, error: "ups-upstream-network" });
  }

  const notFound = { ok: true, status: "Not found", delivered: false };
  if (res.status === 404 || res.status === 400) return json(notFound);
  if (!res.ok) {
    if (res.status === 401) cached = null;
    return json({ ok: false, error: `ups-upstream-${res.status}` });
  }

  const j = await res.json().catch(() => null);
  const shipment = j?.trackResponse?.shipment?.[0];
  const pkg = shipment?.package?.[0];
  if (!pkg) return json(notFound);

  const status = mapStatus(pkg);
  const delivered = status === "Delivered";
  const at = delivered ? deliveredAt(pkg) : undefined;
  return json({ ok: true, status, delivered, ...(at ? { deliveredAt: at } : {}) });
});
