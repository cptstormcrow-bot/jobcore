---
status: DRAFT
classification: plans/jobcore-typecheck-and-field-tech-drift
comments: "Jobcore — TypeScript Typecheck Fixes + Field-Tech Architecture Drift"
origin: .claude/plans/jobcore-typecheck-and-field-tech-drift.md
tags: [plans, jobcore-typecheck-and-field-tech-drift]
---

# Jobcore — TypeScript Typecheck Fixes + Field-Tech Architecture Drift

## Context

_Design phase in progress — Plan agents dispatched for the two code-change domains below. This file will be filled in during Phase 4 Final Plan._

Scope, per Phase 1 exploration:
1. **TS strictness errors** (admin-finance, sales-marketing) — `noUncheckedIndexedAccess` fallout, localized guard/retype fixes.
2. **Field-tech ports drift + import-boundary violation** (field-tech, mobile) — wrong interface name in `module-ports.ts`, missing `buildFieldTechPorts` aggregator, two downstream implicit-any symptoms, and a cross-project-boundary import (`job-status-colors.ts`) that should relocate to `packages/ui`.
3. **Mobile Android build tooling** — out of scope for this plan's code changes; already tracked by an existing DRAFT plan (`jobcore-workstream-a-closure-then-workstream-b-android.md`) gated on Supabase Workstream A and requiring Jeff's hands-on device testing. Will be referenced, not redesigned.
