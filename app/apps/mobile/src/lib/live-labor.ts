/**
 * Live labor seconds: stored seconds plus the time elapsed in the open segment.
 * The host passes job.inProgressAt as openSegmentStartIso. This is exact for a
 * single visit only (multi-visit jobs would need per-segment starts).
 */
export interface LiveLaborInput {
  storedSeconds: number | null | undefined;
  openSegmentStartIso: string | null | undefined;
  completedAt: string | null | undefined;
  nowMs: number;
}

export function liveLaborSeconds(input: LiveLaborInput): number {
  const raw = input.storedSeconds;
  const stored =
    typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : 0;
  if (input.completedAt) return stored;
  if (!input.openSegmentStartIso) return stored;
  if (!Number.isFinite(input.nowMs)) return stored;
  const startMs = Date.parse(input.openSegmentStartIso);
  if (!Number.isFinite(startMs)) return stored;
  return stored + Math.max(0, Math.floor((input.nowMs - startMs) / 1000));
}
