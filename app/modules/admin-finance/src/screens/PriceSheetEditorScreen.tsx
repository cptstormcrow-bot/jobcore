/**
 * Price sheet editor screen — form scaffold (P3i.4a).
 *
 * Scaffold scope ONLY. Reads `session.org.id` via `getModuleSession`, loads the
 * organization's price sheets through the read-only `PriceSheetRepository`
 * port (`../data/ports.ts`), selects the one matching `priceSheetId`, and
 * renders its version, status and published date as READ-ONLY fields.
 *
 * P3i.4b adds the SAVE / PUBLISH wiring on top of that scaffold:
 * - Each section persists via its own Save (standard duration, area
 *   adjustments, service tasks). There is no sheet-level draft write;
 *   Publish is the only sheet-level action (AD-20).
 * - Publish runs the real seam: `getPublished(orgId)` on the publish port
 *   (`PriceSheetRepo`, `../data/price-sheet-repo.ts`) supplies
 *   `planPublish`'s `priorPublished`, `planPublish` (`../money/publish-plan.ts`)
 *   validates and describes the transition, and `applyPublishPlan` applies it.
 *   `planPublish` emitting `'archived'` for the demoted sheet is CORRECT — the
 *   RPC writes the DB's "superseded" server-side; no such literal exists here.
 * - Both actions are gated: absent props disable the button, and publish is
 *   offered only while the sheet is still `'draft'`.
 *
 * Explicitly NOT in scope:
 * - Rate rows. `PriceSheetRepository` (the read port) exposes only
 *   `listForOrganization` and `getActive` — there is no rates method to call,
 *   so rate editing cannot be scaffolded honestly here.
 *
 * Status is displayed in the DOMAIN vocabulary (`'draft' | 'published' |
 * 'archived'` — `../money/types.ts`'s `PriceSheetStatus`). The DB's
 * "superseded" is already translated to `'archived'` by `DB_TO_APP_STATUS`
 * before a row reaches this screen, so it never appears here.
 *
 * Optional-props + honest-empty-view pattern, idle/loading/loaded/failed state
 * machine, and `formatDate` all mirror `PriceSheetListScreen.tsx` exactly so
 * the two screens stay consistent.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Pressable } from 'react-native';
import { Button, Card, Checkbox, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, Select, Toggle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { PriceSheet, PriceSheetStatus, CalculationResult, PriceSheetRate } from '../money/types';
import type { PriceSheetRepository, ServiceArea, ServiceTask, PriceSheetStandardDuration } from '../data/ports';
import type { PriceSheetRepo } from '../data/price-sheet-repo';
import type { PriceSheetAreaAdjustment } from '../data/price-sheet-repo';
import { planPublish } from '../money/publish-plan';
import { getModuleSession, useModuleSession } from '../lib/module-session';
import { parseAdjustmentPercent } from '../domain/parse-adjustment-percent';
import { AccordionEditRow } from './AccordionEditRow';
import { AddTaskDialog } from './AddTaskDialog';
import { formatServiceTaskNumber } from '../domain/format-service-task-number';

/** Rates port shape (`module-ports.ts:75-85`). Do not widen — `JobEstimateScreen.tsx:46` shares it. */
interface PriceSheetRatesPort {
  list(
    priceSheetId: string
  ): Promise<Array<PriceSheetRate & { taskId?: string | null; timeEstimateMinutes?: number | null; taskName?: string | null }>>;
  save(
    priceSheetId: string,
    serviceId: string,
    taskId: string | null,
    attachTiming: string,
    amount: number,
    timeEstimateMinutes: number | null,
    id?: string
  ): Promise<CalculationResult<PriceSheetRate>>;
  remove(rateId: string): Promise<CalculationResult<void>>;
}

interface ServiceTasksRepoPort {
  list(organizationId: string, serviceId?: string): Promise<CalculationResult<ServiceTask[]>>;
  save(
    organizationId: string,
    serviceId: string,
    name: string,
    extra?: {
      estimatedMinutes?: number | null;
      rate?: number | null;
      category?: string | null;
      active?: boolean;
      priceCents?: number | null;
      details?: string | null;
      materials?: string | null;
    }
  ): Promise<CalculationResult<ServiceTask>>;
  updateServiceTask(
    taskId: string,
    patch: {
      name?: string;
      estimatedMinutes?: number | null;
      rate?: number | null;
      category?: string | null;
      active?: boolean;
      priceCents?: number | null;
      details?: string | null;
      materials?: string | null;
    }
  ): Promise<CalculationResult<ServiceTask>>;
  remove(taskId: string): Promise<CalculationResult<void>>;
  listServices(organizationId: string): Promise<Array<{ id: string; name: string }>>;
}

const HELP_BULLETS = [
  'A price sheet is one versioned set of task prices, trip durations and area adjustments.',
  'Only one version is Published at a time; techs and estimates always use that one.',
  'Drafts are private — nothing here changes what techs see until you tap Publish.',
  'Publish makes this version live and archives the previous one; published versions never change again.',
  'Price Area Adjustments raise or lower every price on this sheet for the selected service areas, by percent or a flat amount.',
];

const centsToDollarsText = (c: number | null | undefined) => (c == null ? '' : (c / 100).toFixed(2));
const dollarsTextToCents = (t: string): number | null | undefined => {
  const s = t.trim().replace(/[$,]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};

type ServiceTasksCardState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'done'; message: string }
  | { kind: 'failed'; message: string };

type ServiceTaskDraft = {
  name: string;
  price: string;
  estimatedMinutes: string;
  category: string;
  details: string;
  materials: string;
  active: boolean;
};

function draftFromTask(task: ServiceTask): ServiceTaskDraft {
  return {
    name: task.name,
    price: centsToDollarsText(task.priceCents),
    estimatedMinutes: task.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
    category: task.category ?? '',
    details: task.details ?? '',
    materials: task.materials ?? '',
    active: task.active ?? true,
  };
}

function ServiceTasksCard({ serviceTasksRepo }: { serviceTasksRepo: ServiceTasksRepoPort }) {
  const session = useModuleSession();
  const organizationId = session?.org.id;
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [loadState, setLoadState] = useState<ServiceTasksCardState>({ kind: 'idle' });
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceTaskDraft | null>(null);
  const [addServiceId, setAddServiceId] = useState('');
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organizationId) {
        setLoadState({ kind: 'idle' });
        return;
      }
      setLoadState({ kind: 'loading' });
      const result = await serviceTasksRepo.list(organizationId);
      if (cancelled) return;
      if (!result.ok) {
        setLoadState({ kind: 'failed', message: result.reason });
        return;
      }
      setTasks(result.value);
      setLoadState({ kind: 'loaded' });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceTasksRepo, organizationId]);

  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      if (!organizationId) return;
      try {
        const result = await serviceTasksRepo.listServices(organizationId);
        if (cancelled) return;
        setServices(result);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadState({ kind: 'failed', message: `Could not load services: ${message}` });
      }
    }
    void loadServices();
    return () => {
      cancelled = true;
    };
  }, [serviceTasksRepo, organizationId]);

  const sortedTasks = useMemo(() => {
    const activeTasks = tasks.filter((t) => t.active !== false);
    const inactiveTasks = tasks.filter((t) => t.active === false);
    return [...activeTasks, ...inactiveTasks];
  }, [tasks]);

  function handleToggleRow(task: ServiceTask) {
    if (expandedTaskId === task.id) {
      setExpandedTaskId(null);
      setDraft(null);
      return;
    }
    setExpandedTaskId(task.id);
    setDraft(draftFromTask(task));
  }

  function handleCancelRow() {
    setExpandedTaskId(null);
    setDraft(null);
  }

  async function handleSaveRow(task: ServiceTask): Promise<{ ok: boolean; reason?: string }> {
    if (!draft) return { ok: false, reason: 'Nothing to save.' };
    const trimmedName = draft.name.trim();
    if (trimmedName === '') return { ok: false, reason: 'Name is required.' };
    const priceCents = dollarsTextToCents(draft.price);
    if (priceCents === undefined) return { ok: false, reason: 'Price must be a number ≥ 0.' };
    const trimmedMinutes = draft.estimatedMinutes.trim();
    const parsedMinutes = trimmedMinutes === '' ? null : Number(trimmedMinutes);
    if (parsedMinutes !== null && (!Number.isFinite(parsedMinutes) || parsedMinutes < 0)) {
      return { ok: false, reason: 'Est. minutes must be a number ≥ 0.' };
    }
    const result = await serviceTasksRepo.updateServiceTask(task.id, {
      name: trimmedName,
      priceCents,
      estimatedMinutes: parsedMinutes,
      category: draft.category.trim() === '' ? null : draft.category,
      details: draft.details.trim() === '' ? null : draft.details,
      materials: draft.materials.trim() === '' ? null : draft.materials,
      active: draft.active,
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? result.value : t)));
    setExpandedTaskId(null);
    setDraft(null);
    setStatusMessage(`Saved ${result.value.name} at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    return { ok: true };
  }

  async function handleDeleteRow(taskId: string): Promise<{ ok: boolean; reason?: string }> {
    const result = await serviceTasksRepo.remove(taskId);
    if (!result.ok) return { ok: false, reason: result.reason };
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setExpandedTaskId(null);
    setDraft(null);
    return { ok: true };
  }

  const addServiceName = services.find((s) => s.id === addServiceId)?.name;

  return (
    <Card style={styles.card}>
      <Text style={styles.heading}>Service Tasks</Text>
      {loadState.kind === 'loading' ? <LoadingState label="Loading service tasks..." /> : null}
      {loadState.kind === 'failed' ? <ErrorState message={loadState.message} /> : null}

      {sortedTasks.map((task) => (
        <AccordionEditRow
          key={task.id}
          title={task.name}
          subtitle={formatServiceTaskNumber(task)}
          tag={task.active === false ? 'Inactive' : undefined}
          expanded={expandedTaskId === task.id}
          onToggle={() => handleToggleRow(task)}
          onSave={() => handleSaveRow(task)}
          onCancel={handleCancelRow}
          onDelete={() => handleDeleteRow(task.id)}
          testID={`service-task-${task.id}`}
        >
          {draft && expandedTaskId === task.id ? (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={draft.name}
                onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, name: text } : prev))}
              />
              <TextInput
                style={styles.input}
                placeholder="Price ($)"
                value={draft.price}
                keyboardType="decimal-pad"
                onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, price: text } : prev))}
              />
              <TextInput
                style={styles.input}
                placeholder="Est. minutes"
                value={draft.estimatedMinutes}
                keyboardType="numeric"
                onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, estimatedMinutes: text } : prev))}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Details"
                value={draft.details}
                multiline
                numberOfLines={3}
                onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, details: text } : prev))}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Materials"
                value={draft.materials}
                multiline
                numberOfLines={3}
                onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, materials: text } : prev))}
              />
              <TextInput
                style={styles.input}
                placeholder="Category"
                value={draft.category}
                onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, category: text } : prev))}
              />
              <Toggle
                label="Active"
                value={draft.active}
                onChange={(value) => setDraft((prev) => (prev ? { ...prev, active: value } : prev))}
                style={styles.toggleRow}
              />
            </View>
          ) : null}
        </AccordionEditRow>
      ))}

      <View style={styles.actionRow}>
        <Select
          value={addServiceId || null}
          options={services.map((s) => ({ label: s.name, value: s.id }))}
          placeholder="Select a service"
          onChange={setAddServiceId}
        />
        <Button
          label="+ Add Task"
          onPress={() => setAddDialogVisible(true)}
          disabled={!addServiceId}
          size="sm"
        />
      </View>

      <AddTaskDialog
        visible={addDialogVisible}
        serviceName={addServiceName}
        onCancel={() => setAddDialogVisible(false)}
        onCreate={({ name, extra }) => {
          if (!organizationId || !addServiceId) {
            return Promise.resolve({ ok: false, reason: 'Select a service first.' } as const);
          }
          return serviceTasksRepo.save(organizationId, addServiceId, name, extra);
        }}
        onCreated={(task) => {
          setTasks((prev) => [...prev, task]);
          setAddDialogVisible(false);
          setStatusMessage(`Saved ${task.name} at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
        }}
      />

      {statusMessage ? <Text style={styles.note}>{statusMessage}</Text> : null}
    </Card>
  );
}

const ATTACH_TIMING_OPTIONS = [
  { label: 'At purchase', value: 'at_purchase' },
  { label: 'Before start', value: 'before_start' },
  { label: 'After the fact', value: 'after_the_fact' },
];

type RateRowsCardState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'failed'; message: string };

/**
 * Editable rate rows (AD-23/27). 0067 dropped the draft-only immutability
 * trigger, so published sheets are editable the same as drafts — there is no
 * `editable` gate here.
 */
function RateRowsCard({
  sheet,
  ratesRepo,
  serviceTasksRepo,
}: {
  sheet: PriceSheet;
  ratesRepo?: PriceSheetRatesPort;
  serviceTasksRepo: ServiceTasksRepoPort;
}) {
  const session = useModuleSession();
  const organizationId = session?.org.id;
  const [rates, setRates] = useState<
    Array<PriceSheetRate & { taskId?: string | null; timeEstimateMinutes?: number | null; taskName?: string | null }>
  >([]);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [loadState, setLoadState] = useState<RateRowsCardState>({ kind: 'idle' });
  const [actionState, setActionState] = useState<RateRowsCardState>({ kind: 'idle' });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [serviceIdInput, setServiceIdInput] = useState('');
  const [timingInput, setTimingInput] = useState('at_purchase');
  const [amountInput, setAmountInput] = useState('');
  const [minutesInput, setMinutesInput] = useState('');
  const [taskIdInput, setTaskIdInput] = useState<string | null>(null);
  const [taskOptions, setTaskOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);

  const [expandedRateId, setExpandedRateId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTiming, setEditTiming] = useState('at_purchase');
  const [editAmount, setEditAmount] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [taskOptionsByService, setTaskOptionsByService] = useState<Record<string, Array<{ id: string; name: string }>>>(
    {}
  );

  const [autoOpenedServiceIds, setAutoOpenedServiceIds] = useState<Set<string>>(new Set());
  const [addTaskDialogVisible, setAddTaskDialogVisible] = useState(false);

  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [services]);

  async function reload() {
    if (!ratesRepo) return;
    setLoadState({ kind: 'loading' });
    try {
      const result = await ratesRepo.list(sheet.id);
      setRates(result);
      setLoadState({ kind: 'idle' });
    } catch (err) {
      setLoadState({ kind: 'failed', message: err instanceof Error ? err.message : 'Failed to load rates.' });
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesRepo, sheet.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      if (!organizationId) return;
      const result = await serviceTasksRepo.listServices(organizationId);
      if (cancelled) return;
      setServices(result);
    }
    void loadServices();
    return () => {
      cancelled = true;
    };
  }, [serviceTasksRepo, organizationId]);

  useEffect(() => {
    let cancelled = false;
    async function loadTasks() {
      if (!organizationId || !serviceIdInput) {
        setTaskOptions([]);
        return;
      }
      const result = await serviceTasksRepo.list(organizationId, serviceIdInput);
      if (cancelled) return;
      if (!result.ok) {
        setTaskLoadError(result.reason);
        setTaskOptions([]);
        return;
      }
      setTaskLoadError(null);
      setTaskOptions(result.value.map((t) => ({ id: t.id, name: t.name })));
      setTaskOptionsByService((prev) => ({ ...prev, [serviceIdInput]: result.value.map((t) => ({ id: t.id, name: t.name })) }));
      if (result.value.length === 0 && !autoOpenedServiceIds.has(serviceIdInput)) {
        setAutoOpenedServiceIds((prev) => new Set(prev).add(serviceIdInput));
        setAddTaskDialogVisible(true);
      }
    }
    void loadTasks();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTasksRepo, organizationId, serviceIdInput]);

  async function ensureTaskOptionsForService(serviceId: string) {
    if (!organizationId || taskOptionsByService[serviceId]) return;
    const result = await serviceTasksRepo.list(organizationId, serviceId);
    if (!result.ok) return;
    setTaskOptionsByService((prev) => ({ ...prev, [serviceId]: result.value.map((t) => ({ id: t.id, name: t.name })) }));
  }

  function handleServiceChange(serviceId: string) {
    setServiceIdInput(serviceId);
    setTaskIdInput(null);
  }

  async function handleSave() {
    if (!ratesRepo || !serviceIdInput) return;
    const amount = Number(amountInput);
    if (Number.isNaN(amount)) return;
    const minutes = minutesInput === '' ? null : Number(minutesInput);
    if (minutes !== null && Number.isNaN(minutes)) return;
    setActionState({ kind: 'loading' });
    const result = await ratesRepo.save(sheet.id, serviceIdInput, taskIdInput, timingInput, amount, minutes);
    if (!result.ok) {
      setActionState({ kind: 'failed', message: result.reason });
      return;
    }
    const savedServiceName = serviceNameById.get(serviceIdInput) ?? serviceIdInput;
    setServiceIdInput('');
    setAmountInput('');
    setMinutesInput('');
    setTaskIdInput(null);
    setActionState({ kind: 'idle' });
    setStatusMessage(`Saved rate for ${savedServiceName} at ${new Date().toLocaleTimeString()}`);
    void reload();
  }

  function handleToggleRate(rateId: string) {
    if (expandedRateId === rateId) {
      setExpandedRateId(null);
      return;
    }
    const rate = rates.find((r) => r.id === rateId);
    if (rate) {
      setEditTaskId(rate.taskId ?? null);
      setEditTiming(rate.attachTiming);
      setEditAmount(String(rate.amount));
      setEditMinutes(rate.timeEstimateMinutes != null ? String(rate.timeEstimateMinutes) : '');
      void ensureTaskOptionsForService(rate.serviceId);
    }
    setExpandedRateId(rateId);
  }

  async function handleSaveEdit(rate: {
    id: string;
    serviceId: string;
  }): Promise<{ ok: boolean; reason?: string }> {
    if (!ratesRepo) return { ok: false, reason: 'Rates unavailable' };
    const amount = Number(editAmount);
    if (Number.isNaN(amount)) return { ok: false, reason: 'Amount must be a number.' };
    const minutes = editMinutes === '' ? null : Number(editMinutes);
    if (minutes !== null && Number.isNaN(minutes)) return { ok: false, reason: 'Minutes must be a number.' };
    const result = await ratesRepo.save(sheet.id, rate.serviceId, editTaskId, editTiming, amount, minutes, rate.id);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    const savedServiceName = serviceNameById.get(rate.serviceId) ?? rate.serviceId;
    setStatusMessage(`Saved rate for ${savedServiceName} at ${new Date().toLocaleTimeString()}`);
    setExpandedRateId(null);
    void reload();
    return { ok: true };
  }

  async function handleDeleteEdit(rateId: string): Promise<{ ok: boolean; reason?: string }> {
    if (!ratesRepo) return { ok: false, reason: 'Rates unavailable' };
    const result = await ratesRepo.remove(rateId);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    setExpandedRateId(null);
    void reload();
    return { ok: true };
  }

  if (!ratesRepo) {
    return (
      <Card style={styles.card}>
        <Text style={styles.heading}>Rate Rows</Text>
        <Text style={styles.note}>Rates unavailable</Text>
      </Card>
    );
  }

  const addFormTaskOptions =
    serviceIdInput && taskOptions.length === 0 && !taskLoadError
      ? []
      : taskOptions;

  return (
    <Card style={styles.card}>
      <Text style={styles.heading}>Rate Rows</Text>
      {loadState.kind === 'loading' ? <LoadingState label="Loading rates..." /> : null}
      {loadState.kind === 'failed' ? <ErrorState message={loadState.message} /> : null}

      {rates.map((rate) => (
        <AccordionEditRow
          key={rate.id}
          title={`${serviceNameById.get(rate.serviceId) ?? rate.serviceId} · ${rate.taskName ?? 'All tasks'}`}
          subtitle={`${rate.attachTiming} · ${centsToDollarsText(rate.amount)}`}
          expanded={expandedRateId === rate.id}
          onToggle={() => handleToggleRate(rate.id)}
          onSave={() => handleSaveEdit(rate)}
          onCancel={() => setExpandedRateId(null)}
          onDelete={() => handleDeleteEdit(rate.id)}
        >
          <Select
            label="Task"
            value={editTaskId ?? ''}
            options={[
              { label: 'All tasks', value: '' },
              ...(taskOptionsByService[rate.serviceId] ?? []).map((t) => ({ label: t.name, value: t.id })),
            ]}
            onChange={(value) => setEditTaskId(value === '' ? null : value)}
          />
          <Select
            label="Timing"
            value={editTiming}
            options={ATTACH_TIMING_OPTIONS}
            onChange={setEditTiming}
            style={styles.action}
          />
          <TextInput
            style={styles.input}
            placeholder="Amount ($)"
            value={editAmount}
            keyboardType="decimal-pad"
            onChangeText={setEditAmount}
          />
          <TextInput
            style={styles.input}
            placeholder="Minutes"
            value={editMinutes}
            keyboardType="numeric"
            onChangeText={setEditMinutes}
          />
        </AccordionEditRow>
      ))}

      <Text style={styles.note}>One rate per service + timing; the task labels that rate.</Text>
      <Select
        value={serviceIdInput || null}
        options={services.map((s) => ({ label: s.name, value: s.id }))}
        placeholder="Select a service"
        onChange={handleServiceChange}
      />
      <Select
        label="Task"
        value={taskIdInput ?? ''}
        options={[{ label: 'All tasks', value: '' }, ...addFormTaskOptions.map((t) => ({ label: t.name, value: t.id }))]}
        placeholder="All tasks"
        onChange={(value) => setTaskIdInput(value === '' ? null : value)}
      />
      {taskLoadError ? <ErrorState message={taskLoadError} /> : null}
      {serviceIdInput && taskOptions.length === 0 && !taskLoadError ? (
        <Button label="+ Add Task" variant="outline" size="sm" onPress={() => setAddTaskDialogVisible(true)} />
      ) : null}
      <Select
        label="Timing"
        value={timingInput}
        options={ATTACH_TIMING_OPTIONS}
        onChange={setTimingInput}
        style={styles.action}
      />
      <TextInput
        style={styles.input}
        placeholder="Amount ($)"
        value={amountInput}
        keyboardType="decimal-pad"
        onChangeText={setAmountInput}
      />
      <TextInput
        style={styles.input}
        placeholder="Minutes"
        value={minutesInput}
        keyboardType="numeric"
        onChangeText={setMinutesInput}
      />
      <View style={styles.actionRow}>
        <Button
          label={actionState.kind === 'loading' ? 'Saving...' : 'Save Rate'}
          onPress={() => void handleSave()}
          disabled={actionState.kind === 'loading'}
          size="sm"
        />
      </View>

      {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
      {statusMessage ? <Text style={styles.note}>{statusMessage}</Text> : null}

      <AddTaskDialog
        visible={addTaskDialogVisible}
        serviceName={serviceNameById.get(serviceIdInput)}
        onCancel={() => setAddTaskDialogVisible(false)}
        onCreate={(input) => {
          if (!organizationId || !serviceIdInput) {
            return Promise.resolve({ ok: false, reason: 'No service selected.' });
          }
          return serviceTasksRepo.save(organizationId, serviceIdInput, input.name, input.extra);
        }}
        onCreated={(task) => {
          setAddTaskDialogVisible(false);
          setTaskIdInput(task.id);
          setTaskOptions((prev) => [...prev, { id: task.id, name: task.name }]);
          setTaskOptionsByService((prev) => ({
            ...prev,
            [serviceIdInput]: [...(prev[serviceIdInput] ?? []), { id: task.id, name: task.name }],
          }));
        }}
      />
    </Card>
  );
}

export interface PriceSheetEditorScreenProps {
  priceSheets?: PriceSheetRepository;
  priceSheetId?: string;
  /**
   * Publish-flow port. Absent in read-only hosts — the publish button is
   * disabled rather than hidden so the affordance stays honest.
   */
  publishRepo?: PriceSheetRepo;
  /** Fired after a successful publish so the host can refresh or navigate. */
  onPublished?: (priceSheetId: string) => void;
  areaAdjustmentsRepo: {
    list(priceSheetId: string): Promise<CalculationResult<PriceSheetAreaAdjustment[]>>;
    save(
      priceSheetId: string,
      serviceAreaId: string,
      adjustmentType: 'percent' | 'flat',
      adjustmentValue: number
    ): Promise<CalculationResult<PriceSheetAreaAdjustment>>;
    remove(id: string): Promise<CalculationResult<void>>;
  };
  serviceTasksRepo: ServiceTasksRepoPort;
  /** Rate-rows port (AD-23/27). Absent in read-only hosts — the card shows "Rates unavailable". */
  ratesRepo?: PriceSheetRatesPort;
  standardDurationRepo?: {
    get(organizationId: string): Promise<PriceSheetStandardDuration | null>;
    upsert(organizationId: string, standardMinutes: number): Promise<PriceSheetStandardDuration>;
  };
  serviceAreas?: ServiceArea[];
}

/** Save/publish action state. Independent of the sheet's own load state. */
type ActionState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; message: string };

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; sheet: PriceSheet | null }
  | { kind: 'failed'; message: string };

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Not published';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not published';
  return parsed.toLocaleDateString();
}

/** Signed adjustment value → status-line label, e.g. "−15%" / "+$20.00". */
function formatSignedAdjustment(adjustmentType: 'percent' | 'flat', value: number): string {
  const sign = value < 0 ? '−' : '+';
  const abs = Math.abs(value);
  return adjustmentType === 'percent' ? `${sign}${abs}%` : `${sign}$${abs.toFixed(2)}`;
}

/** Signed adjustment value → accordion-row subtitle, e.g. "−15%" / "+$20.00 flat". */
function formatSignedAdjustmentSubtitle(adjustmentType: 'percent' | 'flat', value: number): string {
  const base = formatSignedAdjustment(adjustmentType, value);
  return adjustmentType === 'flat' ? `${base} flat` : base;
}

/**
 * Handles a leading sign character typed into an adjustment value input:
 * `-`/`−` flips the toggle to negative, `+` flips it to positive, and either
 * way the input itself is left holding only the magnitude.
 */
function applySignedValueInput(
  text: string,
  setValueInput: (value: string) => void,
  setSign: (sign: '+' | '-') => void
): void {
  if (text.startsWith('-') || text.startsWith('−')) {
    setSign('-');
    setValueInput(text.slice(1));
  } else if (text.startsWith('+')) {
    setSign('+');
    setValueInput(text.slice(1));
  } else {
    setValueInput(text);
  }
}

/** Domain status → display label. No DB vocabulary reaches this screen. */
const STATUS_LABEL: Record<PriceSheetStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

export function PriceSheetEditorScreen(props: PriceSheetEditorScreenProps) {
  const {
    priceSheets: priceSheetRepository,
    priceSheetId,
    publishRepo,
    onPublished,
    areaAdjustmentsRepo,
    serviceTasksRepo,
    ratesRepo,
    standardDurationRepo,
    serviceAreas = [],
  } = props;
  const [helpOpen, setHelpOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [areaAdjustmentState, setAreaAdjustmentState] = useState<ActionState>({ kind: 'idle' });
  const [areaAdjustments, setAreaAdjustments] = useState<PriceSheetAreaAdjustment[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('__all__');
  const [adjustmentTypeInput, setAdjustmentTypeInput] = useState<'percent' | 'flat'>('percent');
  const [adjustmentValueInput, setAdjustmentValueInput] = useState('');
  const [adjustmentSignInput, setAdjustmentSignInput] = useState<'+' | '-'>('+');
  const [expandedAdjustmentId, setExpandedAdjustmentId] = useState<string | null>(null);
  const [rowDraftType, setRowDraftType] = useState<'percent' | 'flat'>('percent');
  const [rowDraftValueInput, setRowDraftValueInput] = useState('');
  const [rowDraftSign, setRowDraftSign] = useState<'+' | '-'>('+');
  const [standardDuration, setStandardDuration] = useState<PriceSheetStandardDuration | null>(null);
  const [standardMinutesInput, setStandardMinutesInput] = useState('60');
  const [standardDurationState, setStandardDurationState] = useState<ActionState>({ kind: 'idle' });

  const areaNameById = useMemo(() => {
    const map = new Map<string, string>();
    serviceAreas.forEach((area) => map.set(area.id, area.name));
    return map;
  }, [serviceAreas]);

  const session = getModuleSession();

  useEffect(() => {
    if (!session || !priceSheetRepository || !priceSheetId) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    priceSheetRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          const match = result.find((sheet) => sheet.id === priceSheetId) ?? null;
          setLoadState({ kind: 'loaded', sheet: match });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load the price sheet.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, priceSheetRepository, priceSheetId]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }
    if (!areaAdjustmentsRepo || !priceSheetId) {
      return undefined;
    }
    let cancelled = false;
    areaAdjustmentsRepo
      .list(priceSheetId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setAreaAdjustments(result.value);
        } else {
          setAreaAdjustmentState({ kind: 'failed', message: result.reason });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load area adjustments.';
          setAreaAdjustmentState({ kind: 'failed', message });
        }
      });
    if (standardDurationRepo) {
      standardDurationRepo
        .get(session.org.id)
        .then((result) => {
          if (cancelled) return;
          setStandardDuration(result);
          setStandardMinutesInput(result ? String(result.standardMinutes) : '60');
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : 'Could not load the standard duration.';
            setStandardDurationState({ kind: 'failed', message });
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [areaAdjustmentsRepo, priceSheetId, standardDurationRepo, session?.org.id]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Price Sheet"
          message="Sign in to view this organization's price sheets."
        />
      </View>
    );
  }

  if (!priceSheetRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Price Sheet"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  if (!priceSheetId) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Price Sheet" message="No price sheet was selected." />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading price sheet..." />
      </View>
    );
  }

  if (loadState.kind === 'failed') {
    return (
      <View style={styles.screen}>
        <ErrorState message={loadState.message} />
      </View>
    );
  }

  if (!loadState.sheet) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Price Sheet" message="That price sheet was not found." />
      </View>
    );
  }

  const sheet = loadState.sheet;
  const busy = actionState.kind === 'working';

  async function handlePublish(target: PriceSheet): Promise<void> {
    if (!publishRepo) return;
    setActionState({ kind: 'working' });
    try {
      const priorPublished = await publishRepo.getPublished(target.organizationId);
      const planned = planPublish(target, priorPublished, new Date().toISOString());
      if (!planned.ok) {
        setActionState({ kind: 'failed', message: planned.reason });
        return;
      }
      await publishRepo.applyPublishPlan(target.organizationId, planned.value);
      setActionState({ kind: 'done', message: 'Published.' });
      onPublished?.(target.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not publish the price sheet.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleSaveAreaAdjustments(
    areaIds: string[],
    adjustmentType: 'percent' | 'flat',
    adjustmentValue: number
  ): Promise<void> {
    if (!areaAdjustmentsRepo || !priceSheetId) return;
    setAreaAdjustmentState({ kind: 'working' });
    let okCount = 0;
    let lastFailureMessage = '';
    for (const areaId of areaIds) {
      try {
        const result = await areaAdjustmentsRepo.save(priceSheetId, areaId, adjustmentType, adjustmentValue);
        if (result.ok) {
          okCount += 1;
          const saved = result.value;
          setAreaAdjustments((prev) => {
            const idx = prev.findIndex((item) => item.serviceAreaId === saved.serviceAreaId);
            if (idx === -1) return [...prev, saved];
            const next = [...prev];
            next[idx] = saved;
            return next;
          });
        } else {
          lastFailureMessage = result.reason;
        }
      } catch (error: unknown) {
        lastFailureMessage = error instanceof Error ? error.message : 'Could not save the area adjustment.';
      }
    }
    if (okCount === areaIds.length) {
      const areaLabel =
        selectedAreaId === '__all__' ? 'All areas' : areaNameById.get(selectedAreaId) ?? selectedAreaId;
      const valueLabel = formatSignedAdjustment(adjustmentType, adjustmentValue);
      const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      setAreaAdjustmentState({ kind: 'done', message: `Saved ${valueLabel} for ${areaLabel} at ${time}` });
    } else {
      setAreaAdjustmentState({
        kind: 'failed',
        message: lastFailureMessage || `Saved ${okCount} of ${areaIds.length} areas.`,
      });
    }
  }

  function startRowEdit(adjustment: PriceSheetAreaAdjustment): void {
    setExpandedAdjustmentId(adjustment.id);
    setRowDraftType(adjustment.adjustmentType);
    setRowDraftSign(adjustment.adjustmentValue < 0 ? '-' : '+');
    setRowDraftValueInput(String(Math.abs(adjustment.adjustmentValue)));
  }

  async function handleRowSave(
    adjustment: PriceSheetAreaAdjustment
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!areaAdjustmentsRepo || !priceSheetId) {
      return { ok: false, reason: 'Area adjustments are unavailable.' };
    }
    const pct = parseAdjustmentPercent(rowDraftValueInput);
    if (pct === null) {
      return { ok: false, reason: 'Enter a number, e.g. 20' };
    }
    const signedValue = rowDraftSign === '-' ? -Math.abs(pct) : Math.abs(pct);
    const result = await areaAdjustmentsRepo.save(priceSheetId, adjustment.serviceAreaId, rowDraftType, signedValue);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    const saved = result.value;
    setAreaAdjustments((prev) => prev.map((item) => (item.id === adjustment.id ? saved : item)));
    setExpandedAdjustmentId(null);
    const areaLabel = areaNameById.get(saved.serviceAreaId) ?? saved.serviceAreaId;
    const valueLabel = formatSignedAdjustment(saved.adjustmentType, saved.adjustmentValue);
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    setAreaAdjustmentState({ kind: 'done', message: `Saved ${valueLabel} for ${areaLabel} at ${time}` });
    return { ok: true };
  }

  async function handleRowDelete(
    adjustment: PriceSheetAreaAdjustment
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!areaAdjustmentsRepo) {
      return { ok: false, reason: 'Area adjustments are unavailable.' };
    }
    const result = await areaAdjustmentsRepo.remove(adjustment.id);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    setAreaAdjustments((prev) => prev.filter((item) => item.id !== adjustment.id));
    setExpandedAdjustmentId(null);
    return { ok: true };
  }

  async function handleSaveStandardDuration(value: number): Promise<void> {
    if (!session) return;
    if (!standardDurationRepo) return;
    setStandardDurationState({ kind: 'working' });
    try {
      const saved = await standardDurationRepo.upsert(session.org.id, value);
      setStandardDuration(saved);
      setStandardDurationState({ kind: 'done', message: 'Saved.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the standard duration.';
      setStandardDurationState({ kind: 'failed', message });
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Price Sheet Editor" />
        <Card style={styles.card}>
          <Pressable onPress={() => setHelpOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: helpOpen }} style={styles.helpHeader}>
            <Text style={styles.heading}>How price sheets work</Text>
            <Text style={styles.note}>{helpOpen ? 'Hide' : 'Show'}</Text>
          </Pressable>
          {helpOpen ? (
            <View>
              {HELP_BULLETS.map((b) => (
                <Text key={b} style={styles.bullet}>{'• '}{b}</Text>
              ))}
            </View>
          ) : null}
        </Card>
        <Card style={[styles.card, styles.metaCard]}>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Version</Text>
              <Text style={styles.metaValue}>{String(sheet.version)}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.metaValue}>{STATUS_LABEL[sheet.status]}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Published</Text>
              <Text style={styles.metaValue}>{formatDate(sheet.publishedAt)}</Text>
            </View>
          </View>
        </Card>

        {sheet.status === 'draft' ? (
          <View style={styles.actionRow}>
            <Button
              label={busy ? 'Publishing...' : 'Publish'}
              variant="secondary"
              onPress={() => {
                void handlePublish(sheet);
              }}
              disabled={!publishRepo || busy}
              size="sm"
            />
          </View>
        ) : null}
        {sheet.status === 'draft' ? (
          <Text style={styles.note}>
            Changes in each section save as you go — techs keep seeing the published sheet until
            you tap Publish. Publish makes this version live and archives the previous one.
          </Text>
        ) : (
          <Text style={styles.note}>
            This version is {STATUS_LABEL[sheet.status].toLowerCase()} and can no longer change.
            Create a new price sheet to edit prices.
          </Text>
        )}

        {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
        {actionState.kind === 'done' ? <Text style={styles.note}>{actionState.message}</Text> : null}

        {standardDurationRepo ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Standard Trip Duration</Text>
            <Text style={styles.note}>
              The baseline duration ({standardDuration?.standardMinutes ?? 60} min) other job
              estimates are compared against.
            </Text>
            <TextInput style={styles.input} placeholder="Standard minutes" value={standardMinutesInput} onChangeText={setStandardMinutesInput} keyboardType="numeric" />
            <View style={styles.actionRow}>
              <Button
                label={standardDurationState.kind === 'working' ? 'Saving...' : 'Save Standard Duration'}
                onPress={() => { const value = Number(standardMinutesInput); if (Number.isNaN(value) || value <= 0) return; void handleSaveStandardDuration(value); }}
                disabled={standardDurationState.kind === 'working'}
                size="sm"
              />
            </View>
            {standardDurationState.kind === 'failed' ? <ErrorState message={standardDurationState.message} /> : null}
            {standardDurationState.kind === 'done' ? <Text style={styles.note}>{standardDurationState.message}</Text> : null}
          </Card>
        ) : null}

        {areaAdjustmentsRepo ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Price Area Adjustments</Text>

            {serviceAreas.length === 0 ? (
              <Text style={styles.note}>No service areas yet — add them under Service Areas.</Text>
            ) : (
              <Select
                label="Price area"
                value={selectedAreaId}
                options={[
                  { label: 'All areas', value: '__all__' },
                  ...serviceAreas.map((area) => ({ label: area.name, value: area.id })),
                ]}
                onChange={setSelectedAreaId}
                style={styles.action}
              />
            )}

            {areaAdjustments.length > 0
              ? areaAdjustments
                  .filter((adjustment) => selectedAreaId === '__all__' || adjustment.serviceAreaId === selectedAreaId)
                  .map((adjustment) => (
                    <AccordionEditRow
                      key={adjustment.id}
                      title={areaNameById.get(adjustment.serviceAreaId) ?? adjustment.serviceAreaId}
                      subtitle={formatSignedAdjustmentSubtitle(adjustment.adjustmentType, adjustment.adjustmentValue)}
                      expanded={expandedAdjustmentId === adjustment.id}
                      onToggle={() => {
                        if (expandedAdjustmentId === adjustment.id) {
                          setExpandedAdjustmentId(null);
                        } else {
                          startRowEdit(adjustment);
                        }
                      }}
                      onSave={() => handleRowSave(adjustment)}
                      onCancel={() => setExpandedAdjustmentId(null)}
                      onDelete={() => handleRowDelete(adjustment)}
                      testID={`area-adjustment-row-${adjustment.id}`}
                    >
                      <Select
                        label="Type"
                        value={rowDraftType}
                        options={[
                          { label: 'Percent', value: 'percent' },
                          { label: 'Flat', value: 'flat' },
                        ]}
                        onChange={(v) => setRowDraftType(v === 'flat' ? 'flat' : 'percent')}
                        style={styles.action}
                      />
                      <View style={styles.signRow}>
                        <Pressable
                          onPress={() => setRowDraftSign('+')}
                          style={[styles.signButton, rowDraftSign === '+' ? styles.signButtonActive : undefined]}
                        >
                          <Text style={styles.signButtonText}>+</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setRowDraftSign('-')}
                          style={[styles.signButton, rowDraftSign === '-' ? styles.signButtonActive : undefined]}
                        >
                          <Text style={styles.signButtonText}>{'−'}</Text>
                        </Pressable>
                        <TextInput
                          style={[styles.input, styles.signInput]}
                          placeholder="Adjustment value"
                          value={rowDraftValueInput}
                          onChangeText={(text) => applySignedValueInput(text, setRowDraftValueInput, setRowDraftSign)}
                          keyboardType="numeric"
                        />
                      </View>
                    </AccordionEditRow>
                  ))
              : null}

            <Select
              label="Type"
              value={adjustmentTypeInput}
              options={[
                { label: 'Percent', value: 'percent' },
                { label: 'Flat', value: 'flat' },
              ]}
              onChange={(v) => setAdjustmentTypeInput(v === 'flat' ? 'flat' : 'percent')}
              style={styles.action}
            />
            <View style={styles.signRow}>
              <Pressable
                onPress={() => setAdjustmentSignInput('+')}
                style={[styles.signButton, adjustmentSignInput === '+' ? styles.signButtonActive : undefined]}
              >
                <Text style={styles.signButtonText}>+</Text>
              </Pressable>
              <Pressable
                onPress={() => setAdjustmentSignInput('-')}
                style={[styles.signButton, adjustmentSignInput === '-' ? styles.signButtonActive : undefined]}
              >
                <Text style={styles.signButtonText}>{'−'}</Text>
              </Pressable>
              <TextInput
                style={[styles.input, styles.signInput]}
                placeholder="Adjustment value"
                value={adjustmentValueInput}
                onChangeText={(text) => applySignedValueInput(text, setAdjustmentValueInput, setAdjustmentSignInput)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.actionRow}>
              <Button
                label={areaAdjustmentState.kind === 'working' ? 'Saving...' : 'Save'}
                onPress={() => {
                  const pct = parseAdjustmentPercent(adjustmentValueInput);
                  if (pct === null) {
                    setAreaAdjustmentState({ kind: 'failed', message: 'Enter a number, e.g. 20' });
                    return;
                  }
                  const signedValue = adjustmentSignInput === '-' ? -Math.abs(pct) : Math.abs(pct);
                  const areaIds =
                    selectedAreaId === '__all__'
                      ? serviceAreas.map((area) => area.id)
                      : [selectedAreaId];
                  void handleSaveAreaAdjustments(areaIds, adjustmentTypeInput, signedValue);
                }}
                disabled={areaAdjustmentState.kind === 'working'}
                size="sm"
              />
            </View>

            {areaAdjustmentState.kind === 'failed' ? (
              <ErrorState message={areaAdjustmentState.message} />
            ) : null}
            {areaAdjustmentState.kind === 'done' ? (
              <Text style={styles.note}>{areaAdjustmentState.message}</Text>
            ) : null}
          </Card>
        ) : null}

        {serviceTasksRepo ? <ServiceTasksCard serviceTasksRepo={serviceTasksRepo} /> : null}

        {sheet ? (
          <RateRowsCard sheet={sheet} ratesRepo={ratesRepo} serviceTasksRepo={serviceTasksRepo} />
        ) : null}
      </ScrollView>
    </View>
  );
}

export default PriceSheetEditorScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.sm,
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bullet: {
    fontSize: typography.size.small,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  metaCard: {
    paddingVertical: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCell: {
    flex: 1,
  },
  metaLabel: {
    fontSize: typography.size.small,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: typography.size.body,
    fontWeight: '600',
    color: colors.text,
  },
  action: {
    marginBottom: spacing.sm,
  },
  toggleRow: {
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  chip: {
    marginRight: spacing.md,
    marginBottom: spacing.xs,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 4,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontFamily.body,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  signRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  signButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  signButtonText: {
    fontSize: typography.size.body,
    color: colors.text,
  },
  signInput: {
    flex: 1,
    marginBottom: 0,
  },
});
