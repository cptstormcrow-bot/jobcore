---
classification: build-reports/jobcore-p3-admin-finance
comments: "Jobcore P3 - P3-a money schema: 0005_money.sql (7 tables, 3..."
origin: .claude/build-reports/jobcore-p3-admin-finance/2026-08-05_p3a-money-schema.md
tags: [build-reports, jobcore-p3-admin-finance]
---
---BUILD REPORT---

# Jobcore P3 - P3-a money schema: 0005_money.sql (7 tables, 3 enums, 4 immutability triggers, publish RPC, RLS)

Tier: A
Goal slug: `jobcore-p3-admin-finance`
Plan of record: ledger rows P3a.1-P3a.8 in `Jobcore\handoff\P3-SLICE-LEDGER.md`
Spec of record: `Jobcore\03-P3-admin-finance.md`
Commit: b25c99e - docs(handoff): correct falsified P3a.2 row - CHECK is introduced, not byte-matched (P3 ledger held at exactly 200 lines)
Commit: 426e368 - feat(admin-finance): P3-a money schema - 0005_money.sql (1 file changed, 552 insertions(+); `create mode 100644 app/supabase/0005_money.sql`)
Files: `app/supabase/0005_money.sql` (CREATED, 552 lines); ledger of record `handoff/P3-SLICE-LEDGER.md` rows P3a.1-P3a.8

This group is DB-GATED. Per Rule 15 R-A the ungated core (structural SQL) proceeded on its own
track and is verified below; every acceptance criterion that requires a provisioned Postgres is
recorded OPEN, never PASSED, and is deferred to one provisioned re-run pass.

## What changed

`426e368` lands the admin/finance money migration in eight authoring slices, appended in order to a
single file. Line-count progression across slices: 70 -> 117 -> 161 -> 224 -> 375 -> 458 -> 552.

- **P3a.1 (-> 70)** - file header mirroring `0004_scheduling.sql`'s style; three enums per the
  `0004_scheduling.sql:8-10` doctrine: `publication_status` (`draft`, `published`, `superseded`),
  `reimbursement_status` (`pending`, `approved`, `rejected`, `paid`), `payout_batch_status`
  (`draft`, `approved`, `paid`). Plus `public.is_org_admin() returns boolean` with NO parameters,
  mirroring the existing `public.current_org_id()` convention in `0001_foundation.sql`;
  `security definer / stable / search_path=''`; membership resolved via `public.profiles(id,
  organization_id, role)` with role `in ('owner','admin')` against `auth.uid()`.
- **P3a.2 (-> 117)** - `public.price_sheets` (id uuid pk `gen_random_uuid()`, `organization_id` FK
  to `public.organizations(id) on delete cascade`, `version`, `effective_from`, `published_at`,
  `status publication_status not null default 'draft'`, timestamps, `unique (organization_id,
  version)`, and the named partial unique index `price_sheets_one_published_idx` =
  `unique (organization_id) where status = 'published'`) and `public.price_sheet_rates`
  (`price_sheet_id` FK on delete cascade, `service_id` FK, `attach_timing text`, `amount_cents`,
  timestamps, unique index on the `(price_sheet_id, service_id, attach_timing)` triple - NULL
  `attach_timing` deliberately not deduped, no workaround). Resolved from disk by the hound:
  services table = `public.services`, rate column = `amount_cents`.
- **P3a.3 (-> 161)** - `compensation_policies` (org-scoped, `name`, pay-rule columns mirroring
  `money/types.ts` and `money/commission.ts` field names and units, `status`, timestamps) and
  `commissions` (org-scoped; `job_id` FK `on delete restrict`; person FK to `public.profiles(id)`;
  both snapshot FKs `price_sheet_id` and `compensation_policy_id` NOT NULL and `on delete restrict`
  per Master Spec section 9; `amount_cents`; nullable `voided_at`; and
  `create unique index commissions_one_per_job_idx on public.commissions (job_id) where voided_at is null;`).
  Resolved from disk: jobs table = `public.jobs`, person FK = `public.profiles.id`, rate unit =
  `Money` (integer cents) plus `commissionBasisPercent` (a plain percent number, NOT basis points).
- **P3a.4 (-> 224)** - `reimbursements` (org-scoped, `user_id` FK `on delete restrict`, NULLABLE
  `job_id`, `amount_cents`, `description`, `receipt_photo_path`, `status reimbursement_status
  default 'pending'`, `approved_by`, `approved_at`, timestamps - and, per spec, NO column of any
  kind linking a reimbursement to a commission row); `payout_batches` (`period_start`,
  `period_end`, `status payout_batch_status default 'draft'`, `approved_by`, `approved_at`,
  `paid_at`); `payout_lines` (org-scoped, `payout_batch_id` FK on delete cascade, `user_id` FK on
  delete restrict, `hours_amount` / `commission_amount` / `bonus_amount` / `reimbursement_amount`
  all `integer not null default 0`, `total_amount`, and the CHECK
  `check (total_amount = hours_amount + commission_amount + bonus_amount + reimbursement_amount)`).
- **P3a.5 (-> 375)** - four immutability triggers, all `language plpgsql`, plain (not security
  definer), `set search_path = ''` with every reference schema-qualified, naming style
  `public.<table>_immutable()` / `<table>_immutable_trg`, raising clear exceptions:
  `price_sheets` (block UPDATE/DELETE once `status` is `published` or `superseded`, EXCEPT the
  status-only transition `published -> superseded`); `price_sheet_rates` (block UPDATE/DELETE when
  the parent sheet is not `draft`); `commissions` (immutable once created EXCEPT setting
  `voided_at` - void is the correction mechanism - and DELETE blocked outright); `payout_lines`
  (block UPDATE/DELETE when the parent batch is not `draft`).
- **P3a.6 (-> 458)** - `public.publish_price_sheet(p_price_sheet_id uuid)`, `language plpgsql`,
  `security definer`, `set search_path = ''`, implementing the verbatim contract at
  `03-P3-admin-finance.md` L84 (publishing "stamps `published_at`, supersedes the prior sheet, and
  increments `version`"): asserts the caller is an org admin via `public.is_org_admin()`; asserts
  the sheet exists, belongs to the caller's org via `public.current_org_id()`, and is `draft`;
  DEMOTES the org's currently-published sheet to `superseded` BEFORE promoting the target, so
  `price_sheets_one_published_idx` is never violated at any point; promotes with `status =
  'published'` and `published_at = now()`; and guarantees the published sheet carries a strictly
  higher `version` than the sheet it supersedes.
- **P3a.7 (-> 552)** - `alter table ... enable row level security` on all seven tables, plus nine
  policies mirroring the style and idiom of the existing block at `0001_foundation.sql:159-176`.
  Six tables (`price_sheets`, `price_sheet_rates`, `compensation_policies`, `commissions`,
  `payout_batches`, `payout_lines`) are admin-only within the caller's organization - a non-admin
  sees ZERO rows, which is the mechanism for the spec L177 acceptance criterion. `reimbursements`
  carries three policies: org admins get full access, and a non-admin may SELECT and INSERT their
  OWN rows (`user_id = auth.uid()`) within their org but may never UPDATE, DELETE, or approve.
  `payout_lines` carries its own `organization_id` and is scoped directly; `price_sheet_rates` does
  not and is scoped via its parent sheet. This migration adds NO policy to and makes NO reference
  to `public.audit_log`.
- **P3a.8** - structural verification, commit, this report, and the ledger stamping.

### Decision - the `attach_timing` value set is INTRODUCED here, not byte-matched

The ledger's original P3a.2 row instructed the slice to byte-match a CHECK constraint to
`0004_scheduling.sql`. That instruction was falsified: `0004_scheduling.sql:78` (on `public.leads`)
and `:97` (on `public.jobs`) BOTH declare `attach_timing` as unconstrained `text` with no CHECK, so
there has never been anything to match. The row was corrected first, in its own commit `b25c99e`,
before the group ran.

The value set is therefore authored here, and the evidence pulls three ways:

- `00-MASTER-SPEC.md:125` and `sdassembly-scheduling-app.md:363` declare the pair
  `at_purchase | after_the_fact`; `07-P7-intake-hardening.md:39,120` defaults absent values to
  `at_purchase`.
- The ONLY `attach_timing` literal that exists on disk is `'before_start'`, seeded at
  `app/supabase/seed.sql:172,176,180,199,206,212,217,224` and
  `app/supabase/seed.hosted.sql:143,147,151,170,177,183,188,195`. It appears in no spec.
- The `hero_quick` lead carries `attach_timing` NULL;
  `app/modules/admin-finance/src/data/ports.ts:32` types it `attach_timing: string | null`; spec
  L51 requires incomplete leads to be first-class.

DECISION: admit all three values plus NULL. A CHECK admitting only the spec pair would break both
seed files on load, and the seed files are foreign-modified and must not be edited; a CHECK
admitting only the seeded literal would contradict the Master Spec. The constraint as shipped
(line 110) reads:

    check (attach_timing is null or attach_timing in ('at_purchase', 'after_the_fact', 'before_start'))

This reconciliation is disclosed in the body of commit `426e368`.

## Verification

All commands run from the main session (not asserted by a hound), against
`E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\0005_money.sql`.

Sweep 1 - census and hard constraints (Rule 29-B provenance):

    $p='E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\0005_money.sql'
    "LINES=" + (Get-Content $p).Count
    "NONASCII=" + [bool]([IO.File]::ReadAllText($p) -match '[^\x00-\x7F]')
    "DOLLARQ=" + ([regex]::Matches([IO.File]::ReadAllText($p),'\$\$')).Count
    "RLS=" + (Select-String -Path $p -Pattern 'enable row level security').Count
    "AUDITLOG=" + (Select-String -Path $p -Pattern 'audit_log').Count
    "CREATETABLE=" + (Select-String -Path $p -Pattern '^create table').Count
    "CREATEFUNC=" + (Select-String -Path $p -Pattern '^create or replace function|^create function').Count
    "CREATETRG=" + (Select-String -Path $p -Pattern '^create trigger').Count
    "POLICIES=" + (Select-String -Path $p -Pattern '^create policy').Count
    "CREATETYPE=" + (Select-String -Path $p -Pattern '^create type').Count

Verbatim output:

    LINES=552
    NONASCII=False
    DOLLARQ=12
    RLS=7
    AUDITLOG=0
    CREATETABLE=7
    CREATEFUNC=6
    CREATETRG=4
    POLICIES=9
    CREATETYPE=3

Sweep 2 - CHECK values and full object census:

    $p='E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\0005_money.sql'
    Select-String -Path $p -Pattern 'attach_timing in|total_amount =' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }
    Select-String -Path $p -Pattern '^create (table|type|trigger|policy|or replace function|unique index|index)' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }

Key results: the `attach_timing` CHECK at line 110 and the `total_amount` sum identity at line 219,
both present and correct. Object census: enums at 11/20/30; functions at 54 (`is_org_admin`),
239/280/314/348 (the four trigger functions), 395 (`publish_price_sheet`); triggers at
272/305/341/373; tables at 80/101/123/141/168/188/206; policies at 475-548.

| Check | Result |
|---|---|
| Line count (Rule 29-B) | 552, matching the hound-reported figure exactly. PASS |
| Pure ASCII | NONASCII=False across all 552 lines. PASS |
| Balanced dollar-quoting | DOLLARQ=12 = 6 balanced pairs, matching CREATEFUNC=6 one-for-one. PASS |
| Seven spec tables | CREATETABLE=7 at 80, 101, 123, 141, 168, 188, 206. PASS |
| Three enums | CREATETYPE=3 at 11, 20, 30. PASS |
| Four triggers, four functions | CREATETRG=4 (272/305/341/373) against four distinct trigger functions (239/280/314/348). No duplication. PASS |
| RLS enabled on every table | RLS=7, one per table. PASS |
| Policy count | POLICIES=9 = 6 admin-only tables + 3 on `reimbursements`. PASS |
| `audit_log` untouched | AUDITLOG=0 - verified negatively from the main session, not merely hound-asserted. PASS |
| `attach_timing` CHECK | Present at line 110, three values plus NULL, as decided above. PASS |
| `total_amount` CHECK | Present at line 219. PASS |
| Partial unique indexes | `price_sheets_one_published_idx` (94) and `commissions_one_per_job_idx` (161, `where voided_at is null`). PASS |
| Publish RPC ordering | Hound-reported `demote-before-promote = yes` and `passes P3a.5 trigger = yes`; the P3a.5 brief independently required and confirmed `publish transition permitted = yes`. Two-sided check closed. PASS (structural) |
| Spec L177 - sign in as `tech@`, `select * from price_sheets`, expect zero rows | OPEN - requires a provisioned Postgres. Designed for by P3a.7's admin-only policies. NOT PASSED. |
| Trigger runtime behaviour, RPC execution, RLS enforcement | OPEN - all require a live database. NOT PASSED. |
| Migration applies cleanly against the seed data | OPEN - requires a live database. NOT PASSED. |

Commit provenance for `426e368`:

    cd "E:/Jeff/Codespace/SDAssemblyPros/Jobcore" && git add app/supabase/0005_money.sql && git status --short -- app/supabase/0005_money.sql && git commit -m "..." (x5)

Output: `A  app/supabase/0005_money.sql`; `[main 426e368] feat(admin-finance): P3-a money schema -
0005_money.sql`; `1 file changed, 552 insertions(+)`. The pathspec named that one file and nothing
else - the foreign entries `app/supabase/README.md`, `seed.sql`, `seed.hosted.sql`, and the two
hosted test files were correctly left unstaged.

## Forward contracts

1. The DB-gated acceptance criteria above are OPEN and owe one provisioned re-run pass. Chief among
   them is spec L177: sign in as `tech@`, run `select * from price_sheets`, expect zero rows.
   Nothing here is marked PASSED that was not observed.
2. `app/modules/admin-finance/src/index.ts:23` declares `migrations: ['0005_money.sql',
   '0006_job_service_area.sql']`. This change SATISFIES the first entry. `0006_job_service_area.sql`
   remains unwritten and is owed by a later slice.
3. The `attach_timing` value set introduced at line 110 is now the canonical set. Three later ledger
   rows consume it and must match it: `P3e.1` (`domain/lead.ts`), `P3f.3` (`AxisPicker.tsx`), and
   `P3i.4` (`PriceSheetEditorScreen.tsx`).
4. `public.is_org_admin()` (line 54) is a new shared helper. Any later migration or policy that
   needs an admin predicate should use it rather than re-deriving membership.
5. `public.publish_price_sheet(uuid)` is the ONLY supported way to publish a sheet - the P3a.5
   trigger makes a direct UPDATE impossible. Any UI or service layer must call the RPC.
6. The seed files were NOT edited. If a future slice changes the `attach_timing` value set, both
   `seed.sql` and `seed.hosted.sql` must be reconciled in the same operation or they will fail to
   load.

## Deviations / Defects

1. **RESOLVED - ledger row falsified, corrected before the group ran.** Row `P3a.2` instructed the
   slice to byte-match an `attach_timing` CHECK to `0004_scheduling.sql`. Both declarations there
   (`:78` on `leads`, `:97` on `jobs`) are unconstrained `text`, so no CHECK existed to match. The
   prior checkpoint's own account of this named only `:97` and was itself incomplete. Row corrected
   and committed separately at `b25c99e`; the P3 ledger held at exactly 200 lines.
2. **OPEN by decision, disclosed.** The shipped `attach_timing` CHECK admits three values plus NULL
   rather than the Master Spec's pair, because the seed files carry `'before_start'`, which appears
   in no spec, and a spec-only CHECK would break both seed files on load. Rationale in full above;
   disclosed in the body of commit `426e368`. The Master Spec and the seed data disagree with each
   other, and that disagreement is not resolved by this change.
3. **OPEN.** `03-P3-admin-finance.md` heads this section "### 2. Migration `0003_money.sql`", but
   the module manifest at `modules/admin-finance/src/index.ts:23` declares `0005_money.sql`, and
   `0001` / `0004` are already taken. The manifest wins; the spec heading is stale and needs
   correcting. Disclosed in the `426e368` body.
4. **OPEN - flagged, deliberately not fixed.** Ledger row `P3f.3` (line 95) carries the SAME
   byte-match falsification that `P3a.2` did: it instructs values to be "byte-matched to
   `0004_scheduling.sql`", where none exist. P3-f is not authorized, so the row was left untouched.
   It must be corrected before P3-f runs.
5. **RESOLVED - P3a.1 output violated a stated hard constraint.** The P3a.1 header line 1 read
   "Jobcore P3 - admin/finance money core" with a non-ASCII em-dash, breaching the pure-ASCII
   requirement carried in every brief. It was caught by P3a.2's ASCII-purity verification step and
   corrected to a plain hyphen. Final state verified: NONASCII=False across all 552 lines.
6. **RESOLVED, but a literal deviation.** Making that fix required Nestor to edit pre-existing
   content its P3a.2 brief told it not to touch. Defensible - the slice's own acceptance criterion
   demanded it, and the hound reported it unprompted rather than concealing it - but it is recorded
   here as a departure from the brief.
7. **RESOLVED - risk raised, closed by data.** The P3a.5 slice grew the file 224 -> 375, i.e. 151
   lines for four triggers, which raised a duplication concern. The P3a.8 object census closed it:
   exactly six functions (one helper, four triggers, one RPC) and exactly four `create trigger`
   statements, all at distinct line numbers.
8. **RESOLVED - process gap, closed with a clean result.** Line counts through P3a.1-P3a.7 were
   hound-reported and not main-session-verified until P3a.8. Given the P3-d precedent where a hound
   over-reported by one line, this was a real exposure. The P3a.8 re-measure returned LINES=552,
   matching exactly - the over-report did not recur.
9. **RESOLVED - self-caught process defect, carried forward as a standing prohibition.** Capturing
   an exit code through a pipe (`cmd | tail; echo $?`) reports the pipe tail's status, not the
   command's. This was first caught in P3-d; it is now written into every hound brief as an
   explicit prohibition and appears in all of the P3a.2-P3a.7 briefs.
10. **OPEN.** The foreign untracked entry `jobcore-mobile-build-toolchain.md` at the Jobcore repo
    root is not in the checkpoint's authorized-foreign list. It was treated as foreign and left
    entirely untouched.
11. **OPEN (pre-existing, carried from P3-d).** `packages/core`'s compiled `dist` output emits
    extensionless ESM re-exports, so a runtime value-import of `@jobcore/core` throws
    `ERR_MODULE_NOT_FOUND`. Not touched by this change - `0005_money.sql` is SQL and does not load
    the package - but it remains open and unauthorized to fix.
12. **RESOLVED - tool-layer outage, not a repo or permission problem.** Earlier in this session
    several Bash dispatches returned "claude-sonnet-5[1m] is temporarily unavailable, so auto mode
    cannot determine the safety of Bash right now." Read-only tools were unaffected and an identical
    retry succeeded. No command was partially applied.
13. **Deliberate divergence from a standing memory, not a defect.** Memory
    `feedback-ps51-native-exe-quote-splitting.md` recommends `git commit -F <file>`. Authoring that
    file from the main session would itself be a Rule 30 Bash-write violation, so both commits used
    repeated `-m` flags instead. Both landed cleanly with no quoting failure.

---BUILD REPORT---
