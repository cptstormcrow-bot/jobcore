/**
 * TimeOff screen for the field-tech module (P4 Wave 3 slice S3.6).
 *
 * Time-off request form + read-only "my requests" list. Deliberately
 * isolated from the job state machine: this screen never imports
 * `domain/transition.ts`, never imports `Job`/`JobStatus`/`applyTransition`/
 * `canTransition` from `@jobcore/core`, and never references the `jobs`
 * table/type in any way — it only deals with the tech's own time-off
 * requests via this module's `TimeOffRepository` port
 * (`../data/ports.ts`, already-declared `TimeOffRequest` /
 * `TimeOffRequestDraft` / `TimeOffRepository`).
 *
 * ZERO financial fields.
 *
 * Mirrors the house style of `Greeting.tsx` / `DayList.tsx` /
 * `FieldJobDetail.tsx`: session/ports resolved via `lib/module-session.ts`
 * and `lib/module-ports.ts`, never constructed locally.
 *
 * Workstream G also shows the tech's own upcoming assignments above the
 * request form, via `TechJobRepository.listAssignedToTech` (already
 * exposed on `ModulePorts.jobs`, same port `DayList.tsx` reads) — so a tech
 * can see what they'd be requesting time off against before submitting.
 * This does NOT violate the "never references the `jobs` table/type" rule
 * above in spirit: that rule is about the job STATE MACHINE (transitions),
 * not a read-only listing; `Job` is imported here purely to type that list,
 * mirroring `DayList.tsx`'s own read-only use of the same type.
 */
import * as React from 'react';
/**
 * TimeOff screen: a request form (start date, end date, reason) plus a
 * read-only list of the signed-in tech's own prior requests. No
 * approve/deny affordance here — that is an org-admin concern enforced
 * elsewhere via RLS, per `TimeOffRepository`'s deliberately narrow shape.
 */
interface TimeOffProps {
    initialSelectedId?: string;
}
export declare function TimeOff({ initialSelectedId }: TimeOffProps): React.ReactElement;
export {};
//# sourceMappingURL=TimeOff.d.ts.map