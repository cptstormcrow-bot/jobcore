#!/usr/bin/env node
/**
 * text-codemod.mjs — FX-31/FX-33..36 (JobCore redlines fix cycle)
 *
 * For each .ts/.tsx file under the given path(s):
 *   - Remove `Text` from a `react-native` named-import statement (drop the
 *     whole import statement if it becomes empty; other specifiers and
 *     formatting are left untouched).
 *   - Add/merge `Text` into a named import from the ui package
 *     (default '@jobcore/ui').
 *
 * Never matches `TextInput`, `TextStyle`, or any other identifier that
 * merely starts with "Text" — only the exact bare specifier `Text`.
 * Aliased forms (`Text as RNText`) are never auto-rewritten; they are
 * reported in the summary so a human/spec can decide.
 * Files under packages/ui are always skipped (the ui Text implementation
 * itself must keep importing RN's Text — no self-imports).
 * Idempotent: a file whose react-native import has no bare `Text` specifier
 * and whose ui import already carries `Text` is left untouched.
 *
 * Usage:
 *   node app/scripts/text-codemod.mjs [--dry-run] [--ui-package=@jobcore/ui] <path...>
 *
 * <path...> are one or more files or directories, resolved relative to the
 * current working directory (matches the plan's F7 `files` entries, which
 * are directory-prefix paths relative to app/, e.g. run with cwd=app/ and
 * pass `apps/mobile/`, `modules/admin-finance/src/`, etc).
 *
 * --dry-run: makes no writes; prints each file that would change, then a
 * final summary line `changed N / scanned M`.
 */

import fs from 'node:fs';
import path from 'node:path';

const UI_SKIP_SEGMENT = `packages${path.sep}ui${path.sep}`;
const UI_SKIP_SEGMENT_POSIX = 'packages/ui/';

let dryRun = false;
let uiPackage = '@jobcore/ui';
const targets = [];

for (const arg of process.argv.slice(2)) {
  if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg.startsWith('--ui-package=')) {
    uiPackage = arg.slice('--ui-package='.length);
  } else {
    targets.push(arg);
  }
}

if (targets.length === 0) {
  console.error('Usage: node text-codemod.mjs [--dry-run] [--ui-package=@jobcore/ui] <path...>');
  process.exit(2);
}

function isUiInternal(filePath) {
  const norm = filePath.split(path.sep).join('/');
  return norm.includes(UI_SKIP_SEGMENT_POSIX);
}

function walk(target, out) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(target, entry.name);
      if (entry.isDirectory()) {
        walk(full, out);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
  } else if (stat.isFile() && /\.(ts|tsx)$/.test(target)) {
    out.push(target);
  }
}

const files = [];
for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.error(`WARN: path does not exist, skipping: ${t}`);
    continue;
  }
  walk(t, files);
}

// Matches a react-native named-import statement, capturing the specifier list.
// Handles both single and double quotes, and trailing semicolon optional.
const RN_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])react-native\2\s*;?/;

function splitSpecifiers(raw) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function findUiImportRegex(pkg) {
  const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*(['"])${escaped}\\2\\s*;?`);
}

function processFile(filePath, pkg) {
  const src = fs.readFileSync(filePath, 'utf8');
  const rnMatch = src.match(RN_IMPORT_RE);

  if (!rnMatch) {
    return { changed: false, aliased: false };
  }

  const specifiers = splitSpecifiers(rnMatch[1]);

  // Exact bare "Text" only — never TextInput/TextStyle/etc.
  const hasBareText = specifiers.some((s) => s === 'Text');
  const aliasedText = specifiers.find((s) => /^Text\s+as\s+\S+$/.test(s));

  if (aliasedText) {
    // Report-only: never guess/auto-rewrite an aliased import.
    return { changed: false, aliased: true, aliasForm: aliasedText };
  }

  if (!hasBareText) {
    return { changed: false, aliased: false };
  }

  const remaining = specifiers.filter((s) => s !== 'Text');

  let newSrc;
  if (remaining.length === 0) {
    // Drop the whole react-native import statement.
    newSrc = src.replace(RN_IMPORT_RE, '').replace(/\n{3,}/g, '\n\n');
  } else {
    const rebuilt = `import { ${remaining.join(', ')} } from 'react-native';`;
    newSrc = src.replace(RN_IMPORT_RE, rebuilt);
  }

  // Merge/add Text into the ui-package import.
  const uiRe = findUiImportRegex(pkg);
  const uiMatch = newSrc.match(uiRe);

  if (uiMatch) {
    const uiSpecs = splitSpecifiers(uiMatch[1]);
    if (!uiSpecs.includes('Text')) {
      uiSpecs.push('Text');
    }
    const rebuiltUi = `import { ${uiSpecs.join(', ')} } from '${pkg}';`;
    newSrc = newSrc.replace(uiRe, rebuiltUi);
  } else {
    const newImportLine = `import { Text } from '${pkg}';\n`;
    // Insert after the last top-of-file import line if any, else at the top.
    const importLineRe = /^import .*\n/gm;
    let lastImportEnd = 0;
    let m;
    while ((m = importLineRe.exec(newSrc)) !== null) {
      lastImportEnd = m.index + m[0].length;
    }
    newSrc = newSrc.slice(0, lastImportEnd) + newImportLine + newSrc.slice(lastImportEnd);
  }

  if (newSrc === src) {
    return { changed: false, aliased: false };
  }

  if (!dryRun) {
    fs.writeFileSync(filePath, newSrc, 'utf8');
  }

  return { changed: true, aliased: false };
}

let changed = 0;
let scanned = 0;
const aliasedReports = [];

for (const file of files) {
  if (isUiInternal(file)) continue;
  scanned += 1;
  const result = processFile(file, uiPackage);
  if (result.aliased) {
    aliasedReports.push(`${file}: ${result.aliasForm}`);
    continue;
  }
  if (result.changed) {
    changed += 1;
    console.log(`${dryRun ? 'WOULD CHANGE' : 'CHANGED'}: ${file}`);
  }
}

if (aliasedReports.length > 0) {
  console.log('ALIASED (not auto-rewritten, needs review):');
  for (const line of aliasedReports) console.log(`  ${line}`);
}

console.log(`changed ${changed} / scanned ${scanned}`);
