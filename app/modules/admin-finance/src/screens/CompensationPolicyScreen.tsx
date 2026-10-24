// JobCore screen #0093 - af-compensationPolicy - Compensation Policy
/**
 * Compensation policy screen (admin) — organization-wide pay defaults:
 * hourly rate, commission percent, Dev Tech default commission percent of labor and the
 * Prem Tech bonus (flat plus percent of job total).
 */

import React from 'react';
import { ScrollView, View } from 'react-native';
import { EmptyState, PayrollButton, Text, TextField } from '@jobcore/ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import { centsToDollarsText, parseMoneyToCents, parsePercent } from '../domain/parse-money';
import type { CompensationPolicyInput, Money } from '../money/types';

export function CompensationPolicyScreen({ onBack }: { onBack?: () => void }) {
  const session = useModuleSession();
  const port = getModulePorts().compensationPolicy;
  const orgId = session?.org.id;

  const [hourly, setHourly] = React.useState('');
  const [commission, setCommission] = React.useState('');
  const [devCommission, setDevCommission] = React.useState('');
  const [premFlat, setPremFlat] = React.useState('');
  const [premPct, setPremPct] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!port || !orgId) return;
    let alive = true;
    (async () => {
      try {
        const p = await port.getForOrganization(orgId);
        if (!alive) return;
        if (p) {
          setHourly(centsToDollarsText(p.hourlyRate as number));
          setCommission(String(p.commissionBasisPercent ?? ''));
          setDevCommission(
            p.devDefaultCommissionPercent != null ? String(p.devDefaultCommissionPercent) : '',
          );
          setPremFlat(p.premBonusFlat != null ? centsToDollarsText(p.premBonusFlat as number) : '');
          setPremPct(p.premBonusPercent != null ? String(p.premBonusPercent) : '');
        }
        setLoaded(true);
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Could not load compensation policy');
          setLoaded(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [port, orgId]);

  if (!port || !session || !orgId) {
    return (
      <View>
        <EmptyState title="Compensation policy is not available yet" />
        {onBack ? <PayrollButton label="Back" onPress={onBack} /> : null}
      </View>
    );
  }

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    setMessage(null);
    const z = (s: string) => (s.trim() === '' ? '0' : s);
    const h = parseMoneyToCents(z(hourly));
    if (h === null) return setError('Hourly rate must be a dollar amount like 25.00');
    const c = parsePercent(z(commission));
    if (c === null) return setError('Commission % must be a percent like 10 or 7.5');
    const d = parsePercent(z(devCommission), 50);
    if (d === null) {
      return setError('Dev Tech default commission % of labor must be a number from 0 to 50');
    }
    const pf = parseMoneyToCents(z(premFlat));
    if (pf === null) return setError('Prem Tech bonus flat must be a dollar amount like 50.00');
    const pp = parsePercent(z(premPct));
    if (pp === null) return setError('Prem Tech bonus percent must be a percent like 2 or 1.5');
    setError(null);
    const input: CompensationPolicyInput = {
      hourlyRate: h as Money,
      commissionBasisPercent: c,
      premBonusFlat: pf as Money,
      premBonusPercent: pp,
      devDefaultCommissionPercent: d,
    };
    return run(async () => {
      await port.upsertForOrganization(orgId, input);
    }, 'Policy saved.');
  };

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {onBack ? <PayrollButton label="Back" onPress={onBack} /> : null}
        <PayrollButton label="Save policy" disabled={busy || !loaded} onPress={save} />
      </View>
      <Text>Compensation Policy</Text>
      <Text>
        Dev Tech (assembly) pay is set per technician on the employee's Pay tab: hourly or
        commission. If a Dev Tech is paid by commission with no personal percent, the Dev Tech
        default commission % of labor below is used.
      </Text>
      <Text>Prem Tech bonus = the flat amount plus the percent of the job total.</Text>
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      {message ? <Text style={{ color: 'green' }}>{message}</Text> : null}

      <TextField label="Hourly rate ($/hr)" value={hourly} onChangeText={setHourly} />
      <TextField label="Commission %" value={commission} onChangeText={setCommission} />
      <TextField
        label="Dev Tech default commission % of labor (0-50)"
        value={devCommission}
        onChangeText={setDevCommission}
      />
      <Text>
        Used for Dev Tech employees paid by Commission who have no personal percent. Percent of
        the estimate's labor lines, not materials.
      </Text>
      <TextField label="Prem Tech bonus: flat ($)" value={premFlat} onChangeText={setPremFlat} />
      <TextField
        label="Prem Tech bonus: % of job total"
        value={premPct}
        onChangeText={setPremPct}
      />
    </ScrollView>
  );
}
