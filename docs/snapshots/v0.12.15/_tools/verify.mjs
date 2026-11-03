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

  const stripData = (h) => h.replace(/<script type="application\/json" id="jobcore-ui-data">[\s\S]*?<\/script>/, '');

  // 9
  for (const [n, h] of Object.entries(htmls)) {
    const t = stripData(h);
    const c = [count(t.toLowerCase(), 'lorem ipsum'), count(t, 'Item title'), count(t, '9:41')];
    add(`9 no placeholder content (${n})`, c.every((x) => x === 0), `lorem=${c[0]} itemTitle=${c[1]} 9:41=${c[2]}`);
  }

  // 10
  for (const [n, h] of Object.entries(htmls)) {
    const c = [count(h, 'jc-device'), count(h, 'jobcore-ui-device'), count(h, 'data-device=')];
    add(`10 device frame present (${n})`, c.every((x) => x >= 1), `jc-device=${c[0]} jobcore-ui-device=${c[1]} data-device=${c[2]}`);
  }

  // 11
  for (const [n, h] of Object.entries(htmls)) {
    const c = count(h, 'data-device-btn=');
    add(`11 Phone|Pad toggle (${n})`, c >= 1 && h.includes('>Phone<') && h.includes('>Pad<'), `data-device-btn count=${c}`);
  }

  // 12
  for (const [n, h] of Object.entries(htmls)) {
    const c = count(stripData(h), 'Dev Owner');
    add(`12 no Dev Owner in mockups (${n})`, c === 0, `count=${c}`);
  }

  // continuation blocks (inventory only)
  const contBlocks = [];
  {
    const re = /<section class="cont"[^>]*>/g;
    let m;
    while ((m = re.exec(inv))) {
      const tag = m[0];
      const start = m.index;
      // body: up to the matching </section> (depth-aware)
      let depth = 1, pos = start + tag.length;
      const tr = /<section\b|<\/section>/g;
      tr.lastIndex = pos;
      let t;
      while ((t = tr.exec(inv))) {
        depth += t[0] === '</section>' ? -1 : 1;
        if (depth === 0) { pos = t.index + t[0].length; break; }
      }
      const of = (tag.match(/data-cont-of="([^"]*)"/) || [])[1];
      contBlocks.push({ tag, of, html: inv.slice(start, pos) });
    }
  }

  // 13
  {
    const bad = contBlocks.filter((b) => !b.of || !keys.includes(b.of) || count(inv, `id="screen-${b.of}"`) < 1).map((b) => b.of || '(none)');
    add('13 data-cont-of targets real screens', bad.length === 0, bad.slice(0, 10).join(', ') || `${contBlocks.length} cont blocks`);
  }

  // 14
  {
    const bad = contBlocks.filter((b) => /\bid=/.test(b.tag) || b.html.includes('<!-- screen:') || b.html.includes('<!-- /screen:')).map((b) => b.of);
    add('14 continuation blocks have no id or screen marker', bad.length === 0, bad.slice(0, 10).join(', '));
  }

  // 15
  {
    const pj = path.join(scriptDir, 'pagination.json');
    if (!fs.existsSync(pj)) add('15 pagination.json consistent', true, 'no pagination.json (all screens single-page)');
    else {
      const bad = [];
      let pag = null;
      try { pag = JSON.parse(fs.readFileSync(pj, 'utf8')); } catch (e) { bad.push(`invalid JSON: ${e.message}`); }
      if (pag && typeof pag === 'object' && !Array.isArray(pag)) {
        for (const [k, arr] of Object.entries(pag)) {
          if (!keys.includes(k)) { bad.push(`${k}:unknown key`); continue; }
          const okArr = Array.isArray(arr) && arr.every((x, i) => Number.isInteger(x) && x >= 1 && (i === 0 || x > arr[i - 1]));
          if (!okArr) { bad.push(`${k}:not strictly ascending ints >=1`); continue; }
          const n = contBlocks.filter((b) => b.of === k).length;
          if (n !== arr.length) bad.push(`${k}:cont=${n} vs ${arr.length}`);
        }
      } else if (pag) bad.push('not an object');
      add('15 pagination.json consistent', bad.length === 0, bad.slice(0, 10).join(', '));
    }
  }

  // 16
  {
    const bad = [];
    for (const b of contBlocks) {
      const h = (b.html.match(/<[^>]*class="[^"]*\bcont-head\b[^"]*"[^>]*>([\s\S]*?)<\/(\w+)>/) || [])[0];
      const card = inv.match(new RegExp(`<!-- screen:${b.of} -->[\\s\\S]*?<h2[^>]*>([\\s\\S]*?)</h2>`));
      const title = card ? card[1].replace(/<[^>]+>/g, '').trim() : '';
      const headText = h ? h.replace(/<[^>]+>/g, '') : '';
      if (!h || !title || !headText.includes(title)) bad.push(b.of);
    }
    add('16 continuation heads carry screen title', bad.length === 0, bad.slice(0, 10).join(', '));
  }
}

const passed = checks.filter((c) => c.pass).length;
const pass = checks.length > 0 && passed === checks.length;
fs.writeFileSync(path.join(scriptDir, 'verify.json'), JSON.stringify({ pass, checks }, null, 2));
console.log(`verify: ${passed}/${checks.length} checks pass -> verify.json`);
process.exit(pass ? 0 : 1);
