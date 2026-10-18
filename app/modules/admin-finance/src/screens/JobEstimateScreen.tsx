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
import { Button, Card, ListItem, LoadingState, ErrorState, ScreenTitle, DefaultTabBar, Select, TextField, colors, spacing, radius, typography, Text, EstimateStatusControl, Checkbox } from '@jobcore/ui';
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
  ServiceArea,
} from '../data/ports';
import { getModulePorts } from '../lib/module-ports';
import { getModuleSession } from '../lib/module-session';
import { approveEstimate } from '../flows/approve-estimate';
import { submitEstimate } from '../flows/submit-estimate';

export interface JobEstimateScreenProps {
  job: Job;
  estimates?: EstimateRepository;
  onBack?: () => void;
  onEstimateChange?: (estimate: JobEstimate) => void;
  serviceAreas?: ServiceArea[];
  /** Inlined inside a host screen's own scroll view: suppresses the Back row and renders a plain `View` root instead of `ScrollView`. */
  embedded?: boolean;
  /** When false: read-only display (tech view); mutating controls are hidden. Default true. */
  editable?: boolean;
  /** Publishes the header-right status control and options-menu items to the host; null on unmount. */
  onChrome?: (chrome: EstimateChrome | null) => void;
  /** Optional node rendered right-aligned under the Check UPS row in the first summary cell (e.g. a tech picker). */
  techSlot?: ReactNode;
}

export type EstimateTab = 'contingency' | 'manual' | 'finePrint';

export const ESTIMATE_TABS: { id: EstimateTab; label: string }[] = [
  { id: 'contingency', label: 'Contingency' },
  { id: 'manual', label: 'Manual' },
  { id: 'finePrint', label: 'Fine Print' },
];

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
  { label: 'Material', value: 'material' },
  { label: 'Labor', value: 'labor' },
  { label: 'Other', value: 'other' },
];

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function JobEstimateScreen(props: JobEstimateScreenProps) {
  const { job, onBack, embedded } = props;
  const editable = props.editable ?? true;
  const estimates = props.estimates ?? getModulePorts().estimates;

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [lineItems, setLineItems] = useState<JobEstimateLineItem[]>([]);
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [moving, setMoving] = useState(false);

  const [kindInput, setKindInput] = useState<EstimateLineItemKind>('material');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [unitCostInput, setUnitCostInput] = useState('');

  const [linkCopied, setLinkCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

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
  const [activeTab, setActiveTab] = useState<EstimateTab>('contingency');

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
      optionsItems,
      tabs: ESTIMATE_TABS,
      activeTab,
      onTabChange: (key: string) => setActiveTab(key as EstimateTab),
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
        onChange={(key) => setActiveTab(key as EstimateTab)}
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
            <View style={styles.techColumns}>
            <View style={styles.techLeftCol}>
            <View style={styles.linkRow} testID="estimate-link-row">
              <Pressable
                testID="estimate-link-button"
                accessibilityRole="button"
                accessibilityLabel="Copy estimate link"
                accessibilityState={{ disabled: busy || !linkEnabled }}
                disabled={busy || !linkEnabled}
                onPress={() => {
                  void handleShare();
                }}
                style={[styles.linkChip, (busy || !linkEnabled) && styles.linkChipDisabled]}
              >
                <Text style={styles.linkChipLabel}>{busy ? 'Working...' : 'Copy estimate link'}</Text>
              </Pressable>
              {!linkEnabled ? <Text style={styles.note}>{ESTIMATE_LABELS.linkAfterSubmit}</Text> : null}
              {linkCopied ? <Text style={styles.note}>Link copied</Text> : null}
              {shareError ? <ErrorState message={shareError} /> : null}
            </View>
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
            {props.techSlot ? <View style={styles.techRightCol}>{props.techSlot}</View> : null}
            </View>
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
              disabled={!editable || busy}
              onChange={(next) => {
                void persist({ materialsOnsite: next });
              }}
            />
          </View>
        </View>

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

        {activeTab === 'manual' ? (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{ESTIMATE_LABELS.lineItems}</Text>

          {editable ? (
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
    marginBottom: 0,
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: 160,
  },
  linkRow: {
    marginTop: spacing.xs,
    marginBottom: 2,
    alignItems: 'stretch',
  },
  linkChip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
  action: {
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
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  techLeftCol: {
    flexGrow: 1,
    flexBasis: 200,
  },
  techRightCol: {
    flexGrow: 1,
    flexBasis: 200,
    alignItems: 'flex-start',
  },
});
