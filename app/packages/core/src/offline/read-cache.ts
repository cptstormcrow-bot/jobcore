// Pure read-cache logic (no React Native imports).

export const READ_CACHE_FLOOR_MS = 2000;
export const READ_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const READ_CACHE_MAX_BYTES = 25 * 1024 * 1024;

export function stableStringify(v: unknown): string {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => stableStringify(x)).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

export function buildReadCacheKey(orgId: string, userId: string, queryName: string, params: unknown): string {
  return `${orgId}:${userId}:${queryName}:${stableStringify(params)}`;
}

const listeners = new Set<() => void>();
let revision = 0;
export const readCacheRevision = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  get(): number {
    return revision;
  },
  bump(): void {
    revision += 1;
    for (const cb of Array.from(listeners)) cb();
  },
};

export interface EvictionRow {
  key: string;
  fetched_at: number;
  bytes: number;
}

export function selectEvictions(
  rows: EvictionRow[],
  now: number,
  opts: { maxAgeMs: number; maxBytes: number } = { maxAgeMs: READ_CACHE_MAX_AGE_MS, maxBytes: READ_CACHE_MAX_BYTES },
): string[] {
  const out: string[] = [];
  const keep: EvictionRow[] = [];
  for (const r of rows) {
    if (now - r.fetched_at > opts.maxAgeMs) out.push(r.key);
    else keep.push(r);
  }
  let total = keep.reduce((s, r) => s + r.bytes, 0);
  keep.sort((a, b) => a.fetched_at - b.fetched_at);
  for (const r of keep) {
    if (total <= opts.maxBytes) break;
    out.push(r.key);
    total -= r.bytes;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OpPatchSpec<P = any, R = any> = { op: string; queries: string[]; patch(payload: P, rows: R[]): R[] };

const patchRegistry = new Map<string, OpPatchSpec[]>();

export function registerOpPatches(specs: OpPatchSpec[]): void {
  for (const s of specs) {
    const list = patchRegistry.get(s.op) ?? [];
    list.push(s);
    patchRegistry.set(s.op, list);
  }
}

export function getOpPatches(op: string): OpPatchSpec[] {
  return patchRegistry.get(op) ?? [];
}
