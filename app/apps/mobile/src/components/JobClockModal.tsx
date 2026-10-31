import React, { useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { PayrollButton, colors, spacing, radius, typography, Text } from '@jobcore/ui';

export type JobClockModalMode = 'choice' | 'reason' | 'confirm-next-day' | 'reset-confirm';

export type JobClockModalProps = {
  visible: boolean;
  onClose: () => void;
  elapsedLabel: string;
  isAdmin: boolean;
  onStopForReason: (reason: 'lunch' | 'materials') => Promise<void>;
  onEndForToday: () => Promise<void>;
  onReset: () => Promise<void>;
};

export function JobClockModal({
  visible,
  onClose,
  elapsedLabel,
  isAdmin,
  onStopForReason,
  onEndForToday,
  onReset,
}: JobClockModalProps) {
  const [mode, setMode] = useState<JobClockModalMode>('choice');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode('choice');
    setBusy(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleStopForReason = async (reasonCode: 'lunch' | 'materials') => {
    setBusy(true);
    try {
      await onStopForReason(reasonCode);
    } finally {
      handleClose();
    }
  };

  const handleEndForToday = async () => {
    setBusy(true);
    try {
      await onEndForToday();
    } finally {
      handleClose();
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      await onReset();
    } finally {
      handleClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {mode === 'choice' && (
            <>
              <Text style={styles.title}>Clock Actions</Text>
              <View style={styles.buttonColumn}>
                <PayrollButton label="Continue" onPress={handleClose} />
                <PayrollButton label="Stop clock" onPress={() => setMode('reason')} />
                {isAdmin ? (
                  <PayrollButton label="Reset" onPress={() => setMode('reset-confirm')} />
                ) : null}
              </View>
            </>
          )}

          {mode === 'reason' && (
            <>
              <Text style={styles.title}>Why are you stopping?</Text>
              <View style={styles.buttonColumn}>
                <PayrollButton
                  label="Lunch break"
                  onPress={() => handleStopForReason('lunch')}
                  disabled={busy}
                />
                <PayrollButton
                  label="Materials"
                  onPress={() => handleStopForReason('materials')}
                  disabled={busy}
                />
                <PayrollButton
                  label="Back the next day"
                  onPress={() => setMode('confirm-next-day')}
                  disabled={busy}
                />
              </View>
            </>
          )}

          {mode === 'confirm-next-day' && (
            <>
              <Text style={styles.title}>End Today's Session</Text>
              <Text style={styles.body}>
                {`This ends today's session. Total labor time so far: ${elapsedLabel}. Arriving again will resume the clock from this total.`}
              </Text>
              <View style={styles.buttonColumn}>
                <PayrollButton
                  label="Confirm"
                  onPress={handleEndForToday}
                  disabled={busy}
                />
                <PayrollButton
                  label="Cancel"
                  onPress={() => setMode('reason')}
                  disabled={busy}
                />
              </View>
            </>
          )}

          {mode === 'reset-confirm' && (
            <>
              <Text style={styles.title}>Reset Clock?</Text>
              <Text style={styles.body}>This will reset the clock for this job.</Text>
              <View style={styles.buttonColumn}>
                <PayrollButton
                  label="Confirm"
                  onPress={handleReset}
                  disabled={busy}
                />
                <PayrollButton
                  label="Cancel"
                  onPress={() => setMode('choice')}
                  disabled={busy}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default JobClockModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.h6,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  buttonColumn: {
    gap: spacing.sm,
  },
});
