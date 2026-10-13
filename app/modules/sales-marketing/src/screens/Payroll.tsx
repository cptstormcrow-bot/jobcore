/**
 * Payroll — self-service payroll for Sales & Marketing staff.
 *
 * Thin wrapper over `PayrollHome` (`@jobcore/payroll-ui`) in `self` mode,
 * fed by the optional `getModulePorts().payroll` seam. When the host has
 * not injected a payroll port, a short placeholder renders instead.
 */

import * as React from 'react';
import { View } from 'react-native';
import { PayrollHome } from '@jobcore/payroll-ui';
import { Text } from '@jobcore/ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';

export function Payroll(): React.ReactElement {
  const session = useModuleSession();
  const payroll = getModulePorts().payroll;

  if (payroll === undefined || session === null) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Payroll is not available yet</Text>
      </View>
    );
  }

  return <PayrollHome mode="self" port={payroll} userId={session.userId} />;
}
