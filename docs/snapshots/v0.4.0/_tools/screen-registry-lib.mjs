// Pure screen-registry helpers. No fs/git/Date access: everything is passed in.

export function formatNumber(n) {
  if (!Number.isInteger(n) || n < 1 || n > 9999) {
    throw new RangeError(`screen number out of range (1..9999): ${n}`);
  }
  return String(n).padStart(4, '0');
}

export function stampLine({ number, key, title }) {
  return `// JobCore screen #${formatNumber(number)} - ${key} - ${title}`;
}

const STAMP_RE = /^\/\/ JobCore screen #(\d{4}) - (\S+) - (.*)$/;

export function parseStampLine(line) {
  const m = STAMP_RE.exec(String(line).replace(/\r$/, ''));
  if (!m) return null;
  return { number: Number(m[1]), key: m[2], title: m[3] };
}

export function parseStampLines(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const p = parseStampLine(line);
    if (!p) break;
    out.push(p);
  }
  return out;
}

export function orderCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    if (a.file < b.file) return -1;
    if (a.file > b.file) return 1;
    return 0;
  });
}

export function mintNumbers(registry, candidates, now) {
  const candKeys = new Set(candidates.map((c) => c.key));
  const known = new Set(registry.map((e) => e.key));
  const retired = [];
  const next = registry.map((e) => {
    const copy = { ...e };
    if (!candKeys.has(e.key) && !e.retiredAt) {
      copy.retiredAt = now;
      retired.push(copy);
    } else if (candKeys.has(e.key) && e.retiredAt && e.retiredInto === undefined) {
      delete copy.retiredAt;
    }
    return copy;
  });
  let max = registry.reduce((m, e) => Math.max(m, e.number), 0);
  const added = [];
  for (const c of orderCandidates(candidates.filter((c) => !known.has(c.key)))) {
    max += 1;
    const entry = {
      number: max, key: c.key, title: c.title, route: c.route,
      file: c.file, createdAt: c.createdAt,
    };
    if (c.subView !== undefined) entry.subView = c.subView;
    added.push(entry);
    next.push(entry);
  }
  return { registry: next, added, retired };
}

export function checkRegistry(registry, screenKeys) {
  const problems = [];
  const seenNum = new Set();
  const seenActive = new Set();
  for (const e of registry) {
    if (seenNum.has(e.number)) problems.push(`duplicate number: ${e.number}`);
    seenNum.add(e.number);
    if (!e.retiredAt) {
      if (seenActive.has(e.key)) problems.push(`duplicate active key: ${e.key}`);
      seenActive.add(e.key);
    }
  }
  const keys = new Set(screenKeys);
  const byNumber = new Map(registry.map((e) => [e.number, e]));
  const targetActive = (n) => {
    const t = byNumber.get(n);
    return t !== undefined && !t.retiredAt;
  };
  for (const k of keys) {
    if (seenActive.has(k)) continue;
    const forwarded = registry.some((e) => e.key === k && e.retiredAt
      && e.retiredInto !== undefined && targetActive(e.retiredInto));
    if (!forwarded) problems.push(`screen key has no active entry: ${k}`);
  }
  for (const e of registry) {
    if (e.retiredInto !== undefined && !targetActive(e.retiredInto)) {
      problems.push(`retiredInto target not active: ${e.number} -> ${e.retiredInto}`);
    }
  }
  for (const k of seenActive) {
    if (!keys.has(k)) problems.push(`active entry not in screen keys: ${k}`);
  }
  return problems;
}

export function lookup(registry, n) {
  return registry.find((e) => e.number === n) ?? null;
}
