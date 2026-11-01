import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] ? path.resolve(process.argv[2]) : here;
const RA = process.argv[3] || 'E:/Jeff/Codespace/SDAssemblyPros/Jobcore/app';

const routes = JSON.parse(fs.readFileSync(path.join(dir, 'routes.json'), 'utf8'));

const COMPONENTS = ['Button','Text','Card','ListItem','TextField','Select','DatePicker','Checkbox','Toggle','TabBar','AppChrome','Breadcrumb','ScreenTitle','CalendarHeader','WeekView','MonthView','EmptyState','LoadingState','ErrorState','WalkthroughOverlay','HelpCallout','Modal','FlatList','ScrollView','SectionList','TextInput','Switch','Pressable','TouchableOpacity','JobHeader','JobSummaryRest','JobClockModal','PaymentSimulationNotice','SyncIndicator','AxisPicker','WarningSheet','AddTaskDialog','AccordionEditRow','DateRangeCalendar','DateTimePicker'];
const PICKERS = ['Select','DatePicker','AxisPicker','DateRangeCalendar','DateTimePicker','Modal','AddTaskDialog','WarningSheet','JobClockModal'];

const uniq = (a) => [...new Set(a)];
const all = (re, s, fn) => { const out = []; for (const m of s.matchAll(re)) { const v = fn(m); if (v != null) out.push(v); } return out; };

function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.tsx') && !/\.(test|spec)\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

function extract(src) {
  const testIDs = uniq(all(/testID=(?:"([^"]*)"|\{\s*'([^']*)'\s*\}|\{\s*"([^"]*)"\s*\})/g, src, m => m[1] ?? m[2] ?? m[3]));
  const accessibilityLabels = uniq(all(/accessibilityLabel="([^"]*)"/g, src, m => m[1]));
  const btn = [];
  for (const m of src.matchAll(/<(?:Button|PayrollButton)\b([\s\S]*?)>/g)) {
    const l = m[1].match(/\b(?:label|title)="([^"]*)"/);
    if (l) btn.push(l[1]);
  }
  for (const m of src.matchAll(/<(Pressable|TouchableOpacity)\b/g)) {
    const rest = src.slice(m.index, m.index + 200 + 200);
    const close = rest.indexOf('</' + m[1]);
    const seg = close >= 0 ? rest.slice(0, Math.min(close, 200)) : rest.slice(0, 200);
    const t = seg.match(/<Text[^>]*>([^<{}]+)<\/Text>/);
    if (t && t[1].trim()) btn.push(t[1].trim());
  }
  const components = {};
  for (const c of COMPONENTS) {
    const n = (src.match(new RegExp('<' + c + '(?![A-Za-z0-9_])', 'g')) || []).length;
    if (n) components[c] = n;
  }
  const pickers = PICKERS.filter(p => components[p]);
  return { testIDs, accessibilityLabels, buttonLabels: uniq(btn), components, pickers, _src: src };
}

function navTargets(src) {
  const out = [], seen = new Set();
  const add = (target, kind) => {
    target = target.replace(/\$\{[^}]*\}/g, ':param');
    const k = kind + '|' + target;
    if (!seen.has(k)) { seen.add(k); out.push({ kind, target }); }
  };
  const res = [
    /router\.(?:push|replace|navigate)\(\s*['"`]([^'"`]+)['"`]/g,
    /<Link\b[^>]*?href=(?:\{\s*)?['"`]([^'"`]+)['"`]/g,
    /<Redirect\b[^>]*?href=(?:\{\s*)?['"`]([^'"`]+)['"`]/g,
  ];
  for (const re of res) for (const m of src.matchAll(re)) add(m[1], m[1].startsWith('/') ? 'route' : 'subView');
  for (const m of src.matchAll(/\b(setView|setSubView|setScreen|setSection|onNavigate|navigate|openView|go|onSelect)\(\s*['"`]([^'"`]+)['"`]/g))
    add(m[2], m[2].startsWith('/') ? 'route' : 'subView');
  return out;
}

function process_(src) {
  const e = extract(src);
  const menus = [];
  if (e.components.TabBar || /[\\/]\(tabs\)[\\/]/.test(src.__path || '')) menus.push('tabs');
  const tables = uniq(all(/\.from\(\s*['"]([^'"]+)['"]\s*\)/g, src, m => m[1]));
  const rpcs = uniq(all(/\.rpc\(\s*['"]([^'"]+)['"]/g, src, m => m[1]));
  const rm = [
    ...all(/\b(\w+(?:Repo|Repos|repo|repos|Port|Ports))\.(\w+)\(/g, src, m => m[1] + '.' + m[2]),
    ...all(/\brepos?\.(\w+)\.(\w+)\(/g, src, m => m[1] + '.' + m[2]),
  ];
  const imports = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const s = m[2];
    if (/ui|components|@jobcore/.test(s) || s.startsWith('./') || s.startsWith('../'))
      imports.push({ src: s, names: m[1].split(',').map(x => x.trim()).filter(Boolean) });
  }
  let titleInSource = null;
  const tm = src.match(/title=(?:"([^"]*)"|\{\s*'([^']*)'\s*\})/) || src.match(/<ScreenTitle\b[^>]*>([^<{]+)</);
  if (tm) titleInSource = (tm[1] ?? tm[2] ?? tm[3] ?? '').trim() || null;
  const { _src, ...rest } = e;
  return {
    ...rest, menus, navTargets: navTargets(src), tables, rpcs, repoMethods: uniq(rm), imports,
    lineCount: src.split(/\r\n|\r|\n/).length, titleInSource,
    _appChrome: !!e.components.AppChrome,
  };
}

// ---- elements / chrome (regex-only, additive) ----
const BUSY = /submitting|loading|saving|busy|pending/i;
const lineStarts = (s) => { const a = [0]; for (let i = 0; i < s.length; i++) if (s[i] === '\n') a.push(i + 1); return a; };
const lineOf = (starts, idx) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; };

function parseTag(src, i) {
  const nm = /^<([A-Za-z_][\w.]*)/.exec(src.slice(i, i + 80));
  if (!nm) return null;
  let j = i + nm[0].length, depth = 0, q = null;
  const startAttrs = j;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) break;
  }
  if (j >= src.length) return null;
  return { name: nm[1], attrs: src.slice(startAttrs, j), end: j + 1, selfClosing: src[j - 1] === '/' };
}

function balanced(s, p) {
  let d = 0, q = null;
  for (; p < s.length; p++) {
    const c = s[p];
    if (q) { if (c === '\\') p++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return p + 1; }
  }
  return s.length;
}
function parseAttrs(s) {
  const out = {};
  let p = 0;
  while (p < s.length) {
    while (p < s.length && /[\s/]/.test(s[p])) p++;
    if (p >= s.length) break;
    if (s[p] === '{') { p = balanced(s, p); continue; }
    const m = /^[A-Za-z_][\w-]*/.exec(s.slice(p));
    if (!m) { p++; continue; }
    const name = m[0]; p += name.length;
    if (s[p] !== '=') { out[name] = { bool: true }; continue; }
    p++;
    if (s[p] === '"' || s[p] === "'") { const e = s.indexOf(s[p], p + 1); const v = s.slice(p + 1, e < 0 ? s.length : e); out[name] = { str: v }; p = e < 0 ? s.length : e + 1; }
    else if (s[p] === '{') { const e = balanced(s, p); out[name] = { expr: s.slice(p + 1, e - 1).trim() }; p = e; }
  }
  return out;
}
const tok = (e) => '{' + (e.replace(/\s+/g, ' ').trim().slice(0, 40)) + '}';
const litQ = (e) => { const m = /^(['"`])((?:(?!\1)[^\\]|\\.)*)\1$/.exec(e); return m && !(m[1] === '`' && m[2].includes('${')) ? m[2] : null; };
function resolveExpr(e) {
  e = e.trim();
  const l = litQ(e);
  if (l != null) return { label: l, dynamic: false };
  const t = /^([\s\S]+?)\s*\?\s*(['"`])((?:(?!\2)[^\\]|\\.)*)\2\s*:\s*(['"`])((?:(?!\4)[^\\]|\\.)*)\4$/.exec(e);
  if (t && BUSY.test(t[1])) return { label: t[1].trim().startsWith('!') ? t[3] : t[5], dynamic: false };
  return { label: tok(e), dynamic: true };
}
function resolveAttr(a) {
  if (!a) return null;
  if (a.str != null) return { label: a.str, dynamic: false };
  if (a.expr != null) return resolveExpr(a.expr);
  return null;
}
function resolveChildren(raw) {
  const stripped = raw.replace(/<[^>]*>/g, ' ');
  const bm = stripped.match(/\{([^{}]*)\}/);
  if (bm) { const r = resolveExpr(bm[1]); const rest = stripped.replace(/\{[^{}]*\}/g, '').replace(/\s+/g, ' ').trim(); if (rest && !r.dynamic) return { label: (rest + ' ' + r.label).trim(), dynamic: false }; return r; }
  const t = stripped.replace(/\s+/g, ' ').trim();
  return t ? { label: t, dynamic: false } : null;
}
function childrenOf(src, tag) {
  if (tag.selfClosing) return null;
  const c = src.indexOf('</' + tag.name, tag.end);
  return c < 0 ? null : src.slice(tag.end, c);
}
function localImports(src, file) {
  const map = {};
  const dirOf = path.posix.dirname(file);
  const resolveFile = (spec) => {
    const base = path.posix.normalize(path.posix.join(dirOf, spec));
    for (const c of [base + '.tsx', base + '/index.tsx']) { const a = path.join(RA, c); if (fs.existsSync(a) && fs.statSync(a).isFile()) return c; }
    return null;
  };
  for (const m of src.matchAll(/import\s+([^'";]*?)\s+from\s*['"](\.\.?\/[^'"]*)['"]/g)) {
    const f = resolveFile(m[2]); if (!f) continue;
    const nm = m[1].match(/\{([^}]*)\}/);
    const def = m[1].replace(/\{[^}]*\}/, '').replace(/,/g, '').trim();
    if (def && /^[A-Z]\w*$/.test(def)) map[def] = f;
    if (nm) for (const n of nm[1].split(',')) { const x = n.trim().split(/\s+as\s+/).pop(); if (/^[A-Z]\w*$/.test(x)) map[x] = f; }
  }
  return map;
}
const mk = (type, r, ph, variant, line, via) => ({ type, label: r ? r.label : null, placeholder: ph ? ph.label : null, variant: variant ? variant.label : null, line, via, dynamic: !!((r && r.dynamic) || (ph && ph.dynamic)) });

function scanElements(src, via, imports, chromeOut) {
  const starts = lineStarts(src), els = [];
  for (const m of src.matchAll(/<([A-Z][\w.]*)/g)) {
    const tag = parseTag(src, m.index);
    if (!tag) continue;
    const a = parseAttrs(tag.attrs), line = lineOf(starts, m.index), n = tag.name;
    const A = (k) => resolveAttr(a[k]);
    if (imports && imports[n]) { els.push({ __import: imports[n], line }); continue; }
    if (n === 'TextField') els.push(mk('field', A('label'), A('placeholder'), null, line, via));
    else if (n === 'TextInput') els.push(mk('field', A('label') || A('accessibilityLabel'), A('placeholder'), null, line, via));
    else if (n === 'Button' || n === 'PayrollButton') {
      let r = A('label') || A('title');
      if (!r) { const ch = childrenOf(src, tag); if (ch != null) r = resolveChildren(ch); }
      if (r) els.push(mk('button', r, null, A('variant') || A('tone'), line, via));
    }
    else if (n === 'Toggle' || n === 'Switch' || n === 'Checkbox') els.push(mk('toggle', A('label') || A('accessibilityLabel'), null, null, line, via));
    else if (n === 'Select' || n === 'DatePicker' || n === 'AxisPicker' || n === 'DateTimePicker') els.push(mk('select', A('label'), A('placeholder'), null, line, via));
    else if (n === 'EmptyState') {
      const t = A('title'), mg = A('message') || A('description') || A('subtitle');
      if (t) els.push(mk('empty', t, null, null, line, via));
      if (mg) els.push(mk('empty', mg, null, null, line, via));
    }
    else if (n === 'ListItem') {
      const t = A('title') || A('label'), s2 = A('subtitle') || A('description');
      if (t) els.push(mk('listitem', t, null, null, line, via));
      if (s2) els.push(mk('listitem', s2, null, null, line, via));
    }
    else if (n === 'AppChrome' || n === 'JobHeader') {
      const t = A('title'), s2 = A('subtitle');
      if (t) els.push(mk('header', t, null, null, line, via));
      if (s2) els.push(mk('header', s2, null, null, line, via));
      if (chromeOut && !chromeOut.set) { chromeOut.set = true; chromeOut.title = t ? t.label : null; chromeOut.titleDynamic = !!(t && t.dynamic); chromeOut.subtitle = s2 ? s2.label : null; chromeOut.subtitleDynamic = !!(s2 && s2.dynamic); const tn = A('titleBarTone') || A('tone'); chromeOut.titleBarTone = tn ? tn.label : null; }
    }
    else if (n === 'ScreenTitle' || n === 'SectionHeader' || n === 'SectionTitle' || n === 'Heading') {
      const ch = childrenOf(src, tag); const r = A('title') || A('label') || (ch != null ? resolveChildren(ch) : null);
      if (r) els.push(mk(n === 'ScreenTitle' ? 'header' : 'section', r, null, null, line, via));
    }
    else if (n === 'Text') {
      const hint = ['variant', 'type', 'accessibilityRole', 'style'].map(k => a[k] ? (a[k].str ?? a[k].expr ?? '') : '').join(' ');
      if (/heading|header|section|title/i.test(hint)) { const ch = childrenOf(src, tag); const r = ch != null ? resolveChildren(ch) : null; if (r) els.push(mk('section', r, null, null, line, via)); }
    }
    else if (n === 'Pressable' || n === 'TouchableOpacity') {
      const ch = childrenOf(src, tag); const t = ch && ch.match(/<Text\b[^>]*>([\s\S]*?)<\/Text>/);
      const r = t ? resolveChildren(t[1]) : null;
      if (r) els.push(mk('button', r, null, null, line, via));
    }
  }
  if (chromeOut && !chromeOut.set) {
    const o = src.match(/\b(?:headerTitle|title)\s*:\s*(['"`])((?:(?!\1)[^\\$])*)\1/);
    if (o && /options|headerTitle|Stack\.Screen/.test(src)) { chromeOut.set = true; chromeOut.title = o[2]; }
  }
  return els;
}

function buildElements(src, file) {
  const imports = localImports(src, file);
  const chrome = { title: null, titleDynamic: false, subtitle: null, subtitleDynamic: false, titleBarTone: null };
  const top = scanElements(src, file, imports, chrome);
  const elements = [];
  const cache = {};
  for (const e of top) {
    if (e.__import) {
      const f = e.__import;
      if (!(f in cache)) { const s2 = fs.readFileSync(path.join(RA, f), 'utf8'); cache[f] = scanElements(s2, f, null, chrome).filter(x => !x.__import); }
      elements.push(...cache[f]);
    } else elements.push(e);
  }
  return { elements, chrome: { title: chrome.title, subtitle: chrome.subtitle, titleBarTone: chrome.titleBarTone, titleDynamic: chrome.titleDynamic, subtitleDynamic: chrome.subtitleDynamic } };
}

function fill(entry) {
  const abs = path.join(RA, entry.file || '');
  const base = { ...entry };
  if (!entry.file || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return { ...base, fileMissing: true, testIDs: [], accessibilityLabels: [], buttonLabels: [], components: {}, pickers: [], menus: [], navTargets: [], tables: [], rpcs: [], repoMethods: [], imports: [], lineCount: 0, titleInSource: null, elements: [], chrome: null };
  }
  const src = fs.readFileSync(abs, 'utf8');
  const r = process_(src);
  const menus = new Set(r.menus);
  if (/[\\/]\(tabs\)[\\/]/.test(entry.file.replace(/\//g, '\\')) || /\/\(tabs\)\//.test(entry.file)) menus.add('tabs');
  if (r._appChrome) ['drawer', 'options', 'settings', 'switcher'].forEach(x => menus.add(x));
  delete r._appChrome;
  r.menus = ['drawer', 'options', 'settings', 'switcher', 'tabs'].filter(x => menus.has(x));
  const ec = buildElements(src, entry.file);
  return { ...base, ...r, elements: ec.elements, chrome: ec.chrome };
}

// completeness
const files = [
  ...walk(path.join(RA, 'apps/mobile/app')),
  ...(fs.existsSync(path.join(RA, 'modules')) ? fs.readdirSync(path.join(RA, 'modules')).flatMap(m => walk(path.join(RA, 'modules', m, 'src/screens'))) : []),
].map(f => path.relative(RA, f).replace(/\\/g, '/'));
const covered = new Set(routes.map(r => r.file));
const uncoveredFiles = files.filter(f => !covered.has(f)).sort();
const entries = routes.filter(r => !(r.retiredAt && r.retiredInto !== undefined));
for (const f of uncoveredFiles) {
  const mm = f.match(/^modules\/([^/]+)\//);
  const kebab = path.basename(f, '.tsx').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  entries.push({ key: kebab, kind: 'sub-view', mounted: 'unknown', notes: 'uncovered by routes.json', module: mm ? mm[1] : (f.startsWith('apps/mobile/') ? 'mobile-app' : 'unknown'), file: f, roles: [] });
}

// Fold route-file entries into the registry key that already owns the same route (e.g. job-id -> ft-Completion).
const normRoute = (r) => String(r || '').toLowerCase().replace(/\/+$/, '').replace(/:([A-Za-z0-9_]+)/g, '[$1]');
const regFile = path.resolve(RA, 'apps', 'mobile', 'src', 'screens', 'screen-registry.json');
const regRoutes = new Map();
const regKeys = new Set();
if (fs.existsSync(regFile)) {
  const raw = JSON.parse(fs.readFileSync(regFile, 'utf8'));
  for (const r of (Array.isArray(raw) ? raw : (raw.entries || raw.screens || []))) {
    if (r.retiredAt) continue;
    regKeys.add(r.key);
    if (r.route) { const n = normRoute(r.route); regRoutes.set(n, [...(regRoutes.get(n) || []), r.key]); }
  }
}
const entryKeys = new Set(entries.map(e => e.key));
for (let i = entries.length - 1; i >= 0; i--) {
  if (regKeys.has(entries[i].key)) continue;
  const cands = entries[i].route ? (regRoutes.get(normRoute(entries[i].route)) || []) : [];
  if (cands.length !== 1) continue;
  const rk = cands[0];
  if (entryKeys.has(rk)) entries.splice(i, 1); else entries[i] = { ...entries[i], key: rk };
}
const used = new Set();
const screens = entries.map(e => {
  let key = e.key, n = 2;
  while (used.has(key)) key = `${e.key}-${n++}`;
  used.add(key);
  return fill({ ...e, key });
}).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

// App version and versionCode come from the Expo config, so the inventory header matches the APK.
const expo = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', '..', 'app', 'apps', 'mobile', 'app.json'), 'utf8')).expo;
const appVersion = expo.version;
const out = {
  version: 1, app: 'JobCore', appVersion,
  apk: `app/apps/mobile/jobcore-${appVersion}-vc${expo.android.versionCode}.apk (untracked)`,
  generatedBy: 'docs/snapshots/_tools/extract.mjs', generatedFrom: 'extract.mjs',
  screens, uncoveredFiles,
};
fs.writeFileSync(path.join(dir, 'screens.json'), JSON.stringify(out, null, 2));
const srcFiles = new Set(screens.filter(s => s.file && !s.fileMissing).map(s => s.file));
console.log(`screens.json: ${screens.length} screens, ${srcFiles.size} source files, ${uncoveredFiles.length} uncovered files; ${screens.filter(x => x.elements && x.elements.length).length} screens with elements`);
