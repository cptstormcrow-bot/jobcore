/**
 * Price sheet editor screen — form scaffold (P3i.4a).
 *
 * Scaffold scope ONLY. Reads `session.org.id` via `getModuleSession`, loads the
 * organization's price sheets through the read-only `PriceSheetRepository`
 * port (`../data/ports.ts`), selects the one matching `priceSheetId`, and
 * renders its version, status and published date as READ-ONLY fields.
 *
 * P3i.4b adds the SAVE / PUBLISH wiring on top of that scaffold:
 * - `onSave` is a callback-out prop. No port in `ports.ts` or
 *   `price-sheet-repo.ts` exposes a draft-update write, so the screen does not
 *   invent one — the host supplies the persistence and returns a
 *   `CalculationResult<void>` (`../money/types.ts`), never a thrown error.
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

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Button, Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing, typography } from '@jobcore/ui';
import type { PriceSheet, PriceSheetStatus, CalculationResult } from '../money/types';
import type { PriceSheetRepository, ServiceTask, PriceSheetStandardDuration } from '../data/ports';
import type { PriceSheetRepo } from '../data/price-sheet-repo';
import type { PriceSheetAreaAdjustment } from '../data/price-sheet-repo';
import { planPublish } from '../money/publish-plan';
import { getModuleSession, useModuleSession } from '../lib/module-session';

interface ServiceTasksRepoPort {
  list(organizationId: string, serviceId?: string): Promise<CalculationResult<ServiceTask[]>>;
  save(organizationId: string, serviceId: string, name: string): Promise<CalculationResult<ServiceTask>>;
  updateServiceTask(
    taskId: string,
    patch: {
      estimatedMinutes?: number | null;
      rate?: number | null;
      category?: string | null;
      active?: boolean;
    }
  ): Promise<CalculationResult<ServiceTask>>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServiceTasksCardState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'done'; message: string }
  | { kind: 'failed'; message: string };

function ServiceTasksCard({ serviceTasksRepo }: { serviceTasksRepo: ServiceTasksRepoPort }) {
  const session = useModuleSession();
  const organizationId = session?.org.id;
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [loadState, setLoadState] = useState<ServiceTasksCardState>({ kind: 'idle' });
  const [saveState, setSaveState] = useState<ServiceTasksCardState>({ kind: 'idle' });
  const [nameInput, setNameInput] = useState('');
  const [serviceIdInput, setServiceIdInput] = useState('');
  const [drafts, setDrafts] = useState<
    Record<string, { estimatedMinutes: string; rate: string; category: string }>
  >({});

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
      setDrafts(
        Object.fromEntries(
          result.value.map((task) => [
            task.id,
            {
              estimatedMinutes: task.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
              rate: task.rate != null ? String(task.rate) : '',
              category: task.category ?? '',
            },
          ])
        )
      );
      setLoadState({ kind: 'loaded' });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceTasksRepo, organizationId]);

  function updateDraft(taskId: string, field: 'estimatedMinutes' | 'rate' | 'category', value: string) {
    setDrafts((prev) => ({ ...prev, [taskId]: { ...prev[taskId], [field]: value } }));
  }

  async function commitField(
    taskId: string,
    patch: { estimatedMinutes?: number | null; rate?: number | null; category?: string | null }
  ) {
    const result = await serviceTasksRepo.updateServiceTask(taskId, patch);
    if (!result.ok) {
      setLoadState({ kind: 'failed', message: result.reason });
      return;
    }
    setTasks((prev) => prev.map((task) => (task.id === taskId ? result.value : task)));
  }

  async function handleToggleActive(task: ServiceTask) {
    const result = await serviceTasksRepo.updateServiceTask(task.id, { active: !task.active });
    if (!result.ok) {
      setLoadState({ kind: 'failed', message: result.reason });
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? result.value : t)));
  }

  async function handleCreate() {
    if (!serviceIdInput || !nameInput) return;
    if (!UUID_PATTERN.test(serviceIdInput)) {
      setSaveState({ kind: 'failed', message: 'Service ID must be a valid UUID.' });
      return;
    }
    if (!organizationId) {
      setSaveState({ kind: 'failed', message: 'No organization selected yet.' });
      return;
    }
    setSaveState({ kind: 'loading' });
    const result = await serviceTasksRepo.save(organizationId, serviceIdInput, nameInput);
    if (!result.ok) {
      setSaveState({ kind: 'failed', message: result.reason });
      return;
    }
    setTasks((prev) => [...prev, result.value]);
    setDrafts((prev) => ({
      ...prev,
      [result.value.id]: {
        estimatedMinutes: result.value.estimatedMinutes != null ? String(result.value.estimatedMinutes) : '',
        rate: result.value.rate != null ? String(result.value.rate) : '',
        category: result.value.category ?? '',
      },
    }));
    setNameInput('');
    setServiceIdInput('');
    setSaveState({ kind: 'done', message: 'Task added.' });
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.heading}>Service Tasks</Text>
      {loadState.kind === 'loading' ? <LoadingState label="Loading service tasks..." /> : null}
      {loadState.kind === 'failed' ? <ErrorState message={loadState.message} /> : null}

      {tasks.map((task) => {
        const draft = drafts[task.id] ?? { estimatedMinutes: '', rate: '', category: '' };
        return (
          <View key={task.id} style={styles.action}>
            <ListItem title={task.name} subtitle={task.serviceId} />
            <TextInput
              style={styles.input}
              placeholder="Estimated minutes"
              value={draft.estimatedMinutes}
              keyboardType="numeric"
              onChangeText={(text) => updateDraft(task.id, 'estimatedMinutes', text)}
              onBlur={() => {
                const parsed = draft.estimatedMinutes === '' ? null : Number(draft.estimatedMinutes);
                if (parsed !== null && Number.isNaN(parsed)) return;
                void commitField(task.id, { estimatedMinutes: parsed });
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Rate"
              value={draft.rate}
              keyboardType="numeric"
              onChangeText={(text) => updateDraft(task.id, 'rate', text)}
              onBlur={() => {
                const parsed = draft.rate === '' ? null : Number(draft.rate);
                if (parsed !== null && Number.isNaN(parsed)) return;
                void commitField(task.id, { rate: parsed });
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Category"
              value={draft.category}
              onChangeText={(text) => updateDraft(task.id, 'category', text)}
              onBlur={() =>
                void commitField(task.id, { category: draft.category === '' ? null : draft.category })
              }
            />
            <Button
              label={task.active ? 'Active' : 'Inactive'}
              variant="outline"
              size="sm"
              onPress={() => void handleToggleActive(task)}
            />
          </View>
        );
      })}

      <TextInput
        style={styles.input}
        placeholder="Service ID"
        value={serviceIdInput}
        onChangeText={setServiceIdInput}
      />
      <TextInput
        style={styles.input}
        placeholder="New task name"
        value={nameInput}
        onChangeText={setNameInput}
      />
      <Button
        label={saveState.kind === 'loading' ? 'Saving...' : 'Add Task'}
        onPress={() => void handleCreate()}
        disabled={saveState.kind === 'loading'}
        style={styles.action}
      />
      {saveState.kind === 'failed' ? <ErrorState message={saveState.message} /> : null}
      {saveState.kind === 'done' ? <Text style={styles.note}>{saveState.message}</Text> : null}
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
  /**
   * Host-supplied persistence for the draft. Returns a `CalculationResult`
   * rather than throwing, matching every failable path in `money/`.
   */
  onSave?: (sheet: PriceSheet) => Promise<CalculationResult<void>>;
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
  };
  serviceTasksRepo: ServiceTasksRepoPort;
  standardDurationRepo?: {
    get(organizationId: string): Promise<PriceSheetStandardDuration | null>;
    upsert(organizationId: string, standardMinutes: number): Promise<PriceSheetStandardDuration>;
  };
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
    onSave,
    onPublished,
    areaAdjustmentsRepo,
    serviceTasksRepo,
    standardDurationRepo,
  } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [areaAdjustmentState, setAreaAdjustmentState] = useState<ActionState>({ kind: 'idle' });
  const [areaAdjustments, setAreaAdjustments] = useState<PriceSheetAreaAdjustment[]>([]);
  const [serviceAreaIdInput, setServiceAreaIdInput] = useState('');
  const [adjustmentTypeInput, setAdjustmentTypeInput] = useState<'percent' | 'flat'>('percent');
  const [adjustmentValueInput, setAdjustmentValueInput] = useState('');
  const [standardDuration, setStandardDuration] = useState<PriceSheetStandardDuration | null>(null);
  const [standardMinutesInput, setStandardMinutesInput] = useState('60');
  const [standardDurationState, setStandardDurationState] = useState<ActionState>({ kind: 'idle' });

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
  }, [areaAdjustmentsRepo, priceSheetId, standardDurationRepo, session.org.id]);

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

  async function handleSave(target: PriceSheet): Promise<void> {
    if (!onSave) return;
    setActionState({ kind: 'working' });
    try {
      const result = await onSave(target);
      setActionState(
        result.ok
          ? { kind: 'done', message: 'Saved.' }
          : { kind: 'failed', message: result.reason },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the price sheet.';
      setActionState({ kind: 'failed', message });
    }
  }

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

  async function handleSaveAreaAdjustment(
    serviceAreaId: string,
    adjustmentType: 'percent' | 'flat',
    adjustmentValue: number
  ): Promise<void> {
    if (!areaAdjustmentsRepo || !priceSheetId) return;
    setAreaAdjustmentState({ kind: 'working' });
    try {
      const result = await areaAdjustmentsRepo.save(priceSheetId, serviceAreaId, adjustmentType, adjustmentValue);
      if (result.ok) {
        const saved = result.value;
        setAreaAdjustments((prev) => {
          const idx = prev.findIndex((item) => item.serviceAreaId === saved.serviceAreaId);
          if (idx === -1) return [...prev, saved];
          const next = [...prev];
          next[idx] = saved;
          return next;
        });
        setAreaAdjustmentState({ kind: 'done', message: 'Saved.' });
      } else {
        setAreaAdjustmentState({ kind: 'failed', message: result.reason });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the area adjustment.';
      setAreaAdjustmentState({ kind: 'failed', message });
    }
  }

  async function handleSaveStandardDuration(value: number): Promise<void> {
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
          <ListItem title="Version" subtitle={String(sheet.version)} />
          <ListItem title="Status" subtitle={STATUS_LABEL[sheet.status]} />
          <ListItem title="Published" subtitle={formatDate(sheet.publishedAt)} />
        </Card>

        <Button
          label={busy ? 'Saving...' : 'Save'}
          onPress={() => {
            void handleSave(sheet);
          }}
          disabled={!onSave || busy}
          style={styles.action}
        />
        {sheet.status === 'draft' ? (
          <Button
            label={busy ? 'Publishing...' : 'Publish'}
            variant="secondary"
            onPress={() => {
              void handlePublish(sheet);
            }}
            disabled={!publishRepo || busy}
            style={styles.action}
          />
        ) : null}

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
            <Button
              label={standardDurationState.kind === 'working' ? 'Saving...' : 'Save Standard Duration'}
              onPress={() => { const value = Number(standardMinutesInput); if (Number.isNaN(value) || value <= 0) return; void handleSaveStandardDuration(value); }}
              disabled={standardDurationState.kind === 'working'}
              style={styles.action}
            />
            {standardDurationState.kind === 'failed' ? <ErrorState message={standardDurationState.message} /> : null}
            {standardDurationState.kind === 'done' ? <Text style={styles.note}>{standardDurationState.message}</Text> : null}
          </Card>
        ) : null}

        {areaAdjustmentsRepo ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Area Adjustments</Text>
            {areaAdjustments.length > 0
              ? areaAdjustments.map((adjustment) => (
                  <ListItem
                    key={adjustment.id}
                    title={adjustment.serviceAreaId}
                    subtitle={
                      adjustment.adjustmentType === 'percent'
                        ? `${adjustment.adjustmentValue}%`
                        : String(adjustment.adjustmentValue)
                    }
                  />
                ))
              : null}

            <TextInput
              style={styles.input}
              placeholder="Service area ID"
              value={serviceAreaIdInput}
              onChangeText={setServiceAreaIdInput}
            />
            <View style={styles.action}>
              <Button
                label={adjustmentTypeInput === 'percent' ? 'Type: Percent' : 'Type: Flat'}
                variant="outline"
                size="sm"
                onPress={() =>
                  setAdjustmentTypeInput((prev) => (prev === 'percent' ? 'flat' : 'percent'))
                }
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Adjustment value"
              value={adjustmentValueInput}
              onChangeText={setAdjustmentValueInput}
              keyboardType="numeric"
            />
            <Button
              label={areaAdjustmentState.kind === 'working' ? 'Saving...' : 'Save Adjustment'}
              onPress={() => {
                const value = Number(adjustmentValueInput);
                if (!serviceAreaIdInput || Number.isNaN(value)) return;
                void handleSaveAreaAdjustment(serviceAreaIdInput, adjustmentTypeInput, value);
              }}
              disabled={areaAdjustmentState.kind === 'working'}
              style={styles.action}
            />

            {areaAdjustmentState.kind === 'failed' ? (
              <ErrorState message={areaAdjustmentState.message} />
            ) : null}
            {areaAdjustmentState.kind === 'done' ? (
              <Text style={styles.note}>{areaAdjustmentState.message}</Text>
            ) : null}
          </Card>
        ) : null}

        {serviceTasksRepo ? <ServiceTasksCard serviceTasksRepo={serviceTasksRepo} /> : null}

        <Text style={styles.note}>
          Rate rows are not editable yet — the read port exposes no rates method.
        </Text>
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
    padding: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  action: {
    marginBottom: spacing.sm,
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
});
