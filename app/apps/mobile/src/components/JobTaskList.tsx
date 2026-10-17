// Shared job task list — single source of truth (job_plan_tasks). Used by Job Overview #0081, #0061, #0057, field detail.
// Mutations go through createJobPlanTasksRepository(), which already routes via writeThrough (offline queue).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, colors, Select, spacing, Text, TextField, typography } from '@jobcore/ui';
import type { JobPlanTaskRow, ServiceTaskCatalogEntry } from '../../../../modules/admin-finance/src/data/ports';
import { createJobPlanTasksRepository } from '../lib/admin-finance-repos';
import { useSession } from '../lib/session';

export type JobTaskListProps = {
  jobId: string;
  mode: 'edit' | 'read';
  allowCatalog?: boolean;
  source?: 'plan' | 'prem' | 'estimate';
  onChange?: (tasks: JobPlanTaskRow[]) => void;
};

export function JobTaskList({ jobId, mode, allowCatalog = false, source = 'plan', onChange }: JobTaskListProps) {
  const repo = useMemo(() => createJobPlanTasksRepository(), []);
  const session = useSession();
  const orgId = session.status === 'authenticated' ? session.organization.id : null;
  const [rows, setRows] = useState<JobPlanTaskRow[]>([]);
  const [catalog, setCatalog] = useState<ServiceTaskCatalogEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { qty: string; notes: string }>>({});
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const edit = mode === 'edit';

  const apply = useCallback(
    (next: JobPlanTaskRow[]) => {
      const sorted = [...next].sort((a, b) => a.sortOrder - b.sortOrder);
      setRows(sorted);
      setDrafts(Object.fromEntries(sorted.map((r) => [r.id, { qty: String(r.quantity), notes: r.notes ?? '' }])));
      onChange?.(sorted);
    },
    [onChange],
  );

  useEffect(() => {
    let cancelled = false;
    repo
      .listForJob(jobId)
      .then((r) => {
        if (!cancelled) apply(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load tasks.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, repo]);

  useEffect(() => {
    if (!edit || !allowCatalog || !orgId) return;
    let cancelled = false;
    repo
      .listCatalogTasks(orgId)
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [edit, allowCatalog, orgId, repo]);

  async function run(fn: () => Promise<void>, msg: string) {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : msg);
    }
  }

  const replaceRow = (id: string, patch: Partial<JobPlanTaskRow>) =>
    apply(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addMisc = () =>
    run(async () => {
      const title = newTitle.trim();
      if (!title) return;
      const mins = Number(newMinutes);
      const row = await repo.addMiscTask(jobId, {
        title,
        estimatedMinutes: newMinutes && mins > 0 ? mins : null,
        source,
      });
      apply([...rows, row]);
      setNewTitle('');
      setNewMinutes('');
    }, 'Failed to add task.');

  const addCatalog = (id: string) =>
    run(async () => {
      const row = await repo.addTask(jobId, id, 1);
      apply([...rows, row]);
    }, 'Failed to add task.');

  const saveQty = (row: JobPlanTaskRow) =>
    run(async () => {
      const q = Number(drafts[row.id]?.qty);
      if (!(q > 0) || q === row.quantity) return;
      await repo.updateTask(row.id, { quantity: q });
      replaceRow(row.id, { quantity: q });
    }, 'Failed to save quantity.');

  const saveNotes = (row: JobPlanTaskRow) =>
    run(async () => {
      const n = (drafts[row.id]?.notes ?? '').trim() || null;
      if (n === (row.notes ?? null)) return;
      await repo.updateTask(row.id, { notes: n });
      replaceRow(row.id, { notes: n });
    }, 'Failed to save notes.');

  const defer = (row: JobPlanTaskRow) =>
    run(async () => {
      await repo.deferTask(row.id);
      replaceRow(row.id, { status: 'deferred' });
    }, 'Failed to defer task.');

  const remove = (row: JobPlanTaskRow) =>
    run(async () => {
      await repo.removeTask(row.id);
      apply(rows.filter((r) => r.id !== row.id));
    }, 'Failed to remove task.');

  const active = rows.filter((r) => r.status !== 'deferred');
  const deferred = rows.filter((r) => r.status === 'deferred');

  const renderRow = (row: JobPlanTaskRow, dim: boolean) => {
    const d = drafts[row.id] ?? { qty: String(row.quantity), notes: row.notes ?? '' };
    return (
      <View key={row.id} style={[styles.row, dim && styles.dim]}>
        <View style={styles.head}>
          <Text style={styles.title}>{row.title}</Text>
          {row.kind === 'misc' ? (
            <Text style={styles.badge}>Hourly · clock</Text>
          ) : edit && !dim ? (
            <View style={styles.qty}>
              <TextField
                dense
                value={d.qty}
                onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, qty: t } }))}
                onBlur={() => void saveQty(row)}
              />
            </View>
          ) : (
            <Text style={styles.badge}>Qty {row.quantity}</Text>
          )}
        </View>
        {edit && !dim ? (
          <TextField
            dense
            placeholder="Notes"
            value={d.notes}
            onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, notes: t } }))}
            onBlur={() => void saveNotes(row)}
          />
        ) : row.notes ? (
          <Text style={styles.notes}>{row.notes}</Text>
        ) : null}
        {edit && (
          <View style={styles.actions}>
            {!dim && <Button label="Defer" size="sm" variant="outline" onPress={() => void defer(row)} />}
            <Button label="Remove" size="sm" variant="outline" onPress={() => void remove(row)} />
            <Button label="Add" size="sm" variant="primary" onPress={() => void addMisc()} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {edit && allowCatalog && (
        <Select
          compact
          options={catalog.map((t) => ({ label: t.name, value: t.id }))}
          value={null}
          placeholder="Add price-sheet task..."
          onChange={(id) => {
            if (id) void addCatalog(id);
          }}
        />
      )}
      {active.length === 0 && deferred.length === 0 ? <Text style={styles.notes}>No tasks yet.</Text> : null}
      {active.map((r) => renderRow(r, false))}
      {deferred.length > 0 && (
        <>
          <Text style={styles.group}>Deferred</Text>
          {deferred.map((r) => renderRow(r, true))}
        </>
      )}
      {edit && (
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <TextField dense placeholder="New task title" value={newTitle} onChangeText={setNewTitle} />
          </View>
          <Button label="Add" size="sm" variant="primary" onPress={() => void addMisc()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { gap: spacing.xs, paddingVertical: spacing.xs },
  dim: { opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontWeight: '600', color: colors.text },
  badge: { color: colors.textMutedDark, fontSize: typography.size.detail },
  notes: { color: colors.textMutedDark, fontSize: typography.size.detail },
  qty: { width: 64 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  group: { fontWeight: '600', marginTop: spacing.sm, color: colors.textMutedDark },
  error: { color: colors.danger },
});

export default JobTaskList;
