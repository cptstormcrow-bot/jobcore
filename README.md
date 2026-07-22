# Jobcore — build-prompt series

A phased set of prompts for building **Jobcore** (formerly working name *SDAssembly Scheduling App*):
a cross-platform Android + iOS scheduling app with a modular core — a base scheduling engine plus
pluggable modules for Admin/Finance, Handyman/Assembler, and Sales/Marketing.

**These files are prompts, not code.** Nothing here builds anything by itself. You hand them to an
AI coding tool, one phase at a time.

## How to use this

1. Open a **fresh session** in your coding tool of choice.
2. Paste `00-MASTER-SPEC.md` **plus exactly one** phase file (`01-P1…` through `07-P7…`).
3. Let it build that phase to completion and run the phase's **Verification steps**.
4. Only then move to the next phase, again in a fresh session.

**One phase per session, always.** Each phase file is self-contained: it declares what already
exists, what to build, what *not* to build, how you'll know it worked, and how to check. No phase
file references a sibling phase file — only the Master Spec. Pasting two phases at once is the
fastest way to get a half-built module and a coupled shell.

The Master Spec is the durable source of truth. If a phase file and the Master Spec ever disagree,
the Master Spec wins, and the phase file is a bug.

## The files

| File | Phase | What it builds |
|---|---|---|
| `00-MASTER-SPEC.md` | — | The durable spec: constraints, domain facts, data model, module contract, compensation model. Paste with **every** phase. |
| `01-P1-foundation.md` | P1 | Monorepo, Expo shell, auth, roles, and the module registry |
| `02-P2-scheduling-core.md` | P2 | Schema, job state machine, calendar, offline queue |
| `03-P3-admin-finance.md` | P3 | **Chief module** — lead intake, dispatch, price sheets, commissions, payroll |
| `04-P4-field-tech.md` | P4 | The tech's day — greeting, checklists, photos, earnings |
| `05-P5-payment-review.md` | P5 | One QR: payment handoff + review capture |
| `06-P6-sales-marketing.md` | P6 | Review library, post composer, social publishing |
| `07-P7-intake-hardening.md` | P7 | Real intake adapters, push, audit review, e2e, store builds |

## Non-negotiables

These hold across every phase. They are restated in the Master Spec with reasoning.

- **The website backend is out of scope.** No phase writes, deploys, or modifies anything on
  sdassemblypro.com — not its PHP, not its forms, not its database. P7 documents the intake contract
  the website *would* satisfy; it does not implement it.
- **Analytics stays Google.** Never add, change, or remove GTM/GA4 tags anywhere. Reading numbers is
  marketing's job; maintaining the tracking machinery is not this app's.
- **Zero PCI scope.** No card data ever touches the app, the database, or the handoff page.
- **No review gating.** Every customer sees the same review links regardless of rating — Google
  policy and the FTC's 2024 consumer-review rule.
- **Payout feeds review, not the reverse.** No rating input affects any commission, bonus, or payout.
- **Timestamps are payroll-grade.** `en_route_at → completed_at` spans *are* the hours a tech is paid
  for. They are audit rows, never editable telemetry.

## Before P3 ships

The **productivity-bonus policy** is deliberately unwritten. P3 ships `NullBonusRule` (returns zero,
with a reason) behind a `BonusRule.evaluate(...)` seam. Supply the written policy and implement one
rule against that seam — do **not** let a coding tool invent a bonus formula, because a guessed
formula that silently ships is a wage dispute waiting to happen.

## Layout the prompts assume

```
jobcore/
  apps/mobile/               Expo app shell — auth, routing, module registry mount
  packages/core/             job state machine, data types, offline queue, sync
  packages/module-sdk/       the plug-in contract (types + registration API)
  packages/ui/               shared design system
  modules/admin-finance/     ← chief module (built first)
  modules/field-tech/
  modules/sales-marketing/
  supabase/                  migrations, RLS policies, edge functions
  web/handoff/               the QR landing page (payment + review state machine)
```

## The honest limit of "pluggable"

React Native cannot load native code at runtime, so a module is **not** a downloadable plug-in. A
module is a workspace package registered at compile time and toggled per organization via
`organizations.enabled_modules`. Adding a module is a build; enabling one is a config change.

That distinction is the point of P1's most important test: removing a module id from
`enabled_modules` must make its tab disappear **with no code change**. If that ever stops being
true, the plug-in contract has quietly broken and every later phase inherits the damage.
