/**
 * Price estimating screen — standalone planning/estimating scaffold.
 *
 * NOT the "Job planning details" screen at `./PlanningScreen.tsx` (job
 * picker -> model numbers/parts/measurements/instructions + photos). This
 * screen is a separate, unrelated admin tool: pick a service area, load the
 * org's active price sheet's rates, add line items (service+task + qty),
 * and see a running total price/time — an in-session estimating aid that
 * does not persist anything.
 *
 * Mirrors `PriceSheetCreateScreen.tsx`'s session-gate + flat useState +
 * View > ScrollView > Card layout, and structures the line-item
 * add/list/remove UI after `PriceSheetEditorScreen.tsx`'s Area Adjustments
 * section.
 *
 * Effective price/time per line: start from the matched `PriceSheetRate`'s
 * base `amount` / `timeEstimateMinutes`, then apply any
 * `PriceSheetAreaAdjustment` rows for the selected service area whose
 * `adjustmentTarget` matches ('price' adjusts amount, 'time' adjusts
 * minutes) using the same `percent` / `flat` convention as
 * `price-sheet-repo.ts`'s `PriceSheetAreaAdjustment` — percent adds
 * `base * (value / 100)`, flat adds `value` — then multiply by quantity.
 * Props-in/callbacks-out; no navigation logic in this screen.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Card, Button, ListItem, EmptyState, colors, spacing, typography } from '@jobcore/ui';
import type { PriceSheetRepository, ServiceArea } from '../data/ports';
import type { PriceSheetAreaAdjustment } from '../data/price-sheet-repo';
import type { PriceSheetRate, CalculationResult } from '../money/types';
import { getModuleSession } from '../lib/module-session';

export interface PriceEstimatingLine {
  id: string;
  rateId: string;
  taskId: string | null;
  quantity: number;
  effectiveUnitPrice: number;
  effectiveUnitMinutes: number;
  totalPrice: number;
  totalMinutes: number;
}

export interface PriceEstimatingScreenProps {
  priceSheets?: PriceSheetRepository;
  priceSheetRates?: {
    list: (priceSheetId: string) => Promise<CalculationResult<PriceSheetRate[]>>;
  };
  priceSheetAreaAdjustments?: {
    list: (priceSheetId: string, serviceAreaId?: string) => Promise<CalculationResult<PriceSheetAreaAdjustment[]>>;
  };
  serviceAreas?: ServiceArea[];
  onEstimateChange?: (estimate: {
    totalPrice: number;
    totalMinutes: number;
    lines: PriceEstimatingLine[];
  }) => void;
}

/** Applies one area adjustment to a base value using the `percent`/`flat` convention. */
function applyAdjustment(base: number, adjustment: PriceSheetAreaAdjustment): number {
  if (adjustment.adjustmentType === 'percent') {
    return base + base * (adjustment.adjustmentValue / 100);
  }
  return base + adjustment.adjustmentValue;
}

export function PriceEstimatingScreen({
  priceSheets,
  priceSheetRates,
  priceSheetAreaAdjustments,
  serviceAreas,
  onEstimateChange,
}: PriceEstimatingScreenProps) {
  const session = getModuleSession();

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [rates, setRates] = useState<PriceSheetRate[]>([]);
  const [areaAdjustments, setAreaAdjustments] = useState<PriceSheetAreaAdjustment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lineRateIdInput, setLineRateIdInput] = useState('');
  const [lineQuantityInput, setLineQuantityInput] = useState('1');
  const [lines, setLines] = useState<Array<{ id: string; rateId: string; quantity: number }>>([]);

  useEffect(() => {
    if (!session || !priceSheets || !selectedAreaId) {
      return;
    }
    let cancelled = false;
    setLoadError(null);
    priceSheets
      .getActive(session.org.id)
      .then((sheet) => {
        if (cancelled) return;
        setActiveSheetId(sheet ? sheet.id : null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load the active price sheet.';
          setLoadError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, priceSheets, selectedAreaId]);

  useEffect(() => {
    if (!priceSheetRates || !activeSheetId) {
      setRates([]);
      return undefined;
    }
    let cancelled = false;
    priceSheetRates
      .list(activeSheetId)
      .then((result) => {
        if (!cancelled) {
          if (result.ok) {
            setRates(result.value);
          } else {
            setLoadError(result.reason);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load rates.';
          setLoadError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [priceSheetRates, activeSheetId]);

  useEffect(() => {
    if (!priceSheetAreaAdjustments || !activeSheetId || !selectedAreaId) {
      setAreaAdjustments([]);
      return undefined;
    }
    let cancelled = false;
    priceSheetAreaAdjustments
      .list(activeSheetId, selectedAreaId)
      .then((result) => {
        if (!cancelled) {
          if (result.ok) {
            setAreaAdjustments(result.value);
          } else {
            setLoadError(result.reason);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load area adjustments.';
          setLoadError(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [priceSheetAreaAdjustments, activeSheetId, selectedAreaId]);

  const computedLines: PriceEstimatingLine[] = lines.map((line) => {
    const rate = rates.find((r) => r.id === line.rateId);
    const baseAmount = rate?.amount ?? 0;
    const baseMinutes = rate?.timeEstimateMinutes ?? 0;

    const effectiveUnitPrice = areaAdjustments
      .filter((adjustment) => adjustment.serviceAreaId === selectedAreaId && adjustment.adjustmentTarget === 'price')
      .reduce((value, adjustment) => applyAdjustment(value, adjustment), baseAmount);

    const effectiveUnitMinutes = areaAdjustments
      .filter((adjustment) => adjustment.serviceAreaId === selectedAreaId && adjustment.adjustmentTarget === 'time')
      .reduce((value, adjustment) => applyAdjustment(value, adjustment), baseMinutes);

    return {
      id: line.id,
      rateId: line.rateId,
      taskId: rate?.taskId ?? null,
      quantity: line.quantity,
      effectiveUnitPrice,
      effectiveUnitMinutes,
      totalPrice: effectiveUnitPrice * line.quantity,
      totalMinutes: effectiveUnitMinutes * line.quantity,
    };
  });

  const totalPrice = computedLines.reduce((sum, line) => sum + line.totalPrice, 0);
  const totalMinutes = computedLines.reduce((sum, line) => sum + line.totalMinutes, 0);

  useEffect(() => {
    onEstimateChange?.({ totalPrice, totalMinutes, lines: computedLines });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPrice, totalMinutes, JSON.stringify(computedLines)]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Price Estimating" message="Sign in to build a price estimate." />
      </View>
    );
  }

  function handleAddLine(): void {
    const quantity = Number(lineQuantityInput);
    if (!lineRateIdInput || !Number.isFinite(quantity) || quantity <= 0) return;
    setLines((prev) => [
      ...prev,
      { id: `${lineRateIdInput}-${Date.now()}`, rateId: lineRateIdInput, quantity },
    ]);
    setLineRateIdInput('');
    setLineQuantityInput('1');
  }

  function handleRemoveLine(id: string): void {
    setLines((prev) => prev.filter((line) => line.id !== id));
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>Price Estimating</Text>

          <Text style={styles.label}>Service area</Text>
          {serviceAreas && serviceAreas.length > 0 ? (
            <View style={styles.action}>
              {serviceAreas.map((area) => (
                <Button
                  key={area.id}
                  label={area.name}
                  variant={selectedAreaId === area.id ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => setSelectedAreaId(area.id)}
                  style={styles.action}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.note}>No service areas available.</Text>
          )}

          {loadError && <Text style={styles.errorText}>{loadError}</Text>}
        </Card>

        {selectedAreaId ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Line Items</Text>

            {computedLines.length > 0
              ? computedLines.map((line) => (
                  <ListItem
                    key={line.id}
                    title={line.taskId ?? line.rateId}
                    subtitle={`Qty ${line.quantity} · ${line.totalPrice.toFixed(2)} · ${line.totalMinutes} min`}
                    right={
                      <Button
                        label="Remove"
                        variant="outline"
                        size="sm"
                        onPress={() => handleRemoveLine(line.id)}
                      />
                    }
                  />
                ))
              : null}

            {rates.length > 0 ? (
              <View style={styles.action}>
                {rates.map((rate) => (
                  <Button
                    key={rate.id}
                    label={rate.taskId ?? rate.id}
                    variant={lineRateIdInput === rate.id ? 'primary' : 'outline'}
                    size="sm"
                    onPress={() => setLineRateIdInput(rate.id)}
                    style={styles.action}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.note}>No rates available for the active price sheet.</Text>
            )}

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={lineQuantityInput}
              onChangeText={setLineQuantityInput}
              placeholder="Quantity"
              placeholderTextColor={colors.textLight}
              keyboardType="numeric"
            />

            <Button
              label="Add line item"
              onPress={handleAddLine}
              disabled={!lineRateIdInput}
              style={styles.action}
            />
          </Card>
        ) : null}

        {selectedAreaId ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Estimate</Text>
            <ListItem title="Total price" subtitle={totalPrice.toFixed(2)} />
            <ListItem title="Total time" subtitle={`${totalMinutes} min`} />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default PriceEstimatingScreen;

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
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
  input: {
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  action: {
    marginBottom: spacing.sm,
  },
});
