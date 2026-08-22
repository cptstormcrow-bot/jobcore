/**
 * Read-only data seam for tech service-area coverage (P3 §3 — "Tech
 * service-area coverage" wiring gap).
 *
 * Interfaces are already declared in `../data/ports` (`TechServiceAreaRow`,
 * `TechServiceArea`, `toTechServiceArea`, `TechServiceAreaRepository`) — this
 * file only supplies the concrete Supabase-backed implementation, matching
 * `price-sheet-repo.ts`'s `SupabaseAreaAdjustmentsClient` /
 * `listAreaAdjustments` minimal-client discipline. No factory-function
 * convention exists among the sibling `*-repo.ts` files (`reimbursement-repo.ts`,
 * `payout-batch-repo.ts` export only row mappers, not a
 * client-wiring factory), so this file follows suit: a plain async function
 * satisfying `TechServiceAreaRepository.listForOrganization`'s shape, not a
 * wrapped repo object.
 */

import type { CalculationResult } from '../money/types';
import { toTechServiceArea, type TechServiceArea } from './ports';

/**
 * Minimal Supabase client surface this file depends on — same
 * `{ from: (table: string) => any }` shape `price-sheet-repo.ts`'s
 * `SupabaseAreaAdjustmentsClient` uses, so this module stays free of a hard
 * `@supabase/supabase-js` import.
 */
interface SupabaseTechServiceAreasClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

/**
 * Lists every `tech_service_areas` row for the organization. Feeds
 * `ModulePorts.techServiceAreas` (`../lib/module-ports.ts`), which
 * `AdminFinanceRoot.tsx` loads alongside jobs/techs/commissions and hands to
 * `AssignmentBoardScreen`'s `techServiceAreas` prop for the coverage flag
 * (`domain/segway-candidates.ts`'s `candidatesFor`).
 */
export async function listTechServiceAreas(
  client: SupabaseTechServiceAreasClient,
  organizationId: string
): Promise<CalculationResult<TechServiceArea[]>> {
  const { data, error } = await client
    .from('tech_service_areas')
    .select('*')
    .eq('organization_id', organizationId);
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: (data ?? []).map(toTechServiceArea) };
}
