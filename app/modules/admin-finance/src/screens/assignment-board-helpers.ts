/**
 * Pure helpers for the Assignments board job card (no React, no react-native).
 *
 * Extracted from AssignmentBoardScreen so the plain-node test runner can exercise
 * them without pulling in `react-native` / `@jobcore/ui` at runtime. Precedent:
 * field-tech `day-list-helpers.ts`.
 *
 * A card has two visit kinds: 'service' (the job's assigned tech) and 'prem'
 * (the investigator tech). The picker always reflects the ACTIVE kind, so Jeff can
 * reassign each independently even when they are different techs.
 */

export type VisitKind = 'service' | 'prem';

/** Minimal structural shape of a tech (avoids importing the TechColumn component). */
export interface TechOptionSource {
  id: string;
  fullName: string;
}

export interface TechOption {
  label: string;
  value: string;
}

/** The kind a card opens on: Prem only when a prem tech exists and no service tech does. */
export function defaultKind(serviceId: string | null, premId: string | null): VisitKind {
  return !serviceId && premId ? 'prem' : 'service';
}

/** The assignee id of the active kind ('' when none). */
function currentFor(kind: VisitKind, serviceId: string | null, premId: string | null): string {
  return (kind === 'prem' ? premId : serviceId) ?? '';
}

/** Picker text value: a pending pick wins; otherwise the active kind's assigned tech ('' = Unassigned). */
export function pickerValue(
  kind: VisitKind,
  picked: string | undefined,
  serviceId: string | null,
  premId: string | null,
): string {
  if (picked !== undefined) return picked;
  return currentFor(kind, serviceId, premId);
}

/** Show Confirm only when a pick exists and differs from the active kind's current assignee. */
export function needsConfirm(
  kind: VisitKind,
  picked: string | undefined,
  serviceId: string | null,
  premId: string | null,
): boolean {
  if (picked === undefined) return false;
  return picked !== currentFor(kind, serviceId, premId);
}

/**
 * Picker options for the active kind. The board has no handler that clears a Prem
 * assignment (only `onUnassign`, which clears the SERVICE tech), so in Prem mode the
 * 'Unassigned' option is offered only while no prem is assigned (it then just displays
 * the empty state). Service mode always offers it.
 */
export function techOptionsFor(
  kind: VisitKind,
  techs: TechOptionSource[],
  currentId: string | null,
): TechOption[] {
  const people = techs.map((t) => ({ label: t.fullName, value: t.id }));
  if (kind === 'prem' && currentId) return people;
  return [{ label: 'Unassigned', value: '' }, ...people];
}
