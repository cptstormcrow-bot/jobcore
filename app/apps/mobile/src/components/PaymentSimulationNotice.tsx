import React, { useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { Button, colors, spacing, typography, Text } from '@jobcore/ui';

export interface PaymentSimulationNoticeProps {
  visible: boolean;
  jobTotalLabel: string;
  customerName: string;
  invoiceAmountLabel: string;
  onAcknowledge: () => Promise<void>;
  onCancel: () => void;
}

export function PaymentSimulationNotice({
  visible,
  jobTotalLabel,
  customerName,
  invoiceAmountLabel,
  onAcknowledge,
  onCancel,
}: PaymentSimulationNoticeProps) {
  const [acknowledging, setAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await onAcknowledge();
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Confirm Payment</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer</Text>
            <Text style={styles.detailValue}>{customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Job Total</Text>
            <Text style={styles.detailValue}>{jobTotalLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice Amount</Text>
            <Text style={styles.detailValue}>{invoiceAmountLabel}</Text>
          </View>

          <Text style={styles.message}>
            This is a simulated confirmation. No real funds move — payment-provider integration is
            not yet live.
          </Text>

          <View style={styles.buttonRow}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={onCancel}
              disabled={acknowledging}
            />
            <Button
              label={acknowledging ? 'Acknowledging…' : 'Acknowledge & Mark Paid'}
              variant="primary"
              onPress={handleAcknowledge}
              disabled={acknowledging}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: typography.size.body,
  },
  detailValue: {
    color: colors.text,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body * typography.size.body,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});

export default PaymentSimulationNotice;
