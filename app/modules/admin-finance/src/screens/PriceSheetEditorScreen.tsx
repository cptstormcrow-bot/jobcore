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
import { View, Text, ScrollView, StyleSheet, TextInput, Pressable } from 'react-native';
import { Button, Card, Checkbox, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, Select, colors, spacing, typography } from '@jobcore/ui';
import type { PriceSheet, PriceSheetStatus, CalculationResult } from '../money/types';
import type { PriceSheetRepository, ServiceArea, ServiceTask, PriceSheetStandardDuration } from '../data/ports';
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
      priceCents?: number | null;
      details?: string | null;
      materials?: string | null;
    }
  ): Promise<CalculationResult<ServiceTask>>;
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

function ServiceTasksCard({ serviceTasksRepo }: { serviceTasksRepo: ServiceTasksRepoPort }) {
  const session = useModuleSession();
  const organizationId = session?.org.id;
  const [tasks, setTasks] = useState<ServiceTask[]>([]);
  const [loadState, setLoadState] = useState<ServiceTasksCardState>({ kind: 'idle' });
  const [saveState, setSaveState] = useState<ServiceTasksCardState>({ kind: 'idle' });
  const [nameInput, setNameInput] = useState('');
  const [serviceIdInput, setServiceIdInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [detailsInput, setDetailsInput] = useState('');
  const [materialsInput, setMaterialsInput] = useState('');
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      { estimatedMinutes: string; rate: string; category: string; price: string; details: string; materials: string }
    >
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
              price: centsToDollarsText(task.priceCents),
              details: task.details ?? '',
              materials: task.materials ?? '',
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

  function updateDraft(
    taskId: string,
    field: 'estimatedMinutes' | 'rate' | 'category' | 'price' | 'details' | 'materials',
    value: string
  ) {
    setDrafts((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? {
          estimatedMinutes: '',
          rate: '',
          category: '',
          price: '',
          details: '',
          materials: '',
        }),
        [field]: value,
      },
    }));
  }

  async function commitField(
    taskId: string,
    patch: {
      estimatedMinutes?: number | null;
      rate?: number | null;
      category?: string | null;
      priceCents?: number | null;
      details?: string | null;
      materials?: string | null;
    }
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
        price: centsToDollarsText(result.value.priceCents),
        details: result.value.details ?? '',
        materials: result.value.materials ?? '',
      },
    }));
    const priceCents = dollarsTextToCents(priceInput);
    if (priceInput !== '' || detailsInput !== '' || materialsInput !== '') {
      void serviceTasksRepo.updateServiceTask(result.value.id, {
        ...(priceCents === undefined ? {} : { priceCents }),
        details: detailsInput === '' ? null : detailsInput,
        materials: materialsInput === '' ? null : materialsInput,
      });
    }
    setNameInput('');
    setServiceIdInput('');
    setPriceInput('');
    setDetailsInput('');
    setMaterialsInput('');
    setSaveState({ kind: 'done', message: 'Task added.' });
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.heading}>Service Tasks</Text>
      {loadState.kind === 'loading' ? <LoadingState label="Loading service tasks..." /> : null}
      {loadState.kind === 'failed' ? <ErrorState message={loadState.message} /> : null}

      {tasks.map((task) => {
        const draft = drafts[task.id] ?? {
          estimatedMinutes: '',
          rate: '',
          category: '',
          price: '',
          details: '',
          materials: '',
        };
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
            <TextInput
              style={styles.input}
              placeholder="Price ($)"
              value={draft.price}
              keyboardType="decimal-pad"
              onChangeText={(text) => updateDraft(task.id, 'price', text)}
              onBlur={() => {
                const cents = dollarsTextToCents(draft.price);
                if (cents === undefined) return;
                void commitField(task.id, { priceCents: cents });
              }}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Details"
              value={draft.details}
              multiline
              numberOfLines={3}
              onChangeText={(text) => updateDraft(task.id, 'details', text)}
              onBlur={() =>
                void commitField(task.id, { details: draft.details === '' ? null : draft.details })
              }
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Materials"
              value={draft.materials}
              multiline
              numberOfLines={3}
              onChangeText={(text) => updateDraft(task.id, 'materials', text)}
              onBlur={() =>
                void commitField(task.id, { materials: draft.materials === '' ? null : draft.materials })
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

      <Select
        value={serviceIdInput || null}
        options={services.map((s) => ({ label: s.name, value: s.id }))}
        placeholder="Select a service"
        onChange={setServiceIdInput}
      />
      <TextInput
        style={styles.input}
        placeholder="New task name"
        value={nameInput}
        onChangeText={setNameInput}
      />
      <TextInput
        style={styles.input}
        placeholder="Price ($)"
        value={priceInput}
        keyboardType="decimal-pad"
        onChangeText={setPriceInput}
      />
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Details"
        value={detailsInput}
        multiline
        numberOfLines={3}
        onChangeText={setDetailsInput}
      />
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Materials"
        value={materialsInput}
        multiline
        numberOfLines={3}
        onChangeText={setMaterialsInput}
      />
      <View style={styles.actionRow}>
        <Button
          label={saveState.kind === 'loading' ? 'Saving...' : 'Add Task'}
          onPress={() => void handleCreate()}
          disabled={saveState.kind === 'loading'}
          size="sm"
        />
      </View>
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
      setAreaAdjustmentState({ kind: 'done', message: `Saved ${okCount} of ${areaIds.length} areas.` });
    } else {
      setAreaAdjustmentState({
        kind: 'failed',
        message: lastFailureMessage || `Saved ${okCount} of ${areaIds.length} areas.`,
      });
    }
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
            {areaAdjustments.length > 0
              ? areaAdjustments.map((adjustment) => (
                  <ListItem
                    key={adjustment.id}
                    title={areaNameById.get(adjustment.serviceAreaId) ?? adjustment.serviceAreaId}
                    subtitle={
                      adjustment.adjustmentType === 'percent'
                        ? `${adjustment.adjustmentValue}%`
                        : String(adjustment.adjustmentValue)
                    }
                  />
                ))
              : null}

            {serviceAreas.length === 0 ? (
              <Text style={styles.note}>No service areas yet — add them under Service Areas.</Text>
            ) : (
              <Select
                label="Area"
                value={selectedAreaId}
                options={[
                  { label: 'All areas', value: '__all__' },
                  ...serviceAreas.map((area) => ({ label: area.name, value: area.id })),
                ]}
                onChange={setSelectedAreaId}
                style={styles.action}
              />
            )}
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
            <TextInput
              style={styles.input}
              placeholder="Adjustment value"
              value={adjustmentValueInput}
              onChangeText={setAdjustmentValueInput}
              keyboardType="numeric"
            />
            <View style={styles.actionRow}>
              <Button
                label={areaAdjustmentState.kind === 'working' ? 'Saving...' : 'Save Adjustment'}
                onPress={() => {
                  const value = Number(adjustmentValueInput);
                  if (Number.isNaN(value)) return;
                  const areaIds =
                    selectedAreaId === '__all__'
                      ? serviceAreas.map((area) => area.id)
                      : [selectedAreaId];
                  void handleSaveAreaAdjustments(areaIds, adjustmentTypeInput, value);
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
});
