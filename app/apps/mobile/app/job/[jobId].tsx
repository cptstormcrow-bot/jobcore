// Calendar-entry drilldown: renders a single job's detail canvas from its id
// route param. Mirrors the fetch-by-id + toJob pattern in (tabs)/jobs.tsx and
// the shared-canvas + actions-from-registry pattern from that same file. This
// route does not modify JobDetail.tsx — it only consumes its existing props.
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Job, JobStatus, Profile } from '@jobcore/core';
import { getEnabledModules, type JobAction } from '@jobcore/module-sdk';
import { Breadcrumb, Button, Checkbox, colors, EmptyState, ListItem, LoadingState, spacing, TextField, typography } from '@jobcore/ui';
import { JobDetail } from '../../src/components/JobDetail';
import { useSession } from '../../src/lib/session';
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
  createPriceSheetRatesRepository,
  createPriceSheetAreaAdjustmentsRepository,
  createServiceAreaRepository,
} from '../../src/lib/admin-finance-repos';
import type { JobDetailsPatch, CustomerPatch, CustomerCreateInput } from '../../../../modules/admin-finance/src/data/ports';
import type { JobDraft } from '../../../../modules/admin-finance/src/domain/qualify';
import { assignJob } from '../../../../modules/admin-finance/src/flows/assign-job';
import { classifyJob } from '../../../../modules/admin-finance/src/data/price-sheet-repo';
import { PlanningScreen } from '../../../../modules/admin-finance/src/screens/PlanningScreen';
import { PriceEstimatingScreen } from '../../../../modules/admin-finance/src/screens/PriceEstimatingScreen';
import type { ServiceArea } from '../../../../modules/admin-finance/src/data/ports';
import { setModuleSession } from '@jobcore/admin-finance';
// NOTE (slice 5): the assignment data model has no `kind` column --
// `job_assignments` (app/supabase/0004_scheduling.sql) is `job_id`/`tech_id`/
// `assigned_at` only, `JobAssignmentDraft`/`JobAssignmentRepository.create`
// (admin-finance/src/data/ports.ts) carry no `kind` field, and `assignJob()`
// (flows/assign-job.ts) takes only `(job, techId, deps)`. The dispatch asked
// for `kind: 'installer' | 'investigator'` support, but there is nowhere to
// persist that distinction today -- confirmed by reading both files fresh,
// not inferred. This slice wires the real, persisted tech-assignment flow
// (single `assignedTechId` via `assignJob`) and does not fabricate a `kind`
// toggle with no backing field. See this dispatch's `issues` field.
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
  };
}

const JOB_ROW_COLUMNS =
  'id, organization_id, status, customer_id, service_id, source, payer, attach_timing, ' +
  'requested_window, scheduled_start, scheduled_end, address, description, assigned_tech_id, ' +
  'en_route_at, in_progress_at, completed_at, created_at, is_beta, house_age_years' +
  ', permit_status, parking_available, rooms, panel_info, considerations';

const ROOM_OPTIONS = ['Kitchen', 'Bathroom', 'Bedroom', 'Garage', 'Basement', 'Attic', 'Other'];

/**
 * Local job-form state shape. Populated field-by-field by later slices
 * (2b/2c/2d/2e address, houseAgeYears, customer fields, etc.). In edit mode
 * it is seeded from the loaded `Job`; in create mode it starts blank.
 * Slice 5 (save) reuses this exact shape/name — do not rename.
 */
interface JobFormState {
  address: string;
  description: string;
  houseAgeYears: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  permitStatus: string;
  parkingAvailable: string;
  rooms: string[];
  panelInfo: string;
  considerations: string;
}

const EMPTY_JOB_FORM: JobFormState = {
  address: '',
  description: '',
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
};

export default function JobDrilldownScreen() {
  const { jobId, panel } = useLocalSearchParams<{ jobId: string; panel?: string }>();
  const router = useRouter();
  const session = useSession();
  const org = session.status === 'authenticated' ? session.organization : undefined;
  const role = session.status === 'authenticated' ? session.profile.role : undefined;

  if (session.status === 'authenticated' && org && role) {
    setModuleSession({ org, role, userId: session.profile.id });
  }

  // Mode detection: the `new` route param means create-mode; any other
  // (real UUID) jobId means edit-mode. Later slices branch UI on `isCreate`.
  const isCreate = jobId === 'new';

  const actions = useMemo<JobAction[]>(() => {
    if (!org || !role) return [];
    return getEnabledModules(org, role).flatMap((m) => m.jobActions ?? []);
  }, [org, role]);

  const priceEstimatingRates = useMemo(() => {
    const repo = createPriceSheetRatesRepository();
    return { list: (id: string) => repo.list(id).then((value) => ({ ok: true as const, value })) };
  }, []);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(!isCreate);
  const [form, setForm] = useState<JobFormState>(EMPTY_JOB_FORM);
  // The linked customer's id (job.customerId, nullable per JobRow/Job). Held
  // separately from `form` -- it is not itself an editable text field, only
  // the routing key handleSave uses to decide CustomerRepository.update()
  // (customerId present) vs .create() (no customer linked yet).
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Tech-assignment section (slice 5): active-tech roster for the org, and
  // any in-flight/error state for an assignment tap, kept separate from the
  // job-detail/customer `saving`/`saveError` pair above so an assignment
  // failure doesn't clobber (or get clobbered by) a Save-button failure.
  const [techs, setTechs] = useState<Profile[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'details' | 'plan' | 'estimate'>(panel === 'plan' ? 'plan' : 'details');

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

  // Org-scoped lookup by id: jobs_select_org / jobs_select_tech RLS policies
  // OR together server-side, so this is already the RLS-correct row for
  // whichever role is viewing (mirrors calendar.tsx's org-scoped query note).
  // Skipped entirely in create-mode -- there is no row to load yet.
  useEffect(() => {
    if (isCreate) {
      setJob(null);
      setForm(EMPTY_JOB_FORM);
      setCustomerId(null);
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
        // above) via the CustomerRepository wired in slice 1b-ii -- the
        // `customers` table is not selected as part of JOB_ROW_COLUMNS.
        const customer = loaded?.customerId
          ? await createCustomerRepository().getById(loaded.customerId)
          : null;
        if (cancelled) return;

        setForm(
          loaded
            ? {
                address: loaded.address ?? '',
                description: loaded.description ?? '',
                houseAgeYears: '',
                customerName: customer?.name ?? '',
                customerPhone: customer?.phone ?? '',
                customerEmail: customer?.email ?? '',
                customerAddress: customer?.address ?? '',
                permitStatus: (loaded as any).permitStatus ?? '',
                parkingAvailable: (loaded as any).parkingAvailable ?? '',
                rooms: (loaded as any).rooms ?? [],
                panelInfo: (loaded as any).panelInfo ?? '',
                considerations: (loaded as any).considerations ?? '',
              }
            : EMPTY_JOB_FORM
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCreate, org?.id, jobId]);

  const dispatchInvoke = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    if (!job) return;
    void action?.onInvoke?.(job);
  };

  /**
   * Edit-mode-only combined save: persists the job-detail fields via
   * `JobRepository.updateDetails` and the customer fields via
   * `CustomerRepository.update` (existing `customerId`) or `.create()` (no
   * customer linked to this job yet). Create-mode save is a separate slice
   * -- deliberately not handled here. Later slices reuse this exact
   * name/signature (see slice-2-notes.md).
   */
  const handleSaveEdit = async (): Promise<void> => {
    if (!job) return;
    setSaving(true);
    setSaveError(null);
    try {
      const jobPatch: JobDetailsPatch = {
        address: form.address,
        description: form.description,
        permitStatus: form.permitStatus,
        parkingAvailable: form.parkingAvailable,
        rooms: form.rooms,
        panelInfo: form.panelInfo,
        considerations: form.considerations,
      } as JobDetailsPatch;
      await createJobRepository().updateDetails(job.id, jobPatch);

      if (customerId) {
        const customerPatch: CustomerPatch = {
          name: form.customerName,
          phone: form.customerPhone,
          email: form.customerEmail,
          address: form.customerAddress,
        };
        await createCustomerRepository().update(customerId, customerPatch);
      } else {
        const customerCreateInput: CustomerCreateInput = {
          name: form.customerName,
          phone: form.customerPhone,
          email: form.customerEmail,
          address: form.customerAddress,
        };
        const created = await createCustomerRepository().create(customerCreateInput);
        setCustomerId(created.id);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Create-mode-only save: builds a `JobDraft` (mirroring
   * `buildJobFromLead`'s payload shape, `serviceId: null` since create-mode
   * has no lead to resolve a service from) from `form` plus the org id, and
   * persists it via `JobRepository.create`. On success, navigates to the
   * newly-created job's own edit-mode route. Deliberately separate from
   * `handleSaveEdit` -- edit-mode save is job-detail + customer combined,
   * create-mode save is job-only (no customer linkage yet).
   */
  const handleSaveCreate = async (): Promise<void> => {
    if (!org?.id) return;
    setSaving(true);
    setSaveError(null);
    try {
      let customerId: string | null = null;
      if (form.customerName || form.customerPhone || form.customerEmail) {
        const customerCreateInput: CustomerCreateInput = {
          name: form.customerName,
          phone: form.customerPhone,
          email: form.customerEmail,
          address: '',
        };
        const created = await createCustomerRepository().create(customerCreateInput);
        customerId = created.id;
      }
      const draft: JobDraft = {
        organizationId: org.id,
        status: 'new',
        customerId,
        serviceId: null,
        source: null,
        payer: null,
        attachTiming: null,
        requestedWindow: null,
        scheduledStart: null,
        scheduledEnd: null,
        address: form.address,
        description: form.description,
        assignedTechId: null,
        serviceAreaId: null,
        permitStatus: form.permitStatus,
        parkingAvailable: form.parkingAvailable,
        rooms: form.rooms,
        panelInfo: form.panelInfo,
        considerations: form.considerations,
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
   * Edit-mode-only tech assignment: reuses the exact `assignJob(job, techId,
   * deps)` call pattern from `AdminFinanceRoot.tsx`'s `handleAssign` (read
   * fresh at dispatch time) -- same three deps (`jobs`, `assignments`,
   * `calendarEvents`) plus `ctx`. On success, re-fetches the job row so
   * `job.assignedTechId`/`job.status` reflect the write (`assignJob` also
   * advances status toward `assigned` via `transitionJob`, so a plain local
   * patch would go stale).
   */
  const handleAssignTech = async (techId: string): Promise<void> => {
    if (!job || session.status !== 'authenticated' || !org?.id) return;
    setAssigning(techId);
    setAssignError(null);
    try {
      const result = await assignJob(job, techId, {
        jobs: createJobRepository(),
        assignments: createJobAssignmentRepository(),
        calendarEvents: createCalendarEventRepository(),
        ctx: { role: session.profile.role, now: () => new Date().toISOString() },
      });
      if (!result.ok) {
        setAssignError(result.reason);
        return;
      }
      setJob(result.job);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Assignment failed.');
    } finally {
      setAssigning(null);
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

  if (!isCreate && job && activePanel === 'plan') {
    return (
      <View style={styles.root}>
        <PlanningScreen
          jobs={[job]}
          initialSelectedJobId={job.id}
          onBack={() => setActivePanel('details')}
          jobPlanning={createJobPlanningRepository()}
          jobPlanningPhotos={createJobPlanningPhotoRepository()}
        />
      </View>
    );
  }
  if (!isCreate && job && activePanel === 'estimate') {
    return (
      <View style={styles.root}>
        <View style={styles.field}>
          <Button label="Back to Job" variant="outline" size="sm" onPress={() => setActivePanel('details')} />
        </View>
        <PriceEstimatingScreen
          priceSheets={createPriceSheetRepository()}
          priceSheetRates={priceEstimatingRates}
          priceSheetAreaAdjustments={createPriceSheetAreaAdjustmentsRepository()}
          serviceAreas={serviceAreas}
        />
      </View>
    );
  }

  if (isCreate) {
    // Create-mode shell: editable JobDetailsPatch fields (address, description,
    // houseAgeYears), bound to `form`/`setForm` (JobFormState). Local-state-only
    // for now -- no save handler yet (added in slice 5).
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} testID={form.address ? undefined : 'job-create-shell'}>
        <TextField
          label="Customer name"
          value={form.customerName}
          onChangeText={(value) => setForm((prev) => ({ ...prev, customerName: value }))}
          placeholder="Customer name"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="Customer phone"
          value={form.customerPhone}
          onChangeText={(value) => setForm((prev) => ({ ...prev, customerPhone: value }))}
          placeholder="Customer phone"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="Customer email"
          value={form.customerEmail}
          onChangeText={(value) => setForm((prev) => ({ ...prev, customerEmail: value }))}
          placeholder="Customer email"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="Address"
          value={form.address}
          onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
          placeholder="Job address"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="Description"
          value={form.description}
          onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
          placeholder="Job description"
          multiline
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="House age (years)"
          value={form.houseAgeYears}
          onChangeText={(value) => setForm((prev) => ({ ...prev, houseAgeYears: value }))}
          placeholder="e.g. 12"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="Permit status"
          value={form.permitStatus}
          onChangeText={(value) => setForm((prev) => ({ ...prev, permitStatus: value }))}
          placeholder="e.g. Filed, pending, not required"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="Parking availability"
          value={form.parkingAvailable}
          onChangeText={(value) => setForm((prev) => ({ ...prev, parkingAvailable: value }))}
          placeholder="e.g. Driveway, street only"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Rooms needing work</Text>
          <View style={styles.roomsGrid}>
          {ROOM_OPTIONS.map((room) => (
            <Checkbox
              key={room}
              label={room}
              checked={form.rooms.includes(room)}
              onChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  rooms: checked ? [...prev.rooms, room] : prev.rooms.filter((r) => r !== room),
                }))
              }
              style={styles.roomCheckbox}
              boxStyle={styles.roomCheckboxBox}
            />
          ))}
          </View>
        </View>
        <TextField
          label="Main panel size/style"
          value={form.panelInfo}
          onChangeText={(value) => setForm((prev) => ({ ...prev, panelInfo: value }))}
          placeholder="e.g. 200A, Square D QO"
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        <TextField
          label="Considerations"
          value={form.considerations}
          onChangeText={(value) => setForm((prev) => ({ ...prev, considerations: value }))}
          placeholder="Anything else worth noting"
          multiline
          style={styles.field}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
        />
        {saveError ? (
          <EmptyState title="Save failed" message={saveError} />
        ) : null}
        <Button
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => void handleSaveCreate()}
          disabled={saving}
          style={styles.field}
        />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Edit-mode: existing JobDetail read view is unchanged, plus the
  // customer-field inputs (bound to `form`/`setForm`, seeded from the
  // CustomerRepository lookup in the fetch effect above) and the combined
  // save button wired to `handleSaveEdit`. Create-mode save is out of scope
  // for this slice (create-mode shell above stays local-state-only).
  return (
    <View style={styles.root}>
      <Breadcrumb
        segments={[
          { label: 'Jobs', onPress: () => router.back() },
          { label: job?.address || 'Job Details' },
        ]}
      />
      <View style={styles.actionsRow}>
        <Button label="Plan" onPress={() => setActivePanel('plan')} disabled={saving} style={styles.actionInline} />
        <Button label="Estimate" onPress={() => setActivePanel('estimate')} disabled={saving} style={styles.actionInline} />
        <Button
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => void handleSaveEdit()}
          disabled={saving}
          style={styles.actionInline}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.subtitleText}>
          Currently assigned: {job?.assignedTechId ? (techs.find((t) => t.id === job.assignedTechId)?.fullName ?? job.assignedTechId) : 'Unassigned'}
        </Text>
      </View>
      <View style={styles.jobDetailPane}>
        <JobDetail job={job as Job} actions={actions} onAction={dispatchInvoke} role={role} />
      </View>
      <ScrollView style={styles.formPane} contentContainerStyle={styles.scrollContent}>
      <View style={styles.field}>
        <Text style={styles.sectionLabel}>Classification</Text>
        <Text style={styles.subtitleText}>
          {classifyJob(job?.houseAgeYears ?? null)}
        </Text>
      </View>
      <TextField
        label="Customer name"
        value={form.customerName}
        onChangeText={(value) => setForm((prev) => ({ ...prev, customerName: value }))}
        placeholder="Customer name"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      <TextField
        label="Customer phone"
        value={form.customerPhone}
        onChangeText={(value) => setForm((prev) => ({ ...prev, customerPhone: value }))}
        placeholder="Customer phone"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      <TextField
        label="Customer email"
        value={form.customerEmail}
        onChangeText={(value) => setForm((prev) => ({ ...prev, customerEmail: value }))}
        placeholder="Customer email"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      <TextField
        label="Customer address"
        value={form.customerAddress}
        onChangeText={(value) => setForm((prev) => ({ ...prev, customerAddress: value }))}
        placeholder="Customer address"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      <TextField
        label="Permit status"
        value={form.permitStatus}
        onChangeText={(value) => setForm((prev) => ({ ...prev, permitStatus: value }))}
        placeholder="e.g. Filed, pending, not required"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      <TextField
        label="Parking availability"
        value={form.parkingAvailable}
        onChangeText={(value) => setForm((prev) => ({ ...prev, parkingAvailable: value }))}
        placeholder="e.g. Driveway, street only"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      <View style={styles.field}>
        <Text style={styles.sectionLabel}>Rooms needing work</Text>
        <View style={styles.roomsGrid}>
        {ROOM_OPTIONS.map((room) => (
          <Checkbox
            key={room}
            label={room}
            checked={form.rooms.includes(room)}
            onChange={(checked) =>
              setForm((prev) => ({
                ...prev,
                rooms: checked ? [...prev.rooms, room] : prev.rooms.filter((r) => r !== room),
              }))
            }
            style={styles.roomCheckbox}
            boxStyle={styles.roomCheckboxBox}
          />
        ))}
        </View>
      </View>
      <TextField
        label="Main panel size/style"
        value={form.panelInfo}
        onChangeText={(value) => setForm((prev) => ({ ...prev, panelInfo: value }))}
        placeholder="e.g. 200A, Square D QO"
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      <TextField
        label="Considerations"
        value={form.considerations}
        onChangeText={(value) => setForm((prev) => ({ ...prev, considerations: value }))}
        placeholder="Anything else worth noting"
        multiline
        style={styles.field}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
      />
      {saveError ? (
        <EmptyState title="Save failed" message={saveError} />
      ) : null}
      <View style={styles.field}>
        <Text style={styles.sectionLabel}>Assign tech</Text>
        {assignError ? <EmptyState title="Assignment failed" message={assignError} /> : null}
        {techs.map((tech) => (
          <ListItem
            key={tech.id}
            title={tech.fullName}
            subtitle={tech.id === job?.assignedTechId ? 'Assigned' : undefined}
            right={
              <Button
                label={assigning === tech.id ? 'Assigning…' : 'Assign'}
                onPress={() => void handleAssignTech(tech.id)}
                disabled={assigning !== null || tech.id === job?.assignedTechId}
              />
            }
          />
        ))}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  scrollContent: { paddingBottom: spacing.xl },
  jobDetailPane: { flex: 0.45 },
  formPane: { flex: 1 },
  fieldLabel: { color: colors.textLight },
  fieldInput: { fontSize: typography.size.h5, fontWeight: typography.weight.semibold, color: colors.text },
  roomsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: spacing.md, marginTop: spacing.xs },
  roomCheckbox: { width: '50%', minHeight: 32, marginBottom: spacing.xs },
  roomCheckboxBox: { borderWidth: 2, borderColor: colors.primary },
  field: { marginHorizontal: spacing.md, marginTop: spacing.md },
  sectionLabel: { fontWeight: '600', marginBottom: spacing.sm, color: colors.text },
  subtitleText: { color: colors.textMuted, marginBottom: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.md },
  actionInline: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.offWhite,
  },
});
