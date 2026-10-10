// STANDING RULE: every screen page in the inventory must show ID/Key and Kind in the top table,
// a light-gray claim side-box (redundant/missing claim + evidence) right of Titles/tags/endpoints
// when claims exist, and a wrapped components field.
// JobCore UI snapshot generator. Node ESM, no npm deps.
// Usage: node generate.mjs [--out <dir>] [--descriptions <path>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOB_FLOW_ORDER, JOB_BRANCH_ORDER, JOB_STATUS_COLORS, TOKENS, statusColor, cssVars, renderMockup, renderMiniNode, FRAME_CSS } from './render-mockup.mjs';

const VERSION = '0.4.0';
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; }
const outDir = path.resolve(arg('--out', path.resolve(here, '..')));
const descPath = path.resolve(arg('--descriptions', path.join(here, 'descriptions.json')));
fs.mkdirSync(outDir, { recursive: true });

const src = JSON.parse(fs.readFileSync(path.join(here, 'screens.json'), 'utf8'));

// ---------- screen-number registry (fail-closed) ----------
const registryPath = path.resolve(process.env.JOBCORE_SCREEN_REGISTRY || path.join(here, '..', '..', '..', '..', 'app', 'apps', 'mobile', 'src', 'screens', 'screen-registry.json'));
const registryRaw = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const registryEntries = Array.isArray(registryRaw) ? registryRaw : (registryRaw.entries || registryRaw.screens || []);
const registry = new Map(registryEntries.filter((e) => !e.retiredAt).map((e) => [e.key, e]));
{
  const screenKeys = new Set(src.screens.map((s) => s.key));
  const offenders = [];
  for (const k of screenKeys) if (!registry.has(k)) offenders.push(`screen key with no active registry entry: ${k}`);
  for (const k of registry.keys()) if (!screenKeys.has(k)) offenders.push(`active registry entry with no screen key: ${k}`);
  if (offenders.length) { console.error(`REGISTRY MISMATCH (${offenders.length}) vs ${registryPath}`); for (const o of offenders) console.error('  ' + o); process.exit(1); }
}
let descs = {};
if (fs.existsSync(descPath)) {
  try { descs = JSON.parse(fs.readFileSync(descPath, 'utf8')).descriptions || {}; } catch { descs = {}; }
}

const SPEC_STAGES = ['Greeting', 'DayList', 'Job Detail', 'StartChecklist', 'Completion', 'QR payment/review', 'Admin close-out', 'Ancillary'];
const MODULE_LANES = ['none', 'admin-finance', 'field-tech', 'sales-marketing', 'payment-review'];
const GENERATED_BY = `docs/snapshots/v${VERSION}/_tools/generate.mjs`;
const HOW_TO = 'Edit _tools/descriptions.json or re-run _tools/extract.mjs, then `node _tools/generate.mjs`. Never hand-edit the HTML.';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const numIndexHtml = `<section class="num-index"><h2>Screen number index</h2><table><thead><tr><th>#</th><th>key</th><th>title</th><th>route</th><th>file</th><th>created</th></tr></thead><tbody>${[...registry.values()].sort((a, b) => a.number - b.number).map((e) => `<tr><td>#${String(e.number).padStart(4, '0')}</td><td><code>${esc(e.key)}</code></td><td>${esc(e.title)}</td><td>${esc(e.route ?? '')}</td><td>${esc(e.file)}</td><td>${esc(String(e.createdAt ?? '').slice(0, 10))}</td></tr>`).join('')}</tbody></table></section>`;
// ---------- merge ----------
const base = [...src.screens].sort((a, b) => cmp(a.key, b.key));
const merged = base.map((s) => {
  const d = descs[s.key] || {};
  return {
    ...s,
    summary: d.summary || 'Description pending.',
    flowStage: d.flowStage || 'none',
    specStage: d.specStage || 'Ancillary',
    purpose: d.purpose || '',
    missing: d.missing || '',
    _descNav: Array.isArray(d.navTargets) ? d.navTargets : [],
  };
});
// flowRank
const grp = (s) => {
  const i = JOB_FLOW_ORDER.indexOf(s.flowStage);
  if (i >= 0) return [0, i];
  const j = JOB_BRANCH_ORDER.indexOf(s.flowStage);
  if (j >= 0) return [1, j];
  return [2, 0];
};
const rankSorted = [...merged].sort((a, b) => {
  const ga = grp(a), gb = grp(b);
  return (ga[0] - gb[0]) || (ga[1] - gb[1]) || cmp(String(a.module ?? ''), String(b.module ?? '')) || cmp(a.key, b.key);
});
const rankOf = new Map(rankSorted.map((s, i) => [s.key, i + 1]));

// ---------- edges ----------
const routeRegex = (r) => new RegExp('^' + String(r).split('/').map((seg) => (/^(\[.*\]|:.+)$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|\\]/g, '\\$&'))).join('/') + '$');
const routeScreens = merged.filter((s) => s.route);
function resolveRoute(t) {
  const exact = routeScreens.find((s) => s.route === t);
  if (exact) return exact;
  return routeScreens.find((s) => routeRegex(s.route).test(t)) || routeScreens.find((s) => /[\[:]/.test(t) && routeRegex(t).test(s.route));
}
function resolveSub(mod, t) { return merged.find((s) => s.module === mod && s.subView === t); }
const edgeMap = new Map();
function addEdge(from, to, kind, resolved) {
  const k = `${from}|${to}|${kind}|${resolved}`;
  if (!edgeMap.has(k)) edgeMap.set(k, { from, to, kind, resolved });
}
for (const s of merged) {
  for (const nt of s.navTargets || []) {
    const hit = nt.kind === 'subView' ? resolveSub(s.module, nt.target) : resolveRoute(nt.target);
    if (hit) addEdge(s.key, hit.key, nt.kind, true); else addEdge(s.key, nt.target, nt.kind, false);
  }
  for (const t of s._descNav) {
    const hit = resolveRoute(t) || resolveSub(s.module, t);
    if (hit) addEdge(s.key, hit.key, 'description', true); else addEdge(s.key, t, 'description', false);
  }
}
const edges = [...edgeMap.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.kind, b.kind));
const resolvedEdges = edges.filter((e) => e.resolved);
const outCount = new Map(), inCount = new Map();
for (const e of resolvedEdges) { outCount.set(e.from, (outCount.get(e.from) || 0) + 1); inCount.set(e.to, (inCount.get(e.to) || 0) + 1); }

// ---------- redundant ----------
const redundant = [];
const addR = (kind, key, claim, evidence) => redundant.push({ id: '', kind, key, claim, evidence });
const isUnm = (s) => s.mounted === false || s.mounted === 'exported-unmounted' || s.mounted === 'unknown';
for (const s of merged) {
  if (isUnm(s)) {
    const why = s.mounted === 'unknown' ? 'mount status could not be determined' : s.mounted === 'exported-unmounted' ? 'exported but never mounted in the app' : 'not mounted in the app';
    addR('unmounted', s.key, `Screen "${s.title || s.key}" is ${why}.`, `${s.key} · ${s.file} · mounted=${s.mounted}`);
  }
}
const pr = merged.find((s) => s.module === 'payment-review' && s.kind === 'module-root');
addR('module-switcher', pr ? pr.key : 'payment-review', 'The /m/payment-review module has no entry in the module switcher.', `${pr ? pr.key : 'payment-review'} · ${pr ? pr.file : 'n/a'} · switcher does not list payment-review`);
const jd = merged.find((s) => s.route === '/job/[jobId]');
if (jd) addR('undeclared-route', jd.key, 'The /job/[jobId] route file is not declared in the root Stack.', `${jd.key} · ${jd.file} · route file exists but root Stack has no matching Screen`);
const scrKinds = ['sub-view', 'drill-in', 'route'];
for (const s of merged) {
  if (s.mounted !== true || !scrKinds.includes(s.kind)) continue;
  if (!outCount.get(s.key)) addR('dead-end', s.key, `Screen "${s.title || s.key}" is a dead end: no outgoing navigation was resolved.`, `${s.key} · ${s.file} · 0 resolved outgoing edges`);
}
for (const s of merged) {
  if (s.mounted !== true || !scrKinds.includes(s.kind)) continue;
  const exempt = s.route === '/' || s.route === '/sign-in' || s.route === '/sign-up' || String(s.route || '').includes('(tabs)') || (s.menus || []).includes('tabs') && s.kind === 'route';
  if (!inCount.get(s.key) && !exempt) addR('not-navigable', s.key, `Screen "${s.title || s.key}" is not navigable: nothing links to it.`, `${s.key} · ${s.file} · 0 resolved inbound edges`);
}
redundant.forEach((r, i) => { r.id = 'R' + (i + 1); });
const refutedIds = JSON.parse(fs.readFileSync(path.join(here, 'refuted.json'), 'utf8'));
const refutedSet = new Set(refutedIds);
let refutedDropped = 0;
for (let i = redundant.length - 1; i >= 0; i--) if (refutedSet.has(redundant[i].id)) { redundant.splice(i, 1); refutedDropped++; }

// ---------- missing ----------
const missing = [];
for (const st of SPEC_STAGES.slice(0, 7)) {
  if (!merged.some((s) => s.mounted === true && s.specStage === st)) {
    const un = merged.filter((s) => s.specStage === st && s.mounted === 'exported-unmounted').map((s) => s.key);
    missing.push({ id: '', specStage: st, claim: `Spec stage ${st} has no mounted screen`, evidence: un.length ? `exported-unmounted: ${un.join(', ')}` : 'no screen found for this stage' });
  }
}
for (const s of merged) {
  const m = String(s.missing || '').trim();
  if (m) missing.push({ id: '', specStage: s.specStage, claim: m, evidence: `${s.key} · ${s.file}` });
}
missing.forEach((m, i) => { m.id = 'M' + (i + 1); });
for (let i = missing.length - 1; i >= 0; i--) if (refutedSet.has(missing[i].id)) { missing.splice(i, 1); refutedDropped++; }

// ---------- data model ----------
const screensOut = merged.map((s) => {
  const { _descNav, ...rest } = s;
  return {
    ...rest,
    flowRank: rankOf.get(s.key),
    anchor: 'screen-' + s.key,
    identifiers: { file: s.file, route: s.route, subView: s.subView, title: s.title, titleInSource: s.titleInSource, testIDs: s.testIDs, accessibilityLabels: s.accessibilityLabels, buttonLabels: s.buttonLabels },
  };
});
const statusColors = {};
for (const k of Object.keys(JOB_STATUS_COLORS)) statusColors[k] = statusColor(k);
const data = {
  schemaVersion: 1,
  app: src.app,
  appVersion: src.appVersion,
  apk: src.apk,
  generatedBy: GENERATED_BY,
  inputs: { screens: '_tools/screens.json', descriptions: '_tools/descriptions.json' },
  howToUpdate: HOW_TO,
  jobFlowOrder: JOB_FLOW_ORDER,
  jobBranchOrder: JOB_BRANCH_ORDER,
  specStages: SPEC_STAGES,
  statusColors,
  screens: screensOut,
  edges,
  redundant,
  missing,
  refutedFalsePositives: refutedDropped,
  refutedIds,
};
const dataJson = JSON.stringify(data, null, 2);
fs.writeFileSync(path.join(outDir, 'ui-data.json'), dataJson + '\n');

// ---------- shared HTML ----------
const counts = `screens=${screensOut.length} edges=${edges.length} redundant=${redundant.length} missing=${missing.length}`;
const aiIndex = (page) => {
  const wrap = (x) => x;
  let h = 'AI-INDEX\n';
  h += `page: ${page}\nschemaVersion: 1\ngeneratedBy: ${GENERATED_BY}\nhowToUpdate: ${HOW_TO}\ncounts: ${counts}\n`;
  h += 'screens (key | anchor | kind | module | file):\n';
  for (const s of screensOut) h += `${s.key} | anchor #${s.anchor} | ${s.kind} | ${s.module ?? 'none'} | ${s.file}\n`;
  return '<!-- ' + h.replace(/--/g, '- -') + '-->';
};
const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@600&family=Inter:wght@400&display=swap">';
const dataScript = `<script type="application/json" id="jobcore-ui-data">\n${dataJson.replace(/<\//g, '<\\/')}\n</script>`;
const headerHtml = (title) => `<header class="top"><h1>${esc(data.app)} ${esc(title)}</h1><p>Version ${esc(data.appVersion)} · APK: ${esc(data.apk)} (gitignored; these files are the committed record)</p><p class="muted">Generated from _tools/screens.json and _tools/descriptions.json by ${esc(GENERATED_BY)}. ${esc(counts)}.</p></header>`;
const BASE_CSS = `*{box-sizing:border-box}body{margin:0;background:var(--c-offWhite);color:var(--c-text);font-family:var(--f-body),system-ui,sans-serif;font-size:14px;line-height:1.6}
h1,h2,h3{font-family:var(--f-heading),system-ui,sans-serif;font-weight:600;margin:0}
a{color:var(--c-info)}.muted{color:var(--c-textMuted)}
header.top{background:var(--c-primary);color:#fff;padding:var(--sp-3) var(--sp-4)}header.top p{margin:4px 0 0;color:var(--c-border);font-size:13px}
.toolbar{position:sticky;top:0;z-index:50;background:var(--c-surface);border-bottom:1px solid var(--c-border);padding:var(--sp-2) var(--sp-4);display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap}
.toolbar button{border:1px solid var(--c-primary);background:var(--c-surface);color:var(--c-primary);border-radius:var(--r-pill);padding:4px 16px;cursor:pointer;font:inherit}
.toolbar button.on{background:var(--c-primary);color:#fff}.toolbar input{border:1px solid var(--c-border);border-radius:var(--r-sm);padding:4px 8px;font:inherit;min-width:240px}
main{padding:var(--sp-3) var(--sp-4)}table{border-collapse:collapse;background:var(--c-surface)}th,td{border:1px solid var(--c-border);padding:4px 8px;text-align:left;vertical-align:top;font-size:13px}th{background:var(--c-surfaceAlt)}
.chip{display:inline-block;border-radius:var(--r-pill);padding:1px 10px;font-size:12px;margin:0 4px 4px 0;background:var(--c-surfaceAlt);color:var(--c-textLight);border:1px solid var(--c-border)}
.chip.bad{background:var(--c-danger);color:#fff;border-color:var(--c-danger)}.chip.role{background:var(--c-primaryLight);color:#fff;border-color:var(--c-primaryLight)}
`;
const toolbarHtml = (extra) => `<div class="toolbar"><span>Sort:</span><button type="button" class="on" data-sort="flow">Job flow</button><button type="button" data-sort="alpha">Alphabetical</button><input type="search" id="filter" placeholder="Filter screens (key, title, route, file)"><span>Device:</span><span class="devtoggle" role="group" aria-label="Device"><button type="button" class="on" data-device-btn="phone">Phone</button><button type="button" data-device-btn="pad">Pad</button></span>${extra || ''}</div>`;
const DEV_JS = `(function(){var K='jobcore-ui-device',m=document.querySelector('main'),bs=document.querySelectorAll('.toolbar button[data-device-btn]');
function set(d){if(m)m.setAttribute('data-device',d);bs.forEach(function(b){b.classList.toggle('on',b.dataset.deviceBtn===d)})}
var d='phone';try{var v=localStorage.getItem(K);if(v==='phone'||v==='pad')d=v}catch(e){}
set(d);bs.forEach(function(b){b.addEventListener('click',function(){set(b.dataset.deviceBtn);try{localStorage.setItem(K,b.dataset.deviceBtn)}catch(e){}})})})();`;
const countBy = (fn) => { const m = new Map(); for (const s of screensOut) { const k = String(fn(s)); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => cmp(a[0], b[0])); };
const countTable = (title, rows) => `<table><thead><tr><th>${esc(title)}</th><th>Count</th></tr></thead><tbody>${rows.map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join('')}</tbody></table>`;
const dataAttrs = (s) => `data-screen-key="${esc(s.key)}" data-flow-rank="${s.flowRank}" data-module="${esc(s.module ?? 'none')}" data-kind="${esc(s.kind)}"`;
const searchText = (s) => [s.key, s.title, s.route, s.subView, s.file, s.module, s.summary].filter(Boolean).join(' ').toLowerCase();

// ---------- inventory ----------
// _tools/pagination.json { screenKey: [unit indexes where continuation pages start] }; absent file = no breaks
let pagination = {};
try { pagination = JSON.parse(fs.readFileSync(path.join(here, 'pagination.json'), 'utf8')) || {}; } catch { pagination = {}; }
const list = (a) => (Array.isArray(a) && a.length ? a.map(esc).join(', ') : '<span class="muted">none</span>');
const val = (v) => (v == null || v === '' ? '<span class="muted">none</span>' : esc(v));
// claim lookups (built once; missing is final by inventory time)
const redByKey = new Map();
for (const r of redundant) { if (!redByKey.has(r.key)) redByKey.set(r.key, []); redByKey.get(r.key).push(r); }
const missByKey = new Map();
for (const m of missing) { const i = String(m.evidence || '').indexOf(' · '); if (i > 0) { const k = m.evidence.slice(0, i); if (!missByKey.has(k)) missByKey.set(k, []); missByKey.get(k).push(m); } }
function card(s) {
  const comps = Object.entries(s.components || {}).sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).slice(0, 8).map(([k, n]) => `${k}×${n}`);
  const compsHtml = comps.length ? `<div class="comp-wrap">${comps.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : '<span class="muted">none</span>';
  const rClaims = redByKey.get(s.key) || [];
  const mClaims = missByKey.get(s.key) || [];
  const claimBox = rClaims.length || mClaims.length
    ? `<aside class="claim-box"><strong>Claims</strong>${rClaims.map((r) => `<div>${esc(r.id)} · ${esc(r.kind)}: ${esc(r.claim)}<br><span class="muted">${esc(r.evidence)}</span></div>`).join('')}${mClaims.map((m) => `<div>${esc(m.id)}: ${esc(m.claim)}<br><span class="muted">${esc(m.evidence)}</span></div>`).join('')}</aside>`
    : '';
  const roles = (s.roles && s.roles.length ? s.roles : ['all']).map((r) => `<span class="chip role">${esc(r)}</span>`).join('');
  const unm = s.mounted === false || s.mounted === 'exported-unmounted';
  const outs = edges.filter((e) => e.from === s.key);
  const navLis = outs.length
    ? outs.map((e) => (e.resolved ? `<li><a href="#screen-${esc(e.to)}">${esc(e.to)}</a> <span class="muted">(${esc(e.kind)})</span></li>` : `<li>${esc(e.to)} <span class="muted">(${esc(e.kind)}, unresolved)</span></li>`))
    : ['<li class="muted">none</li>'];
  const fs_ = s.flowStage;
  const kv = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  // atomic units after the header block; g groups consecutive rows/items for wrapper rebuilds on continuation pages
  const units = [
    { g: 'h', h: claimBox ? `<div class="head-row"><h3>How to identify when editing</h3>${claimBox}</div>` : '<h3>How to identify when editing</h3>' },
    ...[`file: <code>${esc(s.file)}</code>`, `route: <code>${esc(s.route ?? 'none')}</code>`, `key: <code>${esc(s.key)}</code>`, `anchor: <code>#${esc(s.anchor)}</code>`,
      `identifiers: testIDs ${list(s.testIDs)}; accessibilityLabels ${list(s.accessibilityLabels)}; buttonLabels ${list(s.buttonLabels)}`].map((h) => ({ g: 'id', h: `<div>${h}</div>` })),
    { g: 'h', h: '<h3>Titles / tags / endpoints</h3>' },
    ...[kv('Screen #', `#${String(registry.get(s.key).number).padStart(4, '0')}`), kv('id / key', `<code>${esc(s.key)}</code>`), kv('kind', val(s.kind)), kv('title', val(s.title)), kv('titleInSource', val(s.titleInSource)), kv('route', val(s.route)), kv('subView', val(s.subView)),
      kv('testIDs', list(s.testIDs)), kv('accessibilityLabels', list(s.accessibilityLabels)), kv('buttonLabels', list(s.buttonLabels)), kv('pickers', list(s.pickers)),
      kv('menus', list(s.menus)), kv('components (top 8)', compsHtml), kv('tables', list(s.tables)), kv('rpcs', list(s.rpcs)), kv('repoMethods', list(s.repoMethods))].map((h) => ({ g: 'tr', h: `<tr>${h.slice(4, -5)}</tr>` })),
    { g: 'h', h: '<h3>Navigation targets</h3>' },
    ...navLis.map((h) => ({ g: 'li', h })),
  ];
  const WRAP = { tr: ['<table><tbody>', '</tbody></table>'], id: ['<div class="ident">', '</div>'], li: ['<ul>', '</ul>'] };
  // render units [from,to) as wrapped runs; mark(i) adds the data-u attribute (and pbrk class when hidden in print)
  const runs = (from, to, brk) => {
    let out = '', cur = null;
    for (let i = from; i < to; i++) {
      const u = units[i];
      if (cur && cur !== u.g) { out += WRAP[cur][1]; cur = null; }
      if (!cur && WRAP[u.g]) { out += WRAP[u.g][0]; cur = u.g; }
      const cls = brk != null && i >= brk ? ' class="pbrk"' : '';
      out += u.h.replace(/^<(\w+)/, `<$1 data-u="${i}"${cls}`);
    }
    return cur ? out + WRAP[cur][1] : out;
  };
  const brks = (pagination[s.key] || []).filter((n) => n > 0 && n < units.length);
  const body = runs(0, units.length, brks.length ? brks[0] : null);
  const chips = `${roles}<span class="chip">${esc(s.kind)}</span>`;
  const conts = brks.map((from, i) => `<section class="cont" data-cont-of="${esc(s.key)}">
<div class="cont-head"><strong>${esc(s.title || s.key)}</strong> ${chips} <span class="muted">continued - page ${i + 2} of ${brks.length + 1}</span></div>
${runs(from, i + 1 < brks.length ? brks[i + 1] : units.length)}
</section>`).join('\n');
  return `<!-- screen:${s.key} -->
<article class="screen-card" id="screen-${esc(s.key)}" ${dataAttrs(s)} data-search="${esc(searchText(s))}">
<div class="mock">${renderMockup(s)}</div>
<div class="info">
<h2>${esc(s.title || s.key)}</h2>
<div>${roles}</div>
<div><span class="chip">${esc(s.kind)}</span><span class="chip">${esc(s.module ?? 'no module')}</span><span class="chip">mounted: ${esc(s.mounted)}</span>${unm ? '<span class="chip bad">NOT MOUNTED</span>' : ''}<span class="chip" style="background:${statusColor(fs_)};color:#fff;border-color:${statusColor(fs_)}">${esc(String(fs_).replace(/_/g, ' '))}</span><span class="chip">${esc(s.specStage)}</span></div>
<p>${esc(s.summary)}</p>
${s.purpose ? `<p class="muted">${esc(s.purpose)}</p>` : ''}
${body}
</div>
</article>${conts ? '\n' + conts : ''}
<!-- /screen:${s.key} -->`;
}
const INV_CSS = `.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(720px,1fr));gap:var(--sp-3);margin-top:var(--sp-3)}
.screen-card{display:flex;gap:var(--sp-3);background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);padding:var(--sp-3);scroll-margin-top:70px}
.screen-card.hide{display:none}.screen-card:target{border-color:var(--c-secondary);box-shadow:0 0 0 2px var(--c-secondary)}
.mock{flex:0 0 300px}.info{flex:1;min-width:0}.info h3{margin-top:var(--sp-2);font-size:14px;color:var(--c-primary)}
.info table{width:100%;word-break:break-word}.ident{background:var(--c-surfaceAlt);border-radius:var(--r-sm);padding:var(--sp-1) var(--sp-2);font-size:13px}
.num-index table{border-collapse:collapse;width:100%;font-size:12px}.num-index th,.num-index td{border:1px solid var(--c-border);padding:2px 6px;text-align:left}.num-index{margin-bottom:var(--sp-3)}.sums{display:flex;gap:var(--sp-3);flex-wrap:wrap}code{background:var(--c-surfaceAlt);padding:0 4px;border-radius:3px}
.head-row{display:block}.head-row>h3{margin-top:var(--sp-2)}.info h3+table{width:auto;min-width:0}
.claim-box{float:right;width:32%;margin:0 0 6px 12px;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;padding:6px 8px;font-size:9px;background:#fafafa}
.comp-wrap{display:flex;flex-wrap:wrap;gap:3px;overflow-wrap:anywhere}.comp-wrap span{border:1px solid #ddd;border-radius:3px;padding:0 4px}
.cont{display:none}.cont-head{border-bottom:1px solid var(--c-border);padding-bottom:4px;margin-bottom:6px;font-size:13px}
@media print{@page{size:A4 landscape;margin:10mm}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.toolbar,header.top{display:none!important}.toolbar{position:static}
main{padding:0}.num-index{break-after:page;page-break-after:always;font-size:10px}.sums{display:none}.grid{display:block;margin:0}
.screen-card{display:flex;box-shadow:none;box-sizing:border-box;min-height:189mm;padding:8px;gap:12px;border-radius:0}
.screen-card:target{box-shadow:none;border-color:var(--c-border)}
.screen-card.hide{display:none}
.screen-card:not(.hide) ~ .screen-card:not(.hide){break-before:page;page-break-before:always}
.mock{flex:0 0 auto;width:auto;height:auto}
.mock .jc-device{zoom:1.05;margin:0}
main[data-device="pad"] .mock .jc-device{zoom:.78;margin:0}
.info .pbrk{display:none}
.info tr,.info li,.info .ident>div,.info h2,.info>div{break-inside:avoid;page-break-inside:avoid}.info h3{break-after:avoid;page-break-after:avoid}
section.cont{display:block;break-before:page;page-break-before:always;padding:8px;box-sizing:border-box}section.cont.hide{display:none}
section.cont tr,section.cont li,section.cont .ident>div{break-inside:avoid;page-break-inside:avoid}}`;
const INV_JS = `(function(){var g=document.getElementById('grid'),bs=document.querySelectorAll('.toolbar button[data-sort]'),f=document.getElementById('filter');
function sortBy(m){var c=[].slice.call(g.querySelectorAll('.screen-card'));c.sort(function(a,b){return m==='flow'?(+a.dataset.flowRank-+b.dataset.flowRank):(a.dataset.screenKey<b.dataset.screenKey?-1:a.dataset.screenKey>b.dataset.screenKey?1:0)});c.forEach(function(n){g.appendChild(n);g.querySelectorAll('.cont').forEach(function(x){if(x.dataset.contOf===n.dataset.screenKey)g.appendChild(x)})});bs.forEach(function(b){b.classList.toggle('on',b.dataset.sort===m)})}
bs.forEach(function(b){b.addEventListener('click',function(){sortBy(b.dataset.sort)})});
f.addEventListener('input',function(){var q=f.value.toLowerCase();g.querySelectorAll('.screen-card').forEach(function(n){var h=q&&n.dataset.search.indexOf(q)<0;n.classList.toggle('hide',h);g.querySelectorAll('.cont').forEach(function(x){if(x.dataset.contOf===n.dataset.screenKey)x.classList.toggle('hide',h)})})});sortBy('flow')})();`;
const inventoryHtml = `<!doctype html>
${aiIndex('ui-inventory.html')}
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JobCore UI Inventory v${esc(data.appVersion)}</title>
${FONT_LINK}
<style>${cssVars()}${BASE_CSS}${INV_CSS}${FRAME_CSS}</style></head><body>
${headerHtml('UI Inventory')}
${toolbarHtml()}
<main data-device="phone">
<div class="sums">${countTable('By kind', countBy((s) => s.kind))}${countTable('By module', countBy((s) => s.module ?? 'none'))}${countTable('By mounted', countBy((s) => s.mounted))}</div>
${numIndexHtml}
<div class="grid" id="grid">
${screensOut.map(card).join('\n')}
</div>
</main>
${dataScript}
<script>${INV_JS}</script>
<script>${DEV_JS}</script>
</body></html>
`;
fs.writeFileSync(path.join(outDir, 'ui-inventory.html'), inventoryHtml);

// ---------- storyboard ----------
const NW = 140, NH = 90, GAP = 24, LW = 190, LH = 40, PAD = 24;
const byKey = new Map(screensOut.map((s) => [s.key, s]));
const missingStages = new Set(missing.filter((m) => m.claim.startsWith('Spec stage ')).map((m) => m.specStage));
function layout(lanes, laneOf, order, ghostFor) {
  const pos = new Map();
  const ghosts = [];
  const perLane = lanes.map(() => 0);
  lanes.forEach((ln, li) => { if (ghostFor && ghostFor(ln)) { ghosts.push({ lane: ln, x: li * LW + (LW - NW) / 2, y: LH + GAP + perLane[li] * (NH + GAP) }); perLane[li]++; } });
  for (const s of order) {
    const li = lanes.indexOf(laneOf(s));
    const row = perLane[li]++;
    pos.set(s.key, { x: li * LW + (LW - NW) / 2, y: LH + GAP + row * (NH + GAP), lane: li });
  }
  const rows = Math.max(1, ...perLane);
  return { pos, ghosts, width: lanes.length * LW, height: LH + GAP + rows * (NH + GAP) + 80, perLane };
}
function connectors(L, markerId) {
  let svg = `<svg class="wires" width="${L.width}" height="${L.height}" viewBox="0 0 ${L.width} ${L.height}" aria-hidden="true"><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--c-primary)"/></marker><marker id="${markerId}-u" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--c-textMuted)"/></marker></defs>`;
  edges.forEach((e, i) => {
    const a = L.pos.get(e.from);
    if (!a) return;
    const jit = (i % 5) * 4;
    let pts;
    if (!e.resolved) {
      const sx = a.x + NW, sy = a.y + NH / 2;
      pts = [[sx, sy], [sx + 14, sy]];
    } else {
      const b = L.pos.get(e.to);
      if (!b || e.from === e.to) return;
      if (b.lane > a.lane) {
        const sx = a.x + NW, sy = a.y + NH / 2, tx = b.x, ty = b.y + NH / 2;
        const mx = sx + 10 + jit;
        pts = [[sx, sy], [mx, sy], [mx, ty], [tx, ty]];
      } else {
        const sx = a.x + NW / 2 + (jit - 8), sy = a.y + NH, tx = b.x + NW / 2 + (jit - 8), ty = b.y + NH;
        const yb = Math.max(sy, ty) + 10 + jit;
        pts = [[sx, sy], [sx, yb], [tx, yb], [tx, ty]];
      }
    }
    const p = pts.map((q) => q.join(',')).join(' ');
    const style = e.resolved ? 'stroke:var(--c-primary)' : 'stroke:var(--c-textMuted);stroke-dasharray:4 3';
    svg += `<polyline points="${p}" fill="none" stroke-width="1.5" style="${style}" marker-end="url(#${markerId}${e.resolved ? '' : '-u'})" data-from="${esc(e.from)}" data-to="${esc(e.to)}" data-kind="${esc(e.kind)}"><title>${esc(e.from)} to ${esc(e.to)} (${esc(e.kind)}${e.resolved ? '' : ', unresolved'})</title></polyline>`;
  });
  return svg + '</svg>';
}
function board(sortId, lanes, laneTitle, laneCount, L, withIds, markerId, order) {
  let h = `<section class="board" data-sort="${sortId}"${sortId === 'flow' ? '' : ' hidden'}><div class="canvas" style="position:relative;width:${L.width}px;height:${L.height}px">`;
  lanes.forEach((ln, li) => {
    h += `<div class="lane" style="left:${li * LW}px;width:${LW}px;height:${L.height}px"><div class="lane-h" style="height:${LH}px">${esc(laneTitle(ln))} <span class="muted">(${laneCount(ln)})</span></div></div>`;
  });
  h += connectors(L, markerId);
  for (const g of L.ghosts) h += `<div class="ghost" style="left:${g.x}px;top:${g.y}px;width:${NW}px;height:${NH}px">MISSING: ${esc(g.lane)}</div>`;
  for (const s of order) {
    const p = L.pos.get(s.key);
    const inner = `<a class="node" ${withIds ? `id="screen-${esc(s.key)}" ` : ''}${dataAttrs(s).replace(withIds ? '' : '', '')} data-search="${esc(searchText(s))}" href="ui-inventory.html#screen-${esc(s.key)}" style="left:${p.x}px;top:${p.y}px">${renderMiniNode(s)}</a>`;
    h += withIds ? `<!-- screen:${s.key} -->${inner}<!-- /screen:${s.key} -->` : inner;
  }
  return h + '</div></section>';
}
const flowOrder = [...screensOut].sort((a, b) => a.flowRank - b.flowRank);
const alphaOrder = screensOut;
const laneOfFlow = (s) => (SPEC_STAGES.includes(s.specStage) ? s.specStage : 'Ancillary');
const laneOfMod = (s) => (s.module ? s.module : 'none');
const LF = layout(SPEC_STAGES, laneOfFlow, flowOrder, (ln) => missingStages.has(ln));
const LA = layout(MODULE_LANES, laneOfMod, alphaOrder, null);
const flowBoard = board('flow', SPEC_STAGES, (l) => l, (l) => screensOut.filter((s) => laneOfFlow(s) === l).length, LF, true, 'arrow-flow', flowOrder);
// alphabetical board must not carry duplicate ids: withIds=false, no comments
const alphaBoard = board('alpha', MODULE_LANES, (l) => l, (l) => screensOut.filter((s) => laneOfMod(s) === l).length, LA, false, 'arrow-alpha', alphaOrder);
const tbl = (cols, rows) => `<table><thead><tr>${cols.map((c) => `<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const SB_CSS = `.boards{overflow:auto;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-md);padding:var(--sp-2)}
.board[hidden]{display:none}.canvas{background:var(--c-surface)}.lane{position:absolute;top:0;border-left:1px dashed var(--c-border)}
.lane-h{font-family:var(--f-heading),system-ui,sans-serif;font-weight:600;font-size:13px;text-align:center;padding-top:8px;color:var(--c-primary);background:var(--c-surfaceAlt)}
.wires{position:absolute;left:0;top:0;pointer-events:none;z-index:1}.node{position:absolute;display:block;width:${NW}px;height:${NH}px;z-index:2;text-decoration:none}.node.dim{opacity:.2}
.ghost{position:absolute;z-index:2;border:2px dashed var(--c-danger);color:var(--c-danger);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;text-align:center;font-weight:600;font-size:12px;padding:8px}
.legend{display:flex;gap:var(--sp-3);flex-wrap:wrap;align-items:center;margin:var(--sp-2) 0}.legend svg{vertical-align:middle}section.tables{margin-top:var(--sp-4)}section.tables h2{margin:var(--sp-3) 0 var(--sp-1)}`;
const SB_JS = `(function(){var bs=document.querySelectorAll('.toolbar button[data-sort]'),bd=document.querySelectorAll('.board'),f=document.getElementById('filter');
function show(m){bd.forEach(function(b){b.hidden=b.dataset.sort!==m});bs.forEach(function(b){b.classList.toggle('on',b.dataset.sort===m)})}
bs.forEach(function(b){b.addEventListener('click',function(){show(b.dataset.sort)})});
f.addEventListener('input',function(){var q=f.value.toLowerCase();document.querySelectorAll('.node').forEach(function(n){n.classList.toggle('dim',!!q&&n.dataset.search.indexOf(q)<0)})});show('flow')})();`;
const legend = `<div class="legend"><span><svg width="40" height="12"><line x1="0" y1="6" x2="34" y2="6" stroke-width="1.5" style="stroke:var(--c-primary)"/></svg> resolved navigation</span><span><svg width="40" height="12"><line x1="0" y1="6" x2="34" y2="6" stroke-width="1.5" style="stroke:var(--c-textMuted);stroke-dasharray:4 3"/></svg> unresolved target</span><span><span class="chip bad">MISSING: stage</span> spec stage with no mounted screen</span><span class="muted">Node stripe color = module; click a node to open its inventory card.</span></div>`;
const storyboardHtml = `<!doctype html>
${aiIndex('ui-storyboard.html')}
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JobCore UI Storyboard v${esc(data.appVersion)}</title>
${FONT_LINK}
<style>${cssVars()}${BASE_CSS}${SB_CSS}${FRAME_CSS}</style></head><body>
${headerHtml('UI Storyboard')}
${toolbarHtml()}
<main data-device="phone">
<div class="boards">
${flowBoard}
${alphaBoard}
</div>
<section class="tables">
<h2>Redundant &amp; missing components</h2>
${legend}
<h3>Redundant (${redundant.length})</h3>
${tbl([['id', 'ID'], ['kind', 'Kind'], ['key', 'Key'], ['claim', 'Claim'], ['evidence', 'Evidence']], redundant)}
<h3 style="margin-top:16px">Missing (${missing.length})</h3>
${tbl([['id', 'ID'], ['specStage', 'Spec stage'], ['claim', 'Claim'], ['evidence', 'Evidence']], missing)}
</section>
</main>
${dataScript}
<script>${SB_JS}</script>
<script>${DEV_JS}</script>
</body></html>
`;
fs.writeFileSync(path.join(outDir, 'ui-storyboard.html'), storyboardHtml);

console.log(`generate: ${screensOut.length} screens, ${edges.length} edges, ${redundant.length} redundant claims, ${missing.length} missing claims -> ${outDir}`);
void byKey; void TOKENS;
