---BUILD REPORT---
GOAL: Rearrange the Prem checklist, make every field required, add schedule pickers and Prem answers to the
Estimate editor, and add the database fields the checklist needs.

RoA: jobcore / BUILD
Plan: prem-checklist-estimate-schedule | Date: 2026-10-06 | Status: COMPLETE
Why: The Prem checklist layout was hard to use, fields could be submitted empty, and the estimate editor had no
schedule pickers and did not show what the tech wrote on the Prem checklist.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-10-06_prem-checklist-estimate-schedule.md

Summary:
- Branch jobcore-role-landing-0.1.3. Commits 51b50be, 8e8c0b5, 552bc0e, plus migration 0077 (LIVE, pushed with Jeff's go).
- Prem checklist (app/modules/field-tech/src/screens/JobInvestigationScreen.tsx) rearranged: top row Add photo /
  Save Draft / Submit; Edit/Remove row sits above the card text.
- Every field is required to submit: a comment counts as filled; at least one photo is required.
- A "Materials arrived" checkbox sits under the top row, replacing the Needs Prem button.
- The bottom Clear Prem/Needs Prem button was removed from app/apps/mobile/app/job/[jobId].tsx.
- Estimate editor (JobEstimateEditor.tsx) gained schedule pickers and shows the Prem answers.
- Migration 0077_prem_checklist_fields.sql adds room_work, measurements, tech_instructions, materials_arrived to
  job_investigations, plus the tech DELETE policy job_planning_photos_delete_tech. LIVE.
- Ports/repos updated: admin-finance-repos.ts, field-tech-repos.ts, both ports.ts, module-ports.ts.
- packages/core jobStages.ts needed no change.

Files:
- Modified: JobInvestigationScreen.tsx, JobEstimateEditor.tsx, app/apps/mobile/app/job/[jobId].tsx,
  admin-finance-repos.ts, field-tech-repos.ts, both ports.ts, module-ports.ts.
- New: 0077_prem_checklist_fields.sql.

Evidence:
- Karen CONFIRMED tsc clean and npm test 234 of 234 pass.
- Karen confirmed the only checkbox on the checklist is materialsArrived and no "Clear Prem" text remains in the screen.
- NOT done: runtime check on http://localhost:8081.

Test plan: declined by Jeff (Rule 43, 2026-10-06).

Forward contracts:
- FC-1: Runtime check on http://localhost:8081 was never exercised this session.
- FC-2: Optional expo-image-manipulator for a real image resize.
- FC-3: Confirm getModulePorts() is registered at app start.
- FC-4: The 0077 live push contract from the earlier plan: HONORED.
- Carried from lineage (Rule 41, need Jeff): JD-08 (2026-09-20_jobcore-redlines-stabilize.md:3) and Restyle FC1
  device checklist (2026-09-04_job-detail-screen-restyle.md:136).
- Restyle FC2 TimeOff.tsx resolved in practice (ec46136).

## Deviations / Defects
- Image resize not done: only quality 0.5 applied, because no resizer dependency is installed.
- S6 admin-save overwrite defect found by Karen, fixed in S6b (passes through techId, ingressNotes,
  logisticsNotes, roomWork, measurements, techInstructions, materialsArrived, submittedAt in [jobId].tsx
  ~523-535) and re-verified.
- "Job not found" fixed via the job prop.
- A role-gated needs-prem menu item (label Clear Prem/Needs Prem, shown when role !== 'tech') remains in
  [jobId].tsx ~1302-1315 as a separate control, left in place.
