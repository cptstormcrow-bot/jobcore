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
import { EmptyState } from '@jobcore/ui';
import { PayrollHome } from '@jobcore/payroll-ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import { PayrollRunScreen } from './PayrollRunScreen';
import { PayrollSettingsScreen } from './PayrollSettingsScreen';

export interface PayrollScreenProps {
  onBack?: () => void;
  initialTab?: 'run' | 'settings';
  onOpenCompensationPolicy?: () => void;
}

export function PayrollScreen(props: PayrollScreenProps = {}) {
  const { initialTab } = props;
  const session = useModuleSession();
  const payroll = getModulePorts().payroll;

  if (!payroll || !session) {
    return (
      <View>
        <EmptyState title="Payroll is not available yet" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <PayrollHome
        mode="admin"
        port={payroll}
        userId={session.userId}
        initialTab={initialTab}
        renderRun={() => <PayrollRunScreen />}
        renderSettings={() => <PayrollSettingsScreen onOpenCompensationPolicy={props.onOpenCompensationPolicy} />}
      />
    </View>
  );
}
