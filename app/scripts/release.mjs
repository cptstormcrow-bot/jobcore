#!/usr/bin/env node
// Release tool: bumps version from Conventional Commits since the last v* tag.
// Zero dependencies. Never pushes. `--dry` writes nothing.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const CO_AUTHOR = 'Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>';

export const NO_TAG_MESSAGE =
  'No v* tag found: release needs a baseline. Tag v0.2.0 on the 0.2.0 release commit ' +
  '(`git tag -a v0.2.0 <sha> -m "v0.2.0"`, find sha with ' +
  "`git log -S'\"version\": \"0.2.0\"' --format=%H -- apps/mobile/app.json`).";

const CONV = /^(feat|fix|perf|docs|chore|test|refactor|ci|style|build|revert)(\([^)]*\))?(!)?: (.*)$/;

export function parseSemver(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  if (!m) throw new Error(`Not a semver: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a, b) {
  const x = parseSemver(a);
  const y = parseSemver(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

export function bumpVersion(v, level) {
  const [maj, min, pat] = parseSemver(v);
  if (level === 'major') return `${maj + 1}.0.0`;
  if (level === 'minor') return `${maj}.${min + 1}.0`;
  if (level === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`Bad level: ${level}`);
}

export function computeBump(commits, currentVersion) {
  const groups = { breaking: [], features: [], fixes: [], perf: [] };
  const warnings = [];
  const below1 = parseSemver(currentVersion)[0] < 1;
  let level = null;
  const rank = { patch: 1, minor: 2, major: 3 };
  const raise = (l) => {
    if (!level || rank[l] > rank[level]) level = l;
  };
  for (const c of commits) {
    const subject = (c.subject ?? '').trim();
    const body = c.body ?? '';
    const m = CONV.exec(subject);
    if (!m) {
      if (!/^(Merge|Revert|fixup!|squash!)/.test(subject)) {
        warnings.push(`Non-conventional subject (ignored): ${c.hash?.slice(0, 7) ?? ''} ${subject}`);
      }
      continue;
    }
    const [, type, , bang, desc] = m;
    const breaking = Boolean(bang) || /^BREAKING[ -]CHANGE:/m.test(body);
    const entry = `${desc} (${c.hash?.slice(0, 7) ?? ''})`;
    if (breaking) {
      groups.breaking.push(entry);
      raise(below1 ? 'minor' : 'major');
    } else if (type === 'feat') {
      groups.features.push(entry);
      raise('minor');
    } else if (type === 'fix') {
      groups.fixes.push(entry);
      raise('patch');
    } else if (type === 'perf') {
      groups.perf.push(entry);
      raise('patch');
    }
  }
  return { level, next: level ? bumpVersion(currentVersion, level) : null, groups, warnings };
}

// Next = max(computed, highest global tag bumped by same level). Throws if tag exists.
export function pickNext(computed, highestGlobalTag, level, existingTags = []) {
  let next = computed;
  if (highestGlobalTag) {
    const floor = bumpVersion(highestGlobalTag, level);
    if (compareSemver(floor, next) > 0) next = floor;
  }
  const tags = new Set(existingTags.map((t) => t.replace(/^v/, '')));
  if (tags.has(next)) throw new Error(`Tag v${next} already exists; aborting.`);
  return next;
}

export function renderChangelogSection(version, date, groups) {
  const out = [`## v${version} — ${date}`, ''];
  const add = (title, items) => {
    if (!items.length) return;
    out.push(`### ${title}`, ...items.map((i) => `- ${i}`), '');
  };
  add('Breaking', groups.breaking);
  add('Features', groups.features);
  add('Fixes', groups.fixes);
  add('Performance', groups.perf);
  return out.join('\n');
}

function git(args) {
  return execFileSync('git', args, { cwd: APP_DIR, encoding: 'utf8' }).trim();
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

function main() {
  const dry = process.argv.includes('--dry');
  const appJsonPath = path.join(APP_DIR, 'apps/mobile/app.json');
  const mobilePkgPath = path.join(APP_DIR, 'apps/mobile/package.json');
  const rootPkgPath = path.join(APP_DIR, 'package.json');
  const changelogPath = path.join(APP_DIR, 'CHANGELOG.md');
  const files = [appJsonPath, mobilePkgPath, rootPkgPath, changelogPath];

  const allTags = git(['tag', '-l', 'v*']).split('\n').filter(Boolean);
  if (!allTags.length) throw new Error(NO_TAG_MESSAGE);

  const dirty = git(['status', '--porcelain', '--', ...files]);
  if (dirty) throw new Error(`Release files have uncommitted changes:\n${dirty}`);
  const highest = [...allTags].sort(compareSemver).at(-1);

  let lastTag;
  try {
    lastTag = git(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
  } catch {
    throw new Error(NO_TAG_MESSAGE);
  }

  const raw = git(['log', '--format=%H%x1f%s%x1f%b%x1e', `${lastTag}..HEAD`]);
  const commits = raw
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.trim())
    .map((r) => {
      const [hash, subject, body] = r.split('\x1f');
      return { hash: hash.trim(), subject: subject ?? '', body: body ?? '' };
    });

  const computed = computeBump(commits, lastTag.replace(/^v/, ''));
  computed.warnings.forEach((w) => console.warn(`WARN: ${w}`));
  if (!computed.level) {
    console.log('nothing to release');
    return;
  }
  const next = pickNext(computed.next, highest, computed.level, allTags);
  const date = new Date().toISOString().slice(0, 10);
  const section = renderChangelogSection(next, date, computed.groups);

  console.log(`Release plan: ${lastTag} -> v${next} (${computed.level}), ${commits.length} commits`);
  console.log(section);
  if (dry) {
    console.log('--dry: nothing written.');
    return;
  }

  const appJson = readJson(appJsonPath);
  appJson.expo.version = next;
  appJson.expo.android = appJson.expo.android ?? {};
  appJson.expo.ios = appJson.expo.ios ?? {};
  appJson.expo.android.versionCode = Number(appJson.expo.android.versionCode ?? 0) + 1;
  appJson.expo.ios.buildNumber = String(Number(appJson.expo.ios.buildNumber ?? 0) + 1);
  writeJson(appJsonPath, appJson);
  for (const p of [mobilePkgPath, rootPkgPath]) {
    const j = readJson(p);
    j.version = next;
    writeJson(p, j);
  }
  let existing = '# Changelog\n';
  try {
    existing = readFileSync(changelogPath, 'utf8');
  } catch {
    // no changelog yet
  }
  const nl = existing.indexOf('\n');
  const head = nl === -1 ? existing + '\n' : existing.slice(0, nl + 1);
  const rest = nl === -1 ? '' : existing.slice(nl + 1);
  const firstH2 = rest.search(/^## /m);
  const intro = firstH2 === -1 ? rest : rest.slice(0, firstH2);
  const entries = firstH2 === -1 ? '' : rest.slice(firstH2);
  writeFileSync(changelogPath, `${head}${intro}${section}\n${entries}`);

  git(['add', '--', ...files]);
  git(['commit', '-m', `chore(release): v${next}\n\n${CO_AUTHOR}`]);
  git(['tag', '-a', `v${next}`, '-m', `v${next}`]);
  console.log(`Released v${next} (committed and tagged locally; not pushed).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
