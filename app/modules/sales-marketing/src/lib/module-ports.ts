/**
 * Repository-port seam for the sales-marketing module (P6).
 *
 * Mirrors the field-tech module's session-injection pattern
 * (`modules/field-tech/src/lib/module-ports.ts`): the host is the ONLY
 * writer, via `setModulePorts`, and this module never constructs its own
 * repository implementations. Like field-tech's seam, `getModulePorts` is
 * fail-closed — it THROWS if called before the host has injected ports,
 * rather than returning `null`, because every sales-marketing screen needs
 * a working repository set to render anything meaningful at all.
 *
 * The seven fields are typed against the repository interfaces declared in
 * `modules/sales-marketing/src/data/ports.ts` (sibling data seam). None of
 * them may ever expose a query touching `commissions`, `price_sheets`, or
 * `payout_batches` — see that file's scope-fence note.
 */

import type {
  ReviewLibraryRepository,
  MarketingAssetRepository,
  PostDraftRepository,
  PostDraftAssetRepository,
  PostTargetRepository,
  CampaignLogRepository,
  SocialProviderRepository,
  TestJobsRepository,
  CallbackTaskRepository,
  JobReportingRepository,
} from '../data/ports';

export interface ModulePorts {
  reviews: ReviewLibraryRepository;
  marketingAssets: MarketingAssetRepository;
  postDrafts: PostDraftRepository;
  postDraftAssets: PostDraftAssetRepository;
  postTargets: PostTargetRepository;
  campaignLog: CampaignLogRepository;
  socialProviders: SocialProviderRepository;
  /** Workstream K: "Spawn Test Jobs" — see `data/ports.ts`. */
  testJobs: TestJobsRepository;
  /** Workstream J: sales callback tasks from completed jobs — see `data/ports.ts`. */
  callbackTasks: CallbackTaskRepository;
  jobReporting: JobReportingRepository;
}

let current: ModulePorts | null = null;

/**
 * Injection point for the host. Pass the fully-constructed repository set
 * once the host has resolved its own data layer. This is the ONLY function
 * that may write `current`.
 */
export function setModulePorts(ports: ModulePorts): void {
  current = ports;
}

/**
 * Returns the injected repository set. Fail-closed: throws if the host has
 * not yet called `setModulePorts`, so a caller can never silently proceed
 * against an absent data layer.
 */
export function getModulePorts(): ModulePorts {
  if (current === null) {
    throw new Error(
      'getModulePorts() called before setModulePorts() — the host must inject ports before any sales-marketing screen renders.',
    );
  }
  return current;
}
