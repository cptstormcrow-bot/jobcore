import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const out = oi >= 0 && argv[oi + 1] ? path.resolve(argv[oi + 1]) : path.resolve(scriptDir, '..');

const count = (s, sub) => s.split(sub).length - 1;
const checks = [];
const add = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });

let data, dataText, screens, inv, story;
try {
  dataText = fs.readFileSync(path.join(out, 'ui-data.json'), 'utf8');
  data = JSON.parse(dataText);
  inv = fs.readFileSync(path.join(out, 'ui-inventory.html'), 'utf8');
  story = fs.readFileSync(path.join(out, 'ui-storyboard.html'), 'utf8');
  screens = JSON.parse(fs.readFileSync(path.join(scriptDir, 'screens.json'), 'utf8')).screens;
} catch (e) {
  add('load inputs', false, e.message);
}

if (data) {
  const htmls = { inventory: inv, storyboard: story };
  const keys = screens.map((s) => s.key);

  add('1 screen count matches', Array.isArray(data.screens) && screens.length === data.screens.length,
    `screens.json=${screens.length} ui-data=${data.screens && data.screens.length}`);

  // 2
  const want = JSON.stringify(data);
  for (const [n, h] of Object.entries(htmls)) {
    let ok = false, d = '';
    const m = h.match(/<script type="application\/json" id="jobcore-ui-data">([\s\S]*?)<\/script>/);
    if (!m) d = 'block not found';
    else {
      try {
        ok = JSON.stringify(JSON.parse(m[1].split('<\\/').join('</'))) === want;
        if (!ok) d = 'differs from ui-data.json';
      } catch (e) { d = e.message; }
    }
    add(`2 embedded data equals ui-data.json (${n})`, ok, d);
  }

  // 3
  for (const [n, h] of Object.entries(htmls)) {
    const bad = [];
    for (const k of keys) {
      if (count(h, `<!-- screen:${k} -->`) !== 1) bad.push(`${k}:open`);
      if (count(h, `<!-- /screen:${k} -->`) !== 1) bad.push(`${k}:close`);
      if (count(h, `id="screen-${k}"`) !== 1) bad.push(`${k}:id`);
      if (n === 'storyboard' && count(h, `data-screen-key="${k}"`) < 2) bad.push(`${k}:data-screen-key`);
    }
    add(`3 screen markers (${n})`, bad.length === 0, bad.slice(0, 10).join(', '));
  }

  // 4
  for (const [n, h] of Object.entries(htmls)) {
    const after = h.replace(/^\s*<!doctype html>\s*/i, '');
    let ok = after.startsWith('<!-- AI-INDEX');
    let d = ok ? '' : 'does not start with AI-INDEX';
    if (ok) {
      const end = after.indexOf('-->');
      const block = after.slice(0, end);
      const miss = keys.filter((k) => !block.includes(k));
      ok = miss.length === 0;
      d = miss.join(', ');
    }
    add(`4 AI-INDEX lists all keys (${n})`, ok, d);
  }

  // 5
  for (const [n, h] of Object.entries(htmls)) {
    const c = (h.match(/data-sort=/g) || []).length;
    add(`5 sort toggle (${n})`, c >= 2 && h.includes('Alphabetical'), `data-sort count=${c}`);
  }

  // 6
  {
    const files = [...new Set(screens.map((s) => s.file))];
    const miss = files.filter((f) => !inv.includes(f));
    add('6 files appear in inventory', miss.length === 0, miss.slice(0, 10).join(', '));
  }

  // 7
  {
    const bad = [];
    for (const k of ['edges', 'redundant', 'missing', 'jobFlowOrder', 'specStages']) if (!Array.isArray(data[k])) bad.push(k);
    for (const k of ['apk', 'howToUpdate']) if (typeof data[k] !== 'string') bad.push(k);
    add('7 ui-data fields', bad.length === 0, bad.join(', '));
  }

  // 8
  {
    const found = [...inv.matchAll(/<!-- screen:([^\s>]+) -->/g)].map((m) => m[1]);
    const sorted = [...found].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    add('8 inventory source order ascending', found.length > 0 && found.every((k, i) => k === sorted[i]),
      `${found.length} wrappers`);
  }
}

const passed = checks.filter((c) => c.pass).length;
const pass = checks.length > 0 && passed === checks.length;
fs.writeFileSync(path.join(scriptDir, 'verify.json'), JSON.stringify({ pass, checks }, null, 2));
console.log(`verify: ${passed}/${checks.length} checks pass -> verify.json`);
process.exit(pass ? 0 : 1);
