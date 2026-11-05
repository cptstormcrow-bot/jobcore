// JobCore screens #0041 (job-region-plan, /job/<id>?panel=plan) and the New Job create flow (/job/new). Former #0039 job-detail was retired into #0041 on 2026-10-16.
// JobCore screen #0040 - job-region-assign - Assign
// JobCore screen #0075 - job-region-contact - Contact
// JobCore screen #0076 - job-region-arrive - Start
// JobCore screen #0077 - job-region-complete - Complete
// JobCore screen #0078 - job-region-paid - Paid
// JobCore screen #0018 - job-region-closeout - Close-out
// Calendar-entry drilldown: renders a single job's unified Job Details
// screen (pinned JobHeader + single-scroll region body) from its id route
// param. Region switching replaces the old full-screen panel early-returns;
// Contact/Arrive/Complete/Payment are header actions, not regions.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { Job, JobStatus, Profile } from '@jobcore/core';
import { STAGE_KEYS, STAGE_LABELS } from '@jobcore/core';
import type { StageKey } from '@jobcore/core';
import { buildJobStageResults, type JobStageExtras } from '../../src/lib/job-stage-results';
import { jobRuleColor, jobRuleState } from '../../src/lib/job-rule-color';
import { usePaidInFull } from '../../src/lib/settle-on-completion';
import { AppChrome, Breadcrumb, Checkbox, PayrollButton, ScreenTitleRow, colors, DefaultTabBar, EmptyState, JobProgressBar, jobSubViewFor, LoadingState, spacing, telUrl, Text, useScreenNumber, BadgeTooltip } from '@jobcore/ui';
import type { MenuItem, JobActionStage } from '@jobcore/ui';
import { JobDetail } from '../../src/components/JobDetail';
import { JobHeader, JobSummaryRest, JobTechFields, type JobRegion } from '../../src/components/JobHeader';
import { JobDetailsForm, type JobFormValues } from '../../src/components/JobDetailsForm';
import JobCloseOutRegion from '../../src/components/JobCloseOutRegion';
import JobHistoryRegion from '../../src/components/JobHistoryRegion';
import { JobPhotosRegion } from '../../src/components/JobPhotosRegion';
import JobPaymentRegion from '../../src/components/JobPaymentRegion';
import { WarningSheet } from '../../../../modules/admin-finance/src/components/WarningSheet';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import { StaleDataHint } from '../../src/components/StaleDataHint';
import { buildReadCacheKey, cachedRead, findSavedRecord, getReadCacheIdentity, useReadCacheRevision } from '../../src/lib/read-cache';
import { QUEUED_COPY, toUserMessage, writeThrough } from '../../src/lib/offline-mutations';
import { getEnabledModules } from '@jobcore/module-sdk';
import { landingRouteFor } from '../../src/lib/landing';
import {
  createJobRepository,
  createCustomerRepository,
  createEmployeeRepository,
  createJobAssignmentRepository,
  createCalendarEventRepository,
  createPriceSheetRepository,
  createPriceSheetPublishRepository,
  createPriceSheetAreaAdjustmentsRepository,
  createServiceAreaRepository,
  createTechServiceAreaRepository,
  createEstimateRepository,
  createJobInvestigationRepository,
  createJobPlanTasksRepository,
  createPriceSheetStandardDurationRepository,
  buildAdminFinancePorts,
} from '../../src/lib/admin-finance-repos';
import type { JobDetailsPatch, CustomerPatch, CustomerCreateInput, Customer, ServiceArea, JobEstimate, JobInvestigation, TechServiceArea } from '../../../../modules/admin-finance/src/data/ports';
import type { JobInvestigationInput } from '../../src/lib/admin-finance-repos';
import { candidatesFor } from '../../../../modules/admin-finance/src/domain/segway-candidates';
import type { JobDraft } from '../../../../modules/admin-finance/src/domain/qualify';
import { assignJob } from '../../../../modules/admin-finance/src/flows/assign-job';
import { unassignJob } from '../../../../modules/admin-finance/src/flows/unassign-job';
import { approveEstimate } from '../../../../modules/admin-finance/src/flows/approve-estimate';
import { canAssignServiceTech } from '../../../../modules/admin-finance/src/domain/service-tech-gate';
import { extractZip, matchServiceAreaByZip, seedPlanningFromInvestigation } from '../../../../modules/admin-finance/src/domain/job-detail-helpers';
import { JobOverviewRegion } from '../../src/components/JobOverviewRegion';
import { JobTaskList } from '../../src/components/JobTaskList';
import { JobBeforePhotoCard } from '../../src/components/JobBeforePhotoCard';
import { JobScheduleScreen } from '../../../../modules/admin-finance/src/screens/JobScheduleScreen';
import { JobEstimateScreen, type EstimateChrome } from '../../../../modules/admin-finance/src/screens/JobEstimateScreen';
import { JobInvestigationScreen } from '../../../../modules/field-tech/src/screens/JobInvestigationScreen';
import { setModuleSession } from '@jobcore/admin-finance';
import { setModuleSession as setAdminFinanceSourceModuleSession } from '../../../../modules/admin-finance/src/lib/module-session';
import {
  setModuleSession as setFieldTechModuleSession,
  clearModuleSession as clearFieldTechModuleSession,
} from '../../../../modules/field-tech/src/lib/module-session';
import { setModulePorts as setFieldTechModulePorts } from '../../../../modules/field-tech/src/lib/module-ports';
import { setModulePorts as setAdminFinanceModulePorts } from '../../../../modules/admin-finance/src/lib/module-ports';

// A direct link to a job lands here without passing /m/admin-finance, which is where
// admin-finance ports were set; the embedded Estimate screen needs them, so set them here too.
let afPortsCache: { key: string; ports: ReturnType<typeof buildAdminFinancePorts> } | null = null;
function adminFinancePortsFor(orgId: string, userId: string) {
  const key = `${orgId}|${userId}`;
  if (afPortsCache?.key !== key) afPortsCache = { key, ports: buildAdminFinancePorts({ orgId, userId }) };
  return afPortsCache.ports;
}
import { buildFieldTechPorts } from '../../src/lib/field-tech-repos';
// NOTE (slice 5, carried forward): the assignment data model has no `kind`
// column on the row itself distinguishing installer/investigator beyond the
// `job_assignments.kind` check-constraint column added in
// 0023_field_ops_segway_and_estimating.sql. Installer assignment continues
// through `assignJob()` (patches `assignedTechId` + advances status via
// `transitionJob`); investigator assignment goes through the separate
// `assignInvestigator()` flow (writes a `job_assignments` row with
// `kind: 'investigator'` only, never touches `assignedTechId`/`status`).
// Path check: this file is app/apps/mobile/app/job/[jobId].tsx; ports.ts lives at
// app/modules/admin-finance/src/data/ports.ts -- ../../../../ from here resolves
// job -> app -> mobile -> apps -> app-root, matching admin-finance-repos.ts's own
// identical 4-levels-up relative import from apps/mobile/src/lib/.

/**
 * Turns a raw assignment error into a plain sentence for the admin Job page.
 * Users never see raw database text.
 */
function friendlyAssignError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof (err as any)?.message === 'string'
        ? (err as any).message
        : String(err ?? '');
  const message = raw.replace(/^create job assignment failed: /, '').trim();
  if (/duplicate key|unique constraint/i.test(message)) {
    return 'This job already has a Prem tech linked. Refresh the page and try again.';
  }
  if (!message) return 'Something went wrong. Please try again.';
  return message;
}

/** `jobs` row shape (snake_case) -> domain `Job` (camelCase). */
interface JobRow {
  id: string;
  organization_id: string;
  status: string;
  customer_id: string | null;
  service_id: string | null;
  source: string | null;
  payer: string | null;
  attach_timing: string | null;
  requested_window: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  address: string | null;
  description: string | null;
  assigned_tech_id: string | null;
  en_route_at: string | null;
  in_progress_at: string | null;
  completed_at: string | null;
  created_at: string;
  is_beta: boolean;
  house_age_years: number | null;
  permit_status: string | null;
  parking_available: string | null;
  rooms: string[] | null;
  panel_info: string | null;
  considerations: string | null;
  service_area_id: string | null;
  job_number: number | null;
  ingress_instructions: string | null;
  total_labor_seconds: number | null;
  needs_prem_at: string | null;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status as JobStatus,
    customerId: row.customer_id,
    serviceId: row.service_id,
    source: row.source,
    payer: row.payer,
    attachTiming: row.attach_timing,
    requestedWindow: row.requested_window,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    address: row.address,
    description: row.description,
    assignedTechId: row.assigned_tech_id,
    enRouteAt: row.en_route_at,
    inProgressAt: row.in_progress_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    isBeta: row.is_beta,
    houseAgeYears: row.house_age_years,
    permitStatus: row.permit_status,
    parkingAvailable: row.parking_available,
    rooms: row.rooms,
    panelInfo: row.panel_info,
    considerations: row.considerations,
    service_area_id: row.service_area_id,
    jobNumber: row.job_number ?? undefined,
    ingressInstructions: row.ingress_instructions,
    totalLaborSeconds: row.total_labor_seconds ?? 0,
    needsPremAt: row.needs_prem_at,
  } as Job;
}

// Jobs saved from create mode, by id. On device a new job can still be only
// queued locally when its detail screen opens, so the live fetch finds no row;
// the screen falls back to this copy until the server has it.
const justCreatedJobs = new Map<string, Job>();

const JOB_ROW_COLUMNS =
  'id, organization_id, status, customer_id, service_id, source, payer, attach_timing, ' +
  'requested_window, scheduled_start, scheduled_end, address, description, assigned_tech_id, ' +
  'en_route_at, in_progress_at, completed_at, created_at, is_beta, house_age_years' +
  ', permit_status, parking_available, rooms, panel_info, considerations, service_area_id, job_number' +
  ', ingress_instructions, total_labor_seconds, needs_prem_at';

// Deep-link `?panel=` -> unified `JobRegion`. `start-checklist`/`completion`
// have no dedicated region in the unified screen (those flows are reached
// from `details`), so they map back to `details`.
const DEEP_LINK_PANELS = ['plan', 'schedule', 'jobEstimate', 'jobInvestigation', 'start-checklist', 'completion', 'closeout', 'assign', 'payment', 'history'] as const;
type DeepLinkPanel = (typeof DEEP_LINK_PANELS)[number];
function isDeepLinkPanel(v: string | undefined): v is DeepLinkPanel {
  return (DEEP_LINK_PANELS as readonly string[]).includes(v ?? '');
}
function regionFromPanel(panel: string | undefined): JobRegion {
  if (panel === 'details') return 'details';
  if (!isDeepLinkPanel(panel)) return 'details';
  switch (panel) {
    case 'closeout':
      return 'closeout';
    case 'assign':
      return 'assign';
    case 'payment':
      return 'payment';
    case 'history':
      return 'history';
    case 'plan':
      return 'plan';
    case 'jobEstimate':
      return 'estimate';
    case 'jobInvestigation':
      return 'evisit';
    case 'schedule':
      return 'schedule';
    case 'start-checklist':
    case 'completion':
    default:
      return 'details';
  }
}

/**
 * Local job-form state shape, shared with `JobDetailsForm`'s `JobFormValues`.
 * In edit mode it is seeded from the loaded `Job`; in create mode it starts
 * blank. `handleSaveEdit` writes all 13 fields.
 */
type JobFormState = JobFormValues;

const EMPTY_JOB_FORM: JobFormState = {
  address: '',
  description: '',
  serviceAreaId: null,
  houseAgeYears: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  permitStatus: '',
  parkingAvailable: '',
  rooms: [],
  panelInfo: '',
  considerations: '',
  ingressInstructions: '',
  service: '',
  preferredDate: '',
  preferredTime: '',
  evisitPanel: '',
};

export default function JobDrilldownScreen() {
  const { jobId, panel } = useLocalSearchParams<{ jobId: string; panel?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const session = useSession();
  const org = session.status === 'authenticated' ? session.organization : undefined;
  const role = session.status === 'authenticated' ? session.profile.role : undefined;
  const goBackOrLanding = (): void => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (session.status === 'authenticated') {
      const ids = getEnabledModules(session.organization, session.profile.role).map((m) => m.id);
      router.replace(landingRouteFor(session.profile.role, ids) as never);
    } else {
      router.replace('/sign-in');
    }
  };
  const isAdmin = role === 'admin' || role === 'owner';

  if (session.status === 'authenticated' && org && role) {
    setModuleSession({ org, role, userId: session.profile.id });
    setAdminFinanceSourceModuleSession({ org, role, userId: session.profile.id });
    setFieldTechModuleSession({ org, role, userId: session.profile.id });
    setFieldTechModulePorts(buildFieldTechPorts());
    setAdminFinanceModulePorts(adminFinancePortsFor(org.id, session.profile.id));
  }
  const moduleSessionReady = session.status === 'authenticated' && !!org && !!role;

  useEffect(() => {
    return () => clearFieldTechModuleSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mode detection: the `new` route param means create-mode; any other
  // (real UUID) jobId means edit-mode.
  const isCreate = jobId === 'new';

  // Stable repos for the estimate screen: a fresh object each render re-ran its load effects,
  // so the screen kept reloading and dropped a task added a moment before.
  const estimateRepo = useMemo(() => createEstimateRepository(), []);
  const priceSheetRepo = useMemo(() => createPriceSheetRepository(), []);
  const areaAdjustmentsRepo = useMemo(() => createPriceSheetAreaAdjustmentsRepository(), []);

  const priceEstimatingRates = useMemo(() => {
    return {
      list: async (priceSheetId: string) => {
        try {
          const value = await createPriceSheetPublishRepository().listRates(priceSheetId);
          return { ok: true as const, value };
        } catch (err) {
          return { ok: false as const, reason: err instanceof Error ? err.message : String(err) };
        }
      },
    };
  }, []);

  const rev = useReadCacheRevision();
  // jobId for which the form has already been seeded; background refetches (rev bumps) must not re-seed/reset the form.
  const formSeededForRef = useRef<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(!isCreate);
  const [form, setForm] = useState<JobFormState>(EMPTY_JOB_FORM);
  // The linked customer's id (job.customerId, nullable per JobRow/Job). Held
  // separately from `form` -- it is not itself an editable text field, only
  // the routing key handleSave uses to decide CustomerRepository.update()
  // (customerId present) vs .create() (no customer linked yet).
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  // New Job #0041's Prem Needed box; written right after the job is created.
  const [createNeedsPrem, setCreateNeedsPrem] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Tech-assignment section: active-tech roster for the org, and any
  // in-flight/error state for an assignment tap, kept separate from the
  // job-detail/customer `saving`/`saveError` pair above so an assignment
  // failure doesn't clobber (or get clobbered by) a Save-button failure.
  const [techs, setTechs] = useState<Profile[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [pendingAssign, setPendingAssign] = useState<{ kind: 'prem' | 'service'; techId: string | null } | null>(null);
  useEffect(() => { setPendingAssign(null); }, [jobId]);
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [investigation, setInvestigation] = useState<JobInvestigation | null>(null);
  const serviceGateOpen = canAssignServiceTech(estimate, investigation);

  const [region, setRegion] = useState<JobRegion>(regionFromPanel(panel));
  const [showBlackouts, setShowBlackouts] = useState(true);
  const [activeStage, setActiveStage] = useState<JobActionStage | undefined>(undefined);
  const isTechEstimate = role === 'tech';
  const [estimateChrome, setEstimateChrome] = useState<EstimateChrome | null>(null);
  useScreenNumber({ subView: jobSubViewFor({ isCreate, region, activeStage, isTechEstimate }) });
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => { setActionError(null); }, [jobId]);
  const [saved, setSaved] = useState(false);
  const [investigatorTechId, setInvestigatorTechId] = useState<string | null>(null);
  const [totalTaskMinutes, setTotalTaskMinutes] = useState<number>(0);
  const [standardMinutes, setStandardMinutes] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!org?.id) {
      setTechs([]);
      return undefined;
    }
    let cancelled = false;
    void createEmployeeRepository()
      .listEmployees(org.id)
      .then((list: Profile[]) => {
        if (!cancelled) setTechs(list.filter((p) => p.role === 'tech' && p.active === true));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  useEffect(() => {
    if (!org?.id) { setServiceAreas([]); return; }
    let cancelled = false;
    void createServiceAreaRepository().listForOrganization(org.id).then((list) => {
      if (!cancelled) setServiceAreas(list);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [org?.id]);

  // Auto-match service area once on load when the job has no service area
  // set but does have an address/zip, mirroring the handleFormChange path.
  useEffect(() => {
    if (serviceAreas.length === 0) return;
    if (form.serviceAreaId !== null) return;
    const zip = extractZip(form.address);
    if (!zip) return;
    const matched = matchServiceAreaByZip(serviceAreas, zip, form.address);
    if (matched) {
      setForm((prev) => (prev.serviceAreaId === null ? { ...prev, serviceAreaId: matched.id } : prev));
    }
  }, [serviceAreas, form.address, form.serviceAreaId]);

  // Persist the derived area once when the stored job has none (same
  // updateDetails path runSaveEdit uses); failures are non-fatal.
  const persistedAreaRef = useRef<string | null>(null);
  useEffect(() => {
    if (isCreate || !job?.id || serviceAreas.length === 0) return;
    if (job.service_area_id) return;
    if (persistedAreaRef.current === job.id) return;
    const addr = job.address ?? '';
    const matched = matchServiceAreaByZip(serviceAreas, extractZip(addr), addr);
    if (!matched) return;
    persistedAreaRef.current = job.id;
    void createJobRepository()
      .updateDetails(job.id, { serviceAreaId: matched.id } as JobDetailsPatch)
      .then((u) => setJob((prev) => (prev && prev.id === u.id ? { ...prev, service_area_id: matched.id } : prev)))
      .catch(() => undefined);
  }, [isCreate, job?.id, job?.service_area_id, job?.address, serviceAreas]);

  // Tech -> service-area coverage rows, used to hard-filter the technician
  // dropdown on this screen. The Assignment Board stays decorate-only.
  const [techServiceAreas, setTechServiceAreas] = useState<TechServiceArea[]>([]);
  useEffect(() => {
    if (!org?.id) { setTechServiceAreas([]); return; }
    let cancelled = false;
    void createTechServiceAreaRepository().listForOrganization(org.id).then((list) => {
      if (!cancelled) setTechServiceAreas(list);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [org?.id]);

  // Only techs whose coverage includes this job's service area are offered.
  // candidatesFor() flags rather than filters, so the hard filter is applied
  // here at the call site; a null service area yields the full roster.
  const eligibleTechOptions = useMemo(
    () =>
      candidatesFor(techs.map((t) => t.id), form.serviceAreaId, techServiceAreas)
        .filter((c) => c.coversServiceArea)
        .map((c) => {
          const tech = techs.find((t) => t.id === c.techId);
          return { id: c.techId, name: tech?.fullName ?? c.techId };
        }),
    [techs, form.serviceAreaId, techServiceAreas],
  );

  // Estimate + investigation lookups (used by the assign gate, the tail
  // read view, and the JobDetailsForm's evisit read-only fields).
  useEffect(() => {
    if (isCreate || !job?.id || !moduleSessionReady) {
      setEstimate(null);
      setInvestigation(null);
      setInvestigatorTechId(null);
      return undefined;
    }
    let cancelled = false;
    void createEstimateRepository().getForJob(job.id).then((value) => {
      if (!cancelled) setEstimate(value);
    }).catch(() => {
      if (!cancelled) setEstimate(null);
    });
    void createJobInvestigationRepository().getForJob(job.id).then((value) => {
      if (!cancelled) setInvestigation(value);
    }).catch(() => {
      if (!cancelled) setInvestigation(null);
    });
    setInvestigatorTechId(null);
    void createJobAssignmentRepository()
      .getInvestigatorTechId(job.id)
      .then((value) => {
        if (!cancelled) setInvestigatorTechId(value);
      })
      .catch(() => {
        if (!cancelled) setInvestigatorTechId(null);
      });
    return () => { cancelled = true; };
  }, [isCreate, job?.id, moduleSessionReady]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      // One Parking field on #0041: a Prem parking note fills Parking availability when that is still empty.
      parkingAvailable: prev.parkingAvailable.trim() ? prev.parkingAvailable : investigation?.parkingNotes ?? '',
      evisitPanel: investigation?.stateAssessment ?? '',
    }));
  }, [investigation, loading]);

  // Org-scoped lookup by id: jobs_select_org / jobs_select_tech RLS policies
  // OR together server-side, so this is already the RLS-correct row for
  // whichever role is viewing (mirrors calendar.tsx's org-scoped query note).
  // Skipped entirely in create-mode -- there is no row to load yet.
  useEffect(() => {
    if (isCreate) {
      setJob(null);
      setForm(EMPTY_JOB_FORM);
      setCustomerId(null);
      setCustomer(null);
      formSeededForRef.current = null;
      setLoading(false);
      return;
    }
    if (!org?.id || !jobId) {
      setJob(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const firstLoad = formSeededForRef.current !== jobId;
    if (firstLoad) setLoading(true); // Loading only when nothing to show yet
    const orgId = org.id;
    const fetchLive = async (): Promise<JobRow | null> => {
      const { data, error } = await supabase
        .from('jobs')
        .select(JOB_ROW_COLUMNS)
        .eq('organization_id', orgId)
        .eq('id', jobId)
        .maybeSingle<JobRow>();
      if (error) throw error;
      return data ?? null;
    };
    const identity = getReadCacheIdentity();
    const load = identity
      ? cachedRead<JobRow | null>(
          buildReadCacheKey(identity.orgId, identity.userId, 'app.jobs.byId', { jobId }),
          fetchLive,
        ).then((res) => res.data)
      : fetchLive();
    void load
      .catch(() => null)
      .then(async (data) => {
        if (cancelled) return;
        if (data) justCreatedJobs.delete(jobId);
        // Offline and never opened here: use the copy saved with any job list.
        const saved = data || justCreatedJobs.has(jobId)
          ? null
          : await findSavedRecord<Record<string, unknown>>('.jobs.', jobId, (r) => typeof r.status === 'string').catch(() => null);
        if (cancelled) return;
        const fromSaved = saved ? ('organization_id' in saved ? toJob(saved as unknown as JobRow) : (saved as unknown as Job)) : null;
        const loaded = data ? toJob(data) : justCreatedJobs.get(jobId) ?? fromSaved;
        setJob(loaded);
        setCustomerId(loaded?.customerId ?? null);

        // Customer fields are seeded from a second lookup keyed off the
        // job's `customer_id` (job.customerId per the JobRow/Job mapping
        // above) via the CustomerRepository -- the `customers` table is not
        // selected as part of JOB_ROW_COLUMNS.
        // Cache-first and failure-tolerant: a slow or missing network must never hold the page on its spinner.
        const customerKey = loaded?.customerId;
        const fetchCustomer = async (): Promise<Customer | null> =>
          customerKey ? await createCustomerRepository().getById(customerKey) : null;
        let fetchedCustomer: Customer | null = null;
        if (customerKey) {
          try {
            fetchedCustomer = identity
              ? (await cachedRead<Customer | null>(
                  buildReadCacheKey(identity.orgId, identity.userId, 'app.customers.byId', { customerId: customerKey }),
                  fetchCustomer,
                )).data
              : await fetchCustomer();
          } catch {
            fetchedCustomer = null;
          }
          if (!fetchedCustomer) {
            fetchedCustomer = await findSavedRecord<Customer>('customers', customerKey, (r) => 'name' in r && !('organization_id' in r)).catch(() => null);
          }
        }
        if (cancelled) return;
        setCustomer(fetchedCustomer);
        // Background refetch (rev bump) after the form was seeded: refresh job/customer only,
        // never reset the form or the dirty flag.
        if (!firstLoad) {
          setLoading(false);
          return;
        }
        formSeededForRef.current = jobId;

        const extras = loaded as typeof loaded & Partial<{ permitStatus: string; parkingAvailable: string; rooms: string[]; panelInfo: string; considerations: string }>;
        setForm(
          loaded
            ? {
                address: loaded.address ?? '',
                description: loaded.description ?? '',
                serviceAreaId: loaded.service_area_id ?? null,
                houseAgeYears: '',
                evisitPanel: '',
                customerName: fetchedCustomer?.name ?? '',
                customerPhone: fetchedCustomer?.phone ?? '',
                customerEmail: fetchedCustomer?.email ?? '',
                customerAddress: fetchedCustomer?.address ?? '',
                permitStatus: extras.permitStatus ?? '',
                parkingAvailable: extras.parkingAvailable ?? '',
                rooms: extras.rooms ?? [],
                panelInfo: extras.panelInfo ?? '',
                considerations: extras.considerations ?? '',
                ingressInstructions: loaded.ingressInstructions ?? '',
                service: '',
                preferredDate: '',
                preferredTime: '',
              }
            : EMPTY_JOB_FORM
        );
        setDirty(false);
        setSaved(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreate, org?.id, jobId, rev]);

  /**
   * Edit-mode-only combined save: saves the customer first (updates the
   * linked row, or creates one and remembers its id immediately so a retry
   * reuses it rather than creating another), links it to the job through
   * `JobRepository.updateDetails` when `jobs.customer_id` differs, then
   * verifies the link succeeded. Only on success are the returned `Job` and
   * `Customer` committed to state, so the header updates without a reload.
   * Any failure surfaces `saveError` and never shows "Saved". Create-mode
   * save is handled by `handleSaveCreate`.
   */
  const runSaveEdit = async (): Promise<boolean> => {
    if (!job) return false;
    if (!org?.id) return false;
    setSaving(true);
    setSaveError(null);
    try {
      const jobPatch: JobDetailsPatch = {
        address: form.address,
        description: form.description,
        serviceAreaId: form.serviceAreaId,
        permitStatus: form.permitStatus,
        parkingAvailable: form.parkingAvailable,
        rooms: form.rooms,
        panelInfo: form.panelInfo,
        considerations: form.considerations,
        ingressInstructions: form.ingressInstructions.trim() || null,
      } as JobDetailsPatch;

      const customerPatch: CustomerPatch = {
        name: form.customerName,
        phone: form.customerPhone,
        email: form.customerEmail,
        address: form.customerAddress,
      };
      const savedCustomer = await createCustomerRepository().saveForJob(job.id, customerPatch);

      const updatedJob = await createJobRepository().updateDetails(job.id, jobPatch);
      if (updatedJob.customerId !== savedCustomer.id) {
        throw new Error('Customer saved but not linked to this job.');
      }

      if (investigation) {
        const investigationPatch: JobInvestigationInput = {
          techId: investigation.techId,
          ingressNotes: investigation.ingressNotes,
          logisticsNotes: investigation.logisticsNotes,
          // Write-through: the Prem checklist (#0061) shows the same single Parking value.
          parkingNotes: form.parkingAvailable.trim() || null,
          stateAssessment: form.evisitPanel.trim() || null,
          roomWork: investigation.roomWork,
          measurements: investigation.measurements,
          techInstructions: investigation.techInstructions,
          materialsArrived: investigation.materialsArrived,
          submittedAt: investigation.submittedAt,
        };
        const updatedInvestigation = await createJobInvestigationRepository().upsertForJob(job.id, investigationPatch);
        setInvestigation(updatedInvestigation);
      }
      setJob(updatedJob);
      setCustomer(savedCustomer);
      setCustomerId(savedCustomer.id);
      setDirty(false);
      setSaved(true);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Awaitable and deduped: concurrent callers share one in-flight promise;
  // resolves `true` on success, `false` on failure, so callers can gate
  // navigation on save success.
  const handleSaveEdit = async (): Promise<boolean> => {
    if (saveInFlightRef.current) return saveInFlightRef.current;
    const p = runSaveEdit().finally(() => {
      if (saveInFlightRef.current === p) saveInFlightRef.current = null;
    });
    saveInFlightRef.current = p;
    return p;
  };

  /**
   * Create-mode-only save: builds a `JobDraft` (mirroring
   * `buildJobFromLead`'s payload shape, `serviceId: null` since create-mode
   * has no lead to resolve a service from) from `form` plus the org id, and
   * persists it via `JobRepository.create`. On success, navigates to the
   * newly-created job's own edit-mode route.
   */
  const handleSaveCreate = async (): Promise<void> => {
    if (!org?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      let newCustomerId: string | null = null;
      if (form.customerName || form.customerPhone || form.customerEmail || form.customerAddress) {
        const customerCreateInput: CustomerCreateInput = {
          organizationId: org.id,
          name: form.customerName,
          phone: form.customerPhone,
          email: form.customerEmail,
          address: form.customerAddress,
        };
        const created = await createCustomerRepository().create(customerCreateInput);
        newCustomerId = created.id;
      }
      const draft: JobDraft = {
        organizationId: org.id,
        status: 'new',
        customerId: newCustomerId,
        serviceId: null,
        source: null,
        payer: null,
        attachTiming: null,
        requestedWindow: [form.preferredDate, form.preferredTime].filter(Boolean).join(' ') || null,
        scheduledStart: null,
        scheduledEnd: null,
        address: form.address,
        description: form.service ? `Service: ${form.service}\n\n${form.description}` : form.description,
        assignedTechId: null,
        serviceAreaId: form.serviceAreaId,
        permitStatus: form.permitStatus,
        parkingAvailable: form.parkingAvailable,
        rooms: form.rooms,
        panelInfo: form.panelInfo,
        considerations: form.considerations,
        ingressInstructions: form.ingressInstructions.trim() || null,
      } as JobDraft;
      const created = await createJobRepository().create(draft);
      const needsPremAt = createNeedsPrem ? new Date().toISOString() : null;
      if (needsPremAt) await createJobRepository().setNeedsPrem?.(created.id, needsPremAt);
      justCreatedJobs.set(created.id, { ...created, totalLaborSeconds: created.totalLaborSeconds ?? 0, isBeta: created.isBeta ?? false, ...(needsPremAt ? { needsPremAt } : {}) });
      router.replace(`/job/${created.id}?panel=plan` as never);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Edit-mode-only installer assignment: reuses the exact `assignJob(job,
   * techId, deps)` call pattern from `AdminFinanceRoot.tsx`'s `handleAssign`
   * -- same three deps (`jobs`, `assignments`, `calendarEvents`) plus `ctx`.
   * On success, re-fetches the job row so `job.assignedTechId`/`job.status`
   * reflect the write (`assignJob` also advances status toward `assigned`
   * via `transitionJob`, so a plain local patch would go stale).
   */
  const handleAssignInstaller = async (techId: string): Promise<void> => {
    if (!serviceGateOpen) return;
    if (!job ||session.status !== 'authenticated' || !org?.id) return;
    setAssigning(techId);
    setActionError(null);
    const fail = (message: string) => {
      setActionError(message);
    };
    const deps = {
      jobs: createJobRepository(),
      assignments: createJobAssignmentRepository(),
      calendarEvents: createCalendarEventRepository(),
      ctx: { role: session.profile.role, now: () => new Date().toISOString() },
    };
    try {
      if (job.assignedTechId && job.assignedTechId !== techId) {
        // Reassign Service: unassign (installer-scoped), then assign the new tech.
        const unassigned = await unassignJob(job, deps);
        if (!unassigned.ok) {
          fail(friendlyAssignError(unassigned.reason));
          return;
        }
        setJob(unassigned.job);
        let assignFailure: string | null = null;
        try {
          const assigned = await assignJob(unassigned.job, techId, deps);
          if (assigned.ok) {
            setJob(assigned.job);
          } else {
            assignFailure = friendlyAssignError(assigned.reason);
          }
        } catch (err) {
          assignFailure = friendlyAssignError(err);
        }
        if (assignFailure) {
          fail(assignFailure);
        }
        return;
      }
      const result = await assignJob(job, techId, deps);
      if (!result.ok) {
        fail(friendlyAssignError(result.reason));
        return;
      }
      setJob(result.job);
    } catch (err) {
      fail(friendlyAssignError(err));
    } finally {
      setAssigning(null);
    }
  };

  /**
   * Edit-mode-only investigator assignment: no flow-layer wrapper exists for
   * this (unlike `assignJob` for installers) -- writes a `job_assignments`
   * row with `kind: 'investigator'` directly via
   * `JobAssignmentRepository.create`, per this file's own top-of-file NOTE
   * on the installer/investigator split. Never touches `assignedTechId`/
   * `status`; `investigatorTechId` local state is the read-back.
   * Reassignment is delete-then-insert inside the repo's `create()`; unassigning
   * an investigator calls `removeInvestigator`.
   */
  const handleAssignInvestigator = async (techId: string): Promise<void> => {
    if (!isAdmin) return;
    if (!job || !org?.id) return;
    const orgId = org.id;
    const targetJobId = job.id;
    setAssigning(techId);
    setActionError(null);
    const fail = (message: string) => {
      setActionError(message);
    };
    const assignments = createJobAssignmentRepository();
    try {
      const previousTechId = await assignments.getInvestigatorTechId(targetJobId);
      if (previousTechId && previousTechId !== techId) {
        try {
          await assignments.removeInvestigator(targetJobId);
        } catch (err) {
          fail(friendlyAssignError(err));
          return;
        }
        const stillLinked = await assignments.getInvestigatorTechId(targetJobId);
        if (stillLinked) {
          fail("The current Prem tech couldn't be removed, so nothing was changed. Refresh the page and try again.");
          return;
        }
      }
      try {
        await assignments.create(orgId, {
          jobId: targetJobId,
          techId,
          assignedAt: new Date().toISOString(),
          kind: 'investigator',
        });
      } catch (err) {
        fail(friendlyAssignError(err));
        if (previousTechId && previousTechId !== techId) {
          try {
            await assignments.create(orgId, {
              jobId: targetJobId,
              techId: previousTechId,
              assignedAt: new Date().toISOString(),
              kind: 'investigator',
            });
            setInvestigatorTechId(previousTechId);
          } catch {
            setInvestigatorTechId(null);
          }
        }
        return;
      }
      setInvestigatorTechId(techId);
      setActionError(null);
      const refreshed = await createJobRepository().getById(targetJobId);
      if (refreshed) setJob(refreshed);
    } catch (err) {
      fail(friendlyAssignError(err));
    } finally {
      setAssigning(null);
    }
  };

  useEffect(() => {
    // New Job has no real id yet ("new" is not a uuid), so skip the lookup.
    if (!jobId || isCreate) {
      setTotalTaskMinutes(0);
      return undefined;
    }
    let cancelled = false;
    void createJobPlanTasksRepository().listForJob(jobId).then((rows) => {
      if (cancelled) return;
      const sum = rows.reduce(
        (acc, row) => acc + (row.kind === 'misc' ? (row.estimatedMinutes ?? 0) : (row.estimatedMinutes ?? 0) * row.quantity),
        0,
      );
      setTotalTaskMinutes(sum);
    }).catch(() => undefined);
    if (org?.id) {
      void createPriceSheetStandardDurationRepository().get(org.id).then((result) => {
        if (cancelled) return;
        if (result.ok && result.value) {
          setStandardMinutes(result.value.standardMinutes);
        }
      }).catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [jobId, isCreate, org?.id]);

  // Clears the assignment back to the shared "Unassigned" convention
  // (Select option { label: 'Unassigned', value: '' }); approved jobs persist
  // the clear via patchScheduling; unassigning an investigator calls
  // removeInvestigator (reassignment is delete-then-insert in the repo's create()).
  const handleUnassign = async (kind: 'prem' | 'service'): Promise<void> => {
    if (!isAdmin) return;
    if (!job) return;
    if (session.status !== 'authenticated' || !org?.id) return;
    setAssigning('unassign');
    setActionError(null);
    const fail = (message: string) => {
      setActionError(message);
    };
    try {
      const assignments = createJobAssignmentRepository();
      if (kind === 'prem') {
        await assignments.removeForJob(job.id, 'investigator');
        const stillLinked = await assignments.getInvestigatorTechId(job.id);
        if (stillLinked) {
          fail("The Prem tech couldn't be removed. Refresh the page and try again.");
          return;
        }
        setInvestigatorTechId(null);
        return;
      }
      const result = await unassignJob(job, {
        jobs: createJobRepository(),
        assignments,
        calendarEvents: createCalendarEventRepository(),
        ctx: { role: session.profile.role, now: () => new Date().toISOString() },
      });
      if (!result.ok) {
        fail(friendlyAssignError(result.reason));
        return;
      }
      setJob(result.job);
      setActionError(null);
    } catch (err) {
      fail(friendlyAssignError(err));
    } finally {
      setAssigning(null);
    }
  };

  // Save-follows-selection: switching regions autosaves a dirty edit-mode
  // form before moving; a `saving` ref guards `beforeRemove` against a
  // double-fire. `handleSaveEdit` dedupes concurrent calls onto one in-flight
  // promise and is awaitable, resolving `true` on success.
  const scrollRef = useRef<ScrollView>(null);
  const stageList = STAGE_KEYS.map((key) => ({ key, label: STAGE_LABELS[key] }));
  const savingRef = useRef(false);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const skipAutosaveRef = useRef(false);
  const leaveAfterFailRef = useRef(false);
  const leavePendingRef = useRef(false);
  const selectRegion = useCallback(
    (next: JobRegion) => {
      setActiveStage(undefined);
      if (!isCreate && dirty && !savingRef.current && !skipAutosaveRef.current) {
        savingRef.current = true;
        void handleSaveEdit().finally(() => {
          savingRef.current = false;
        });
      }
      setRegion(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCreate, dirty, job, customerId, org?.id, form],
  );

  useEffect(() => {
    // Web browser back button cannot be prevented (known limit).
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isCreate || !dirty || skipAutosaveRef.current || leaveAfterFailRef.current) return;
      e.preventDefault();
      if (leavePendingRef.current) return;
      leavePendingRef.current = true;
      void handleSaveEdit().then((ok) => {
        leavePendingRef.current = false;
        if (ok) { skipAutosaveRef.current = true; navigation.dispatch(e.data.action); }
        else { leaveAfterFailRef.current = true; }
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isCreate, dirty, job, customerId, org?.id, form]);

  const handleFormChange = (patch: Partial<JobFormValues>) => {
    setForm((prev) => {
      const merged = { ...prev, ...patch };
      // Service area auto-match on address change: only when the field is
      // currently unset -- manual selection always wins.
      if (patch.address !== undefined && merged.serviceAreaId === null) {
        const zip = extractZip(patch.address);
        const matched = matchServiceAreaByZip(serviceAreas, zip, patch.address);
        if (matched) {
          merged.serviceAreaId = matched.id;
        }
      }
      return merged;
    });
    setDirty(true);
    leaveAfterFailRef.current = false;
    setSaved(false);
  };

  const [stageExtras, setStageExtras] = useState<JobStageExtras | null>(null);

  const [photoCountTick, setPhotoCountTick] = useState(0);
  // Re-derive inputs on load and on every refresh (job object changes on each setJob).
  useEffect(() => {
    if (!job?.id) return;
    let cancelled = false;
    const fetchLive = async () => {
      const [jobRes, photoRes, leadRes] = await Promise.all([
        supabase.from('jobs').select('contacted_at, stage_marks, upstream_changed_at, created_at').eq('id', job.id).maybeSingle(),
        supabase.from('job_photos').select('id', { count: 'exact', head: true }).eq('job_id', job.id),
        supabase.from('leads').select('id').eq('converted_job_id', job.id).limit(1).maybeSingle(),
      ]);
      if (jobRes.error || photoRes.error || leadRes.error) throw jobRes.error ?? photoRes.error ?? leadRes.error;
      return { jobData: jobRes.data ?? null, photoCount: photoRes.count ?? 0, leadData: leadRes.data ?? null };
    };
    void (async () => {
      const identity = getReadCacheIdentity();
      let fetched: Awaited<ReturnType<typeof fetchLive>>;
      try {
        fetched = identity
          ? (await cachedRead(buildReadCacheKey(identity.orgId, identity.userId, 'app.jobs.stageExtras', { jobId: job.id }), fetchLive)).data
          : await fetchLive();
      } catch {
        return;
      }
      if (cancelled) return;
      const jobRes = { data: fetched.jobData };
      const photoRes = { count: fetched.photoCount };
      const leadRes = { data: fetched.leadData };
      const row = (jobRes.data ?? null) as { contacted_at?: string | null; stage_marks?: Record<string, string> | null; upstream_changed_at?: string | null; created_at?: string | null } | null;
      setStageExtras({
        contactedAt: row?.contacted_at ?? null,
        stageMarks: row?.stage_marks ?? {},
        upstreamChangedAt: row?.upstream_changed_at ?? null,
        createdAt: row?.created_at ?? job.createdAt ?? null,
        photoCount: photoRes.count ?? 0,
        lead: leadRes.data ? { id: (leadRes.data as { id: string }).id } : null,
      });
    })();
    return () => { cancelled = true; };
  }, [job, estimate, investigation, rev, photoCountTick]);

  const paidInFull = usePaidInFull(job);
  const stageResults = useMemo(
    () => buildJobStageResults({ job, estimate, investigation, investigatorTechId, stageExtras, paidInFull }),
    [job, estimate, investigation, investigatorTechId, stageExtras, paidInFull],
  );

  const handleContact = () => {
    if (!customer?.phone) return;
    void Linking.openURL(telUrl(customer.phone));
    if (job) {
      const stamp = new Date().toISOString();
      void writeThrough('job.mark_contacted', { jobId: job.id, contactedAt: stamp }, stamp, { contactedAt: stamp })
        .then((res) => {
          setStageExtras((prev) => (prev ? { ...prev, contactedAt: stamp } : prev));
          if (res.status === 'queued') setActionError(QUEUED_COPY);
        })
        .catch((err) => setActionError(toUserMessage(err)));
    }
  };

  const [estimateFocus, setEstimateFocus] = useState<{ tab: 'tasks'; nonce: number } | undefined>(undefined);
  const openEstimateTasks = useCallback(() => {
    selectRegion('estimate');
    setEstimateFocus((prev) => ({ tab: 'tasks', nonce: (prev?.nonce ?? 0) + 1 }));
  }, [selectRegion]);

  const handleStagePress = (key: string) => {
    switch (key as StageKey) {
      case 'job': selectRegion('plan'); break;
      case 'prem':
        // The Prem dot opens the Prem screen #0061.
        selectRegion('evisit');
        break;
      case 'estimate': selectRegion('estimate'); break;
      case 'schedule': selectRegion('schedule'); break;
      case 'assign': selectRegion('assign'); break;
      case 'contact': setActiveStage('contact'); handleContact(); break;
      // Start is set by the Start (arrive) action; the before-photo card sits at the top of the Tasks tab.
      case 'startWork': setActiveStage('arrive'); void handleArrive(); break;
      case 'completeWork': setActiveStage('complete'); handleComplete(); break;
      case 'paid':
        if (role === 'owner' || role === 'admin' || role === 'tech') { selectRegion('payment'); setActiveStage('paid'); }
        break;
      // Closeout opens #0018 job-region-closeout for admins and techs; Sales has no need (Jeff 2026-11-03).
      case 'closeout':
        if (role === 'owner' || role === 'admin' || role === 'tech') selectRegion('closeout');
        break;
      default: break;
    }
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleArrive = async (): Promise<void> => {
    if (!job) return;
    if (!(job.assignedTechId)) {
      Alert.alert('Installer tech required', 'An installer tech must be assigned to this job before Start can be marked.');
      return;
    }
    setBusyAction('arrive');
    setActionError(null);
    try {
      if (!job.inProgressAt) {
        const nowIso = new Date().toISOString();
        const patch = { enRouteAt: job.enRouteAt ?? nowIso, inProgressAt: nowIso };
        await createJobRepository().patchLifecycle(job.id, patch);
        if (String(job.status) !== 'in_progress') {
          await createJobRepository().updateStatus(job.id, 'in_progress');
        }
        // The repo returns a partial job (this screen never seeds its cache), so merge into the full one.
        setJob((prev) => (prev && prev.id === job.id ? { ...prev, ...patch, status: 'in_progress' as JobStatus } : prev));
      }
      openEstimateTasks();
      // openEstimateTasks clears the active stage; keep Start lit in the menu.
      setActiveStage('arrive');
    } catch (err) {
      const message = toUserMessage(err);
      setSaveError(message);
      setActionError(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleComplete = () => {
    if (!job) return;
    router.push({ pathname: '/job/complete/[jobId]', params: { jobId: job.id } } as never);
  };

  const handleToggleNeedsPrem = async (): Promise<void> => {
    if (!job) return;
    setBusyAction('needs-prem');
    setActionError(null);
    try {
      const next = job.needsPremAt ? null : new Date().toISOString();
      await createJobRepository().setNeedsPrem?.(job.id, next);
      setJob({ ...job, needsPremAt: next });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Needs Prem failed.';
      setSaveError(message);
      setActionError(message);
    } finally {
      setBusyAction(null);
    }
  };

  /**
   * Admin/owner-only estimate approval, gated to `estimate?.status ===
   * 'submitted'` at the render call site. Deliberately does NOT call
   * `transitionJob` -- `approveEstimate` itself documents that auto-
   * advancing `Job.status` on approval is out of scope (Increment 4).
   */
  const confirmApproveEstimate = (): void => {
    const title = 'Confirm customer approval';
    const body = 'Did the customer specifically approve this estimate?';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
        void handleApproveEstimate();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => void handleApproveEstimate() },
    ]);
  };

  const handleApproveEstimate = async (): Promise<void> => {
    if (!estimate || session.status !== 'authenticated') return;
    setBusyAction('approve');
    setActionError(null);
    try {
      const result = await approveEstimate(estimate, 'approved', {
        estimates: createEstimateRepository(),
        ctx: { role: session.profile.role, now: () => new Date().toISOString() },
        now: () => new Date().toISOString(),
      });
      if (!result.ok) {
        setActionError(result.reason);
        return;
      }
      setEstimate(result.estimate);
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancel = (): void => {
    skipAutosaveRef.current = true;
    goBackOrLanding();
  };

  const handleResetTime = async (): Promise<void> => {
    if (!job) return;
    setBusyAction('reset');
    try {
      await createJobRepository().resetTimeSegments?.(job.id);
      await createJobRepository().patchLifecycle(job.id, {
        enRouteAt: null,
        inProgressAt: null,
        completedAt: null,
      });
      await createJobRepository().patchScheduling(job.id, {
        assignedTechId: null,
        scheduledStart: null,
        scheduledEnd: null,
        requestedWindow: null,
      });
      const jobRepo = createJobRepository();
      if (jobRepo.resetTimeline) await jobRepo.resetTimeline(job.id);
      else await jobRepo.clearInvestigator(job.id);
      const updated = await jobRepo.updateStatus(job.id, 'new');
      setJob({ ...updated, totalLaborSeconds: 0, needsPremAt: null });
      setInvestigatorTechId(null);
      setInvestigation(null);
      setStageExtras((prev) => (prev ? { ...prev, stageMarks: {}, contactedAt: null } : prev));
    } catch (error) {
      setActionError(toUserMessage(error));
      if (org?.id && jobId) {
        const { data } = await supabase
          .from('jobs')
          .select(JOB_ROW_COLUMNS)
          .eq('organization_id', org.id)
          .eq('id', jobId)
          .maybeSingle<JobRow>();
        if (data) setJob(toJob(data));
      }
    } finally {
      setBusyAction(null);
    }
  };

  const confirmResetTime = (): void => {
    const title = 'Reset job?';
    const body =
      "This resets this job's timeline back to New: clears schedule, assigned tech, Prem claim and Prem checklist, stage marks, contacted time, en route / arrived / completed times and logged hours. Customer, details, estimates, payments and contact log are kept.";
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
        void handleResetTime();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => void handleResetTime() },
    ]);
  };

  // Zeroes the job's time only (migration 0119); status, tech and schedule stay. A running clock restarts at 0.
  const handleResetLaborTime = (): void => {
    if (!job) return;
    const stamp = new Date().toISOString();
    const running = job.status === 'in_progress' ? { inProgressAt: stamp } : job.status === 'en_route' ? { enRouteAt: stamp } : {};
    const patch = { totalLaborSeconds: 0, ...running };
    void writeThrough('job.reset_labor_time', { jobId: job.id, resetAt: stamp }, stamp, patch)
      .then((res) => {
        setJob((prev) => (prev && prev.id === job.id ? { ...prev, ...patch } : prev));
        if (res.status === 'queued') setActionError(QUEUED_COPY);
      })
      .catch((err) => setActionError(toUserMessage(err)));
  };

  const confirmResetLaborTime = (): void => {
    const title = 'Reset time to 0?';
    const body = "This sets this job's logged time back to 0. If the clock is running it starts again from 0. Status, tech and schedule are kept.";
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}

${body}`)) handleResetLaborTime();
      return;
    }
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: handleResetLaborTime },
    ]);
  };
  const canResetLaborTime =
    !!job &&
    !['closed', 'archived'].includes(String(job.status)) &&
    (isAdmin || (session.status === 'authenticated' && job.assignedTechId === session.profile.id));

  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingState />
      </View>
    );
  }

  if (!isCreate && !job) {
    return (
      <View style={styles.center}>
        <EmptyState title="Job unavailable" message="This job could not be found." />
        <PayrollButton label="Back" onPress={goBackOrLanding} />
      </View>
    );
  }

  if (isCreate) {
    // Same slider menu as an open job; only Job is live until the job is saved.
    const createMenuItems: MenuItem[] = [
      // All Jobs (#0012) tops every job-timeline menu: Jeff's way back to the jobs list.
      // Techs have no #0012, so theirs opens the Field Tech Jobs tab; other roles get their Jobs tab.
      { id: 'all-jobs', helpId: 'jobs_list', label: 'All Jobs', onPress: () => router.replace((isAdmin ? `/m/admin-finance?view=jobs&ts=${Date.now()}` : role === 'tech' ? '/m/field-tech' : '/jobs') as never) },
      { id: 'plan', helpId: 'job_create', label: 'Job', onPress: () => {}, isActive: true },
      ...['Prem', 'Estimate', ...(isAdmin ? ['Assign'] : []), 'Schedule', 'Contact', 'Start', 'Complete', ...(isAdmin ? ['Paid', 'Close-out'] : [])]
        .map((label) => ({ id: `create-${label.toLowerCase()}`, label, onPress: () => {}, disabled: true })),
    ];
    // Create-mode shell: JobDetailsForm in create mode, local-state-only
    // until Save is pressed.
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppChrome
          menuItems={createMenuItems}
          optionsItems={[]}
          breadcrumbSegments={[{ label: 'Jobs' }, { label: 'New Job' }]}
          titleBar={{ title: 'Admin & Finance', subtitle: 'New Job' }}
          helpContext={{ screenKey: 'job-create' }}
          showBack={false}
          compactMenu
          fitMenu
          gearTitle="Configuration"
          gearItems={[
            { id: 'gear-logins', helpId: 'account', label: 'Logins', onPress: () => router.push('/account') },
            { id: 'gear-settings', helpId: 'settings', label: 'Settings', onPress: () => router.push('/config/settings') },
            { id: 'gear-profile', helpId: 'profile', label: 'Profile', onPress: () => router.push('/profile') },
            ...(isAdmin ? [{ id: 'gear-test-jobs', helpId: 'test_jobs' as const, label: 'Test Jobs', onPress: () => router.push('/config/test-jobs') }] : []),
          ]}
          onLogoPress={goBackOrLanding}
        />
        <ScreenTitleRow
          title="New Job"
          right={(
            <>
              <PayrollButton label="Cancel" onPress={goBackOrLanding} />
              <PayrollButton
                label={saving ? 'Saving…' : 'Save'}
                disabled={saving}
                onPress={() => void handleSaveCreate()}
              />
            </>
          )}
        />
        <ScrollView contentContainerStyle={styles.scrollContent} testID={form.address ? undefined : 'job-create-shell'}>
          {role !== 'tech' ? (
            <Checkbox
              label="Prem Needed"
              accessibilityLabel="Prem Needed"
              variant="check"
              checked={createNeedsPrem}
              disabled={saving}
              onChange={() => setCreateNeedsPrem((v) => !v)}
              style={styles.createPremNeeded}
            />
          ) : null}
          <JobDetailsForm
            mode="create"
            value={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            serviceAreas={serviceAreas}
            error={saveError}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Edit-mode: pinned JobHeader (region tabs + action buttons) above a
  // single ScrollView whose body switches on `region`.
  const currentJob = job as Job;
  const premTechName = investigatorTechId ? techs.find((t) => t.id === investigatorTechId)?.fullName ?? investigatorTechId : null;
  const serviceTechName = currentJob.assignedTechId ? techs.find((t) => t.id === currentJob.assignedTechId)?.fullName ?? currentJob.assignedTechId : null;
  const currentServiceAreaName =
    (currentJob.service_area_id
      ? serviceAreas.find((a) => a.id === currentJob.service_area_id)?.name
      : undefined) ??
    matchServiceAreaByZip(serviceAreas, extractZip(form.address || currentJob.address || ''), form.address || currentJob.address || '')?.name ??
    null;

  // One rule set for the timeline dots and the slider menu, so each stage opens (or stays shut) the same way in both (Jeff 2026-11-03).
  // Admin-only stages are hidden in the menu and dimmed on the timeline; Start needs an installer tech in both.
  const lockedStages = new Set<StageKey>([
    // Techs collect payment for their work, so Paid opens for them too (Jeff 2026-11-02).
    // Techs close out jobs; Sales has no need, so Closeout stays shut for Sales (Jeff 2026-11-03).
    ...(isAdmin ? [] : ['assign' as const]),
    ...(isAdmin || role === 'tech' ? [] : ['paid' as const]),
    ...(isAdmin || role === 'tech' ? [] : ['closeout' as const]),
    ...(currentJob.assignedTechId ? [] : ['startWork' as const]),
  ]);

  const jobDetailMenuItems: MenuItem[] = [
    // All Jobs (#0012) tops every job-timeline menu: Jeff's way back to the jobs list.
    // Techs have no #0012, so theirs opens the Field Tech Jobs tab; other roles get their Jobs tab.
    { id: 'all-jobs', helpId: 'jobs_list', label: 'All Jobs', onPress: () => router.replace((isAdmin ? `/m/admin-finance?view=jobs&ts=${Date.now()}` : role === 'tech' ? '/m/field-tech' : '/jobs') as never) },
    { id: 'plan', helpId: 'job_plan', label: 'Job', onPress: () => selectRegion('plan'), isActive: region === 'details' || region === 'plan' },
    { id: 'evisit', helpId: 'job_prem', label: 'Prem', onPress: () => selectRegion('evisit'), isActive: region === 'evisit' },
    { id: 'estimate', helpId: 'approve_estimate', label: 'Estimate', onPress: () => selectRegion('estimate'), isActive: region === 'estimate' && activeStage !== 'arrive' },
    ...(!lockedStages.has('assign')
      ? [{ id: 'assign', helpId: 'assign', label: 'Assign', onPress: () => { selectRegion('assign'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }, isActive: region === 'assign' }] as MenuItem[]
      : []),
    { id: 'schedule', helpId: 'job_schedule', label: 'Schedule', onPress: () => selectRegion('schedule'), isActive: region === 'schedule' },
    { id: 'contact', helpId: 'contact', label: 'Contact', onPress: () => { setActiveStage('contact'); handleContact(); }, isActive: activeStage === 'contact' },
    { id: 'arrive', helpId: 'arrive', label: 'Start', onPress: () => { setActiveStage('arrive'); void handleArrive(); }, disabled: lockedStages.has('startWork'), isActive: activeStage === 'arrive' },
    { id: 'photos', helpId: 'job_photos', label: 'Photos', onPress: () => { selectRegion('photos'); scrollRef.current?.scrollTo({ y: 0, animated: true }); }, isActive: region === 'photos' && !activeStage },
    { id: 'complete', helpId: 'complete', label: 'Complete', onPress: () => { setActiveStage('complete'); void handleComplete(); }, isActive: activeStage === 'complete' },
    ...(!lockedStages.has('paid')
      ? [{ id: 'paid', helpId: 'paid', label: 'Paid', onPress: () => { selectRegion('payment'); setActiveStage('paid'); }, isActive: region === 'payment' }] as MenuItem[]
      : []),
    {
      id: 'configuration',
      helpId: 'settings',
      label: 'Configuration',
      onPress: () => {},
      submenu: [
        { id: 'config-settings', helpId: 'settings', label: 'Settings', onPress: () => router.push('/config/settings') },
      ],
    },
    ...(!lockedStages.has('closeout')
      ? [{ id: 'closeout', helpId: 'job_closeout', label: 'Close-out', onPress: () => selectRegion('closeout'), isActive: region === 'closeout' }] as MenuItem[]
      : []),
  ];

  // Configuration (#0097) stays in every role's slider; Needs Prem is the Prem Needed
  // checkbox on the Job tab, not a menu item. AppChrome adds the line, Sign out (#0096), then Configuration (#0097) last.
  const adminJobMenuItems: MenuItem[] = jobDetailMenuItems;
  const isTech = role === 'tech';
  const techJobMenuItems: MenuItem[] = jobDetailMenuItems;

  return (
    <View style={styles.root}>
      <JobHeader
        job={currentJob}
        customer={customer}
        totalLaborSeconds={currentJob.totalLaborSeconds ?? 0}
        jobDetailMenuItems={isAdmin ? adminJobMenuItems : isTech ? techJobMenuItems : jobDetailMenuItems}
        optionsItems={
          region === 'estimate'
            ? estimateChrome?.optionsItems
            : region === 'schedule'
              ? [{ id: 'schedule-blackout-dates', helpId: 'job_schedule', label: 'Blackout Dates?', kind: 'toggle' as const, checked: showBlackouts, onToggle: setShowBlackouts }]
              : undefined
        }
        showBack={isAdmin || isTech ? false : undefined}
        compactMenu={isAdmin || isTech || undefined}
        onSchedulePress={() => selectRegion('schedule')}
        fitMenu={isAdmin || isTech || undefined}
        gearItems={isAdmin || isTech ? [
          { id: 'gear-logins', helpId: 'account', label: 'Logins', onPress: () => router.push('/account') },
          { id: 'gear-settings', helpId: 'settings', label: 'Settings', onPress: () => router.push('/config/settings') },
          { id: 'gear-profile', helpId: 'profile', label: 'Profile', onPress: () => router.push('/profile') },
          ...(isAdmin ? [{ id: 'gear-test-jobs', helpId: 'test_jobs' as const, label: 'Test Jobs', onPress: () => router.push('/config/test-jobs') }] : []),
        ] : undefined}
        gearTitle={isAdmin || isTech ? 'Configuration' : undefined}
        onLogoPress={isAdmin ? () => (router.canGoBack() ? router.back() : router.replace('/m/admin-finance')) : isTech ? () => router.push('/m/field-tech') : undefined}
      >
        {stageResults ? (
          <JobProgressBar
            stages={stageList}
            states={stageResults.states}
            nextStep={region === 'payment' || region === 'closeout' ? '' : (stageResults.nextStep ?? '')}
            onStagePress={handleStagePress}
            disabledKeys={[...lockedStages]}
            testID="job-progress-bar"
          />
        ) : null}
      </JobHeader>
      <BadgeTooltip title="Job status line" state={jobRuleState(job?.status)} detail="It turns yellow when Start is pressed and green when the job is complete." color={jobRuleColor(job?.status)} hitSlop={{ top: 12, bottom: 12 }} testID="job-status-rule"><View style={[styles.rule, { backgroundColor: jobRuleColor(job?.status) }]} /></BadgeTooltip>
      <StaleDataHint queries={['app.jobs.byId', 'app.jobs.stageExtras']} />
      {region === 'estimate' && estimateChrome?.tabs ? (
        <View testID="estimate-tab-bar" style={styles.tabBarWrap}>
          <DefaultTabBar tabs={estimateChrome.tabs} activeId={estimateChrome.activeTab} onChange={estimateChrome.onTabChange} />
        </View>
      ) : null}
      <ScreenTitleRow
        title={REGION_TITLES[region] ?? 'Job'}
        testID="job-screen-title"
        right={region === 'details' || region === 'plan' ? (
          <>
            <PayrollButton label="Cancel" onPress={handleCancel} disabled={saving} />
            <PayrollButton label={saving ? 'Saving...' : 'Save'} onPress={() => void handleSaveEdit()} disabled={saving} />
            {isAdmin ? <PayrollButton label="Reset" onPress={confirmResetTime} /> : null}
            {canResetLaborTime ? <PayrollButton label="Reset time" onPress={confirmResetLaborTime} /> : null}
          </>
        ) : undefined}
      />
      <ScrollView ref={scrollRef} style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
        {region === 'payment' && (estimate?.summary?.trim() || currentJob.description?.trim()) ? (
          <Text style={{ paddingHorizontal: spacing.md, marginTop: spacing.xs }}>
            {estimate?.summary?.trim() || currentJob.description?.trim()}
          </Text>
        ) : null}
        <JobSummaryRest
          hideTechFields={region === 'estimate' || region === 'schedule' || region === 'closeout' || region === 'evisit'}
          hidePremTech={region === 'payment'}
          hideServiceArea={region === 'payment'}
          job={currentJob}
          statusError={actionError}
          serviceAreaName={currentServiceAreaName}
          premTechId={investigatorTechId}
          serviceTechId={currentJob.assignedTechId ?? null}
          premTechName={premTechName}
          serviceTechName={serviceTechName}
          premBusy={assigning !== null}
          serviceBusy={assigning !== null}
          serviceGateOpen={serviceGateOpen}
          premIndicator={currentJob.needsPremAt && estimate?.status !== 'approved' ? 'Prem' : null}
          {...(role !== 'tech' && (region === 'details' || region === 'plan')
            ? {
                needsPrem: !!currentJob.needsPremAt || !!investigatorTechId,
                onToggleNeedsPrem: () => { void handleToggleNeedsPrem(); },
                needsPremDisabled: !!investigation?.submittedAt || !!investigatorTechId || busyAction === 'needs-prem',
              }
            : {})}
          {...(isAdmin
            ? {
                techs: eligibleTechOptions,
                onRequestAssignPrem: (techId: string | null) => setPendingAssign({ kind: 'prem', techId }),
                onRequestAssignService: (techId: string | null) => {
                  if (techId !== null && !serviceGateOpen) return;
                  setPendingAssign({ kind: 'service', techId });
                },
              }
            : {})}
        />
        <WarningSheet
          visible={pendingAssign !== null}
          warnings={[]}
          title="Reassign job?"
          message={(() => {
            if (!pendingAssign) return '';
            const role = pendingAssign.kind === 'prem' ? 'Prem Tech' : 'Service Tech';
            const curId = pendingAssign.kind === 'prem' ? investigatorTechId : currentJob.assignedTechId ?? null;
            const nameOf = (id: string | null | undefined) => (id ? techs.find((t) => t.id === id)?.fullName ?? id : '');
            if (pendingAssign.techId === null) return `Remove ${nameOf(curId)} as ${role}?`;
            if (curId && curId !== pendingAssign.techId) return `Replace ${nameOf(curId)} with ${nameOf(pendingAssign.techId)} as ${role}?`;
            return `Assign ${nameOf(pendingAssign.techId)} as ${role}?`;
          })()}
          onCancel={() => setPendingAssign(null)}
          onConfirm={() => {
            const p = pendingAssign;
            setPendingAssign(null);
            if (!p) return;
            void (p.kind === 'prem'
              ? (p.techId ? handleAssignInvestigator(p.techId) : handleUnassign('prem'))
              : (p.techId ? (serviceGateOpen ? handleAssignInstaller(p.techId) : undefined) : handleUnassign('service')));
          }}
        />
        {region === 'evisit' && (
          <JobInvestigationScreen
            jobId={currentJob.id}
            job={currentJob}
            embedded
            headerSlot={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {isAdmin && investigatorTechId ? (
                  <>
                    <Text numberOfLines={1}>
                      {'Prem Claimed by: '}
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{techs.find((t) => t.id === investigatorTechId)?.fullName ?? investigatorTechId}</Text>
                    </Text>
                    <Text style={{ color: colors.textMuted }}>{'•'}</Text>
                  </>
                ) : null}
                <View style={{ flex: 1 }}>
                  <JobTechFields
                    hideServiceTech
                    hideServiceArea
                    premTechId={investigatorTechId}
                    premTechName={premTechName}
                    premBusy={assigning !== null}
                    premIndicator={currentJob.needsPremAt && estimate?.status !== 'approved' ? 'Prem' : null}
                    {...(isAdmin
                      ? {
                          techs: eligibleTechOptions,
                          onRequestAssignPrem: (techId: string | null) => setPendingAssign({ kind: 'prem', techId }),
                        }
                      : {})}
                  />
                </View>
              </View>
            }
            renderTaskList={(p) => <JobTaskList {...p} source={p.source as 'plan' | 'prem' | 'estimate' | undefined} />}
            onSubmitted={(inv) => {
              setInvestigation(inv);
              void createEstimateRepository().getForJob(currentJob.id).then((value) => setEstimate(value));
            }}
          />
        )}
        {region === 'estimate' && (
          <JobEstimateScreen
            job={currentJob}
            embedded
            {...(isAdmin
              ? { renderTaskList: (p) => <JobTaskList {...p} source={p.source as 'plan' | 'prem' | 'estimate' | undefined} /> }
              : {})}
            onEstimateChange={setEstimate}
            estimates={estimateRepo}
            priceSheets={priceSheetRepo}
            priceSheetRates={priceEstimatingRates}
            priceSheetAreaAdjustments={areaAdjustmentsRepo}
            techSlot={
              <JobTechFields
                serviceAreaName={currentServiceAreaName}
                premTechId={investigatorTechId}
                serviceTechId={currentJob.assignedTechId ?? null}
                premTechName={premTechName}
                serviceTechName={serviceTechName}
                premBusy={assigning !== null}
                serviceBusy={assigning !== null}
                serviceGateOpen={serviceGateOpen}
                premIndicator={currentJob.needsPremAt && estimate?.status !== 'approved' ? 'Prem' : null}
                {...(isAdmin
                  ? {
                      techs: eligibleTechOptions,
                      onRequestAssignPrem: (techId: string | null) => setPendingAssign({ kind: 'prem', techId }),
                      onRequestAssignService: (techId: string | null) => {
                        if (techId !== null && !serviceGateOpen) return;
                        setPendingAssign({ kind: 'service', techId });
                      },
                    }
                  : {})}
              />
            }
            serviceAreas={serviceAreas}
            editable={!isTechEstimate}
            onChrome={setEstimateChrome}
            focusTab={estimateFocus}
            beforePhotoSlot={
              <>
                {/* Start screen #0076: Reset time sits here too (Jeff 2026-11-03). */}
                {activeStage === 'arrive' && canResetLaborTime ? (
                  <View style={styles.startResetRow}>
                    <PayrollButton label="Reset time" onPress={confirmResetLaborTime} />
                  </View>
                ) : null}
                <JobBeforePhotoCard
                  jobId={currentJob.id}
                  jobNumber={currentJob.jobNumber ?? null}
                  onSaved={() => setPhotoCountTick((n) => n + 1)}
                />
              </>
            }
          />
        )}
        {region === 'closeout' && role && (
          <JobCloseOutRegion job={currentJob} role={role} onClosed={(updated) => setJob(updated)} />
        )}
        {region === 'history' && role && <JobHistoryRegion job={currentJob} role={role} />}
        {region === 'photos' && <JobPhotosRegion jobId={currentJob.id} jobNumber={currentJob.jobNumber ?? null} />}
        {region === 'payment' && role && <JobPaymentRegion job={currentJob} role={role} onJobUpdated={(j) => setJob(j)} />}
        {region === 'schedule' && (
          <JobScheduleScreen
            job={currentJob}
            embedded
            jobRepository={createJobRepository()}
            onSaved={(updated) => setJob(updated)}
            totalTaskMinutes={totalTaskMinutes}
            standardMinutes={standardMinutes}
            showBlackouts={showBlackouts}
            onOpenJob={(id) => router.push(`/job/${id}?panel=plan` as never)}
          />
        )}
        {(region === 'details' || region === 'plan') && (
          <>
            <JobOverviewRegion
              jobId={currentJob.id}
              jobNumber={currentJob.jobNumber ?? null}
              customerId={currentJob.customerId ?? null}
              jobStatus={currentJob.status ?? null}
              jobIsOpen={['new', 'qualified', 'scheduled', 'assigned', 'accepted', 'en_route', 'in_progress', 'needs_reschedule'].includes(String(currentJob.status))}
              isAdmin={isAdmin}
              value={form}
              onChange={handleFormChange}
              serviceAreas={serviceAreas}
              hasInvestigation={investigation !== null}
              error={saveError}
              createdAt={stageExtras?.createdAt ?? currentJob.createdAt}
              saving={saving}
              onSave={() => void handleSaveEdit()}
              onCancel={handleCancel}
              hideActions
              onReset={isAdmin ? confirmResetTime : undefined}
              onResetTime={canResetLaborTime ? confirmResetLaborTime : undefined}
              onOpenJob={(id) => router.push(`/job/${id}?panel=plan` as never)}
            />
            <View style={styles.jobDetailPane}>
              <JobDetail job={currentJob} />
            </View>
          </>
        )}
      </ScrollView>
      {/* 'details' region (JobOverviewRegion) owns its own Cancel/Save; no parent footer. */}
    </View>
  );
}

/** Title shown at the left of the title row for each Job timeline region (Jeff 2026-11-05). */
const REGION_TITLES: Record<string, string> = {
  details: 'Job Details',
  plan: 'Job Details',
  evisit: 'Prem Checklist',
  estimate: 'Estimate',
  assign: 'Assign',
  schedule: 'Schedule',
  photos: 'Photos',
  history: 'History',
  payment: 'Paid',
  closeout: 'Close-Out',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  rule: { height: 3, backgroundColor: colors.text, width: '100%', marginTop: Math.round(spacing.sm * 0.67) },
  scrollBody: { flex: 1 },
  scrollContent: { paddingBottom: spacing.sm },
  jobDetailPane: { marginTop: spacing.sm },
  startResetRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  footerButton: { flex: 1 },
  createPremNeeded: { paddingHorizontal: spacing.md, marginTop: spacing.xs, marginBottom: 0 },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  tabBarWrap: {},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.offWhite,
  },
});
