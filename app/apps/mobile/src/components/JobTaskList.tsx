// Shared job task list — single source of truth (job_plan_tasks). Used by Job Overview #0081, #0061, #0057, field detail.
// Mutations go through createJobPlanTasksRepository(), which already routes via writeThrough (offline queue).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PayrollButton, colors, Select, spacing, Text, TextField, typography } from '@jobcore/ui';
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

type TaskDraft = { qty: string; notes: string; unit: string; area: string; materials: string };
const UNIT_OPTIONS = ['ea', 'sq ft', 'lin ft', 'hr', 'set'].map((u) => ({ label: u, value: u }));
const toDraft = (r: JobPlanTaskRow): TaskDraft => ({
  qty: String(r.quantity),
  notes: r.notes ?? '',
  unit: r.unit ?? '',
  area: r.area ?? '',
  materials: r.materialsNote ?? '',
});

export function JobTaskList({ jobId, mode, allowCatalog = false, source = 'plan', onChange }: JobTaskListProps) {
  const repo = useMemo(() => createJobPlanTasksRepository(), []);
  const session = useSession();
  const orgId = session.status === 'authenticated' ? session.organization.id : null;
  const [rows, setRows] = useState<JobPlanTaskRow[]>([]);
  const [catalog, setCatalog] = useState<ServiceTaskCatalogEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ServiceTaskCatalogEntry | null>(null);
  const edit = mode === 'edit';
  const prem = source === 'prem'; // #0061 Prem Checklist: price-sheet search + item sheet

  const apply = useCallback(
    (next: JobPlanTaskRow[]) => {
      const sorted = [...next].sort((a, b) => a.sortOrder - b.sortOrder);
      setRows(sorted);
      setDrafts(Object.fromEntries(sorted.map((r) => [r.id, toDraft(r)])));
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
    if (!edit || !(allowCatalog || prem) || !orgId) return;
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
  }, [edit, allowCatalog, prem, orgId, repo]);

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

  const q = query.trim().toLowerCase();
  const matches = q ? catalog.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6) : [];

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

  const saveDetail = (row: JobPlanTaskRow, over?: Partial<TaskDraft>) =>
    run(async () => {
      const d = { ...(drafts[row.id] ?? toDraft(row)), ...over };
      const unit = d.unit.trim() || null;
      const area = d.area.trim() || null;
      const materialsNote = d.materials.trim() || null;
      if (unit === (row.unit ?? null) && area === (row.area ?? null) && materialsNote === (row.materialsNote ?? null)) return;
      await repo.updateTask(row.id, { unit, area, materialsNote });
      replaceRow(row.id, { unit, area, materialsNote });
    }, 'Failed to save task details.');

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
    const d = drafts[row.id] ?? toDraft(row);
    const detail = [row.area, row.unit, row.materialsNote].filter((x) => !!x).join(' · ');
    return (
      <View key={row.id} style={[styles.row, dim && styles.dim]}>
        <View style={styles.head}>
          <Text style={styles.title}>{row.title}</Text>
          {row.kind === 'misc' ? (
            <Text style={styles.badge}>Hourly · clock</Text>
          ) : edit && !dim ? (
            <View style={styles.qty}>
              <TextField inline
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
          <TextField inline
            dense
            placeholder="Notes"
            value={d.notes}
            onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, notes: t } }))}
            onBlur={() => void saveNotes(row)}
          />
        ) : row.notes ? (
          <Text style={styles.notes}>{row.notes}</Text>
        ) : null}
        {edit && !dim ? (
          <>
            <Select
              compact
              options={UNIT_OPTIONS}
              value={d.unit || null}
              placeholder="Unit"
              onChange={(u) => {
                setDrafts((p) => ({ ...p, [row.id]: { ...d, unit: u ?? '' } }));
                void saveDetail(row, { unit: u ?? '' });
              }}
            />
            <TextField inline
              dense
              placeholder="Area / room"
              value={d.area}
              onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, area: t } }))}
              onBlur={() => void saveDetail(row)}
            />
            <TextField inline
              dense
              placeholder="Materials"
              value={d.materials}
              onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, materials: t } }))}
              onBlur={() => void saveDetail(row)}
            />
          </>
        ) : detail ? (
          <Text style={styles.notes}>{detail}</Text>
        ) : null}
        {edit && (
          <View style={styles.actions}>
            {!dim && <PayrollButton label="Defer" onPress={() => void defer(row)} />}
            <PayrollButton label="Remove" onPress={() => void remove(row)} />
            <PayrollButton label="Add" textStyle={{ fontWeight: '700' }} onPress={() => void addMisc()} />
          </View>
        )}
      </View>
    );
  };

  const empty = active.length === 0 && deferred.length === 0;

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {edit && prem && (
        <View style={styles.search}>
          <TextField inline dense placeholder="Search price sheet" value={query} onChangeText={setQuery} />
          {matches.map((t) => (
            <Pressable key={t.id} onPress={() => setPicked(t)} accessibilityRole="button" style={styles.hit}>
              <Text style={styles.hitName} numberOfLines={1}>{t.name}</Text>
              {t.rate != null ? <Text style={styles.notes}>${t.rate}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
      {edit && !prem && allowCatalog && (
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
      {empty && !edit ? <Text style={styles.notes}>No tasks yet.</Text> : null}
      {active.map((r) => renderRow(r, false))}
      {deferred.length > 0 && (
        <>
          <Text style={styles.group}>Deferred</Text>
          {deferred.map((r) => renderRow(r, true))}
        </>
      )}
      {edit && (
        // While the list is empty the hint shares the add line, and drops once a task exists (Jeff 2026-11-03).
        <View style={styles.addRow}>
          {empty ? <Text style={styles.notes} numberOfLines={1}>No tasks yet.</Text> : null}
          <View style={styles.flex}>
            <TextField inline dense placeholder="New task title" value={newTitle} onChangeText={setNewTitle} />
          </View>
          <PayrollButton label="Add" textStyle={{ fontWeight: '700' }} onPress={() => void addMisc()} />
        </View>
      )}
      <Modal visible={!!picked} transparent animationType="slide" onRequestClose={() => setPicked(null)}>
        <Pressable style={styles.overlay} onPress={() => setPicked(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            {picked ? (
              <ScrollView>
                <Text style={styles.sheetTitle}>{picked.name}</Text>
                {picked.rate != null ? <Text style={styles.notes}>Rate: ${picked.rate}</Text> : null}
                {picked.details ? <Text style={styles.sheetText}>Details: {picked.details}</Text> : null}
                {picked.materials ? <Text style={styles.sheetText}>Materials: {picked.materials}</Text> : null}
              </ScrollView>
            ) : null}
            <PayrollButton
              label="Add"
              onPress={() => {
                const id = picked?.id;
                setPicked(null);
                if (id) void addCatalog(id);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { gap: spacing.xs, paddingVertical: spacing.xs },
  dim: { opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontWeight: '600', color: colors.text },
  badge: { color: colors.textMutedDark, fontSize: typography.text.hint },
  notes: { color: colors.textMutedDark, fontSize: typography.text.hint },
  qty: { width: 80 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  search: { gap: spacing.xs },
  hit: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  hitName: { flex: 1, color: colors.text, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, padding: spacing.sm, gap: spacing.sm, maxHeight: '60%' },
  sheetTitle: { fontWeight: '700', color: colors.text, fontSize: 14 },
  sheetText: { color: colors.text, fontSize: 14, marginTop: spacing.xs },
  group: { fontWeight: '600', marginTop: spacing.sm, color: colors.textMutedDark },
  error: { color: colors.danger, fontSize: typography.text.error },
});

export default JobTaskList;
