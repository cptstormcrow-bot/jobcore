// capture.mjs - screenshots app screens listed in captures.json using Edge + puppeteer-core.
//
// Login-profile gate: the app needs a signed-in session per role. Jeff signs in ONCE per role
// in headed Edge using the same --user-data-dir (<profilesDir>/<role.profile>). This script then
// reuses that profile headlessly. A page that lands on /sign-in means the profile has no session.
//
// Step {click:'^Text'} matches a label prefix (list rows carry long aria-labels).
// Flags: --only k1,k2   --role af   --log <path>   --profiles <dir>
// stdout: only the final summary line. Exit 0 (even with failures), 2 on config/launch errors.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'captures');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const logPath = flag('log');
const log = (m) => { if (logPath) fs.appendFileSync(logPath, m + '\n'); };
const die = (m) => { log('FATAL ' + m); process.exit(2); };

const only = flag('only') ? flag('only').split(',').map((s) => s.trim()) : null;
const onlyRole = flag('role');
const profilesDir = flag('profiles') || process.env.CAPTURE_PROFILES_DIR || path.join(os.tmpdir(), 'jobcore-capture');

const exe = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (!exe) die('Edge not found');

let cfg;
try { cfg = JSON.parse(fs.readFileSync(path.join(here, 'captures.json'), 'utf8')); }
catch (e) { die('captures.json: ' + e.message); }

fs.mkdirSync(outDir, { recursive: true });
const manifestPath = path.join(outDir, '_manifest.json');
let manifest = {};
if (only && fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { manifest = {}; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text) {
  const deadline = Date.now() + 8000;
  let ok = false;
  while (!ok) {
    ok = await page.evaluate((t) => {
      const norm = (s) => (s || '').replace(/[?▸▾\s]+$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const pre = t.startsWith('^'); const want = norm(pre ? t.slice(1) : t);
      const eq = (v) => (pre ? norm(v).startsWith(want) : norm(v) === want);
      const els = [...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],[role="switch"],button,a,div[role],[aria-label],[data-testid]')]
        .filter((e) => e.getClientRects().length);
      const el = els.find((e) => e.getAttribute('data-testid') === t)
        || els.find((e) => eq(e.getAttribute('aria-label')))
        || els.find((e) => eq(e.textContent));
      if (!el) return false;
      el.scrollIntoView(); el.click(); return true;
    }, text);
    if (!ok) {
      if (Date.now() > deadline) throw new Error('click target not found: ' + text);
      await sleep(250);
    }
  }
  await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {});
  await sleep(600);
}

async function scrollToText(page, text) {
  const deadline = Date.now() + 8000;
  let ok = false;
  while (!ok) {
    ok = await page.evaluate((t) => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const want = norm(t);
      const all = [...document.querySelectorAll('body *')];
      const el = all.find((e) => e.getAttribute('data-testid') === t)
        || all.find((e) => norm(e.getAttribute('aria-label')).includes(want))
        || all.filter((e) => norm(e.textContent).includes(want)).pop();
      if (!el) return false;
      el.scrollIntoView();
      return true;
    }, text);
    if (!ok) {
      if (Date.now() > deadline) throw new Error('scrollTo target not found: ' + text);
      await sleep(250);
    }
  }
  await sleep(300);
}

async function ensureSignedIn(page, label) {
  await page.waitForFunction(() => !location.pathname.includes('/sign-in'), { timeout: 10000 }).catch(() => {});
  if (!page.url().includes('/sign-in')) return;
  const hasAuthKey = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))).catch(() => 'err');
  log(`signin-check ${label} url=${page.url()} hasAuthKey=${hasAuthKey}`);
  throw new Error('not signed in (profile has no session)');
}

let cachedJobId = flag('job') || cfg.jobId || null;
async function pickJobId(page, base, home) {
  if (cachedJobId) return cachedJobId;
  await page.goto(base + home, { waitUntil: 'networkidle0', timeout: 30000 });
  await ensureSignedIn(page, 'pickJobId');
  await clickText(page, 'Menu');
  await clickText(page, 'Jobs');
  await clickText(page, 'Detail');
  await page.waitForFunction(() => location.pathname.includes('/job/'), { timeout: 15000 }).catch(() => {});
  const m = page.url().match(/\/job\/(?:complete\/)?([^/?#]+)/);
  if (!m) throw new Error('no job link found on home');
  return (cachedJobId = m[1]);
}

async function captureOne(page, key, scr, role) {
  let u = scr.url;
  const steps = scr.steps || [];
  if (steps.some((s) => s.pickFirstJob)) u = u.replace('[jobId]', await pickJobId(page, cfg.base, role.home));
  await page.goto(cfg.base + u, { waitUntil: 'networkidle0', timeout: 30000 });
  if (scr.role !== 'anon') await ensureSignedIn(page, key);
  for (const s of steps) {
    if (s.click) await clickText(page, s.click);
    else if (s.scrollTo) await scrollToText(page, s.scrollTo);
  }
  if (scr.waitFor) {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, scr.waitFor)
      .catch((e) => log(`${key}: waitFor not met (${e.message.slice(0, 80)})`));
  }
  await page.screenshot({ path: path.join(outDir, key + '.png'), type: 'png', fullPage: false });
}

// group screens by role
const groups = {};
for (const [key, scr] of Object.entries(cfg.screens)) {
  if (only && !only.includes(key)) continue;
  if (onlyRole && scr.role !== onlyRole) continue;
  if (scr.skip) { manifest[key] = { status: 'skipped', reason: typeof scr.skip === 'string' ? scr.skip : 'skip' }; continue; }
  (groups[scr.role] ||= []).push([key, scr]);
}

for (const [roleName, items] of Object.entries(groups)) {
  const role = cfg.roles[roleName];
  if (!role) { items.forEach(([k]) => { manifest[k] = { status: 'failed', reason: 'unknown role ' + roleName }; }); continue; }
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: exe,
      headless: true,
      dumpio: true,
      userDataDir: path.join(profilesDir, role.profile),
      args: ['--disable-gpu', '--no-first-run'],
      defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    });
  } catch (e) { die(`launch ${roleName}: ` + ((e && e.message) ? e.message : String(e)) + '\n' + ((e && e.stack) ? e.stack : '')); }
  for (const [key, scr] of items) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => localStorage.setItem('app.settings.show-screen-numbers', 'true'));
    try {
      await captureOne(page, key, scr, role);
      manifest[key] = { status: 'ok' };
      log('ok ' + key);
    } catch (e) {
      manifest[key] = { status: 'failed', reason: String(e.message).slice(0, 200) };
      log(`failed ${key}: ${manifest[key].reason}`);
    }
    await page.close().catch(() => {});
  }
  await browser.close().catch(() => {});
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const vals = Object.values(manifest);
const n = (s) => vals.filter((v) => v.status === s).length;
console.log(`capture: ${n('ok')} ok, ${n('failed')} failed, ${n('skipped')} skipped`);
process.exit(0);
