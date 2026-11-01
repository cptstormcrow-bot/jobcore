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
import { View, ScrollView, StyleSheet, Platform, Alert, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, DefaultTabBar, Select, TextField, colors, spacing, radius, typography, Text, EstimateStatusControl, JobHeaderBlock, JobTitleBarHeader, Checkbox } from '@jobcore/ui';
import { PayrollButton } from '@jobcore/ui';
import { extractZip, matchServiceAreaByZip } from '../domain/job-detail-helpers';
import { findCatalogDuplicate, isLineStale, taskToLineDraft } from '../lib/estimate-line-helpers';
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
  ServiceTaskCatalogEntry,
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
  onChrome?: (chrome: EstimateChrome | null) => void;
  /** Optional node rendered right-aligned under the Check UPS row in the first summary cell (e.g. a tech picker). */
  techSlot?: ReactNode;
  /** Host request to switch tabs; re-applied whenever `nonce` changes. */
  focusTab?: { tab: EstimateTab; nonce: number };
  /** Rendered at the top of the Tasks tab, before the first card. */
  beforePhotoSlot?: ReactNode;
}

export type EstimateTab = 'tasks' | 'contingency' | 'finePrint';

export const ESTIMATE_TABS: { id: EstimateTab; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'contingency', label: 'Contingencies' },
  { id: 'finePrint', label: 'Fine Print' },
];

/** Applies one area adjustment to a base DOLLAR value using the `percent`/`flat` convention.
 * `adjustment.adjustmentValue` is `Money` (integer cents) for a `'flat'` adjustment, so it is
 * converted to dollars before being added. */
function applyDollarAdjustment(baseDollars: number, adjustment: PriceSheetAreaAdjustment): number {
  if (adjustment.adjustmentType === 'percent') {
    return baseDollars + baseDollars * (adjustment.adjustmentValue / 100);
  }
  return baseDollars + adjustment.adjustmentValue / 100;
}

/** Chrome the screen publishes to its host: options-menu items plus the tab bar state the host renders when `embedded`. */
export interface EstimateChrome {
  optionsItems: MenuItem[];
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
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
  { label: 'Labor', value: 'labor' },
  { label: 'Material', value: 'material' },
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

  // Prem-investigation red flags, loaded once per job; load errors are ignored.
  const [redFlags, setRedFlags] = useState<{ marginal: boolean; undocumented: boolean; substandard: boolean; notes: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getModulePorts().investigations.getForJob(job.id).then((inv) => {
      if (cancelled || !inv) return;
      setRedFlags({ marginal: inv.redFlagMarginalEquipment, undocumented: inv.redFlagUndocumentedSystem, substandard: inv.redFlagSubstandardStart, notes: inv.redFlagNotes });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [job.id]);
  const redFlagLabels: string[] = [];
  if (redFlags?.marginal) redFlagLabels.push('marginal or failing equipment');
  if (redFlags?.undocumented) redFlagLabels.push('complicated undocumented existing system');
  if (redFlags?.substandard) redFlagLabels.push('substandard starting point (needs up to code)');

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [lineItems, setLineItems] = useState<JobEstimateLineItem[]>([]);
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [moving, setMoving] = useState(false);

  const [kindInput, setKindInput] = useState<EstimateLineItemKind>('labor');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [unitCostInput, setUnitCostInput] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescriptionInput, setEditDescriptionInput] = useState('');
  const [editQuantityInput, setEditQuantityInput] = useState('');
  const [editUnitCostInput, setEditUnitCostInput] = useState('');
  const [editUnitInput, setEditUnitInput] = useState('');
  const [editAreaInput, setEditAreaInput] = useState('');
  const [editMaterialsInput, setEditMaterialsInput] = useState('');

  const [linkCopied, setLinkCopied] = useState(false);
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

  const [allCatalog, setAllCatalog] = useState<ServiceTaskCatalogEntry[]>([]);
  const [pickedServiceTaskId, setPickedServiceTaskId] = useState<string | null>(null);
  const [saveToSheet, setSaveToSheet] = useState(true);
  const [sheetNotice, setSheetNotice] = useState<string | null>(null);
  const [canSaveToSheet, setCanSaveToSheet] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let repo: ReturnType<typeof getModulePorts>['jobPlanTasks'] | undefined;
    try {
      repo = getModulePorts().jobPlanTasks;
    } catch {
      repo = undefined;
    }
    if (!repo) {
      setAllCatalog([]);
      setCanSaveToSheet(false);
      return undefined;
    }
    setCanSaveToSheet(typeof estimates.saveLineToPriceSheet === 'function');
    repo
      .listCatalogTasks(job.organizationId)
      .then((rows) => {
        if (!cancelled) setAllCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) setAllCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [job.organizationId, estimates]);
  const assemblyCatalog = allCatalog.filter((c) => (c.category ?? '').trim().toLowerCase() === 'assembly');
  function handleAssemblyPick(id: string | null): void {
    setPickedServiceTaskId(id);
    if (!id) return;
    const row = assemblyCatalog.find((c) => c.id === id);
    if (!row) return;
    setKindInput('labor');
    setDescriptionInput(row.name);
    setQuantityInput('1');
    setUnitCostInput(row.rate != null ? String(row.rate) : '');
  }

  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [rates, setRates] = useState<PriceSheetRate[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaAdjustments, setAreaAdjustments] = useState<PriceSheetAreaAdjustment[]>([]);

  useEffect(() => {
    if (!props.priceSheets) {
      return;
    }
    let cancelled = false;
    props.priceSheets
      .getActive(job.organizationId)
      .then((sheet) => {
        if (!cancelled) setActiveSheetId(sheet ? sheet.id : null);
      })
      .catch(() => {
        // active price sheet load failure is non-fatal here
      });
    return () => {
      cancelled = true;
    };
  }, [props.priceSheets, job.organizationId]);

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
        }
      })
      .catch(() => {
        // rate load failure is non-fatal here
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
        }
      })
      .catch(() => {
        // area adjustment load failure is non-fatal here
      });
    return () => {
      cancelled = true;
    };
  }, [props.priceSheetAreaAdjustments, activeSheetId, selectedAreaId]);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    Promise.all([estimates.getForJob(job.id), estimates.listLineItems(job.id)])
      .then(([loadedEstimate, loadedLineItems]) => {
        if (cancelled) return;
        setEstimate(loadedEstimate);
        setTrackingInput(loadedEstimate?.trackingNumber ?? '');
        setFinePrintInput(loadedEstimate?.finePrint ?? '');
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
  const [finePrintInput, setFinePrintInput] = useState('');
  const [templateText, setTemplateText] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [templateInput, setTemplateInput] = useState('');
  const [activeTab, setActiveTab] = useState<EstimateTab>('tasks');
  const focusTabNonce = props.focusTab?.nonce;
  useEffect(() => {
    if (props.focusTab) setActiveTab(props.focusTab.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTabNonce]);
  const [materialsOnsiteLocal, setMaterialsOnsiteLocal] = useState<boolean | null>(null);
  const materialsInFlight = useRef(false);

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

  // The list renders from the saved estimate; the form below it adds or edits one row at a time.
  // contingencyForm.index: null = adding a new row, number = editing that saved row.
  const [contingencyForm, setContingencyForm] = useState<{ index: number | null; description: string; priceText: string }>({ index: null, description: '', priceText: '' });

  function resetContingencyForm(): void {
    setContingencyForm({ index: null, description: '', priceText: '' });
  }

  function editContingency(index: number): void {
    const c = (estimate?.contingencies ?? [])[index];
    if (!c) return;
    setContingencyForm({ index, description: c.description, priceText: c.price === null ? '' : String(c.price) });
  }

  function saveContingencyForm(): void {
    const current = estimate?.contingencies ?? [];
    const [built] = toContingencies([{ description: contingencyForm.description, priceText: contingencyForm.priceText }]);
    if (!built) return;
    const idx = contingencyForm.index;
    const next =
      idx !== null && current[idx]
        ? current.map((c, i) => (i === idx ? { ...built, applies: c.applies } : c))
        : [...current, { ...built, applies: true }];
    void persist({ contingencies: next });
    resetContingencyForm();
  }

  function toggleContingencyApplies(index: number, applies: boolean): void {
    const current = estimate?.contingencies ?? [];
    void persist({ contingencies: current.map((c, i) => (i === index ? { ...c, applies } : c)) });
  }

  function removeContingency(index: number): void {
    const current = estimate?.contingencies ?? [];
    void persist({ contingencies: current.filter((_, i) => i !== index) });
    if (contingencyForm.index === index) resetContingencyForm();
    else if (contingencyForm.index !== null && contingencyForm.index > index) setContingencyForm((f) => ({ ...f, index: (f.index ?? 1) - 1 }));
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
  const totalText = formatMoney(layoutTotals.total);
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
      ...(pickedServiceTaskId ? { serviceTaskId: pickedServiceTaskId } : {}),
    };
    setActionState({ kind: 'working' });
    setSheetNotice(null);
    try {
      if (!estimate) await persist({ status: 'draft' });
      const added = await estimates.addLineItem(job.id, draft);
      setLineItems((prev) => [...prev, added]);
      setDescriptionInput('');
      setQuantityInput('1');
      setUnitCostInput('');
      setPickedServiceTaskId(null);
      setActionState({ kind: 'done', message: 'Line item added.' });
      if (
        saveToSheet &&
        canSaveToSheet &&
        !pickedServiceTaskId &&
        unitCost !== 0 &&
        draft.description.length >= 3 &&
        !findCatalogDuplicate(allCatalog, draft.description)
      ) {
        try {
          await estimates.saveLineToPriceSheet(added.id);
        } catch {
          setSheetNotice('Line added, but it could not be saved to the price sheet.');
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not add the line item.';
      setActionState({ kind: 'failed', message });
    }
  }

  // Display-only: stored area first, else ZIP match on the address. Never persisted.
  const resolvedServiceArea =
    (props.serviceAreas ?? []).find((a) => a.id === job.service_area_id) ??
    matchServiceAreaByZip(props.serviceAreas ?? [], extractZip(job.address), job.address);

  async function handleBuildFromTasks(): Promise<void> {
    let buildAdjustments: PriceSheetAreaAdjustment[] = [];
    if (resolvedServiceArea && props.priceSheets && props.priceSheetAreaAdjustments) {
      try {
        const sheet = await props.priceSheets.getActive(job.organizationId);
        if (sheet) {
          const adjResult = await props.priceSheetAreaAdjustments.list(sheet.id, resolvedServiceArea.id);
          if (adjResult.ok) buildAdjustments = adjResult.value;
        }
      } catch {
        buildAdjustments = [];
      }
    }
    const linked = new Set(lineItems.map((i) => i.jobPlanTaskId).filter((v): v is string => !!v));
    const priceSheetTasks = visibleTasks.filter((t) => !!t.serviceTaskId && !linked.has(t.id));
    const miscTasks = visibleTasks.filter((t) => !t.serviceTaskId && !linked.has(t.id));
    const hasLegacyMiscFold = lineItems.some((i) => i.description.startsWith('Hourly — billed by clock'));
    const drafts: JobEstimateLineItemDraft[] = priceSheetTasks.map((t) => {
      const unitCost = buildAdjustments
        .filter((adjustment) => adjustment.serviceAreaId === resolvedServiceArea?.id)
        .reduce((value, adjustment) => applyDollarAdjustment(value, adjustment), t.rate ?? 0);
      const base = taskToLineDraft(t);
      return {
        ...base,
        unitCost,
        lineTotal: base.quantity * unitCost,
        jobPlanTaskId: t.id,
        serviceTaskId: t.serviceTaskId,
      };
    });
    if (!hasLegacyMiscFold) {
      for (const t of miscTasks) {
        const quantity = t.quantity > 0 ? t.quantity : 1;
        const mins = t.estimatedMinutes ? ` (${t.estimatedMinutes} min)` : '';
        drafts.push({
          kind: 'labor',
          description: `${t.title}${mins}`,
          quantity,
          unit: t.unit ?? 'hr',
          unitCost: 0,
          lineTotal: 0,
          jobPlanTaskId: t.id,
        });
      }
    }
    if (drafts.length === 0) {
      setActionState({ kind: 'done', message: 'Every task already has a line.' });
      return;
    }
    setActionState({ kind: 'working' });
    try {
      if (!estimate) await persist({ status: 'draft' });
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
    setEditUnitInput(item.unit ?? '');
    setEditAreaInput(item.area ?? '');
    setEditMaterialsInput(item.materialsNote ?? '');
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditDescriptionInput('');
    setEditQuantityInput('');
    setEditUnitCostInput('');
    setEditUnitInput('');
    setEditAreaInput('');
    setEditMaterialsInput('');
  }

  function readEditDraft(): { description: string; quantity: number; unitCost: number } | null {
    const quantity = Number(editQuantityInput);
    const unitCost = Number(editUnitCostInput);
    if (!editDescriptionInput.trim() || Number.isNaN(quantity) || Number.isNaN(unitCost)) {
      setActionState({ kind: 'failed', message: 'Enter a valid description, quantity, and unit cost.' });
      return null;
    }
    return { description: editDescriptionInput.trim(), quantity, unitCost };
  }

  async function handleRefreshFromTask(item: JobEstimateLineItem): Promise<void> {
    const task = planTasks.find((t) => t.id === item.jobPlanTaskId);
    if (!task) return;
    const d = taskToLineDraft(task);
    setActionState({ kind: 'working' });
    try {
      const updated = await estimates.updateLineItem(item.id, {
        description: d.description,
        quantity: d.quantity,
        lineTotal: d.quantity * item.unitCost,
        serviceTaskId: d.serviceTaskId,
        unit: d.unit ?? null,
        area: d.area ?? null,
        materialsNote: d.materialsNote ?? null,
      });
      setLineItems((prev) => prev.map((existing) => (existing.id === updated.id ? { ...existing, ...updated } : existing)));
      setActionState({ kind: 'done', message: 'Line item refreshed from task.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not refresh the line item.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function saveEdit(item: JobEstimateLineItem, mode: 'overwrite' | 'clone' | 'catalog'): Promise<void> {
    const base = readEditDraft();
    if (!base) return;
    const { description, quantity, unitCost } = base;
    const extra = {
      unit: editUnitInput.trim() || null,
      area: editAreaInput.trim() || null,
      materialsNote: editMaterialsInput.trim() || null,
    };
    setActionState({ kind: 'working' });
    try {
      if (mode === 'catalog') {
        await estimates.updateLineItem(item.id, { description, quantity, unitCost, lineTotal: quantity * unitCost, ...extra });
        const res = await estimates.saveLineToPriceSheet(item.id);
        const refreshed = await estimates.listLineItems(job.id);
        setLineItems(refreshed);
        cancelEdit();
        setActionState({ kind: 'done', message: `Saved to price sheet as ${description}` });
        void res;
        return;
      }
      if (mode === 'clone') {
        const created = await estimates.saveLineAsNew(item.id, {
          kind: item.kind,
          description,
          quantity,
          unitCost,
          lineTotal: quantity * unitCost,
          jobPlanTaskId: null,
          serviceTaskId: item.serviceTaskId ?? null,
          originLineItemId: item.id,
          ...extra,
        });
        setLineItems((prev) => [...prev, created]);
        cancelEdit();
        setActionState({ kind: 'done', message: 'Saved as a new line.' });
        return;
      }
      const updated = await estimates.updateLineItem(item.id, {
        description,
        quantity,
        unitCost,
        lineTotal: quantity * unitCost,
        ...extra,
      });
      setLineItems((prev) => prev.map((existing) => (existing.id === updated.id ? { ...existing, ...updated } : existing)));
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
    setLinkCopied(false);
    setActionState({ kind: 'working' });
    try {
      const { url } = await estimates.issueShareLink(job.id);
      setLinkCopied(true);
      await Clipboard.setStringAsync(url);
      setActionState({ kind: 'done', message: 'Link copied to clipboard.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create a share link.';
      setShareError(message);
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
    if (next !== 'draft' && !lineItems.some((item) => item.kind === 'labor')) {
      return;
    }
    if (estimate && needsDownstreamWarning(estimate.status, next)) {
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
      let current: JobEstimate = estimate ?? (await estimates.upsertForJob(job.id, { status: 'draft' }));
      if (next === 'draft') {
        current = await estimates.upsertForJob(current.jobId, { status: 'draft' });
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
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const handleShareRef = useRef(handleShare);
  handleShareRef.current = handleShare;
  const chromeStatus = estimate?.status ?? null;
  const chromePdf = estimate?.pdfDelivery ?? false;
  const hasChrome = !!props.onChrome;
  useEffect(() => {
    const publish = onChromeRef.current;
    if (!publish) return undefined;
    const optionsItems: MenuItem[] = editable && chromeStatus
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
      optionsItems,
      tabs: ESTIMATE_TABS,
      activeTab,
      onTabChange: (key: string) => {
        setActiveTab(key as EstimateTab);
      },
    });
    return () => {
      onChromeRef.current?.(null);
    };
  }, [chromeStatus, chromePdf, editable, hasChrome, activeTab]);

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

  const tabBar = (
    <View testID="estimate-tab-bar">
      <DefaultTabBar
        tabs={ESTIMATE_TABS}
        activeId={activeTab}
        onChange={(key) => {
          setActiveTab(key as EstimateTab);
        }}
        rightSlot={
          <View style={styles.totalColumn}>
            <Text style={styles.totalLabel}>Total Estimate</Text>
            <Text style={styles.cellValue}>{totalText}</Text>
          </View>
        }
      />
    </View>
  );

  const Root = embedded ? View : ScrollView;
  const rootProps = embedded ? {} : { contentContainerStyle: styles.content };

  return (
    <View style={styles.screen}>
      {!embedded ? tabBar : null}
      <Root {...rootProps}>
        {!embedded && (
          <PayrollButton
            label={onBack ? 'Back to Job' : 'Estimate'}
            onPress={() => onBack?.()}
            disabled={!onBack}
            style={styles.action}
          />
        )}
        {!embedded && <ScreenTitle title="Estimate" />}
        <View style={styles.summaryRow} testID="estimate-summary-row">
          <View style={[styles.summaryCell, styles.summaryCellWide]}>
            <View style={styles.statusRow} testID="estimate-status-row">
            <View style={styles.statusControlWrap}>
            <EstimateStatusControl
              status={estimate?.status ?? 'draft'}
              allowed={
                editable
                  ? estimate
                    ? allowedEstimateMoves('admin', estimate.status)
                    : (['draft', 'submitted', 'approved'] as ReturnType<typeof allowedEstimateMoves>)
                  : []
              }
              readOnly={!editable}
              busy={moving}
              onSelect={(next) => {
                void handleMove(next);
              }}
              testID="estimate-status-control"
            />
            </View>
            <View style={styles.statusCenterGroup} testID="estimate-center-group">
              <View style={styles.linkRowHug} testID="estimate-link-row">
                <Pressable
                  testID="estimate-link-button"
                  accessibilityRole="button"
                  accessibilityLabel="Copy estimate link"
                  accessibilityState={{ disabled: busy || !linkEnabled }}
                  disabled={busy || !linkEnabled}
                  onPress={() => { void handleShare(); }}
                  style={[styles.linkChip, (busy || !linkEnabled) && styles.linkChipDisabled]}
                >
                  <Text style={styles.linkChipLabel}>{busy ? 'Working...' : 'Copy estimate link'}</Text>
                </Pressable>
                {!linkEnabled ? <Text style={styles.note}>{ESTIMATE_LABELS.linkAfterSubmit}</Text> : null}
                {linkCopied ? <Text style={styles.note}>Link copied</Text> : null}
                {shareError ? <ErrorState message={shareError} /> : null}
              </View>
              <View style={[styles.totalColumn, styles.statusCenterTotal]}>
                <Text style={styles.totalLabel}>Total Estimate</Text>
                <Text style={styles.cellValue}>{totalText}</Text>
              </View>
            </View>
            </View>
            <View style={styles.techColumns}>
            <View style={styles.techLeftCol}>
            {estimate?.status !== 'submitted' && estimate?.status !== 'approved' && !lineItems.some((item) => item.kind === 'labor') ? (
              <Text style={styles.blankHint} testID="estimate-blank-hint">
                Estimate is blank - fill it in.
              </Text>
            ) : null}
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
              <PayrollButton
                label={checkingUps ? 'Checking...' : 'Check UPS'}
                onPress={() => {
                  void runTrackingLookup(trackingInput);
                }}
                disabled={busy || checkingUps || !trackingInput.trim()}
                style={styles.trackingButton}
              />
            ) : null}
            </View>
            {trackingLine ? <Text style={styles.note}>{trackingLine}</Text> : null}
              <View>
                <Checkbox
                  label="Materials Onsite?"
                  variant="check"
                  checked={materialsOnsiteLocal ?? !!estimate?.materialsOnsite}
                  disabled={!editable}
                  onChange={(next) => {
                    if (materialsInFlight.current) return;
                    materialsInFlight.current = true;
                    setMaterialsOnsiteLocal(next);
                    void persist({ materialsOnsite: next }).finally(() => {
                      materialsInFlight.current = false;
                      setMaterialsOnsiteLocal(null);
                    });
                  }}
                />
              </View>
            </View>
            <View style={styles.techRightCol}>
              {props.techSlot}
            </View>
            </View>
          </View>
        </View>

        {activeTab === 'tasks' ? props.beforePhotoSlot : null}

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
          <Text style={styles.note} testID="estimate-service-area">
            {resolvedServiceArea
              ? `Service area: ${resolvedServiceArea.name} (auto from address)`
              : 'Not matched - standard pricing'}
          </Text>
          {visibleTasks.length > 0 ? (
            <View testID="estimate-task-list">
              <Text style={styles.heading}>Service tasks</Text>
              {visibleTasks.map((t) => (
                <ListItem
                  key={t.id}
                  title={t.title}
                  subtitle={t.kind === 'misc' ? 'Hourly · clock' : `Qty ${t.quantity}`}
                />
              ))}
              {editable ? (
                <PayrollButton
                  label={busy ? 'Building...' : 'Build from tasks'}
                  onPress={() => {
                    void handleBuildFromTasks();
                  }}
                  disabled={busy}
                  style={styles.action}
                />
              ) : null}
            </View>
          ) : null}
        </Card>
        ) : null}

        {activeTab === 'contingency' ? (
        <Card style={styles.card}>
          <Text style={styles.heading}>{ESTIMATE_LABELS.contingencies}</Text>
          <Text style={styles.note}>Possible extras. Only rows with Applies on are included in the total.</Text>
          {(estimate?.contingencies ?? []).length === 0 ? (
            <Text style={styles.note}>None.</Text>
          ) : (
            (estimate?.contingencies ?? []).map((c, index) => (
              <View key={index} style={styles.editRow}>
                <ListItem
                  title={c.description}
                  subtitle={c.price !== null ? formatMoney(c.price) : 'No price'}
                />
                <Checkbox
                  label="Applies"
                  variant="check"
                  checked={c.applies === true}
                  disabled={!editable || busy}
                  onChange={(next) => toggleContingencyApplies(index, next)}
                />
                {editable ? (
                  <>
                    <PayrollButton label="Edit" onPress={() => editContingency(index)} disabled={busy} style={styles.action} />
                    <PayrollButton label="Delete" onPress={() => removeContingency(index)} disabled={busy} style={styles.action} />
                  </>
                ) : null}
              </View>
            ))
          )}
          {editable ? (
            <>
              <TextField
                label="Description"
                value={contingencyForm.description}
                onChangeText={(text) => setContingencyForm((f) => ({ ...f, description: text }))}
                disabled={busy}
                style={styles.field}
              />
              <TextField
                label="Price (optional)"
                value={contingencyForm.priceText}
                onChangeText={(text) => setContingencyForm((f) => ({ ...f, priceText: text }))}
                placeholder="0.00"
                disabled={busy}
                style={styles.field}
              />
              <PayrollButton
                label={contingencyForm.index === null ? 'Add contingency' : 'Save'}
                onPress={saveContingencyForm}
                disabled={busy || contingencyForm.description.trim() === ''}
                style={styles.action}
              />
              {contingencyForm.index !== null ? (
                <PayrollButton label="Cancel" onPress={resetContingencyForm} disabled={busy} style={styles.action} />
              ) : (
                <PayrollButton label="Add another" onPress={resetContingencyForm} disabled={busy} style={styles.action} />
              )}
            </>
          ) : null}
        </Card>
        ) : null}

        {activeTab === 'tasks' && redFlagLabels.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.note} testID="estimate-red-flag-banner">
              {`Prem investigation flagged: ${redFlagLabels.join(', ')}. Consider adding Contingencies.`}
            </Text>
            {(redFlags?.notes ?? '').trim() !== '' ? <Text style={styles.note}>{redFlags?.notes}</Text> : null}
          </Card>
        ) : null}

        {activeTab === 'tasks' ? (
        <Card style={styles.card}>
          <View style={styles.finePrintHeader}>
            <Text style={styles.sectionTitle}>{ESTIMATE_LABELS.tasks}</Text>
            <PayrollButton
              label="Add Task"
              testID="estimate-add-task"
              onPress={() => {
                void handleAddLineItem();
              }}
              disabled={busy}
            />
            {!pickedServiceTaskId && canSaveToSheet ? (
              <View style={styles.finePrintActions}>
                <Text style={styles.label}>Save to price sheet</Text>
                {([true, false] as const).map((on) => (
                  <PayrollButton
                    key={on ? 'on' : 'off'}
                    label={on ? 'On' : 'Off'}
                    onPress={() => setSaveToSheet(on)}
                    disabled={busy}
                    style={
                      saveToSheet === on
                        ? { borderBottomWidth: 2, borderBottomColor: colors.primary }
                        : undefined
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
          {activeTab === 'tasks' ? (
          <>
          {lineItems.length === 0 ? (
            <EmptyState title="No tasks" message="Add a task below." />
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
                  <TextField
                    label="Unit"
                    value={editUnitInput}
                    onChangeText={setEditUnitInput}
                    disabled={busy}
                    style={styles.field}
                  />
                  <TextField
                    label="Area"
                    value={editAreaInput}
                    onChangeText={setEditAreaInput}
                    disabled={busy}
                    style={styles.field}
                  />
                  <TextField
                    label="Materials note"
                    value={editMaterialsInput}
                    onChangeText={setEditMaterialsInput}
                    disabled={busy}
                    style={styles.field}
                  />
                  <View style={styles.actionRow}>
                    <PayrollButton
                      label={busy ? 'Saving...' : 'Save'}
                      onPress={() => {
                        void saveEdit(item, 'overwrite');
                      }}
                      disabled={busy}
                    />
                    <PayrollButton
                      label="Save as new line"
                      onPress={() => {
                        void saveEdit(item, 'clone');
                      }}
                      disabled={busy}
                    />
                    <PayrollButton
                      label="Save to sheet"
                      onPress={() => {
                        void saveEdit(item, 'catalog');
                      }}
                      disabled={busy}
                    />
                    <PayrollButton label="Cancel" onPress={cancelEdit} disabled={busy} />
                  </View>
                </View>
              ) : (
                <View key={item.id}>
                <ListItem
                  title={`${KIND_LABEL[item.kind]} — ${item.description}`}
                  subtitle={`${item.quantity} x ${formatCurrency(item.unitCost)} = ${formatCurrency(item.lineTotal)}`}
                  onPress={editable ? () => beginEdit(item) : undefined}
                  right={editable ? (
                    <PayrollButton
                      label="Remove"
                      onPress={() => {
                        void handleRemoveLineItem(item);
                      }}
                      disabled={busy}
                    />
                  ) : undefined}
                />
                {isLineStale(item, planTasks.find((t) => t.id === item.jobPlanTaskId)) ? (
                  <View style={styles.actionRow}>
                    <Text style={styles.staleBadge}>Task changed</Text>
                    {editable ? (
                      <PayrollButton
                        label="Refresh from task"
                        disabled={busy}
                        onPress={() => {
                          void handleRefreshFromTask(item);
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
                </View>
              ),
            )}
            </View>
          )}
          </>
          ) : null}

          {editable ? (
          <>

            <>
              {assemblyCatalog.length > 0 ? (
                <Select
                  label="Assembly labor"
                  value={pickedServiceTaskId}
                  options={assemblyCatalog.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={(value) => handleAssemblyPick(value as string | null)}
                  disabled={busy}
                  style={styles.field}
                />
              ) : null}
              <Select
                label="Type"
                value={kindInput}
                options={KIND_OPTIONS}
                onChange={(value) => setKindInput((value as EstimateLineItemKind) ?? 'labor')}
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
              {sheetNotice ? <Text style={styles.note}>{sheetNotice}</Text> : null}
            </>
          </>
          ) : null}
        </Card>
        ) : null}

        {activeTab === 'finePrint' ? (
        <Card style={styles.card}>
          <View style={styles.finePrintHeader}>
            <Text style={styles.heading}>{ESTIMATE_LABELS.finePrint}</Text>
            {editable && !editingTemplate ? (
              <View style={styles.finePrintActions}>
                <PayrollButton
                  label="Edit Template"
                  onPress={() => {
                    setTemplateInput(templateText ?? '');
                    setEditingTemplate(true);
                  }}
                  disabled={busy}
                />
                <PayrollButton
                  label="Reset to default"
                  onPress={() => {
                    void resetTemplate();
                  }}
                  disabled={busy}
                />
              </View>
            ) : null}
          </View>
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
                    <PayrollButton
                      label="Save template"
                      onPress={() => {
                        void saveTemplate();
                      }}
                      disabled={busy}
                    />
                    <PayrollButton
                      label="Cancel"
                      onPress={() => setEditingTemplate(false)}
                      disabled={busy}
                    />
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.note}>{(estimate?.finePrint ?? '').trim() !== '' ? estimate?.finePrint : templateText ?? ''}</Text>
          )}
        </Card>
        ) : null}

        {activeTab === 'tasks' && (
        <Card style={styles.card}>
          <Text style={styles.heading}>Payment Outlay</Text>
          <ListItem title="Materials" subtitle={formatCurrency(totals.materials)} />
          <ListItem title="Labor" subtitle={formatCurrency(totals.labor)} />
          <ListItem title="Other" subtitle={formatCurrency(totals.other)} />
          {layoutTotals.contingencyTotal > 0 ? (
            <ListItem title="Applied contingencies" subtitle={formatCurrency(layoutTotals.contingencyTotal)} />
          ) : null}
          <ListItem title="Total" subtitle={formatCurrency(layoutTotals.total)} />
        </Card>
        )}

        {estimate?.pdfDelivery ? (
          <PayrollButton
            label="Print / PDF"
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
    marginBottom: 2,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  buttonFlex: {
    flex: 1,
  },
  finePrintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  finePrintActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
  statusControlWrap: { alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusCenterGroup: { flex: 1, minWidth: 0, flexShrink: 1, flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusCenterTotal: { marginLeft: spacing.sm },
  totalColumn: { alignItems: 'flex-end' },
  totalLabel: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: 0,
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: 160,
  },
  summaryCellWide: {
    flexBasis: '100%',
  },
  linkRowHug: { alignItems: 'center' },
  linkChip: {
    alignSelf: 'center',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.sandInactive,
  },
  linkChipDisabled: { borderColor: colors.border, opacity: 0.6 },
  linkChipLabel: {
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.label,
    color: colors.text,
  },
  field: {
    marginBottom: spacing.xs,
  },
  editRow: {
    marginBottom: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  staleBadge: {
    color: colors.warning,
  },
  action: {
    marginBottom: spacing.xs,
  },
  itemList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  blankHint: { color: colors.textMutedDark, fontSize: typography.size.small, paddingTop: 2 },
  trackingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  trackingField: {
    flex: 1,
  },
  trackingButton: {},
  techColumns: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    width: '100%',
    gap: spacing.xs,
  },
  techLeftCol: {
    flex: 1,
    minWidth: 0,
  },
  techRightCol: {
    flex: 1,
    minWidth: 0,
  },
});
