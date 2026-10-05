import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(scriptDir, '..', 'ui-inventory.html');
const outPath = path.join(scriptDir, 'pagination.json');
const check = process.argv.slice(2).includes('--check');

// Page geometry (A4 landscape, 96dpi): 188mm content height, 277mm content width.
const MM = 96 / 25.4;
const PAGE_H_MM = 188;
const PAGE_W_MM = 277;
// Approximate height (mm) of the compact repeated header on continuation pages.
const CONT_HEADER_MM = 14;
// Print card/cont padding (8px top + 8px bottom).
const PAD_PX = 16;
// Slack for rounding and borders.
const SAFETY_PX = 24;
const EDGE_TIMEOUT_MS = 60000;

const EDGES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = EDGES.find((p) => fs.existsSync(p));
if (!edge) {
  console.error('paginate: Microsoft Edge not found in either standard location');
  process.exit(2);
}

const measure = `(${function (cfg) {
  const out = {};
  const st = document.createElement('style');
  st.textContent =
    '.pbrk{display:block !important}.cont{display:none !important}' +
    'body{width:' + cfg.pageW + 'px !important;margin:0 !important}' +
    '.screen-card{width:' + cfg.pageW + 'px !important;height:auto !important;overflow:visible !important;break-before:auto !important}';
  document.head.appendChild(st);
  const h = (el) => {
    const cs = getComputedStyle(el);
    return el.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  };
  const cards = document.querySelectorAll('article.screen-card');
  cards.forEach((card) => {
    const key = card.id.replace(/^screen-/, '');
    const info = card.querySelector('.info');
    if (!info) return;
    const units = Array.from(info.querySelectorAll('[data-u]'))
      .sort((a, b) => Number(a.dataset.u) - Number(b.dataset.u));
    const heights = units.map(h);
    const isH3 = units.map((u) => u.tagName === 'H3');
    let header = 0;
    if (units.length) {
      header = Math.max(0, units[0].getBoundingClientRect().top - info.getBoundingClientRect().top);
    }
    const first = Math.max(1, cfg.pageH - cfg.padSafety - header);
    const cont = Math.max(1, cfg.pageH - cfg.padSafety - cfg.contHeader);
    const breaks = [];
    let budget = first, used = 0, start = 0;
    for (let i = 0; i < units.length; i++) {
      if (used + heights[i] > budget && i > start) {
        let b = i;
        if (isH3[i - 1] && i - 1 > start) b = i - 1;
        breaks.push(b);
        budget = cont; used = 0; start = b;
        for (let j = b; j <= i; j++) used += heights[j];
        continue;
      }
      used += heights[i];
    }
    out[key] = breaks;
  });
  const pre = document.createElement('pre');
  pre.id = 'pg-result';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
}.toString()})(${JSON.stringify({
  pageW: Math.round(PAGE_W_MM * MM),
  pageH: Math.round(PAGE_H_MM * MM),
  contHeader: Math.round(CONT_HEADER_MM * MM),
  padSafety: PAD_PX + SAFETY_PX,
})});`;

// Check mode: measure actual overflow of the baked cards and .cont sections.
const measureCheck = `(function(){
  const PH = ${Math.round(PAGE_H_MM * MM)};
  const res = { over: [], cards: 0, maxPages: 1 };
  const st = document.createElement('style');
  st.textContent = '.info .pbrk{display:none !important}.cont{display:block !important;padding:8px;box-sizing:border-box}' +
    '.screen-card{display:flex;box-sizing:border-box;padding:8px;gap:12px}' +
    'body{width:${Math.round(PAGE_W_MM * MM)}px !important;margin:0 !important}' +
    '.screen-card,.cont{width:${Math.round(PAGE_W_MM * MM)}px !important;height:auto !important;overflow:visible !important}' +
    '.mock .jc-device{zoom:1.05;margin:0}main[data-device="pad"] .mock .jc-device{zoom:.78;margin:0}';
  document.head.appendChild(st);
  const pages = {};
  document.querySelectorAll('article.screen-card').forEach((c) => {
    res.cards++;
    const k = c.id.replace(/^screen-/, '');
    pages[k] = 1;
    if (c.getBoundingClientRect().height > PH + 1) res.over.push(k);
  });
  document.querySelectorAll('[data-cont-of]').forEach((c) => {
    const k = c.getAttribute('data-cont-of');
    pages[k] = (pages[k] || 1) + 1;
    if (c.getBoundingClientRect().height > PH + 1) res.over.push(k + ' (cont)');
  });
  res.maxPages = Math.max(1, ...Object.values(pages));
  const pre = document.createElement('pre');
  pre.id = 'pg-result';
  pre.textContent = JSON.stringify(res);
  document.body.appendChild(pre);
})();`;

const runEdge = (url) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      edge,
      ['--headless', '--disable-gpu', '--virtual-time-budget=5000', '--dump-dom', url],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', () => {});
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Edge timed out after ' + EDGE_TIMEOUT_MS + 'ms'));
    }, EDGE_TIMEOUT_MS);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => { clearTimeout(timer); resolve(stdout); });
  });

let tmp;
try {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const script = '<script>window.addEventListener("load",function(){' + (check ? measureCheck : measure) + '});</script>';
  const injected = html.includes('</body>') ? html.replace('</body>', () => script + '</body>') : html + script;
  tmp = path.join(os.tmpdir(), 'jobcore-paginate-' + process.pid + '.html');
  fs.writeFileSync(tmp, injected, 'utf8');

  const dom = await runEdge(pathToFileURL(tmp).href);
  const m = dom.match(/<pre id="pg-result">([\s\S]*?)<\/pre>/);
  if (!m) throw new Error('measurement result not found in Edge output');
  const text = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const parsed = JSON.parse(text);

  if (check) {
    console.log(`paginate --check: ${parsed.cards} screens measured, ${parsed.over.length} overflowing, max pages for one screen ${parsed.maxPages}`);
    if (parsed.over.length) {
      console.error('overflow: ' + parsed.over.join(', '));
      process.exitCode = 1;
    }
  } else {
    const result = {};
    let withBreaks = 0, maxPages = 1;
    for (const k of Object.keys(parsed).sort()) {
      if (parsed[k].length) {
        result[k] = parsed[k];
        withBreaks++;
        maxPages = Math.max(maxPages, parsed[k].length + 1);
      }
    }
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`paginate: ${Object.keys(parsed).length} screens measured, ${withBreaks} with breaks, max pages for one screen ${maxPages}`);
  }
} catch (e) {
  console.error('paginate: ' + e.message);
  process.exitCode = 2;
} finally {
  if (tmp) { try { fs.unlinkSync(tmp); } catch {} }
}
