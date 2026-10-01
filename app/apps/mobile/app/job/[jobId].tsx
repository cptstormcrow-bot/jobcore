// Calendar-entry drilldown: renders a single job's unified Job Details
// screen (pinned JobHeader + single-scroll region body) from its id route
// param. Region switching replaces the old full-screen panel early-returns;
// Contact/Arrive/Complete/Payment are header actions, not regions.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { Job, JobStatus, Profile } from '@jobcore/core';
import { AppChrome, Breadcrumb, Button, colors, EmptyState, LoadingState, spacing, telUrl, Text } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
import { JobDetail } from '../../src/components/JobDetail';
import { JobHeader, JobSummaryRest, type JobRegion } from '../../src/components/JobHeader';
import { JobDetailsForm, type JobFormValues } from '../../src/components/JobDetailsForm';
import { AssignTechRegion } from '../../src/components/AssignTechRegion';
import { useSession, signOut } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';
import {
  createJobRepository,
  createCustomerRepository,
  createEmployeeRepository,
  createJobAssignmentRepository,
  createCalendarEventRepository,
  createJobPlanningRepository,
  createJobPlanningPhotoRepository,
  createPriceSheetRepository,
  createPriceSheetPublishRepository,
  createPriceSheetAreaAdjustmentsRepository,
  createServiceAreaRepository,
  createTechServiceAreaRepository,
  createEstimateRepository,
  createJobInvestigationRepository,
  createPaymentsRepository,
  createJobPlanTasksRepository,
  createPriceSheetStandardDurationRepository,
} from '../../src/lib/admin-finance-repos';
import type { JobDetailsPatch, CustomerPatch, CustomerCreateInput, Customer, ServiceArea, JobEstimate, JobInvestigation, TechServiceArea } from '../../../../modules/admin-finance/src/data/ports';
import type { JobInvestigationInput } from '../../src/lib/admin-finance-repos';
import { SETTLED_PAYMENT_STATUSES } from '../../../../modules/admin-finance/src/data/ports';
import { candidatesFor } from '../../../../modules/admin-finance/src/domain/segway-candidates';
import type { JobDraft } from '../../../../modules/admin-finance/src/domain/qualify';
import { assignJob } from '../../../../modules/admin-finance/src/flows/assign-job';
import { unassignJob } from '../../../../modules/admin-finance/src/flows/unassign-job';
import { approveEstimate } from '../../../../modules/admin-finance/src/flows/approve-estimate';
import { transitionJob } from '../../../../modules/admin-finance/src/domain/transition';
import { extractZip, matchServiceAreaByZip, seedPlanningFromInvestigation } from '../../../../modules/admin-finance/src/domain/job-detail-helpers';
import { PlanningScreen } from '../../../../modules/admin-finance/src/screens/PlanningScreen';
import { JobScheduleScreen } from '../../../../modules/admin-finance/src/screens/JobScheduleScreen';
import { JobEstimateScreen } from '../../../../modules/admin-finance/src/screens/JobEstimateScreen';
import { JobEstimateEditor } from '../../../../modules/field-tech/src/screens/JobEstimateEditor';
import { JobInvestigationScreen } from '../../../../modules/field-tech/src/screens/JobInvestigationScreen';
import { setModuleSession } from '@jobcore/admin-finance';
import {
  setModuleSession as setFieldTechModuleSession,
  clearModuleSession as clearFieldTechModuleSession,
} from '../../../../modules/field-tech/src/lib/module-session';
import { setModulePorts as setFieldTechModulePorts } from '../../../../modules/field-tech/src/lib/module-ports';
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

const JOB_ROW_COLUMNS =
  'id, organization_id, status, customer_id, service_id, source, payer, attach_timing, ' +
  'requested_window, scheduled_start, scheduled_end, address, description, assigned_tech_id, ' +
  'en_route_at, in_progress_at, completed_at, created_at, is_beta, house_age_years' +
  ', permit_status, parking_available, rooms, panel_info, considerations, service_area_id, job_number' +
  ', ingress_instructions, total_labor_seconds, needs_prem_at';

// Deep-link `?panel=` -> unified `JobRegion`. `start-checklist`/`completion`
// have no dedicated region in the unified screen (those flows are reached
// from `details`), so they map back to `details`.
const DEEP_LINK_PANELS = ['plan', 'schedule', 'jobEstimate', 'jobInvestigation', 'start-checklist', 'completion'] as const;
type DeepLinkPanel = (typeof DEEP_LINK_PANELS)[number];
function isDeepLinkPanel(v: string | undefined): v is DeepLinkPanel {
  return (DEEP_LINK_PANELS as readonly string[]).includes(v ?? '');
}
function regionFromPanel(panel: string | undefined): JobRegion {
  if (!isDeepLinkPanel(panel)) return 'details';
  switch (panel) {
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
  evisitParking: '',
  evisitPanel: '',
};

export default function JobDrilldownScreen() {
  const { jobId, panel } = useLocalSearchParams<{ jobId: string; panel?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const session = useSession();
  const org = session.status === 'authenticated' ? session.organization : undefined;
  const role = session.status === 'authenticated' ? session.profile.role : undefined;
  const isAdmin = role === 'admin';

  if (session.status === 'authenticated' && org && role) {
    setModuleSession({ org, role, userId: session.profile.id });
    setFieldTechModuleSession({ org, role, userId: session.profile.id });
    setFieldTechModulePorts(buildFieldTechPorts());
  }

  useEffect(() => {
    return () => clearFieldTechModuleSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mode detection: the `new` route param means create-mode; any other
  // (real UUID) jobId means edit-mode.
  const isCreate = jobId === 'new';

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Tech-assignment section: active-tech roster for the org, and any
  // in-flight/error state for an assignment tap, kept separate from the
  // job-detail/customer `saving`/`saveError` pair above so an assignment
  // failure doesn't clobber (or get clobbered by) a Save-button failure.
  const [techs, setTechs] = useState<Profile[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [investigation, setInvestigation] = useState<JobInvestigation | null>(null);

  const [region, setRegion] = useState<JobRegion>(regionFromPanel(panel));
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
      });
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
    });
    return () => { cancelled = true; };
  }, [org?.id]);

  // Auto-match service area once on load when the job has no service area
  // set but does have an address/zip, mirroring the handleFormChange path.
  useEffect(() => {
    if (serviceAreas.length === 0) return;
    if (form.serviceAreaId !== null) return;
    const zip = extractZip(form.address);
    if (!zip) return;
    const matched = matchServiceAreaByZip(serviceAreas, zip);
    if (matched) {
      setForm((prev) => (prev.serviceAreaId === null ? { ...prev, serviceAreaId: matched.id } : prev));
    }
  }, [serviceAreas, form.address, form.serviceAreaId]);

  // Tech -> service-area coverage rows, used to hard-filter the technician
  // dropdown on this screen. The Assignment Board stays decorate-only.
  const [techServiceAreas, setTechServiceAreas] = useState<TechServiceArea[]>([]);
  useEffect(() => {
    if (!org?.id) { setTechServiceAreas([]); return; }
    let cancelled = false;
    void createTechServiceAreaRepository().listForOrganization(org.id).then((list) => {
      if (!cancelled) setTechServiceAreas(list);
    });
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
    if (isCreate || !job?.id) {
      setEstimate(null);
      setInvestigation(null);
      setInvestigatorTechId(null);
      return undefined;
    }
    let cancelled = false;
    void createEstimateRepository().getForJob(job.id).then((value) => {
      if (!cancelled) setEstimate(value);
    });
    void createJobInvestigationRepository().getForJob(job.id).then((value) => {
      if (!cancelled) setInvestigation(value);
    });
    void createJobAssignmentRepository().getInvestigatorTechId(job.id).then((value) => {
      if (!cancelled) setInvestigatorTechId(value);
    });
    return () => { cancelled = true; };
  }, [isCreate, job?.id]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      evisitParking: investigation?.parkingNotes ?? '',
      evisitPanel: investigation?.stateAssessment ?? '',
    }));
  }, [investigation]);

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
      setLoading(false);
      return;
    }
    if (!org?.id || !jobId) {
      setJob(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void supabase
      .from('jobs')
      .select(JOB_ROW_COLUMNS)
      .eq('organization_id', org.id)
      .eq('id', jobId)
      .maybeSingle<JobRow>()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        const loaded = error || !data ? null : toJob(data);
        setJob(loaded);
        setCustomerId(loaded?.customerId ?? null);

        // Customer fields are seeded from a second lookup keyed off the
        // job's `customer_id` (job.customerId per the JobRow/Job mapping
        // above) via the CustomerRepository -- the `customers` table is not
        // selected as part of JOB_ROW_COLUMNS.
        const fetchedCustomer = loaded?.customerId
          ? await createCustomerRepository().getById(loaded.customerId)
          : null;
        if (cancelled) return;
        setCustomer(fetchedCustomer);

        const extras = loaded as typeof loaded & Partial<{ permitStatus: string; parkingAvailable: string; rooms: string[]; panelInfo: string; considerations: string }>;
        setForm(
          loaded
            ? {
                address: loaded.address ?? '',
                description: loaded.description ?? '',
                serviceAreaId: loaded.service_area_id ?? null,
                houseAgeYears: '',
                evisitParking: '',
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
  }, [isCreate, org?.id, jobId]);

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
          parkingNotes: form.evisitParking.trim() || null,
          stateAssessment: form.evisitPanel.trim() || null,
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
      router.replace(`/job/${created.id}`);
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
    if (!job || session.status !== 'authenticated' || !org?.id) return;
    setAssigning(techId);
    setAssignError(null);
    setActionError(null);
    try {
      const result = await assignJob(job, techId, {
        jobs: createJobRepository(),
        assignments: createJobAssignmentRepository(),
        calendarEvents: createCalendarEventRepository(),
        ctx: { role: session.profile.role, now: () => new Date().toISOString() },
      });
      if (!result.ok) {
        setAssignError(result.reason);
        setActionError(result.reason);
        return;
      }
      setJob(result.job);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assignment failed.';
      setAssignError(message);
      setActionError(message);
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
   */
  const handleAssignInvestigator = async (techId: string): Promise<void> => {
    if (!isAdmin) return;
    if (!job || !org?.id) return;
    setAssigning(techId);
    setAssignError(null);
    setActionError(null);
    try {
      await createJobAssignmentRepository().create(org.id, {
        jobId: job.id,
        techId,
        assignedAt: new Date().toISOString(),
        kind: 'investigator',
      });
      setInvestigatorTechId(techId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assignment failed.';
      setAssignError(message);
      setActionError(message);
    } finally {
      setAssigning(null);
    }
  };

  useEffect(() => {
    if (!jobId) {
      setTotalTaskMinutes(0);
      return undefined;
    }
    let cancelled = false;
    void createJobPlanTasksRepository().listForJob(jobId).then((rows) => {
      if (cancelled) return;
      const sum = rows.reduce((acc, row) => acc + (row.estimatedMinutes ?? 0) * row.quantity, 0);
      setTotalTaskMinutes(sum);
    });
    if (org?.id) {
      void createPriceSheetStandardDurationRepository().get(org.id).then((result) => {
        if (cancelled) return;
        if (result.ok && result.value) {
          setStandardMinutes(result.value.standardMinutes);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [jobId, org?.id]);

  const handleAssign = async (techId: string): Promise<void> => {
    if (!isAdmin) return;
    return (estimate?.status === 'approved' ? handleAssignInstaller : handleAssignInvestigator)(techId);
  };

  // Clears the assignment back to the shared "Unassigned" convention
  // (Select option { label: 'Unassigned', value: '' }); approved jobs persist
  // the clear via patchScheduling, investigator picks clear locally only.
  const handleUnassign = async (): Promise<void> => {
    if (!isAdmin) return;
    if (!job) return;
    setAssigning('unassign');
    setActionError(null);
    try {
      if (estimate?.status === 'approved') {
        if (session.status !== 'authenticated' || !org?.id) return;
        const result = await unassignJob(job, {
          jobs: createJobRepository(),
          assignments: createJobAssignmentRepository(),
          calendarEvents: createCalendarEventRepository(),
          ctx: { role: session.profile.role, now: () => new Date().toISOString() },
        });
        if (!result.ok) {
          setAssignError(result.reason);
          setActionError(result.reason);
          return;
        }
        setJob(result.job);
      } else {
        setInvestigatorTechId(null);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unassign failed.');
    } finally {
      setAssigning(null);
    }
  };

  // Save-follows-selection: switching regions autosaves a dirty edit-mode
  // form before moving; a `saving` ref guards `beforeRemove` against a
  // double-fire. `handleSaveEdit` dedupes concurrent calls onto one in-flight
  // promise and is awaitable, resolving `true` on success.
  const savingRef = useRef(false);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const skipAutosaveRef = useRef(false);
  const leaveAfterFailRef = useRef(false);
  const leavePendingRef = useRef(false);
  const selectRegion = useCallback(
    (next: JobRegion) => {
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
        const matched = matchServiceAreaByZip(serviceAreas, zip);
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

  const handleContact = () => {
    if (!customer?.phone) return;
    void Linking.openURL(telUrl(customer.phone));
  };

  const handleArrive = async (): Promise<void> => {
    if (!job) return;
    if (!(job.assignedTechId ?? investigatorTechId)) {
      Alert.alert('Installer tech required', 'An installer tech must be assigned to this job before Arrive can be marked.');
      return;
    }
    setBusyAction('arrive');
    setActionError(null);
    try {
      if (!job.enRouteAt) {
        const updated = await createJobRepository().patchLifecycle(job.id, { enRouteAt: new Date().toISOString() });
        setJob(updated);
        await createJobRepository().updateStatus(job.id, 'in_progress');
      } else if (!job.inProgressAt) {
        const updated = await createJobRepository().patchLifecycle(job.id, { inProgressAt: new Date().toISOString() });
        setJob(updated);
        await createJobRepository().updateStatus(job.id, 'in_progress');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Arrive failed.';
      setSaveError(message);
      setActionError(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (!job || job.completedAt) return;
    setBusyAction('complete');
    setActionError(null);
    try {
      const updated = await createJobRepository().patchLifecycle(job.id, { completedAt: new Date().toISOString() });
      setJob(updated);
      await createJobRepository().updateStatus(job.id, 'completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Complete failed.';
      setSaveError(message);
      setActionError(message);
    } finally {
      setBusyAction(null);
    }
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
      setActionError(err instanceof Error ? err.message : 'Approve failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const confirmMarkPaid = (): void => {
    if (!job || job.status !== 'completed') {
      const message = 'Complete the job before marking it paid.';
      setSaveError(message);
      setActionError(message);
      return;
    }
    const amount = estimate?.totalCost ?? 0;
    const title = 'Confirm payment received';
    const body = `Mark this job as paid for $${amount.toFixed(2)}?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
        void handleMarkPaid();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => void handleMarkPaid() },
    ]);
  };

  const handleCancel = (): void => {
    skipAutosaveRef.current = true;
    router.back();
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
      await createJobRepository().clearInvestigator(job.id);
      const updated = await createJobRepository().updateStatus(job.id, 'new');
      setJob({ ...updated, totalLaborSeconds: 0 });
      setInvestigatorTechId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
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
      'This returns the job to New: clears schedule, assigned tech, Prem claim, en route / arrived / completed times and logged hours. Customer, details, estimates, payments and contact log are kept.';
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

  const handleMarkPaid = async (): Promise<void> => {
    if (!job || session.status !== 'authenticated') return;
    if (session.profile.role !== 'owner' && session.profile.role !== 'admin') return;
    if (job.status !== 'completed') {
      const message = 'Complete the job before marking it paid.';
      setSaveError(message);
      setActionError(message);
      return;
    }
    setBusyAction('paid');
    setActionError(null);
    try {
      const payments = await createPaymentsRepository().listForJob(job.id);
      const settled = payments.some((p) => SETTLED_PAYMENT_STATUSES.includes(p.status));
      if (!settled) {
        const amount = estimate?.totalCost ?? 0;
        await createPaymentsRepository().recordManualPayment(job.organizationId, job.id, amount);
      }
      // A payment record is now guaranteed to exist (either it was already
      // settled, or we just recorded one above), so this can be hardcoded.
      const updated = await transitionJob(job, 'paid', {
        role: session.profile.role,
        now: () => new Date().toISOString(),
        hasPaymentRecord: () => true,
      });
      setJob(updated);
      await createJobRepository().updateStatus(job.id, 'paid');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Mark paid failed.';
      setSaveError(message);
      setActionError(message);
    } finally {
      setBusyAction(null);
    }
  };

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
      </View>
    );
  }

  if (isCreate) {
    // Create-mode shell: JobDetailsForm in create mode, local-state-only
    // until Create is pressed.
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppChrome
          menuItems={[]}
          optionsItems={[]}
          breadcrumbSegments={[{ label: 'Jobs' }, { label: 'New Job' }]}
          titleBar={{ title: 'New Job' }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent} testID={form.address ? undefined : 'job-create-shell'}>
          <JobDetailsForm
            mode="create"
            value={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            serviceAreas={serviceAreas}
            error={saveError}
          />
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Cancel" variant="outline" style={styles.footerButton} onPress={() => router.back()} />
          <Button
            label={saving ? 'Creating…' : 'Create'}
            disabled={saving}
            style={styles.footerButton}
            onPress={() => void handleSaveCreate()}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Edit-mode: pinned JobHeader (region tabs + action buttons) above a
  // single ScrollView whose body switches on `region`.
  const currentJob = job as Job;
  const effectiveTechId = currentJob.assignedTechId ?? investigatorTechId;
  const assignedTechName = effectiveTechId
    ? techs.find((t) => t.id === effectiveTechId)?.fullName ?? effectiveTechId
    : null;
  const currentServiceAreaName = currentJob.service_area_id
    ? serviceAreas.find((a) => a.id === currentJob.service_area_id)?.name ?? null
    : null;

  const jobDetailMenuItems: MenuItem[] = [
    { id: 'plan', label: 'Plan', onPress: () => selectRegion('plan'), isActive: region === 'plan' },
    { id: 'evisit', label: 'Prelim (Prem)', onPress: () => selectRegion('evisit'), isActive: region === 'evisit' },
    { id: 'estimate', label: 'Estimate', onPress: () => selectRegion('estimate'), isActive: region === 'estimate' },
    ...(isAdmin
      ? [{ id: 'assign', label: 'Assign', onPress: () => selectRegion('assign'), isActive: region === 'assign' }]
      : []),
    ...(role !== 'tech'
      ? [{
          id: 'needs-prem',
          label: currentJob.needsPremAt ? 'Clear Prem' : 'Needs Prem',
          onPress: () => void handleToggleNeedsPrem(),
        }]
      : []),
    { id: 'schedule', label: 'Schedule', onPress: () => selectRegion('schedule'), isActive: region === 'schedule' },
    { id: 'contact', label: 'Contact', onPress: handleContact },
    { id: 'arrive', label: 'Arrive', onPress: () => void handleArrive(), disabled: !effectiveTechId },
    { id: 'complete', label: 'Complete', onPress: () => void handleComplete() },
    ...(role === 'owner' || role === 'admin'
      ? [{ id: 'paid', label: 'Paid', onPress: () => void confirmMarkPaid() }]
      : []),
    { id: 'sign-out', label: 'Sign out', onPress: () => void signOut() },
    {
      id: 'configuration',
      label: 'Configuration',
      onPress: () => {},
      submenu: [
        { id: 'config-settings', label: 'Settings', onPress: () => router.push('/config/settings') },
      ],
    },
  ];

  const adminJobMenuItems: MenuItem[] = jobDetailMenuItems
    .filter((item) => item.id !== 'needs-prem' && item.id !== 'sign-out' && item.id !== 'configuration')
    .map((item) => (item.id === 'evisit' ? { ...item, label: 'Prelim' } : item));
  const isTech = role === 'tech';
  const techJobMenuItems: MenuItem[] = jobDetailMenuItems.filter((item) => item.id !== 'sign-out' && item.id !== 'configuration');

  return (
    <View style={styles.root}>
      <JobHeader
        job={{ ...currentJob, assignedTechId: currentJob.assignedTechId ?? investigatorTechId }}
        customer={customer}
        totalLaborSeconds={currentJob.totalLaborSeconds ?? 0}
        jobDetailMenuItems={isAdmin ? adminJobMenuItems : isTech ? techJobMenuItems : jobDetailMenuItems}
        showBack={isAdmin || isTech ? false : undefined}
        compactMenu={isAdmin || isTech || undefined}
        fitMenu={isAdmin || isTech || undefined}
        gearItems={isAdmin || isTech ? [
          { id: 'gear-logins', label: 'Logins', onPress: () => router.push('/account') },
          { id: 'gear-settings', label: 'Settings', onPress: () => router.push('/config/settings') },
          { id: 'gear-profile', label: 'Profile', onPress: () => router.push('/profile') },
        ] : undefined}
        gearTitle={isAdmin || isTech ? 'Configuration' : undefined}
        onLogoPress={isAdmin ? () => (router.canGoBack() ? router.back() : router.replace('/m/admin-finance')) : isTech ? () => router.push('/m/field-tech') : undefined}
        onPressSchedule={() => selectRegion('schedule')}
      />
      <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
        <JobSummaryRest
          job={{ ...currentJob, assignedTechId: currentJob.assignedTechId ?? investigatorTechId }}
          statusError={actionError}
          assignedTechName={assignedTechName}
          serviceAreaName={currentServiceAreaName}
          techs={eligibleTechOptions}
          onAssignTech={(techId) => void (techId ? handleAssign(techId) : handleUnassign())}
          assigningTech={assigning !== null}
        />
        {region === 'plan' && (
          <PlanningScreen
            embedded
            jobs={[currentJob]}
            initialSelectedJobId={currentJob.id}
            jobPlanning={createJobPlanningRepository()}
            jobPlanningPhotos={createJobPlanningPhotoRepository()}
            jobPlanTasks={createJobPlanTasksRepository()}
            investigationSeed={investigation}
            standardMinutes={standardMinutes}
          />
        )}
        {region === 'evisit' && (
          <JobInvestigationScreen jobId={currentJob.id} embedded />
        )}
        {isAdmin && region === 'evisit' ? (
          <Button
            label={currentJob.needsPremAt ? 'Clear Prem' : 'Needs Prem'}
            onPress={() => void handleToggleNeedsPrem()}
          />
        ) : null}
        {region === 'estimate' && role === 'tech' && (
          <JobEstimateEditor jobId={currentJob.id} embedded />
        )}
        {region === 'estimate' && role !== 'tech' && estimate?.status === 'submitted' && (
          <Button
            label={busyAction === 'approve' ? 'Approving…' : 'Approve Estimate'}
            onPress={confirmApproveEstimate}
            disabled={busyAction === 'approve'}
          />
        )}
        {region === 'estimate' && role !== 'tech' && (
          <JobEstimateScreen
            job={currentJob}
            embedded
            estimates={createEstimateRepository()}
            priceSheets={createPriceSheetRepository()}
            priceSheetRates={priceEstimatingRates}
            priceSheetAreaAdjustments={createPriceSheetAreaAdjustmentsRepository()}
            serviceAreas={serviceAreas}
          />
        )}
        {region === 'assign' && isAdmin && (
          <AssignTechRegion
            techs={eligibleTechOptions}
            currentTechId={currentJob.assignedTechId ?? investigatorTechId}
            busy={assigning !== null}
            error={assignError}
            onAssign={(techId) => void handleAssign(techId)}
            onUnassign={(currentJob.assignedTechId ?? investigatorTechId) ? () => void handleUnassign() : undefined}
            label="Assign Technician" indicator={currentJob.needsPremAt && estimate?.status !== 'approved' ? 'Prem' : null}
          />
        )}
        {region === 'schedule' && (
          <JobScheduleScreen
            job={currentJob}
            embedded
            jobRepository={createJobRepository()}
            onSaved={(updated) => setJob(updated)}
            totalTaskMinutes={totalTaskMinutes}
            standardMinutes={standardMinutes}
          />
        )}
        {region === 'details' && (
          <>
            <JobDetailsForm
              mode="edit"
              value={form}
              onChange={handleFormChange}
              serviceAreas={serviceAreas}
              hasInvestigation={investigation !== null}
              error={saveError}
            />
            <View style={styles.jobDetailPane}>
              <JobDetail job={currentJob} />
            </View>
          </>
        )}
      </ScrollView>
      {region === 'details' && (
        <View style={styles.footer}>
          <Button label="Cancel" variant="outline" style={styles.footerButton} onPress={handleCancel} />
          {role === 'admin' && (
            <Button
              label={busyAction === 'reset' ? 'Resetting…' : 'Reset'}
              variant="outline"
              disabled={busyAction === 'reset'}
              style={styles.footerButton}
              onPress={confirmResetTime}
            />
          )}
          <Button
            label={saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            disabled={saving}
            style={styles.footerButton}
            onPress={() => void handleSaveEdit()}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  scrollBody: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  jobDetailPane: { marginTop: spacing.md },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  footerButton: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.offWhite,
  },
});
