// JobCore screen #0057 - af-jobEstimate - Job Estimate
/**
 * Job Estimate screen — full CRUD over a job's estimate header + line items,
 * plus a shareable link and a print-friendly view.
 *
 * Modeled on `PriceSheetEditorScreen.tsx`/`BlackoutEditorScreen.tsx`'s
 * conventions: `idle | loading | loaded | failed` load state, a separate
 * `ActionState` for in-flight writes, `getModulePorts()` fallback when no
 * `estimates` prop is supplied, `Card`/`ScrollView` layout, `styles` object
 * at the bottom.
 *
 * Line items are the source of truth for the header cost fields
 * (materialsCost/laborCost/otherCost/totalCost) — this screen derives and
 * displays those totals from `lineItems` rather than trusting stale header
 * values, though the header's own persisted cost fields are shown too once
 * the estimate loads.
 *
 * `updateLineItem` (not remove+re-add) is used for the inline-edit path so a
 * line item's `id`/`createdAt` survive a save.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { View, ScrollView, StyleSheet, Platform, Alert, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, Select, TextField, colors, spacing, typography, Text, EstimateStatusControl, JobHeaderBlock, JobTitleBarHeader, Checkbox } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
import { ESTIMATE_LABELS, DEFAULT_FINE_PRINT_PLACEHOLDER, computeTotals, formatMoney } from '../domain/estimate-layout';
import { allowedEstimateMoves, needsDownstreamWarning } from '@jobcore/core';
import type { Job } from '@jobcore/core';
import type {
  EstimateRepository,
  EstimateContingency,
  JobEstimate,
  JobEstimateInput,
  JobEstimateLineItem,
  JobEstimateLineItemDraft,
  EstimateLineItemKind,
  JobPlanTaskRow,
  PriceSheetRepository,
  ServiceArea,
} from '../data/ports';
import type { PriceSheetAreaAdjustment } from '../data/price-sheet-repo';
import type { PriceSheetRate, CalculationResult } from '../money/types';
import { getModulePorts } from '../lib/module-ports';
import { getModuleSession } from '../lib/module-session';
import { approveEstimate } from '../flows/approve-estimate';
import { submitEstimate } from '../flows/submit-estimate';

export interface JobEstimateScreenProps {
  job: Job;
  estimates?: EstimateRepository;
  onBack?: () => void;
  onEstimateChange?: (estimate: JobEstimate) => void;
  priceSheets?: PriceSheetRepository;
  priceSheetRates?: {
    list: (priceSheetId: string) => Promise<CalculationResult<PriceSheetRate[]>>;
  };
  priceSheetAreaAdjustments?: {
    list: (priceSheetId: string, serviceAreaId?: string) => Promise<CalculationResult<PriceSheetAreaAdjustment[]>>;
  };
  serviceAreas?: ServiceArea[];
  /** Inlined inside a host screen's own scroll view: suppresses the Back row and renders a plain `View` root instead of `ScrollView`. */
  embedded?: boolean;
  /** When false: read-only display (tech view); mutating controls are hidden. Default true. */
  editable?: boolean;
  /** Publishes the header-right status control and options-menu items to the host; null on unmount. */
  onChrome?: (chrome: { statusControl: ReactNode; optionsItems: MenuItem[] } | null) => void;
}

/** Applies one area adjustment to a base DOLLAR value using the `percent`/`flat` convention.
 * `adjustment.adjustmentValue` is `Money` (integer cents) for a `'flat'` adjustment, so it is
 * converted to dollars before being added. */
function applyDollarAdjustment(baseDollars: number, adjustment: PriceSheetAreaAdjustment): number {
  if (adjustment.adjustmentType === 'percent') {
    return baseDollars + baseDollars * (adjustment.adjustmentValue / 100);
  }
  return baseDollars + adjustment.adjustmentValue / 100;
}

/** In-flight write state, independent of the load state. */
type ActionState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; message: string };

/** Editable contingency row; price kept as text until saved. */
type ContingencyDraft = { description: string; priceText: string };

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'failed'; message: string };

const KIND_OPTIONS: { label: string; value: EstimateLineItemKind }[] = [
  { label: 'Material', value: 'material' },
  { label: 'Labor', value: 'labor' },
  { label: 'Other', value: 'other' },
];

const KIND_LABEL: Record<EstimateLineItemKind, string> = {
  material: 'Material',
  labor: 'Labor',
  other: 'Other',
};

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function JobEstimateScreen(props: JobEstimateScreenProps) {
  const { job, onBack, embedded } = props;
  const editable = props.editable ?? true;
  const estimates = props.estimates ?? getModulePorts().estimates;

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const tabStyle = windowWidth < 600 ? styles.tabNarrow : undefined;
  const [lineItems, setLineItems] = useState<JobEstimateLineItem[]>([]);
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [moving, setMoving] = useState(false);

  const [kindInput, setKindInput] = useState<EstimateLineItemKind>('material');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [unitCostInput, setUnitCostInput] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescriptionInput, setEditDescriptionInput] = useState('');
  const [editQuantityInput, setEditQuantityInput] = useState('');
  const [editUnitCostInput, setEditUnitCostInput] = useState('');

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const [planTasks, setPlanTasks] = useState<JobPlanTaskRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    let repo: ReturnType<typeof getModulePorts>['jobPlanTasks'] | undefined;
    try {
      repo = getModulePorts().jobPlanTasks;
    } catch {
      repo = undefined;
    }
    if (!repo) {
      setPlanTasks([]);
      return undefined;
    }
    repo
      .listForJob(job.id)
      .then((rows) => {
        if (!cancelled) setPlanTasks(rows);
      })
      .catch(() => {
        if (!cancelled) setPlanTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [job.id]);
  const visibleTasks = planTasks.filter((t) => t.status !== 'deferred');

  const priceSheetQuickAddAvailable = !!(props.priceSheets && props.priceSheetRates);
  const [addMode, setAddMode] = useState<'manual' | 'priceSheet'>('manual');
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [rates, setRates] = useState<PriceSheetRate[]>([]);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaAdjustments, setAreaAdjustments] = useState<PriceSheetAreaAdjustment[]>([]);
  const [rateQuantityInput, setRateQuantityInput] = useState('1');

  useEffect(() => {
    if (addMode !== 'priceSheet' || !props.priceSheets) {
      return;
    }
    let cancelled = false;
    props.priceSheets
      .getActive(job.organizationId)
      .then((sheet) => {
        if (!cancelled) setActiveSheetId(sheet ? sheet.id : null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load the active price sheet.';
          setRatesError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [addMode, props.priceSheets, job.organizationId]);

  useEffect(() => {
    if (!props.priceSheetRates || !activeSheetId) {
      setRates([]);
      return undefined;
    }
    let cancelled = false;
    props.priceSheetRates
      .list(activeSheetId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setRates(result.value);
        } else {
          setRatesError(result.reason);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load rates.';
          setRatesError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.priceSheetRates, activeSheetId]);

  useEffect(() => {
    if (!props.priceSheetAreaAdjustments || !activeSheetId || !selectedAreaId) {
      setAreaAdjustments([]);
      return undefined;
    }
    let cancelled = false;
    props.priceSheetAreaAdjustments
      .list(activeSheetId, selectedAreaId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setAreaAdjustments(result.value);
        } else {
          setRatesError(result.reason);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load area adjustments.';
          setRatesError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.priceSheetAreaAdjustments, activeSheetId, selectedAreaId]);

  const selectedRate = rates.find((r) => r.id === selectedRateId) ?? null;
  const priceSheetUnitCost = selectedRate
    ? areaAdjustments
        .filter((adjustment) => adjustment.serviceAreaId === selectedAreaId)
        .reduce((value, adjustment) => applyDollarAdjustment(value, adjustment), selectedRate.amount / 100)
    : 0;

  async function handlePriceSheetQuickAdd(): Promise<void> {
    if (!selectedRate) {
      setActionState({ kind: 'failed', message: 'Pick a rate.' });
      return;
    }
    const quantity = Number(rateQuantityInput);
    if (Number.isNaN(quantity) || quantity <= 0) {
      setActionState({ kind: 'failed', message: 'Quantity must be a positive number.' });
      return;
    }
    const unitCost = priceSheetUnitCost;
    const draft: JobEstimateLineItemDraft = {
      kind: 'labor',
      description: `${selectedRate.serviceId} — ${selectedRate.attachTiming}`,
      quantity,
      unitCost,
      lineTotal: quantity * unitCost,
    };
    setActionState({ kind: 'working' });
    try {
      const added = await estimates.addLineItem(job.id, draft);
      setLineItems((prev) => [...prev, added]);
      setSelectedRateId(null);
      setRateQuantityInput('1');
      setAddMode('manual');
      setActionState({ kind: 'done', message: 'Line item added.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not add the line item.';
      setActionState({ kind: 'failed', message });
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    Promise.all([estimates.getForJob(job.id), estimates.listLineItems(job.id)])
      .then(([loadedEstimate, loadedLineItems]) => {
        if (cancelled) return;
        setEstimate(loadedEstimate);
        setTrackingInput(loadedEstimate?.trackingNumber ?? '');
        setFinePrintInput(loadedEstimate?.finePrint ?? '');
        setContingencyRows(
          (loadedEstimate?.contingencies ?? []).map((c) => ({ description: c.description, priceText: c.price === null ? '' : String(c.price) })),
        );
        setLineItems(loadedLineItems);
        setLoadState({ kind: 'loaded' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Could not load the estimate.';
        setLoadState({ kind: 'failed', message });
      });
    return () => {
      cancelled = true;
    };
  }, [estimates, job.id]);

  const busy = actionState.kind === 'working';

  const [trackingInput, setTrackingInput] = useState('');
  const [trackingMsg, setTrackingMsg] = useState<string | null>(null);
  const [checkingUps, setCheckingUps] = useState(false);
  const [contingencyRows, setContingencyRows] = useState<ContingencyDraft[]>([]);
  const [finePrintInput, setFinePrintInput] = useState('');
  const [templateText, setTemplateText] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateInput, setTemplateInput] = useState('');
  const [activeTab, setActiveTab] = useState<'copy' | 'tasks' | 'contingency' | 'manual' | 'priceSheet' | 'lineItem' | 'finePrint'>('copy');

  useEffect(() => {
    let cancelled = false;
    try {
      estimates
        .getFinePrintTemplate()
        .then((text) => {
          if (!cancelled) setTemplateText(text);
        })
        .catch(() => {
          if (!cancelled) setTemplateText(null);
        });
    } catch {
      setTemplateText(null);
    }
    return () => {
      cancelled = true;
    };
  }, [estimates]);

  /** Persists a partial header update through the normal upsert path. */
  async function persist(input: JobEstimateInput): Promise<JobEstimate | null> {
    try {
      const next = await estimates.upsertForJob(job.id, input);
      setEstimate(next);
      props.onEstimateChange?.(next);
      return next;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the estimate.';
      setActionState({ kind: 'failed', message });
      return null;
    }
  }

  async function runTrackingLookup(raw: string): Promise<void> {
    const number = raw.trim();
    setTrackingMsg(null);
    if (!number) {
      await persist({ trackingNumber: null, trackingStatus: null, trackingCheckedAt: null });
      return;
    }
    setCheckingUps(true);
    try {
      let result: Awaited<ReturnType<EstimateRepository['trackShipment']>>;
      try {
        result = await estimates.trackShipment(number);
      } catch (error: unknown) {
        result = { ok: false, status: null, delivered: false, error: error instanceof Error ? error.message : 'UPS lookup failed.' };
      }
      const checkedAt = new Date().toISOString();
      if (result.error === 'ups-not-configured') {
        setTrackingMsg('UPS lookup not set up yet');
        await persist({ trackingNumber: number });
      } else if (!result.ok && result.error && !/not.?found/i.test(result.error)) {
        setTrackingMsg(result.error);
        await persist({ trackingNumber: number });
      } else if (!result.ok || (!result.status && !result.delivered)) {
        await persist({ trackingNumber: number, trackingStatus: 'Not found', trackingCheckedAt: checkedAt });
      } else if (result.delivered) {
        await persist({ trackingNumber: number, trackingStatus: 'Delivered', trackingCheckedAt: result.deliveredAt ?? checkedAt, materialsOnsite: true });
      } else {
        await persist({ trackingNumber: number, trackingStatus: result.status, trackingCheckedAt: checkedAt });
      }
    } catch (error: unknown) {
      setTrackingMsg(error instanceof Error ? error.message : 'UPS lookup failed.');
    } finally {
      setCheckingUps(false);
    }
  }

  function trackingStatusLine(): string | null {
    if (trackingMsg) return trackingMsg;
    if (!estimate?.trackingNumber || !estimate.trackingStatus) return null;
    if (estimate.trackingStatus === 'Not found') return 'Not found at UPS';
    const when = estimate.trackingCheckedAt ? ` · checked ${new Date(estimate.trackingCheckedAt).toLocaleString()}` : '';
    return `UPS: ${estimate.trackingStatus}${when}`;
  }
  const trackingLine = trackingStatusLine();

  function toContingencies(rows: ContingencyDraft[]): EstimateContingency[] {
    return rows
      .filter((r) => r.description.trim() !== '')
      .map((r) => {
        const text = r.priceText.replace(/[$,\s]/g, '');
        const n = text === '' ? Number.NaN : Number(text);
        return { description: r.description.trim(), price: Number.isFinite(n) ? n : null };
      });
  }

  function saveContingencies(rows: ContingencyDraft[]): void {
    const next = toContingencies(rows);
    const current = estimate?.contingencies ?? [];
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    void persist({ contingencies: next });
  }

  function addContingency(): void {
    setContingencyRows((prev) => [...prev, { description: '', priceText: '' }]);
  }

  function updateContingency(index: number, patch: Partial<ContingencyDraft>): void {
    setContingencyRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeContingency(index: number): void {
    const next = contingencyRows.filter((_, i) => i !== index);
    setContingencyRows(next);
    saveContingencies(next);
  }

  useEffect(() => {
    if (!estimate) return;
    if ((estimate.finePrint ?? '').trim() !== '') return;
    if (finePrintInput.trim() !== '') return;
    const seed = templateText && templateText.trim() !== '' ? templateText : DEFAULT_FINE_PRINT_PLACEHOLDER;
    setFinePrintInput(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate, templateText]);

  async function resetTemplate(): Promise<void> {
    setActionState({ kind: 'working' });
    try {
      await estimates.setFinePrintTemplate(DEFAULT_FINE_PRINT_PLACEHOLDER);
      setTemplateText(DEFAULT_FINE_PRINT_PLACEHOLDER);
      setTemplateInput(DEFAULT_FINE_PRINT_PLACEHOLDER);
      setActionState({ kind: 'done', message: 'Fine-print template reset to default.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not reset the template.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function saveTemplate(): Promise<void> {
    setActionState({ kind: 'working' });
    try {
      await estimates.setFinePrintTemplate(templateInput);
      setTemplateText(templateInput);
      setEditingTemplate(false);
      setActionState({ kind: 'done', message: 'Fine-print template saved.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the template.';
      setActionState({ kind: 'failed', message });
    }
  }

  const layoutTotals = computeTotals(lineItems, estimate?.contingencies ?? []);
  const linkEnabled = estimate?.status === 'submitted' || estimate?.status === 'approved';

  const totals = lineItems.reduce(
    (acc, item) => {
      acc.total += item.lineTotal;
      if (item.kind === 'material') acc.materials += item.lineTotal;
      else if (item.kind === 'labor') acc.labor += item.lineTotal;
      else acc.other += item.lineTotal;
      return acc;
    },
    { materials: 0, labor: 0, other: 0, total: 0 },
  );

  async function handleAddLineItem(): Promise<void> {
    const quantity = Number(quantityInput);
    const unitCost = Number(unitCostInput);
    if (!descriptionInput.trim()) {
      setActionState({ kind: 'failed', message: 'Enter a description.' });
      return;
    }
    if (Number.isNaN(quantity) || Number.isNaN(unitCost)) {
      setActionState({ kind: 'failed', message: 'Quantity and unit cost must be numbers.' });
      return;
    }
    const draft: JobEstimateLineItemDraft = {
      kind: kindInput,
      description: descriptionInput.trim(),
      quantity,
      unitCost,
      lineTotal: quantity * unitCost,
    };
    setActionState({ kind: 'working' });
    try {
      const added = await estimates.addLineItem(job.id, draft);
      setLineItems((prev) => [...prev, added]);
      setDescriptionInput('');
      setQuantityInput('1');
      setUnitCostInput('');
      setActionState({ kind: 'done', message: 'Line item added.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not add the line item.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleBuildFromTasks(): Promise<void> {
    const linked = new Set(lineItems.map((i) => i.jobPlanTaskId).filter((v): v is string => !!v));
    const priceSheetTasks = visibleTasks.filter((t) => t.kind !== 'misc' && !linked.has(t.id));
    const allMisc = visibleTasks.filter((t) => t.kind === 'misc');
    const miscAlreadyLinked = allMisc.some((t) => linked.has(t.id));
    const drafts: JobEstimateLineItemDraft[] = priceSheetTasks.map((t) => {
      const unitCost = t.rate ?? 0;
      const quantity = t.quantity > 0 ? t.quantity : 1;
      return {
        kind: 'labor' as const,
        description: t.title,
        quantity,
        unitCost,
        lineTotal: quantity * unitCost,
        jobPlanTaskId: t.id,
      };
    });
    if (allMisc.length > 0 && !miscAlreadyLinked) {
      drafts.push({
        kind: 'labor',
        description: `Hourly — billed by clock: ${allMisc.map((t) => t.title).join(', ')}`,
        quantity: 1,
        unitCost: 0,
        lineTotal: 0,
        jobPlanTaskId: allMisc[0]?.id ?? null,
      });
    }
    if (drafts.length === 0) {
      setActionState({ kind: 'done', message: 'Every task already has a line.' });
      return;
    }
    setActionState({ kind: 'working' });
    try {
      const added: JobEstimateLineItem[] = [];
      for (const draft of drafts) {
        added.push(await estimates.addLineItem(job.id, draft));
      }
      setLineItems((prev) => [...prev, ...added]);
      setActionState({ kind: 'done', message: `${added.length} line(s) built from tasks.` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not build lines from tasks.';
      setActionState({ kind: 'failed', message });
    }
  }

  function beginEdit(item: JobEstimateLineItem): void {
    setEditingId(item.id);
    setEditDescriptionInput(item.description);
    setEditQuantityInput(String(item.quantity));
    setEditUnitCostInput(String(item.unitCost));
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditDescriptionInput('');
    setEditQuantityInput('');
    setEditUnitCostInput('');
  }

  async function handleSaveEdit(item: JobEstimateLineItem): Promise<void> {
    const quantity = Number(editQuantityInput);
    const unitCost = Number(editUnitCostInput);
    if (!editDescriptionInput.trim() || Number.isNaN(quantity) || Number.isNaN(unitCost)) {
      setActionState({ kind: 'failed', message: 'Enter a valid description, quantity, and unit cost.' });
      return;
    }
    setActionState({ kind: 'working' });
    try {
      const updated = await estimates.updateLineItem(item.id, {
        description: editDescriptionInput.trim(),
        quantity,
        unitCost,
        lineTotal: quantity * unitCost,
      });
      setLineItems((prev) => prev.map((existing) => (existing.id === updated.id ? updated : existing)));
      cancelEdit();
      setActionState({ kind: 'done', message: 'Line item updated.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not update the line item.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleRemoveLineItem(item: JobEstimateLineItem): Promise<void> {
    setActionState({ kind: 'working' });
    try {
      await estimates.removeLineItem(item.id);
      setLineItems((prev) => prev.filter((existing) => existing.id !== item.id));
      setActionState({ kind: 'done', message: 'Line item removed.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not remove the line item.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleShare(): Promise<void> {
    setShareError(null);
    setActionState({ kind: 'working' });
    try {
      const { url } = await estimates.issueShareLink(job.id);
      setShareUrl(url);
      await Clipboard.setStringAsync(url);
      setActionState({ kind: 'done', message: 'Link copied to clipboard.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create a share link.';
      setShareError(message);
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleApprove(): Promise<void> {
    if (!estimate) {
      return;
    }
    setActionState({ kind: 'working' });
    try {
      const session = getModuleSession();
      const result = await approveEstimate(estimate, 'approved', {
        estimates,
        ctx: { role: session ? session.role : 'admin', now: () => new Date().toISOString() },
        now: () => new Date().toISOString(),
      });
      if (result.ok) {
        setEstimate(result.estimate);
        props.onEstimateChange?.(result.estimate);
        setActionState({ kind: 'done', message: 'Estimate approved.' });
      } else {
        setActionState({ kind: 'failed', message: result.reason });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not approve the estimate.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function confirmMove(message: string): Promise<boolean> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.confirm(message) : false;
    }
    return new Promise<boolean>((resolve) => {
      Alert.alert('Move estimate', message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Move', onPress: () => resolve(true) },
      ]);
    });
  }

  async function handleMove(next: 'draft' | 'submitted' | 'approved'): Promise<void> {
    if (!estimate) {
      return;
    }
    if (needsDownstreamWarning(estimate.status, next)) {
      const ok = await confirmMove(
        'Moving this estimate out of Approved will turn the Approval and Estimate stages red on the job timeline until it is approved again. Continue?'
      );
      if (!ok) {
        return;
      }
    }
    setMoving(true);
    setActionState({ kind: 'working' });
    try {
      const session = getModuleSession();
      const nowFn = () => new Date().toISOString();
      const ctx = { role: session ? session.role : 'admin', now: nowFn };
      let current: JobEstimate = estimate;
      if (next === 'draft') {
        current = await estimates.upsertForJob(estimate.jobId, { status: 'draft' });
      } else {
        if (current.status === 'draft') {
          const submitted = await submitEstimate(current, { estimates, ctx, now: nowFn });
          if (!submitted.ok) {
            setActionState({ kind: 'failed', message: submitted.reason });
            return;
          }
          current = submitted.estimate;
        } else if (current.status !== 'submitted') {
          current = await estimates.upsertForJob(current.jobId, { status: 'submitted' });
        }
        if (next === 'approved') {
          const result = await approveEstimate(current, next, { estimates, ctx, now: nowFn });
          if (!result.ok) {
            setActionState({ kind: 'failed', message: result.reason });
            return;
          }
          current = result.estimate;
        }
      }
      setEstimate(current);
      props.onEstimateChange?.(current);
      setActionState({ kind: 'done', message: 'Estimate status updated.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not change the estimate status.';
      setActionState({ kind: 'failed', message });
    } finally {
      setMoving(false);
    }
  }

  const onChromeRef = useRef(props.onChrome);
  onChromeRef.current = props.onChrome;
  const handleMoveRef = useRef(handleMove);
  handleMoveRef.current = handleMove;
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const chromeStatus = estimate?.status ?? null;
  const chromePdf = estimate?.pdfDelivery ?? false;
  const hasChrome = !!props.onChrome;
  useEffect(() => {
    const publish = onChromeRef.current;
    if (!publish || !chromeStatus) return undefined;
    const optionsItems: MenuItem[] = editable
      ? [
          {
            id: 'estimate-pdf-delivery',
            label: ESTIMATE_LABELS.pdfDelivery,
            kind: 'toggle',
            checked: chromePdf,
            onToggle: (next: boolean) => {
              void persistRef.current({ pdfDelivery: next });
            },
          },
        ]
      : [];
    publish({
      statusControl: (
        <EstimateStatusControl
          compact
          status={chromeStatus}
          allowed={editable ? allowedEstimateMoves('admin', chromeStatus) : []}
           readOnly={!editable}
          onSelect={(next) => {
            void handleMoveRef.current(next);
          }}
          testID="estimate-status-control"
        />
      ),
      optionsItems,
    });
    return () => {
      onChromeRef.current?.(null);
    };
  }, [chromeStatus, chromePdf, editable, hasChrome]);

  function handlePrint(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading estimate..." />
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

  const Root = embedded ? View : ScrollView;
  const rootProps = embedded ? {} : { contentContainerStyle: styles.content };

  return (
    <View style={styles.screen}>
      <Root {...rootProps}>
        {!embedded && (
          <Button
            label={onBack ? 'Back to Job' : 'Estimate'}
            size="sm"
            onPress={() => onBack?.()}
            disabled={!onBack}
            style={styles.action}
          />
        )}
        {!embedded && <ScreenTitle title="Estimate" />}
        <View style={styles.summaryRow} testID="estimate-summary-row">
          <View style={styles.summaryCell}>
            <Text style={styles.cellLabel}>{ESTIMATE_LABELS.estimate.toUpperCase()}</Text>
            <Text style={styles.cellValue}>{estimate?.status ?? 'draft'}</Text>
            {!props.onChrome && estimate ? (
              <EstimateStatusControl
                status={estimate.status}
                allowed={editable ? allowedEstimateMoves('admin', estimate.status) : []}
           readOnly={!editable}
                busy={moving}
                onSelect={(next) => {
                  void handleMove(next);
                }}
                testID="estimate-status-control"
              />
            ) : null}
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.cellLabel}>{ESTIMATE_LABELS.totalCost.toUpperCase()}</Text>
            <Text style={styles.cellValue}>{formatMoney(layoutTotals.total)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.cellLabel}>MATERIALS ONSITE</Text>
            <Checkbox
              label={ESTIMATE_LABELS.materialsOnsite}
              checked={!!estimate?.materialsOnsite}
              disabled={!editable || busy || !estimate}
              onChange={(next) => {
                void persist({ materialsOnsite: next });
              }}
            />
            <View style={styles.trackingRow}>
            {editable || trackingInput ? (
              <TextField
                label={ESTIMATE_LABELS.trackingNumber}
                value={trackingInput}
                onChangeText={setTrackingInput}
                onBlur={() => {
                  if (editable && trackingInput.trim() !== (estimate?.trackingNumber ?? '')) {
                    void runTrackingLookup(trackingInput);
                  }
                }}
                disabled={!editable || busy}
                style={styles.trackingField}
              />
            ) : null}
            {editable ? (
              <Button
                label={checkingUps ? 'Checking...' : 'Check UPS'}
                size="sm"
                onPress={() => {
                  void runTrackingLookup(trackingInput);
                }}
                disabled={busy || checkingUps || !trackingInput.trim()}
                style={styles.trackingButton}
              />
            ) : null}
            </View>
            {trackingLine ? <Text style={styles.note}>{trackingLine}</Text> : null}
          </View>
        </View>

        <View style={styles.tabRow} testID="estimate-tab-bar">
          <Button label="Copy Link" size="tab" style={tabStyle} variant={activeTab === 'copy' ? 'secondary' : 'outline'} onPress={() => setActiveTab('copy')} />
          <Button label="Build from Tasks" size="tab" style={tabStyle} variant={activeTab === 'tasks' ? 'secondary' : 'outline'} onPress={() => setActiveTab('tasks')} />
          <Button label="Contingency" size="tab" style={tabStyle} variant={activeTab === 'contingency' ? 'secondary' : 'outline'} onPress={() => setActiveTab('contingency')} />
          {priceSheetQuickAddAvailable ? (
            <>
              <Button label="Manual" size="tab" style={tabStyle} variant={activeTab === 'manual' ? 'secondary' : 'outline'} onPress={() => { setActiveTab('manual'); setAddMode('manual'); }} />
              <Button label="Price Sheet" size="tab" style={tabStyle} variant={activeTab === 'priceSheet' ? 'secondary' : 'outline'} onPress={() => { setActiveTab('priceSheet'); setAddMode('priceSheet'); }} />
            </>
          ) : null}
          <Button label="Line Item" size="tab" style={tabStyle} variant={activeTab === 'lineItem' ? 'secondary' : 'outline'} onPress={() => setActiveTab('lineItem')} />
          <Button label="Fine Print" size="tab" style={tabStyle} variant={activeTab === 'finePrint' ? 'secondary' : 'outline'} onPress={() => setActiveTab('finePrint')} />
        </View>

        {activeTab === 'copy' ? (
        <View style={styles.linkRow} testID="estimate-link-row">
          <Text style={styles.cellLabel}>{ESTIMATE_LABELS.estimateLink.toUpperCase()}</Text>
          <Button
            label={busy ? 'Working...' : 'Copy estimate link'}
            size="sm"
            onPress={() => {
              void handleShare();
            }}
            disabled={busy || !linkEnabled}
            style={styles.action}
          />
          {!linkEnabled ? <Text style={styles.note}>{ESTIMATE_LABELS.linkAfterSubmit}</Text> : null}
          {shareUrl ? <Text style={styles.note}>Link copied to clipboard: {shareUrl}</Text> : null}
          {shareError ? <ErrorState message={shareError} /> : null}
        </View>
        ) : null}

        {activeTab === 'tasks' ? (
        <Card style={styles.card}>
          {!embedded && (
            <>
              <JobTitleBarHeader
                framed
                customerName={job.customerName}
                address={job.address}
                phone={job.customerPhone}
                ingressCode={job.ingressInstructions}
                onCopy={async (text) => {
                  await Clipboard.setStringAsync(text);
                }}
              />
              <JobHeaderBlock
                jobNumber={job.jobNumber}
                createdAt={job.createdAt}
                scheduledStart={job.scheduledStart}
              />
            </>
          )}
          {job.description ? <ListItem title={ESTIMATE_LABELS.description} subtitle={job.description} /> : null}
          {visibleTasks.length > 0 ? (
            <View testID="estimate-task-list">
              <Text style={styles.heading}>Tasks</Text>
              {visibleTasks.map((t) => (
                <ListItem
                  key={t.id}
                  title={t.title}
                  subtitle={t.kind === 'misc' ? 'Hourly · clock' : `Qty ${t.quantity}`}
                />
              ))}
              {editable ? (
                <Button
                  label={busy ? 'Building...' : 'Build lines from tasks'}
                  size="sm"
                  onPress={() => {
                    void handleBuildFromTasks();
                  }}
                  disabled={busy}
                  style={styles.action}
                />
              ) : null}
            </View>
          ) : null}
          {editable && estimate?.status === 'submitted' ? (
            <Button
              label={busy ? 'Approving...' : 'Approve'}
              variant="primary"
              size="sm"
              onPress={() => {
                void handleApprove();
              }}
              disabled={busy}
              style={styles.action}
            />
          ) : null}
        </Card>
        ) : null}

        {activeTab === 'contingency' ? (
        <Card style={styles.card}>
          <Text style={styles.heading}>{ESTIMATE_LABELS.contingencies}</Text>
          <Text style={styles.note}>Possible extras. They are not included in the total.</Text>
          {editable ? (
            <>
              {contingencyRows.map((row, index) => (
                <View key={index} style={styles.editRow}>
                  <TextField
                    label="Description"
                    value={row.description}
                    onChangeText={(text) => updateContingency(index, { description: text })}
                    onBlur={() => saveContingencies(contingencyRows)}
                    disabled={busy}
                    style={styles.field}
                  />
                  <TextField
                    label="Price (optional)"
                    value={row.priceText}
                    onChangeText={(text) => updateContingency(index, { priceText: text })}
                    onBlur={() => saveContingencies(contingencyRows)}
                    placeholder="0.00"
                    disabled={busy}
                    style={styles.field}
                  />
                  <Button
                    label="Remove"
                    size="sm"
                    onPress={() => removeContingency(index)}
                    disabled={busy}
                    style={styles.action}
                  />
                </View>
              ))}
              <Button
                label="Add contingency"
                size="sm"
                onPress={addContingency}
                disabled={busy}
                style={styles.action}
              />
            </>
          ) : (estimate?.contingencies ?? []).length === 0 ? (
            <Text style={styles.note}>None.</Text>
          ) : (
            (estimate?.contingencies ?? []).map((c, index) => (
              <ListItem
                key={index}
                title={c.description}
                subtitle={c.price !== null ? formatMoney(c.price) : 'No price'}
              />
            ))
          )}
        </Card>
        ) : null}

        {activeTab === 'manual' || activeTab === 'priceSheet' || activeTab === 'lineItem' ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{ESTIMATE_LABELS.lineItems}</Text>
          {activeTab === 'lineItem' ? (
          <>
          {lineItems.length === 0 ? (
            <EmptyState title="No line items" message="Add a line item below." />
          ) : (
            <View style={styles.itemList}>
            {lineItems.map((item) =>
              editingId === item.id ? (
                <View key={item.id} style={styles.editRow}>
                  <TextField
                    label="Description"
                    value={editDescriptionInput}
                    onChangeText={setEditDescriptionInput}
                    disabled={busy}
                    style={styles.field}
                  />
                  <TextField
                    label="Quantity"
                    value={editQuantityInput}
                    onChangeText={setEditQuantityInput}
                    disabled={busy}
                    style={styles.field}
                  />
                  <TextField
                    label="Unit Cost"
                    value={editUnitCostInput}
                    onChangeText={setEditUnitCostInput}
                    disabled={busy}
                    style={styles.field}
                  />
                  <Button
                    label={busy ? 'Saving...' : 'Save'}
                    variant="primary"
                    size="sm"
                    onPress={() => {
                      void handleSaveEdit(item);
                    }}
                    disabled={busy}
                    style={styles.action}
                  />
                  <Button
                    label="Cancel"
                    size="sm"
                    onPress={cancelEdit}
                    disabled={busy}
                    style={styles.action}
                  />
                </View>
              ) : (
                <ListItem
                  key={item.id}
                  title={`${KIND_LABEL[item.kind]} — ${item.description}`}
                  subtitle={`${item.quantity} x ${formatCurrency(item.unitCost)} = ${formatCurrency(item.lineTotal)}`}
                  onPress={editable ? () => beginEdit(item) : undefined}
                  right={editable ? (
                    <Button
                      label="Remove"
                      size="sm"
                      onPress={() => {
                        void handleRemoveLineItem(item);
                      }}
                      disabled={busy}
                    />
                  ) : undefined}
                />
              ),
            )}
            </View>
          )}
          </>
          ) : null}

          {activeTab !== 'lineItem' && editable ? (
          <>

          {addMode === 'priceSheet' && priceSheetQuickAddAvailable ? (
            <>
              {ratesError ? <ErrorState message={ratesError} /> : null}

              {props.serviceAreas && props.serviceAreas.length > 0 && props.priceSheetAreaAdjustments ? (
                <>
                  <Text style={styles.label}>Service Area (optional)</Text>
                  <View style={styles.action}>
                    {props.serviceAreas.map((area) => (
                      <Button
                        key={area.id}
                        label={area.name}
                        variant={selectedAreaId === area.id ? 'primary' : 'outline'}
                        size="sm"
                        onPress={() => setSelectedAreaId(selectedAreaId === area.id ? null : area.id)}
                        style={styles.action}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>Rate</Text>
              {rates.length > 0 ? (
                <View style={styles.action}>
                  {rates.map((rate) => (
                    <Button
                      key={rate.id}
                      label={`${rate.serviceId} — ${rate.attachTiming}`}
                      variant={selectedRateId === rate.id ? 'primary' : 'outline'}
                      size="sm"
                      onPress={() => setSelectedRateId(rate.id)}
                      style={styles.action}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.note}>No rates available for the active price sheet.</Text>
              )}

              <TextField
                label="Quantity"
                value={rateQuantityInput}
                onChangeText={setRateQuantityInput}
                placeholder="1"
                disabled={busy}
                style={styles.field}
              />

              {selectedRate ? (
                <Text style={styles.note}>Unit cost: {formatCurrency(priceSheetUnitCost)}</Text>
              ) : null}

              <Button
                label={busy ? 'Adding...' : 'Add Line Item'}
                size="sm"
                onPress={() => {
                  void handlePriceSheetQuickAdd();
                }}
                disabled={busy || !selectedRateId}
                style={styles.action}
              />
            </>
          ) : (
            <>
              <Select
                label="Kind"
                value={kindInput}
                options={KIND_OPTIONS}
                onChange={(value) => setKindInput((value as EstimateLineItemKind) ?? 'material')}
                disabled={busy}
                style={styles.field}
              />
              <TextField
                label="Description"
                value={descriptionInput}
                onChangeText={setDescriptionInput}
                placeholder="Description"
                disabled={busy}
                style={styles.field}
              />
              <TextField
                label="Quantity"
                value={quantityInput}
                onChangeText={setQuantityInput}
                placeholder="1"
                disabled={busy}
                style={styles.field}
              />
              <TextField
                label="Unit Cost"
                value={unitCostInput}
                onChangeText={setUnitCostInput}
                placeholder="0.00"
                disabled={busy}
                style={styles.field}
              />
              <Button
                label={busy ? 'Adding...' : 'Add Line Item'}
                size="sm"
                onPress={() => {
                  void handleAddLineItem();
                }}
                disabled={busy}
                style={styles.action}
              />
            </>
          )}
          </>
          ) : null}
        </Card>
        ) : null}

        {activeTab === 'finePrint' ? (
        <Card style={styles.card}>
          <Text style={styles.heading}>{ESTIMATE_LABELS.finePrint}</Text>
          {editable ? (
            <>
              <TextField
                label="Fine print for this estimate"
                value={finePrintInput}
                onChangeText={setFinePrintInput}
                onBlur={() => {
                  const next = finePrintInput.trim() === '' ? null : finePrintInput;
                  if (next !== (estimate?.finePrint ?? null)) {
                    void persist({ finePrint: next });
                  }
                }}
                placeholder={templateText ?? ''}
                multiline
                disabled={busy}
                style={styles.field}
              />
              {finePrintInput.trim() === '' && templateText ? <Text style={styles.note}>{templateText}</Text> : null}
              {editingTemplate ? (
                <>
                  <TextField
                    label="Organization fine-print template"
                    value={templateInput}
                    onChangeText={setTemplateInput}
                    multiline
                    disabled={busy}
                    style={styles.field}
                  />
                  <View style={styles.buttonRow}>
                    <Button
                      label="Save template"
                      variant="primary"
                      size="sm"
                      onPress={() => {
                        void saveTemplate();
                      }}
                      disabled={busy}
                      style={styles.buttonFlex}
                    />
                    <Button
                      label="Cancel"
                      size="sm"
                      onPress={() => setEditingTemplate(false)}
                      disabled={busy}
                      style={styles.buttonFlex}
                    />
                  </View>
                </>
              ) : (
                <>
                <Button
                  label="Edit Fine Print Template"
                  size="sm"
                  onPress={() => {
                    setTemplateInput(templateText ?? '');
                    setEditingTemplate(true);
                  }}
                  disabled={busy}
                  style={styles.action}
                />
                <Button
                  label="Reset to default"
                  size="sm"
                  onPress={() => {
                    void resetTemplate();
                  }}
                  disabled={busy}
                  style={styles.action}
                />
                </>
              )}
            </>
          ) : (
            <Text style={styles.note}>{(estimate?.finePrint ?? '').trim() !== '' ? estimate?.finePrint : templateText ?? ''}</Text>
          )}
        </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.heading}>Payment Outlay</Text>
          <ListItem title="Materials" subtitle={formatCurrency(totals.materials)} />
          <ListItem title="Labor" subtitle={formatCurrency(totals.labor)} />
          <ListItem title="Other" subtitle={formatCurrency(totals.other)} />
          <ListItem title="Total" subtitle={formatCurrency(totals.total)} />
        </Card>

        {estimate?.pdfDelivery ? (
          <Button
            label="Print / Save as PDF"
            size="sm"
            onPress={handlePrint}
            disabled={Platform.OS !== 'web'}
            style={styles.action}
          />
        ) : null}

        {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
        {actionState.kind === 'done' ? <Text style={styles.note}>{actionState.message}</Text> : null}
      </Root>
    </View>
  );
}

export default JobEstimateScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.sm,
  },
  card: {
    marginBottom: spacing.xs,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: 0,
  },
  itemList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  buttonFlex: {
    flex: 1,
  },
  cellLabel: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  cellValue: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: 160,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  linkRow: {
    marginBottom: spacing.xs,
  },
  field: {
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  editRow: {
    marginBottom: spacing.xs,
  },
  action: {
    marginBottom: spacing.xs,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  trackingField: {
    flex: 1,
  },
  trackingButton: {},
  tabNarrow: {
    flexGrow: 1,
    flexBasis: '30%',
  },
});
