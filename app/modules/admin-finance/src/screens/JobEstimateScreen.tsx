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

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  Button,
  Card,
  ListItem,
  EmptyState,
  LoadingState,
  ErrorState,
  ScreenTitle,
  Select,
  TextField,
  colors,
  spacing,
  typography,
} from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import type {
  EstimateRepository,
  JobEstimate,
  JobEstimateLineItem,
  JobEstimateLineItemDraft,
  EstimateLineItemKind,
  PriceSheetRepository,
  ServiceArea,
} from '../data/ports';
import type { PriceSheetAreaAdjustment } from '../data/price-sheet-repo';
import type { PriceSheetRate, CalculationResult } from '../money/types';
import { getModulePorts } from '../lib/module-ports';

export interface JobEstimateScreenProps {
  job: Job;
  estimates?: EstimateRepository;
  onBack?: () => void;
  priceSheets?: PriceSheetRepository;
  priceSheetRates?: {
    list: (priceSheetId: string) => Promise<CalculationResult<PriceSheetRate[]>>;
  };
  priceSheetAreaAdjustments?: {
    list: (priceSheetId: string, serviceAreaId?: string) => Promise<CalculationResult<PriceSheetAreaAdjustment[]>>;
  };
  serviceAreas?: ServiceArea[];
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
  const { job, onBack } = props;
  const estimates = props.estimates ?? getModulePorts().estimates;

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [lineItems, setLineItems] = useState<JobEstimateLineItem[]>([]);
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button
          label={onBack ? 'Back to Job' : 'Estimate'}
          variant="outline"
          onPress={() => onBack?.()}
          disabled={!onBack}
          style={styles.action}
        />
        <ScreenTitle title="Estimate" />
        <Text style={styles.guidance}>
          Give the customer a number before you hang up. Submit once they accept.
        </Text>

        <Card style={styles.card}>
          <ListItem title="Status" subtitle={estimate?.status ?? 'draft'} />
          <ListItem title="Address" subtitle={job.address ?? 'No address on file'} />
          {job.description ? <ListItem title="Description" subtitle={job.description} /> : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Line Items</Text>
          {lineItems.length === 0 ? (
            <EmptyState title="No line items" message="Add a line item below." />
          ) : (
            lineItems.map((item) =>
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
                    onPress={() => {
                      void handleSaveEdit(item);
                    }}
                    disabled={busy}
                    style={styles.action}
                  />
                  <Button
                    label="Cancel"
                    variant="outline"
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
                  onPress={() => beginEdit(item)}
                  right={
                    <Button
                      label="Remove"
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        void handleRemoveLineItem(item);
                      }}
                      disabled={busy}
                    />
                  }
                />
              ),
            )
          )}

          <Text style={styles.subheading}>Add Line Item</Text>

          {priceSheetQuickAddAvailable ? (
            <View style={styles.action}>
              <Button
                label="Manual"
                variant={addMode === 'manual' ? 'primary' : 'outline'}
                size="sm"
                onPress={() => setAddMode('manual')}
                disabled={busy}
                style={styles.action}
              />
              <Button
                label="From Price Sheet"
                variant={addMode === 'priceSheet' ? 'primary' : 'outline'}
                size="sm"
                onPress={() => setAddMode('priceSheet')}
                disabled={busy}
                style={styles.action}
              />
            </View>
          ) : null}

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
                onPress={() => {
                  void handleAddLineItem();
                }}
                disabled={busy}
                style={styles.action}
              />
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Payment Outlay</Text>
          <ListItem title="Materials" subtitle={formatCurrency(totals.materials)} />
          <ListItem title="Labor" subtitle={formatCurrency(totals.labor)} />
          <ListItem title="Other" subtitle={formatCurrency(totals.other)} />
          <ListItem title="Total" subtitle={formatCurrency(totals.total)} />
        </Card>

        <Button
          label={busy ? 'Working...' : 'Share Link'}
          onPress={() => {
            void handleShare();
          }}
          disabled={busy}
          style={styles.action}
        />
        {shareUrl ? <Text style={styles.note}>Link copied to clipboard: {shareUrl}</Text> : null}
        {shareError ? <ErrorState message={shareError} /> : null}

        <Button
          label="Print / Save as PDF"
          variant="outline"
          onPress={handlePrint}
          disabled={Platform.OS !== 'web'}
          style={styles.action}
        />

        {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
        {actionState.kind === 'done' ? <Text style={styles.note}>{actionState.message}</Text> : null}
      </ScrollView>
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
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  subheading: {
    color: colors.text,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  editRow: {
    marginBottom: spacing.sm,
  },
  action: {
    marginBottom: spacing.sm,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  guidance: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.md,
  },
});
