/**
 * Read-only data seam for service areas (feeds `ModulePorts.serviceAreas`,
 * consumed by the employee-editor coverage picker and the lead-qualification
 * service-area picker).
 *
 * Interfaces are already declared in `../data/ports` (`ServiceAreaRow`,
 * `ServiceArea`, `toServiceArea`, `ServiceAreaRepository`) — this file only
 * supplies the concrete Supabase-backed implementation, matching
 * `tech-service-area-repo.ts`'s minimal-client discipline. No factory-function
 * convention exists among the sibling `*-repo.ts` files (`reimbursement-repo.ts`,
 * `payout-batch-repo.ts` export only row mappers, not a
 * client-wiring factory), so this file follows suit: a plain async function
 * satisfying `ServiceAreaRepository.listForOrganization`'s shape, not a
 * wrapped repo object.
 */

import type { CalculationResult } from '../money/types';
import { toServiceArea, type ServiceArea } from './ports';

/**
 * Minimal Supabase client surface this file depends on — same
 * `{ from: (table: string) => any }` shape `tech-service-area-repo.ts`'s
 * `SupabaseTechServiceAreasClient` uses, so this module stays free of a hard
 * `@supabase/supabase-js` import.
 */
interface SupabaseServiceAreasClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

/**
 * Lists every `service_areas` row for the organization. Feeds
 * `ModulePorts.serviceAreas` (`../lib/module-ports.ts`), which
 * `AdminFinanceRoot.tsx` loads alongside jobs/techs/commissions and hands to
 * the employee-editor coverage picker and the lead-qualification
 * service-area picker.
 */
export async function listServiceAreas(
  client: SupabaseServiceAreasClient,
  organizationId: string
): Promise<CalculationResult<ServiceArea[]>> {
  const { data, error } = await client
    .from('service_areas')
    .select('*')
    .eq('organization_id', organizationId);
  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, value: (data ?? []).map(toServiceArea) };
}
