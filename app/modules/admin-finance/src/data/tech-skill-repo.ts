/**
 * Read-only data seam for tech skill assignments (Employee Screen Edits2,
 * Slice E — tech skills wiring).
 *
 * Interfaces are already declared in `../data/ports` (`TechSkillRow`,
 * `TechSkill`, `toTechSkill`, `TechSkillRepository`) — this file only
 * supplies the concrete Supabase-backed implementation for
 * `listForOrganization`, mirroring `tech-service-area-repo.ts`'s
 * `listTechServiceAreas` exactly (same minimal-client discipline as
 * `price-sheet-repo.ts`'s `SupabaseAreaAdjustmentsClient`).
 */

import type { CalculationResult } from '../money/types';
import { toTechSkill, type TechSkill } from './ports';

/**
 * Minimal Supabase client surface this file depends on — same
 * `{ from: (table: string) => any }` shape `tech-service-area-repo.ts`'s
 * `SupabaseTechServiceAreasClient` uses, so this module stays free of a hard
 * `@supabase/supabase-js` import.
 */
interface SupabaseTechSkillsClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

/**
 * Lists every `tech_skills` row for the organization. Feeds
 * `TechSkillRepository.listForOrganization`, which `EmployeeEditorScreen.tsx`
 * loads for the Skills picker alongside service areas.
 */
export async function listTechSkills(
  client: SupabaseTechSkillsClient,
  organizationId: string
): Promise<CalculationResult<TechSkill[]>> {
  const { data, error } = await client
    .from('tech_skills')
    .select('*')
    .eq('organization_id', organizationId);
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: (data ?? []).map(toTechSkill) };
}
