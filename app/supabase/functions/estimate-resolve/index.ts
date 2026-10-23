// supabase/functions/estimate-resolve/index.ts
//
// Deno-runtime Supabase Edge Function: public, unauthenticated, GET-only
// resolver for a job estimate's customer-facing share link (Job Estimate
// feature, Wave 2). The token IS the auth — no Supabase session exists for
// the customer holding the link, mirroring handoff-resolve's rationale.
//
// Route:
//   GET /?token=<token>  ->  a server-rendered, printable HTML page
//
// The function response IS the customer-facing page (Content-Type: text/html)
// — there is no separate frontend route for this. Reads job_estimates,
// job_estimate_line_items, jobs, and customers under the service role
// (bypasses RLS by design — this is the one place in the system that
// legitimately reads across org boundaries via a bearer token instead of a
// session). Never selects/joins job_estimates.internal_notes or any
// commission/payroll table — this is a public page.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeTotals,
  DEFAULT_FINE_PRINT_PLACEHOLDER,
  ESTIMATE_LABELS,
  formatMoney,
  materialsOnsiteLabel,
} from "./estimate-layout.ts";
import type { ContingencyItem } from "./estimate-layout.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Inline shapes — reimplemented (not imported) to match the DB schema
// (0036_job_estimates.sql / 0037_estimate_tokens.sql / 0004_scheduling.sql)
// field-for-field. Edge Functions run under Deno outside the npm/tsc
// workspace tree (apps/*, packages/*, modules/* only), so these are
// restated here, same pattern as handoff-resolve.
// ---------------------------------------------------------------------------

interface JobEstimateLineItem {
  id: string;
  kind: string;
  description: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

interface EstimatePageData {
  organizationName: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  jobAddress: string | null;
  jobDescription: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  summary: string | null;
  materialsCost: number;
  laborCost: number;
  otherCost: number;
  totalCost: number;
  paymentTerms: string | null;
  depositAmount: number | null;
  customerNotes: string | null;
  lineItems: JobEstimateLineItem[];
  materialsOnsite: boolean;
  finePrint: string;
  pdfDelivery: boolean;
  contingencies: ContingencyItem[];
}

// ---------------------------------------------------------------------------
// Response helpers — HTML envelope for both success and error responses, so
// every response renders in the browser instead of prompting a download.
// ---------------------------------------------------------------------------

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function errorPage(message: string, status: number): Response {
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Estimate unavailable</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2933; }
    .box { max-width: 32rem; margin: 4rem auto; text-align: center; }
    h1 { font-size: 1.25rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>This estimate link is not available</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
  // Status intentionally still carries the real error code (404/401) — the
  // body is HTML either way "so it renders instead of downloading."
  return htmlResponse(body, status);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not yet scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet scheduled";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

interface ResolvedToken {
  jobId: string;
}

/**
 * Looks up an `estimate_tokens` row by its raw token value. Returns
 * `{ status: "not_found" }` for an unknown token and `{ status: "expired" }`
 * for one past `expires_at`, otherwise `{ status: "ok", token }`.
 */
async function resolveToken(
  token: string,
): Promise<{ status: "not_found" } | { status: "expired" } | { status: "ok"; token: ResolvedToken }> {
  const { data, error } = await supabase
    .from("estimate_tokens")
    .select("job_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { status: "not_found" };
  }

  const isExpired = new Date(data.expires_at).getTime() <= Date.now();
  if (isExpired) {
    return { status: "expired" };
  }

  return { status: "ok", token: { jobId: data.job_id } };
}

/**
 * Joins job, customer, organization, the job_estimates header, and line
 * items (ordered by kind) into the flat page-data shape renderEstimateHtml
 * needs. Returns `null` if the job or its estimate header cannot be found.
 * Never selects job_estimates.internal_notes — this is a public page.
 */
async function fetchEstimatePageData(jobId: string): Promise<EstimatePageData | null> {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, organization_id, customer_id, address, description")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    throw jobError;
  }
  if (!job) {
    return null;
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", job.organization_id)
    .maybeSingle();

  if (orgError) {
    throw orgError;
  }

  let customerName = "Customer";
  let customerPhone: string | null = null;
  let customerEmail: string | null = null;

  if (job.customer_id) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("name, phone, email")
      .eq("id", job.customer_id)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }
    if (customer) {
      customerName = customer.name;
      customerPhone = customer.phone;
      customerEmail = customer.email;
    }
  }

  const { data: estimate, error: estimateError } = await supabase
    .from("job_estimates")
    .select(
      "status, summary, materials_cost, labor_cost, other_cost, total_cost, scheduled_start, scheduled_end, payment_terms, deposit_amount, customer_notes, materials_onsite, fine_print, pdf_delivery, contingencies",
    )
    .eq("job_id", jobId)
    .maybeSingle();

  if (estimateError) {
    throw estimateError;
  }
  if (!estimate) {
    return null;
  }

  const { data: settings, error: settingsError } = await supabase
    .from("estimate_settings")
    .select("fine_print_template")
    .eq("organization_id", job.organization_id)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  const { data: lineItems, error: lineItemsError } = await supabase
    .from("job_estimate_line_items")
    .select("id, kind, description, quantity, unit_cost, line_total")
    .eq("job_id", jobId)
    .order("kind", { ascending: true });

  if (lineItemsError) {
    throw lineItemsError;
  }

  return {
    organizationName: org?.name ?? "",
    customerName,
    customerPhone,
    customerEmail,
    jobAddress: job.address,
    jobDescription: job.description,
    scheduledStart: estimate.scheduled_start,
    scheduledEnd: estimate.scheduled_end,
    status: estimate.status,
    summary: estimate.summary,
    materialsCost: Number(estimate.materials_cost),
    laborCost: Number(estimate.labor_cost),
    otherCost: Number(estimate.other_cost),
    totalCost: Number(estimate.total_cost),
    paymentTerms: estimate.payment_terms,
    depositAmount: estimate.deposit_amount === null ? null : Number(estimate.deposit_amount),
    customerNotes: estimate.customer_notes,
    materialsOnsite: estimate.materials_onsite === true,
    finePrint:
      typeof estimate.fine_print === "string" && estimate.fine_print.trim() !== ""
        ? estimate.fine_print
        : typeof settings?.fine_print_template === "string" &&
            settings.fine_print_template.trim() !== ""
          ? settings.fine_print_template
          : DEFAULT_FINE_PRINT_PLACEHOLDER,
    pdfDelivery: estimate.pdf_delivery === true,
    contingencies: Array.isArray(estimate.contingencies)
      ? estimate.contingencies
          .filter((c: unknown) => c !== null && typeof c === "object")
          .map((c: { description?: unknown; price?: unknown; applies?: unknown }) => ({
            applies: c.applies === true,
            description: typeof c.description === "string" ? c.description : "",
            price:
              c.price === null || c.price === undefined || !Number.isFinite(Number(c.price))
                ? null
                : Number(c.price),
          }))
          .filter((c: ContingencyItem) => c.description.trim() !== "")
      : [],
    lineItems: (lineItems ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      description: row.description,
      quantity: Number(row.quantity),
      unit_cost: Number(row.unit_cost),
      line_total: Number(row.line_total),
    })),
  };
}

/**
 * Server-renders the printable estimate page: header, job details,
 * materials/line items table, completion schedule, payment outlay, and a
 * `.no-print` Print/Save-as-PDF button. PDF-on-demand is entirely the
 * browser's native print-to-PDF via the `@media print` stylesheet below —
 * no server-side PDF library.
 */
function renderEstimateHtml(data: EstimatePageData): string {
  const lineItemRows = data.lineItems
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="cell-kind">${escapeHtml(item.kind)}</td>
          <td class="cell-num">${item.quantity}</td>
          <td class="cell-num">${formatMoney(item.unit_cost)}</td>
          <td class="cell-num">${formatMoney(item.line_total)}</td>
        </tr>`,
    )
    .join("");

  const totals = computeTotals(
    data.lineItems.map((li) => ({ quantity: li.quantity, unitCost: li.unit_cost })),
    data.contingencies,
  );
  const contingencyRows = data.contingencies
    .map(
      (c) =>
        `<li>${escapeHtml(c.description)}${c.price !== null ? ` &mdash; ${formatMoney(c.price)}` : ""}</li>`,
    )
    .join("");
  const contingencySection = contingencyRows
    ? `<h2>${escapeHtml(ESTIMATE_LABELS.contingencies)}</h2>
    <p class="muted">Possible extras - only items marked as applying are included in the total.</p>
    <ul>${contingencyRows}</ul>`
    : "";
  const finePrintSection = data.finePrint.trim()
    ? `<h2>${escapeHtml(ESTIMATE_LABELS.finePrint)}</h2>
    <p class="muted" style="white-space: pre-wrap;">${escapeHtml(data.finePrint)}</p>`
    : "";
  const printButton = data.pdfDelivery
    ? `<div class="no-print">
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Estimate — ${escapeHtml(data.organizationName)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; color: #1f2933; }
    .page { max-width: 42rem; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; margin-bottom: 0.5rem; border-bottom: 1px solid #d2d6dc; padding-bottom: 0.25rem; }
    .muted { color: #616e7c; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid #e4e7eb; font-size: 0.9rem; }
    .cell-num, .cell-kind { text-align: right; }
    .totals { margin-top: 0.75rem; width: 100%; }
    .totals td { border: none; padding: 0.2rem 0.5rem; }
    .totals .label { text-align: right; color: #616e7c; }
    .totals .value { text-align: right; width: 8rem; }
    .totals .grand td { font-weight: 700; border-top: 1px solid #1f2933; padding-top: 0.5rem; }
    .no-print { margin-top: 2rem; }
    button { font-size: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
    @media print {
      @page { margin: 0.75in; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>${escapeHtml(data.organizationName)}</h1>
    <p class="muted">Estimate for ${escapeHtml(data.customerName)} &middot; status: ${escapeHtml(data.status)}</p>

    <h2>Job Details</h2>
    <p>${escapeHtml(data.jobAddress ?? "No address on file")}</p>
    <p class="muted">${escapeHtml(data.jobDescription ?? "")}</p>
    ${data.summary ? `<p>${escapeHtml(data.summary)}</p>` : ""}
    <p>${escapeHtml(ESTIMATE_LABELS.materialsOnsite)} ${materialsOnsiteLabel(data.materialsOnsite)}</p>

    ${contingencySection}

    <h2>Materials &amp; Line Items</h2>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="cell-kind">Kind</th>
          <th class="cell-num">Qty</th>
          <th class="cell-num">Unit Cost</th>
          <th class="cell-num">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows || `<tr><td colspan="5" class="muted">No line items yet.</td></tr>`}
      </tbody>
    </table>

    <h2>Completion Schedule</h2>
    <p>Start: ${escapeHtml(formatDateTime(data.scheduledStart))}</p>
    <p>End: ${escapeHtml(formatDateTime(data.scheduledEnd))}</p>

    <h2>Payment Outlay</h2>
    <table class="totals">
      <tr><td class="label">Materials</td><td class="value">${formatMoney(data.materialsCost)}</td></tr>
      <tr><td class="label">Labor</td><td class="value">${formatMoney(data.laborCost)}</td></tr>
      <tr><td class="label">Other</td><td class="value">${formatMoney(data.otherCost)}</td></tr>
      <tr class="grand"><td class="label">Total</td><td class="value">${formatMoney(totals.total)}</td></tr>
    </table>
    ${data.depositAmount !== null ? `<p>Deposit required: ${formatMoney(data.depositAmount)}</p>` : ""}
    ${data.paymentTerms ? `<p class="muted">Payment terms: ${escapeHtml(data.paymentTerms)}</p>` : ""}
    ${data.customerNotes ? `<p class="muted">${escapeHtml(data.customerNotes)}</p>` : ""}

    ${finePrintSection}

    ${printButton}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (req.method !== "GET") {
    return errorPage("This link only supports GET requests.", 404);
  }

  if (!token) {
    return errorPage("No estimate token was provided.", 404);
  }

  try {
    const resolved = await resolveToken(token);
    if (resolved.status === "not_found") {
      return errorPage("This estimate link is invalid.", 404);
    }
    if (resolved.status === "expired") {
      return errorPage("This estimate link has expired.", 401);
    }

    const data = await fetchEstimatePageData(resolved.token.jobId);
    if (!data) {
      return errorPage("This estimate could not be found.", 404);
    }

    return htmlResponse(renderEstimateHtml(data));
  } catch (err) {
    return errorPage(
      err instanceof Error ? err.message : "Unexpected error loading this estimate.",
      500,
    );
  }
});
