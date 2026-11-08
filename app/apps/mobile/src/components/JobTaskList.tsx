// Shared job task list — single source of truth (job_plan_tasks). Used by Job Overview #0081, #0061, #0057, field detail.
// Mutations go through createJobPlanTasksRepository(), which already routes via writeThrough (offline queue).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PayrollButton, colors, Select, spacing, Text, TextField, typography } from '@jobcore/ui';
import type { JobPlanTaskRow, JobPlanTaskType, ServiceTaskCatalogEntry } from '../../../../modules/admin-finance/src/data/ports';
import { createJobPlanTasksRepository, createServiceTasksRepository } from '../lib/admin-finance-repos';
import { normalizeInstructionsUrl } from '../../../../modules/admin-finance/src/domain/normalize-instructions-url';
import { useSession } from '../lib/session';

export type JobTaskListProps = {
  jobId: string;
  mode: 'edit' | 'read';
  allowCatalog?: boolean;
  source?: 'plan' | 'prem' | 'estimate';
  onChange?: (tasks: JobPlanTaskRow[]) => void;
};

type TaskDraft = {
  qty: string; notes: string; unit: string; area: string; materials: string;
  type: string; sku: string; price: string; rate: string; extras: string;
  cName: string; cContact: string; cLicense: string;
};
const TYPE_OPTIONS = [
  { label: 'Assembly', value: 'assembly' },
  { label: 'Handyman', value: 'handyman' },
  { label: 'Appliance', value: 'appliance' },
  { label: 'Contractor', value: 'contractor' },
];
const money = (n: number | null | undefined) => (n == null ? '' : String(n));
const num = (t: string): number | null => {
  const n = Number(t);
  return t.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
// Assembly = flat price. Handyman / Appliance = hourly rate x expected hours + materials / parts.
export function taskTotal(type: string | null, price: number | null, rate: number | null, extras: number | null, minutes: number | null): number | null {
  if (type === 'assembly') return price;
  if (type === 'handyman' || type === 'appliance') {
    if (rate == null) return null;
    return Math.round((rate * ((minutes ?? 0) / 60) + (extras ?? 0)) * 100) / 100;
  }
  return null;
}
const UNIT_OPTIONS = ['ea', 'sq ft', 'lin ft', 'hr', 'set'].map((u) => ({ label: u, value: u }));
const toDraft = (r: JobPlanTaskRow): TaskDraft => ({
  qty: String(r.quantity),
  notes: r.notes ?? '',
  unit: r.unit ?? '',
  area: r.area ?? '',
  materials: r.materialsNote ?? '',
  type: r.taskType ?? '',
  sku: r.sku ?? '',
  price: money(r.price),
  rate: money(r.hourlyRate),
  extras: money(r.extrasCost),
  cName: r.contractorName ?? '',
  cContact: r.contractorContact ?? '',
  cLicense: r.contractorLicense ?? '',
});

export function JobTaskList({ jobId, mode, allowCatalog = false, source = 'plan', onChange }: JobTaskListProps) {
  const repo = useMemo(() => createJobPlanTasksRepository(), []);
  const session = useSession();
  const orgId = session.status === 'authenticated' ? session.organization.id : null;
  const [rows, setRows] = useState<JobPlanTaskRow[]>([]);
  const [catalog, setCatalog] = useState<ServiceTaskCatalogEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({}); // admin-typed instructions URL per job row (lives on the price-sheet task)
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ServiceTaskCatalogEntry | null>(null);
  // Scan-from-box (Job Overview #0081): a box SKU resolves to a price-sheet task, else a last-minute add pending HQ price approval.
  const [scanSku, setScanSku] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [scanMiss, setScanMiss] = useState(false);
  const [scanTitle, setScanTitle] = useState('');
  const [scanPrice, setScanPrice] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null); // two-tap delete on the row header
  const [open, setOpen] = useState<Record<string, boolean>>({}); // rolled-up rows show the title only (Jeff 2026-11-05)
  const edit = mode === 'edit';
  const isAdmin = session.status === 'authenticated' && (session.profile.role === 'owner' || session.profile.role === 'admin');
  const prem = source === 'prem'; // #0061 Prem Checklist: item sheet rows
  const search = prem || allowCatalog; // price-sheet search on #0061 and Job Overview

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
    if (!orgId) return; // catalog also feeds the price shown on every row
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
  }, [orgId, repo]);

  function openUrl(url: string) {
    // Hand off to the device: its default browser, PDF viewer or video app takes it.
    Linking.openURL(url).catch(() => setError('Could not open that link.'));
  }

  async function saveUrl(row: JobPlanTaskRow, cat: ServiceTaskCatalogEntry) {
    const raw = urlDrafts[row.id];
    if (raw === undefined) return;
    const next = normalizeInstructionsUrl(raw);
    setUrlDrafts((p) => { const { [row.id]: _x, ...rest } = p; return rest; });
    if ((cat.instructionsUrl ?? null) === next) return;
    setCatalog((c) => c.map((x) => (x.id === cat.id ? { ...x, instructionsUrl: next } : x)));
    await run(async () => {
      const res = await createServiceTasksRepository().updateServiceTask(cat.id, { instructionsUrl: next });
      if (res && (res as { ok?: boolean }).ok === false) throw new Error('Could not save the link.');
    }, 'Could not save the link.');
  }

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
      const added = await repo.addTask(jobId, id, 1);
      const entry = catalog.find((c) => c.id === id);
      // The optimistic row carries an empty title; name it from the price-sheet entry so it is never untitled.
      const row = added.title ? added : { ...added, title: entry?.name ?? 'Price-sheet task', name: entry?.name ?? added.name };
      const rate = entry?.rate;
      if (rate != null) {
        // Firm price = sheet rate x quantity, frozen on the task at drop time.
        const price = Math.round(rate * 100) / 100;
        await repo.updateTask(row.id, { price });
        apply([...rows, { ...row, price }]);
      } else apply([...rows, row]);
    }, 'Failed to add task.');

  const resetScan = () => {
    setScanSku('');
    setScanMiss(false);
    setScanTitle('');
    setScanPrice('');
  };

  // Typed or keyboard-wedge scanned SKU. Known SKU -> price-sheet task; unknown -> ask for a title and price.
  const lookupSku = (skuArg?: string) =>
    run(async () => {
      const sku = (skuArg ?? scanSku).trim();
      if (!sku) return;
      const hit = catalog.find((c) => (c.sku ?? '').trim().toLowerCase() === sku.toLowerCase());
      if (hit) {
        await addCatalog(hit.id);
        resetScan();
        return;
      }
      setScanMiss(true);
    }, 'Failed to look up SKU.');

  const openCamera = async () => {
    if (!camPerm?.granted) {
      const res = await requestCamPerm();
      if (!res.granted) return;
    }
    setCamOpen(true);
  };

  const onBarcode = (data: string) => {
    const code = data.trim();
    if (!code) return;
    setCamOpen(false);
    setScanSku(code);
    setScanMiss(false);
    void lookupSku(code);
  };

  const addScanned = () =>
    run(async () => {
      const sku = scanSku.trim();
      const title = scanTitle.trim();
      const price = num(scanPrice);
      if (!sku || !title || price == null) throw new Error('Enter a title and a price.');
      const row = await repo.addMiscTask(jobId, {
        title,
        taskType: 'assembly',
        sku,
        price,
        priceStatus: 'pending',
        source,
      });
      apply([...rows, row]);
      resetScan();
    }, 'Failed to add scanned task.');

  const approvePrice = (row: JobPlanTaskRow) =>
    run(async () => {
      if (!repo.approveTaskPrice) throw new Error('Approval is not available.');
      const price = num(drafts[row.id]?.price ?? '') ?? row.price ?? null;
      const id = await repo.approveTaskPrice(row.id, price);
      replaceRow(row.id, { priceStatus: 'approved', price, serviceTaskId: id, kind: 'price_sheet', billing: 'flat' });
    }, 'Failed to approve price.');

  const q = query.trim().toLowerCase();
  const matches = q ? catalog.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6) : [];

  const saveQty = (row: JobPlanTaskRow) =>
    run(async () => {
      const q = Number(drafts[row.id]?.qty);
      if (!(q > 0) || q === row.quantity) return;
      const rate = row.serviceTaskId && !row.taskType ? catalog.find((c) => c.id === row.serviceTaskId)?.rate : null;
      if (rate != null) {
        const price = Math.round(rate * q * 100) / 100;
        await repo.updateTask(row.id, { quantity: q, price });
        replaceRow(row.id, { quantity: q, price });
        return;
      }
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

  // Task type + its price fields (Prem Checklist #0061). Blank text clears the field.
  const saveType = (row: JobPlanTaskRow, over?: Partial<TaskDraft>) =>
    run(async () => {
      const d = { ...(drafts[row.id] ?? toDraft(row)), ...over };
      const patch = {
        taskType: (d.type || null) as JobPlanTaskType | null,
        sku: d.sku.trim() || null,
        price: num(d.price),
        hourlyRate: num(d.rate),
        extrasCost: num(d.extras),
        contractorName: d.cName.trim() || null,
        contractorContact: d.cContact.trim() || null,
        contractorLicense: d.cLicense.trim() || null,
      };
      const same = (Object.keys(patch) as (keyof typeof patch)[]).every((k) => patch[k] === (row[k] ?? null));
      if (same) return;
      await repo.updateTask(row.id, patch);
      replaceRow(row.id, patch);
    }, 'Failed to save task type.');

  const publish = (row: JobPlanTaskRow) =>
    run(async () => {
      if (!repo.publishAssemblyTask) throw new Error('Publishing is not available.');
      const id = await repo.publishAssemblyTask(row.id);
      replaceRow(row.id, { serviceTaskId: id, kind: 'price_sheet', billing: 'flat' });
    }, 'Failed to add to price sheet.');

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
    const total = taskTotal(d.type || null, num(d.price), num(d.rate), num(d.extras), row.estimatedMinutes);
    const typeLabel = TYPE_OPTIONS.find((o) => o.value === row.taskType)?.label;
    const typeSummary = typeLabel
      ? [typeLabel, row.sku, row.contractorName, row.contractorContact, row.contractorLicense ? `Lic ${row.contractorLicense}` : null,
         taskTotal(row.taskType, row.price, row.hourlyRate, row.extrasCost, row.estimatedMinutes) != null
           ? `$${taskTotal(row.taskType, row.price, row.hourlyRate, row.extrasCost, row.estimatedMinutes)}` : null]
          .filter((x) => !!x).join(' · ')
      : '';
    const expanded = !edit || !!open[row.id];
    const cat = row.serviceTaskId ? catalog.find((c) => c.id === row.serviceTaskId) : undefined;
    const typed = taskTotal(row.taskType, row.price, row.hourlyRate, row.extrasCost, row.estimatedMinutes);
    const priceNum = typed ?? (!row.taskType && row.price != null ? row.price : null) ?? (cat?.rate != null ? Math.round(cat.rate * (row.quantity || 1) * 100) / 100 : null);
    return (
      <View key={row.id} style={[styles.row, dim && styles.dim]}>
        <View style={styles.headWrap}>
        <Pressable
          style={[styles.head, styles.flex]}
          disabled={!edit}
          onPress={() => setOpen((p) => ({ ...p, [row.id]: !p[row.id] }))}
          accessibilityRole="button"
          accessibilityLabel={`${row.title}, ${expanded ? 'roll up' : 'roll down'}`}
          testID={`task-row-toggle-${row.id}`}
        >
          {edit ? <Text style={styles.arrow}>{expanded ? '▾' : '▸'}</Text> : null}
          <Text style={[styles.title, edit && styles.flex]} numberOfLines={edit && !expanded ? 1 : undefined}>{row.title}</Text>
          {priceNum != null ? <Text style={styles.notes}>{`$${priceNum}`}</Text> : null}
          {row.kind === 'misc' ? (
            <Text style={styles.badge}>Hourly · clock</Text>
          ) : (
            <Text style={styles.badge}>Qty {row.quantity}</Text>
          )}
        </Pressable>
        {edit ? (
          <PayrollButton
            label={confirmDel === row.id ? 'Confirm' : 'Delete'}
            onPress={() => {
              if (confirmDel === row.id) { setConfirmDel(null); void remove(row); } else setConfirmDel(row.id);
            }}
          />
        ) : null}
        </View>
        {expanded ? (
        <>
        {edit && !dim && row.kind !== 'misc' ? (
          <TextField inline dense label="Quantity" labelStyle={styles.lbl} keyboardType="number-pad" value={d.qty}
            onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, qty: t } }))}
            onBlur={() => void saveQty(row)} />
        ) : null}
        {edit && !dim && isAdmin && cat ? (
          <TextField inline dense label="URL" labelStyle={styles.lbl} placeholder="Instructions link" autoCapitalize="none" autoCorrect={false} keyboardType="url"
            value={urlDrafts[row.id] ?? cat.instructionsUrl ?? ''}
            onChangeText={(t) => setUrlDrafts((p) => ({ ...p, [row.id]: t }))}
            onBlur={() => void saveUrl(row, cat)} />
        ) : null}
        {edit && !dim && !prem ? (
          <TextField inline dense label="SKU" labelStyle={styles.lbl} value={d.sku}
            onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, sku: t } }))}
            onBlur={() => void saveType(row)} />
        ) : null}
        {edit && !dim ? (
          <TextField inline
            dense
            label="Notes"
            labelStyle={styles.lbl}
            placeholder="Notes"
            value={d.notes}
            onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, notes: t } }))}
            onBlur={() => void saveNotes(row)}
          />
        ) : row.notes ? (
          <Text style={styles.notes}>{row.notes}</Text>
        ) : null}
        {edit && !dim && !prem ? (() => {
          // Fixed vs hourly pricing on Job Overview. Amounts live inside the dropdown block (editable) and beside it (info).
          // Once a price is established only an admin can change it.
          const mode = d.type === 'assembly' ? 'fixed' : d.type === 'handyman' || d.type === 'appliance' ? 'hourly' : null;
          const established = row.taskType != null ? (row.price != null || row.hourlyRate != null) : row.price != null;
          const locked = established && !isAdmin;
          const info = mode === 'hourly'
            ? `Hourly $${num(d.rate) ?? 0}/hr x ${row.estimatedMinutes ?? 0} min${total != null ? ` = $${total}` : ''}`
            : mode === 'fixed' || row.price != null
              ? `Fixed $${num(d.price) ?? row.price ?? 0}`
              : 'No price set';
          return (
            <>
              <Text style={styles.notes}>{info}</Text>
              {locked ? null : (
                <>
                  <Select
                    compact
                    options={[{ label: 'Fixed price', value: 'assembly' }, { label: 'Hourly', value: 'handyman' }]}
                    value={mode === 'fixed' ? 'assembly' : mode === 'hourly' ? 'handyman' : (row.price != null ? 'assembly' : null)}
                    placeholder="Fixed or hourly"
                    onChange={(v) => {
                      setDrafts((p) => ({ ...p, [row.id]: { ...d, type: v ?? '' } }));
                      void saveType(row, { type: v ?? '' });
                    }}
                  />
                  {mode === 'hourly' ? (
                    <TextField inline dense label="Hourly rate $" labelStyle={styles.lbl} keyboardType="decimal-pad" value={d.rate}
                      onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, rate: t } }))}
                      onBlur={() => void saveType(row)} />
                  ) : (
                    <TextField inline dense label="Fixed Labor $" labelStyle={styles.lbl} keyboardType="decimal-pad" value={d.price}
                      onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, price: t } }))}
                      onBlur={() => void saveType(row)} />
                  )}
                </>
              )}
            </>
          );
        })() : null}
        {edit && !dim && prem ? (
          <>
            <Select
              compact
              options={TYPE_OPTIONS}
              value={d.type || null}
              placeholder="Type"
              onChange={(v) => {
                setDrafts((p) => ({ ...p, [row.id]: { ...d, type: v ?? '' } }));
                void saveType(row, { type: v ?? '' });
              }}
            />
            {d.type === 'assembly' && (
              <>
                <TextField inline dense placeholder="Name or SKU (video lookup)" value={d.sku}
                  onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, sku: t } }))}
                  onBlur={() => void saveType(row)} />
                <TextField inline dense placeholder="Flat rate price $" keyboardType="decimal-pad" value={d.price}
                  onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, price: t } }))}
                  onBlur={() => void saveType(row)} />
              </>
            )}
            {(d.type === 'handyman' || d.type === 'appliance') && (
              <>
                <TextField inline dense placeholder="Hourly rate $" keyboardType="decimal-pad" value={d.rate}
                  onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, rate: t } }))}
                  onBlur={() => void saveType(row)} />
                <TextField inline dense placeholder={d.type === 'handyman' ? 'Materials $' : 'Parts $'} keyboardType="decimal-pad" value={d.extras}
                  onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, extras: t } }))}
                  onBlur={() => void saveType(row)} />
              </>
            )}
            {d.type === 'contractor' && (
              <>
                <TextField inline dense placeholder="Contractor name" value={d.cName}
                  onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, cName: t } }))}
                  onBlur={() => void saveType(row)} />
                <TextField inline dense placeholder="Phone / email" value={d.cContact}
                  onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, cContact: t } }))}
                  onBlur={() => void saveType(row)} />
                <TextField inline dense placeholder="License #" value={d.cLicense}
                  onChangeText={(t) => setDrafts((p) => ({ ...p, [row.id]: { ...d, cLicense: t } }))}
                  onBlur={() => void saveType(row)} />
              </>
            )}
            {total != null && (
              <Text style={styles.notes}>
                {d.type === 'assembly' ? 'Flat' : `${row.estimatedMinutes ?? 0} min`} · Total ${total}
              </Text>
            )}
          </>
        ) : typeSummary ? (
          <Text style={styles.notes}>{typeSummary}</Text>
        ) : null}
        {edit && !dim ? null : detail ? (
          <Text style={styles.notes}>{detail}</Text>
        ) : null}
        {cat?.instructionsUrl ? (
          <Pressable onPress={() => openUrl(cat.instructionsUrl as string)} accessibilityRole="link" accessibilityLabel="Open instructions">
            <Text style={styles.link} numberOfLines={1}>Instructions ▸ {cat.instructionsUrl}</Text>
          </Pressable>
        ) : null}
        {row.priceStatus === 'pending' ? (
          <Text style={styles.notes}>Pending HQ approval{row.sku ? ` · SKU ${row.sku}` : ''}</Text>
        ) : null}
        {edit && (
          <View style={styles.actions}>
            {!dim && isAdmin && row.priceStatus === 'pending' && (
              <PayrollButton label="Approve price" onPress={() => void approvePrice(row)} />
            )}
            {!dim && <PayrollButton label="Defer" onPress={() => void defer(row)} />}
            {!dim && isAdmin && row.taskType === 'assembly' && !row.serviceTaskId && (
              <PayrollButton label="To price sheet" onPress={() => void publish(row)} />
            )}
            <PayrollButton label="Add" textStyle={{ fontWeight: '700' }} onPress={() => void addMisc()} />
          </View>
        )}
        </>
        ) : null}
      </View>
    );
  };

  const empty = active.length === 0 && deferred.length === 0;

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal visible={camOpen} animationType="slide" onRequestClose={() => setCamOpen(false)}>
        <View style={styles.camWrap}>
          <CameraView
            style={styles.camView}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'qr', 'datamatrix'] }}
            onBarcodeScanned={({ data }) => onBarcode(data)}
          />
          <View style={styles.actions}>
            <PayrollButton label="Cancel" onPress={() => setCamOpen(false)} />
          </View>
        </View>
      </Modal>
      {empty && !edit ? <Text style={styles.notes}>No tasks yet.</Text> : null}
      {active.map((r) => renderRow(r, false))}
      {deferred.length > 0 && (
        <>
          <Text style={styles.group}>Deferred</Text>
          {deferred.map((r) => renderRow(r, true))}
        </>
      )}
      {/* Assigned tasks first, then the price-sheet search and SKU scan (Jeff 2026-11-06, uber 83). */}
      {edit && search && (
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
      {edit && search && (
        <View style={styles.search}>
          <TextField inline dense placeholder="Scan box SKU" value={scanSku}
            onChangeText={(t) => { setScanSku(t); setScanMiss(false); }} />
          {scanMiss ? (
            <>
              <Text style={styles.notes}>SKU not on the price sheet. Add it last-minute; HQ approves the price.</Text>
              <TextField inline dense placeholder="Piece name" value={scanTitle} onChangeText={setScanTitle} />
              <TextField inline dense placeholder="Price $" keyboardType="decimal-pad" value={scanPrice} onChangeText={setScanPrice} />
              <View style={styles.actions}>
                <PayrollButton label="Cancel" onPress={resetScan} />
                <PayrollButton label="Add (pending HQ)" textStyle={{ fontWeight: '700' }} onPress={() => void addScanned()} />
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <PayrollButton label="Scan" onPress={() => void openCamera()} />
              <PayrollButton label="Find SKU" onPress={() => void lookupSku()} />
            </View>
          )}
        </View>
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
                {picked.instructionsUrl ? (
                  <Pressable onPress={() => openUrl(picked.instructionsUrl as string)} accessibilityRole="link">
                    <Text style={[styles.sheetText, styles.link]} numberOfLines={1}>Instructions ▸ {picked.instructionsUrl}</Text>
                  </Pressable>
                ) : null}
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
  camWrap: { flex: 1, backgroundColor: '#000' },
  camView: { flex: 1 },
  root: { gap: spacing.sm },
  row: { gap: spacing.xs, paddingVertical: spacing.xs },
  dim: { opacity: 0.5 },
  headWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontWeight: '600', color: colors.text },
  badge: { color: colors.textMutedDark, fontSize: typography.text.hint },
  notes: { color: colors.textMutedDark, fontSize: typography.text.hint },
  arrow: { fontSize: typography.text.title + 6, fontWeight: '600', color: colors.text },
  qty: { width: 80 },
  lbl: { width: 104 }, // same label column on every field so inputs line up across rows
  link: { color: colors.primary, fontSize: typography.text.hint, textDecorationLine: 'underline' },
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
