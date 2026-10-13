// JobCore screen #0088 - af-Payroll - Payroll
/**
 * Payroll screen — hosts the shared `PayrollHome` in admin mode.
 *
 * Reads the payroll port from `getModulePorts()`. If the host has not
 * injected one, renders a short message instead of crashing. The user id
 * comes from the module session.
 */

import React from 'react';
import { View } from 'react-native';
import { Button, EmptyState, Text } from '@jobcore/ui';
import { PayrollHome } from '@jobcore/payroll-ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';

export interface PayrollScreenProps {
  onBack?: () => void;
  onOpenRun?: () => void;
  onOpenSettings?: () => void;
}

export function PayrollScreen(props: PayrollScreenProps = {}) {
  const { onBack, onOpenRun, onOpenSettings } = props;
  const session = useModuleSession();
  const payroll = getModulePorts().payroll;

  if (!payroll || !session) {
    return (
      <View>
        <EmptyState title="Payroll is not available yet" />
        {onBack ? <Button label="Back" onPress={onBack} /> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {onBack ? <Button label="Back" onPress={onBack} /> : null}
      {onOpenRun ? <Button label="Payroll Run" onPress={onOpenRun} /> : null}
      {onOpenSettings ? <Button label="Payroll Settings" onPress={onOpenSettings} /> : null}
      <PayrollHome mode="admin" port={payroll} userId={session.userId} />
    </View>
  );
}
