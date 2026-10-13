// JobCore screen #0084 - ft-Payroll - Payroll
/**
 * Payroll screen for the field-tech module.
 *
 * Thin wrapper over the shared `PayrollHome` in self mode. The self-service
 * payroll port is host-supplied via `getModulePorts().payroll`; when absent
 * the screen shows a short placeholder instead of crashing.
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';

import { PayrollHome } from '@jobcore/payroll-ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { colors, Text } from '@jobcore/ui';

export function Payroll(): React.ReactElement {
  const session = getModuleSession();
  const { payroll } = getModulePorts();

  if (payroll === undefined || session === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Payroll is not available yet</Text>
      </View>
    );
  }

  return <PayrollHome mode="self" port={payroll} userId={session.userId} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  emptyText: { color: colors.textMutedDark },
});
