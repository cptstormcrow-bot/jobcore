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
  for (const m of src.matchAll(/<Button\b([\s\S]*?)>/g)) {
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

function fill(entry) {
  const abs = path.join(RA, entry.file || '');
  const base = { ...entry };
  if (!entry.file || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return { ...base, fileMissing: true, testIDs: [], accessibilityLabels: [], buttonLabels: [], components: {}, pickers: [], menus: [], navTargets: [], tables: [], rpcs: [], repoMethods: [], imports: [], lineCount: 0, titleInSource: null };
  }
  const src = fs.readFileSync(abs, 'utf8');
  const r = process_(src);
  const menus = new Set(r.menus);
  if (/[\\/]\(tabs\)[\\/]/.test(entry.file.replace(/\//g, '\\')) || /\/\(tabs\)\//.test(entry.file)) menus.add('tabs');
  if (r._appChrome) ['drawer', 'options', 'settings', 'switcher'].forEach(x => menus.add(x));
  delete r._appChrome;
  r.menus = ['drawer', 'options', 'settings', 'switcher', 'tabs'].filter(x => menus.has(x));
  return { ...base, ...r };
}

// completeness
const files = [
  ...walk(path.join(RA, 'apps/mobile/app')),
  ...(fs.existsSync(path.join(RA, 'modules')) ? fs.readdirSync(path.join(RA, 'modules')).flatMap(m => walk(path.join(RA, 'modules', m, 'src/screens'))) : []),
].map(f => path.relative(RA, f).replace(/\\/g, '/'));
const covered = new Set(routes.map(r => r.file));
const uncoveredFiles = files.filter(f => !covered.has(f)).sort();
const entries = [...routes];
for (const f of uncoveredFiles) {
  const mm = f.match(/^modules\/([^/]+)\//);
  const kebab = path.basename(f, '.tsx').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  entries.push({ key: kebab, kind: 'sub-view', mounted: 'unknown', notes: 'uncovered by routes.json', module: mm ? mm[1] : (f.startsWith('apps/mobile/') ? 'mobile-app' : 'unknown'), file: f, roles: [] });
}

const used = new Set();
const screens = entries.map(e => {
  let key = e.key, n = 2;
  while (used.has(key)) key = `${e.key}-${n++}`;
  used.add(key);
  return fill({ ...e, key });
}).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

const out = {
  version: 1, app: 'JobCore', appVersion: '0.3.0',
  apk: 'app/apps/mobile/jobcore-0.3.0-vc5.apk (untracked, .gitignore:28)',
  generatedBy: 'docs/snapshots/_tools/extract.mjs', generatedFrom: 'extract.mjs',
  screens, uncoveredFiles,
};
fs.writeFileSync(path.join(dir, 'screens.json'), JSON.stringify(out, null, 2));
const srcFiles = new Set(screens.filter(s => s.file && !s.fileMissing).map(s => s.file));
console.log(`screens.json: ${screens.length} screens, ${srcFiles.size} source files, ${uncoveredFiles.length} uncovered files`);
