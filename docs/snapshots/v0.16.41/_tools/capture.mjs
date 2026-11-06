// capture.mjs - screenshots app screens listed in captures.json using Edge + puppeteer-core.
//
// Login-profile gate: the app needs a signed-in session per role. Jeff signs in ONCE per role
// in headed Edge using the same --user-data-dir (<profilesDir>/<role.profile>). This script then
// reuses that profile headlessly. A page that lands on /sign-in means the profile has no session.
//
// Step {click:'^Text'} matches a label prefix (list rows carry long aria-labels).
// Step {back:true} goes back one history entry (a stage that pushes its own route).
// A recipe's testJob block replaces its skip only when --job <id> names a test job.
// Flags: --only k1,k2   --role af   --job <id>   --log <path>   --profiles <dir>
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

const SCREEN_LIMIT_MS = 120000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text) {
  const deadline = Date.now() + 8000;
  let ok = false;
  while (!ok) {
    ok = await page.evaluate((t) => {
      const norm = (s) => (s || '').replace(/[?▸▾\s]+$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const pre = t.startsWith('^'); const has = t.startsWith('~'); const want = norm(pre || has ? t.slice(1) : t);
      const eq = (v) => (pre ? norm(v).startsWith(want) : has ? norm(v).includes(want) : norm(v) === want);
      const els = [...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],[role="switch"],button,a,div[role],[aria-label],[data-testid]')]
        .filter((e) => e.getClientRects().length);
      // a contains-match also hits every wrapper around the text, so take the innermost
      const hits = has ? els.filter((e) => eq(e.textContent)) : [];
      const el = has ? hits.find((m) => !hits.some((o) => o !== m && m.contains(o)))
        : els.find((e) => e.getAttribute('data-testid') === t)
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
  // job screens keep requests open, so the default 30s idle wait would run out on every click
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
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
  // A view that keeps a request open (e.g. #0018 Close-Out) never goes idle; waitFor below still guards the content.
  await page.goto(cfg.base + u, { waitUntil: 'networkidle0', timeout: 30000 }).catch((e) => { if (!/timeout/i.test(String(e))) throw e; });
  if (scr.role !== 'anon') await ensureSignedIn(page, key);
  for (const s of steps) {
    log(`step ${key}: ${JSON.stringify(s)}`);
    if (s.click) await clickText(page, s.click);
    else if (s.scrollTo) await scrollToText(page, s.scrollTo);
    else if (s.back) { await page.evaluate(() => history.back()); await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {}); await sleep(1500); }
  }
  if (scr.waitFor) {
    try {
      await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, scr.waitFor);
    } catch {
      const seen = await page.evaluate(() => location.pathname + ' | ' + document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '');
      throw new Error('waitFor not met: ' + scr.waitFor + ' (saw: ' + seen + ')');
    }
  }
  await page.screenshot({ path: path.join(outDir, key + '.png'), type: 'png', fullPage: false });
}

// every non-skipped recipe must declare a waitFor
const noWait = Object.entries(cfg.screens).filter(([, v]) => !v.skip && !v.waitFor).map(([k]) => k);
if (noWait.length) { console.error('recipes missing waitFor: ' + noWait.join(', ')); die('recipes missing waitFor: ' + noWait.join(', ')); }

// group screens by role
const groups = {};
for (const [key, raw] of Object.entries(cfg.screens)) {
  if (only && !only.includes(key)) continue;
  // a skipped stage that writes to the job runs only with an explicit --job (a test job)
  const scr = raw.testJob && flag('job') ? { role: raw.role, url: raw.url, ...raw.testJob } : raw;
  if (onlyRole && scr.role !== onlyRole) continue;
  if (scr.skip) { manifest[key] = { status: 'skipped', reason: typeof scr.skip === 'string' ? scr.skip : 'skip' }; continue; }
  (groups[scr.role] ||= []).push([key, scr]);
}

for (const [roleName, items] of Object.entries(groups)) {
  const role = cfg.roles[roleName];
  if (!role) { items.forEach(([k]) => { manifest[k] = { status: 'failed', reason: 'unknown role ' + roleName }; }); continue; }
  // A page stuck in a render loop never answers evaluate/screenshot, so each screen gets a hard limit
  // and the browser is relaunched after a stuck screen.
  const launch = async () => {
    try {
      return await puppeteer.launch({
        executablePath: exe,
        headless: true,
        dumpio: true,
        userDataDir: path.join(profilesDir, role.profile),
        args: ['--disable-gpu', '--no-first-run'],
        defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
      });
    } catch (e) { die(`launch ${roleName}: ` + ((e && e.message) ? e.message : String(e)) + '\n' + ((e && e.stack) ? e.stack : '')); }
  };
  let browser = await launch();
  for (const [key, scr] of items) {
    const page = await browser.newPage();
    const errs = new Set();
    page.on('pageerror', (e) => errs.add(String(e.message).slice(0, 160)));
    await page.evaluateOnNewDocument(() => localStorage.setItem('app.settings.show-screen-numbers', 'true'));
    let stuck = false;
    try {
      let timer;
      const limit = new Promise((_, rej) => { timer = setTimeout(() => { stuck = true; rej(new Error('screen time limit reached (page not responding)')); }, SCREEN_LIMIT_MS); });
      await Promise.race([captureOne(page, key, scr, role), limit]).finally(() => clearTimeout(timer));
      manifest[key] = { status: 'ok' };
      log('ok ' + key);
    } catch (e) {
      fs.rmSync(path.join(outDir, key + '.png'), { force: true }); // hard failure: never leave a stale PNG
      manifest[key] = { status: 'failed', reason: String(e.message).slice(0, 200) };
      log(`failed ${key}: ${e.message}`); // full text in the log; the manifest keeps the short form
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); // survives a killed run
    if (errs.size) log(`pageerror ${key}: ${[...errs].join(' || ')}`);
    if (stuck) {
      const old = browser;
      await Promise.race([old.close(), sleep(5000)]).catch(() => {});
      try { old.process()?.kill('SIGKILL'); } catch {}
      await sleep(1500);
      browser = await launch();
    } else {
      await Promise.race([page.close(), sleep(5000)]).catch(() => {});
    }
  }
  await Promise.race([browser.close(), sleep(5000)]).catch(() => {});
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
const vals = Object.values(manifest);
const n = (s) => vals.filter((v) => v.status === s).length;
console.log(`capture: ${n('ok')} ok, ${n('failed')} failed, ${n('skipped')} skipped`);
process.exit(0);
