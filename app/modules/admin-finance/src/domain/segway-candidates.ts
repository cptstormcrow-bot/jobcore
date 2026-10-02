/**
 * Tech service-area coverage candidates (P3 §3).
 *
 * `plans/jobcore-service-area.md` §3: filters/flags technician candidates
 * for a job by whether they have a `tech_service_areas` coverage row
 * (`app/supabase/migrations/0050_field_ops_segway_and_estimating.sql`) matching the
 * job's resolved service area.
 *
 * Pure — no DB, no network, no clock read — mirroring
 * `assignment-warnings.ts`'s style: this module takes coverage rows and a
 * resolved `serviceAreaId` as caller-supplied arguments and never touches
 * Supabase directly. It ALWAYS returns a list, one entry per candidate tech
 * id, never filtering the input list itself — same "never a boolean gate"
 * reasoning `assignment-warnings.ts`'s own doc comment states for warnings,
 * since coverage is informational (flag), not a hard block, on the
 * assignment board.
 */

/**
 * The narrow slice of a `tech_service_areas` row this module needs.
 * Declared locally rather than importing a wire-row type, matching
 * `assignment-warnings.ts`'s `AssignmentTimeOffRequest` precedent of taking
 * a narrow structural slice instead of a cross-module type dependency.
 */
export interface TechServiceAreaCoverage {
  techId: string;
  serviceAreaId: string;
}

export interface SegwayCandidate {
  techId: string;
  /**
   * `true` when this tech has a `tech_service_areas` row matching the job's
   * resolved service area, or when `serviceAreaId` is `null` (unresolved
   * area carries no coverage signal, so every tech is treated as covered —
   * `assignment-warnings.ts`'s `missing_service_area` warning already
   * covers that case separately).
   */
  coversServiceArea: boolean;
}

/**
 * Builds one `SegwayCandidate` per `techId`, flagging whether each tech's
 * `coverageRows` include a match on `serviceAreaId`. `techIds` order is
 * preserved in the returned list.
 */
export function candidatesFor(
  techIds: string[],
  serviceAreaId: string | null,
  coverageRows: TechServiceAreaCoverage[],
): SegwayCandidate[] {
  return techIds.map((techId) => {
    if (serviceAreaId === null) {
      return { techId, coversServiceArea: true };
    }
    const coversServiceArea = coverageRows.some(
      (row) => row.techId === techId && row.serviceAreaId === serviceAreaId,
    );
    return { techId, coversServiceArea };
  });
}
