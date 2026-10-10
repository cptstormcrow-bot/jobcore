// Screen-number registry CLI. Modes: (none)=mint, --check, --lookup N, --stamp [--dry-run].
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  stampLine, parseStampLines, orderCandidates, mintNumbers, checkRegistry, lookup,
} from './screen-registry-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.JOBCORE_ROOT || path.resolve(here, '..', '..', '..', '..');
const SCREENS = path.join(here, 'screens.json');
const REGISTRY = path.join(ROOT, 'app', 'apps', 'mobile', 'src', 'screens', 'screen-registry.json');
// screens.json "file" values are relative to <root>/app
const absFile = (f) => path.join(ROOT, 'app', f);
const repoRel = (f) => 'app/' + f.split(String.fromCharCode(92)).join('/');

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

function createdAtOf(f) {
  let out = '';
  try { out = git(['log', '--diff-filter=A', '--follow', '--format=%aI', '--', repoRel(f)]); } catch { /* untracked */ }
  const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length) return lines[lines.length - 1];
  return fs.statSync(absFile(f)).birthtime.toISOString();
}

function loadScreens() {
  const j = JSON.parse(fs.readFileSync(SCREENS, 'utf8'));
  return Array.isArray(j) ? j : j.screens;
}
function loadRegistry() {
  return fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) : null;
}

export function mint() {
  const screens = loadScreens();
  const reg = loadRegistry() ?? [];
  const active = new Set(reg.filter((e) => !e.retiredAt).map((e) => e.key));
  const cache = new Map();
  const cands = screens.filter((s) => !active.has(s.key)).map((s) => {
    if (!cache.has(s.file)) cache.set(s.file, createdAtOf(s.file));
    const c = { key: s.key, title: s.title || s.key, route: s.route, file: s.file, createdAt: cache.get(s.file) };
    if (s.subView) c.subView = s.subView;
    return c;
  });
  // known-but-retired keys that are back are handled by the lib; only pass new ones for ordering
  cands.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)); // key tiebreak (stable sort in lib)
  const all = screens.map((s) => ({ key: s.key, title: s.title || s.key, route: s.route, file: s.file, createdAt: '' }));
  const ordered = orderCandidates(cands);
  const known = new Set(reg.map((e) => e.key));
  const fresh = ordered.filter((c) => !known.has(c.key));
  const revive = all.filter((c) => !fresh.some((f) => f.key === c.key));
  const now = new Date().toISOString().slice(0, 10);
  const res = mintNumbers(reg, [...revive, ...fresh], now);
  const out = res.registry.sort((a, b) => a.number - b.number);
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true });
  fs.writeFileSync(REGISTRY, JSON.stringify(out, null, 2) + '\n');
  const act = out.filter((e) => !e.retiredAt).length;
  console.log(`minted ${res.added.length}, retired ${res.retired.length}, total ${out.length}`);
  return act;
}

export function check() {
  const reg = loadRegistry();
  if (!reg) { console.log('registry missing'); return 1; }
  const probs = checkRegistry(reg, loadScreens().map((s) => s.key));
  if (probs.length) { probs.forEach((p) => console.log(p)); return 1; }
  const a = reg.filter((e) => !e.retiredAt).length;
  console.log(`OK ${a} active, ${reg.length - a} retired`);
  return 0;
}

export function stampFile(file, entries, { dryRun = false } = {}) {
  const buf = fs.readFileSync(file);
  let text = buf.toString('utf8');
  const bom = text.charCodeAt(0) === 0xfeff ? '﻿' : '';
  if (bom) text = text.slice(1);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = [...entries].sort((a, b) => a.number - b.number).map(stampLine);
  const existing = parseStampLines(text).length;
  const rest = text.split('\n').slice(existing).join('\n');
  const next = bom + lines.join(eol) + eol + rest;
  const changed = next !== bom + text;
  if (changed && !dryRun) fs.writeFileSync(file, next);
  return changed;
}

export function stamp(dryRun) {
  const reg = (loadRegistry() ?? []).filter((e) => !e.retiredAt);
  const byFile = new Map();
  for (const e of reg) { if (!byFile.has(e.file)) byFile.set(e.file, []); byFile.get(e.file).push(e); }
  let would = 0, dirty = 0;
  for (const [f, es] of byFile) {
    const st = git(['status', '--porcelain', '--', repoRel(f)]).trim();
    if (st) { dirty++; console.log(`SKIPPED dirty: ${f}`); continue; }
    if (stampFile(absFile(f), es, { dryRun })) { would++; console.log(`${dryRun ? 'would change' : 'stamped'}: ${f}`); }
  }
  console.log(`${dryRun ? 'would change' : 'changed'} ${would}, dirty-skipped ${dirty}`);
  return 0;
}

function main() {
  const a = process.argv.slice(2);
  if (a.includes('--check')) process.exit(check());
  if (a.includes('--lookup')) {
    const e = lookup(loadRegistry() ?? [], Number(a[a.indexOf('--lookup') + 1]));
    if (!e) { console.log('unknown'); process.exit(1); }
    console.log(`#${String(e.number).padStart(4, '0')} ${e.key} - ${e.title} - ${e.file}`);
    process.exit(0);
  }
  if (a.includes('--stamp')) process.exit(stamp(a.includes('--dry-run')));
  mint();
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
