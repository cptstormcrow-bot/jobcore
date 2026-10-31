/**
 * #0043 multi-select picker box: "{n} {noun} chosen" box; tapping opens a popup with All / None
 * then one checkbox per item (each toggles independently). Chosen items list below in two
 * bullet columns with minimal vertical padding.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Checkbox, PayrollButton, Text, colors, radius, spacing, typography } from '@jobcore/ui';

export interface MultiPickItem { id: string; label: string }

export interface MultiPickBoxProps {
  items: MultiPickItem[];
  selectedIds: Set<string>;
  noun: string;
  onToggle: (id: string, next: boolean) => void;
  disabledIds?: Set<string>;
  /** Tap a chosen bullet below the box (e.g. to rename or delete it). */
  onItemPress?: (id: string) => void;
}

export function MultiPickBox({ items, selectedIds, noun, onToggle, disabledIds, onItemPress }: MultiPickBoxProps) {
  const [open, setOpen] = useState(false);
  const chosen = items.filter((i) => selectedIds.has(i.id));
  const allOn = items.length > 0 && chosen.length === items.length;
  const noneOn = chosen.length === 0;
  const isDisabled = (id: string) => disabledIds?.has(id) ?? false;
  const selectAll = () => items.forEach((i) => { if (!selectedIds.has(i.id) && !isDisabled(i.id)) onToggle(i.id, true); });
  const selectNone = () => items.forEach((i) => { if (selectedIds.has(i.id) && !isDisabled(i.id)) onToggle(i.id, false); });

  return (
    <View>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.box}>
        <Text style={styles.boxText}>{`${chosen.length} ${noun} chosen`}</Text>
        <Text style={styles.caret}>{'▾'}</Text>
      </Pressable>
      <View style={styles.list}>
        {chosen.map((i) => (
          onItemPress ? (
            <Pressable key={i.id} accessibilityRole="button" onPress={() => onItemPress(i.id)} style={styles.bulletCell}>
              <Text style={styles.bulletText}>{`• ${i.label}`}</Text>
            </Pressable>
          ) : (
            <Text key={i.id} style={styles.bullet}>{`• ${i.label}`}</Text>
          )
        ))}
      </View>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView style={styles.scroll}>
              <Checkbox label="All" checked={allOn} onChange={selectAll} style={styles.row} />
              <Checkbox label="None" checked={noneOn} onChange={selectNone} style={styles.row} />
              {items.map((i) => (
                <Checkbox
                  key={i.id}
                  label={i.label}
                  checked={selectedIds.has(i.id)}
                  onChange={(v) => onToggle(i.id, v)}
                  disabled={isDisabled(i.id)}
                  style={styles.row}
                />
              ))}
            </ScrollView>
            <View style={styles.doneRow}>
              <PayrollButton label="Done" onPress={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface,
  },
  boxText: { fontSize: typography.size.label, color: colors.text },
  caret: { fontSize: typography.size.label, color: colors.textLight },
  list: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  bullet: { width: '50%', fontSize: typography.size.small, lineHeight: 18, color: colors.text },
  bulletCell: { width: '50%' },
  bulletText: { fontSize: typography.size.small, lineHeight: 18, color: colors.text, textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  sheet: { width: '80%', maxWidth: 320, maxHeight: '80%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  scroll: { flexGrow: 0 },
  row: { minHeight: 36, borderBottomWidth: 1, borderBottomColor: colors.divider },
  doneRow: { alignItems: 'center', marginTop: spacing.sm },
});

export default MultiPickBox;
