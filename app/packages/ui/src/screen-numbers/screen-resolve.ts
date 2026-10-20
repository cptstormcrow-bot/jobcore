export type RegistryEntry = {
  number: number;
  key: string;
  title: string;
  route: string | null;
  file: string;
  createdAt: string;
  subView?: string;
  retiredAt?: string;
  // number of the active entry a retired route now resolves to
  retiredInto?: number;
};

export function normalizePath(p: string): string {
  let s = p;
  const h = s.indexOf('#');
  if (h >= 0) s = s.slice(0, h);
  const q = s.indexOf('?');
  if (q >= 0) s = s.slice(0, q);
  const segs = s
    .split('/')
    .filter((x) => x !== '' && !(x.startsWith('(') && x.endsWith(')')));
  if (segs.length > 0 && segs[segs.length - 1] === 'index') segs.pop();
  return '/' + segs.join('/');
}

export function matchRoute(
  pattern: string,
  path: string,
): { matched: boolean; dynamicCount: number } {
  const ps = normalizePath(pattern).split('/').filter((x) => x !== '');
  const xs = normalizePath(path).split('/').filter((x) => x !== '');
  if (ps.length !== xs.length) return { matched: false, dynamicCount: 0 };
  let dynamicCount = 0;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i]!;
    if (a.length > 2 && a.startsWith('[') && a.endsWith(']')) {
      dynamicCount++;
    } else if (a !== xs[i]) {
      return { matched: false, dynamicCount: 0 };
    }
  }
  return { matched: true, dynamicCount };
}

// subView names collide across modules, so subViews are scoped by the module folder of their file.
export function scopeOf(file: string): string {
  const segs = file.split('/');
  const mi = segs.indexOf('modules');
  if (mi >= 0 && mi + 1 < segs.length) {
    const mod = segs[mi + 1];
    // payment-review's ReconciliationView renders inside the admin-finance shell (Review sub-view), so it shares that scope.
    return 'modules/' + (mod === 'payment-review' ? 'admin-finance' : mod);
  }
  const ai = segs.indexOf('app');
  if (ai >= 0 && segs[ai + 1] === 'job') return 'job-detail';
  return 'other:' + segs.slice(0, -1).join('/');
}

export function resolveScreen(
  pathname: string,
  registry: readonly RegistryEntry[],
  subView?: string | null,
): RegistryEntry | null {
  const active = registry.filter((e) => !e.retiredAt);
  const cands: { e: RegistryEntry; d: number }[] = [];
  for (const e of active) {
    if (typeof e.route !== 'string' || e.route === '') continue;
    const m = matchRoute(e.route, pathname);
    if (m.matched) cands.push({ e, d: m.dynamicCount });
  }
  let base = cands
    .filter((c) => !c.e.subView)
    .sort((a, b) => a.d - b.d || a.e.number - b.e.number)[0];
  if (!base) {
    // a retired route falls back to the active entry it was merged into
    for (const r of registry) {
      if (!r.retiredAt || r.retiredInto == null) continue;
      if (typeof r.route !== 'string' || r.route === '') continue;
      if (!matchRoute(r.route, pathname).matched) continue;
      const target = active.find((a) => a.number === r.retiredInto);
      if (target) {
        base = { e: target, d: 0 };
        break;
      }
    }
  }
  if (typeof subView === 'string' && subView !== '') {
    const hit = cands
      .filter((c) => c.e.subView === subView)
      .sort((a, b) => a.e.number - b.e.number)[0];
    if (hit) return hit.e;
    if (base) {
      const scope = scopeOf(base.e.file);
      const mod = active
        .filter((e) => e.subView === subView && scopeOf(e.file) === scope)
        .sort((a, b) => a.number - b.number)[0];
      if (mod) return mod;
    }
  }
  return base ? base.e : null;
}
