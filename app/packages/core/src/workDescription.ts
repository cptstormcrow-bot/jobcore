/**
 * Short one-line work description for a job, built from its task/line titles.
 * Falls back to the job description (minus any "Service:" line) when no titles exist.
 */
export interface WorkDescriptionOptions {
  maxTitles?: number;
  maxTitleChars?: number;
  maxChars?: number;
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, Math.max(0, max - 3)) + '...' : text;
}

export function summarizeWorkDescription(
  titles: ReadonlyArray<string | null | undefined>,
  fallbackDescription?: string | null,
  opts?: WorkDescriptionOptions,
): string {
  const maxTitles = opts?.maxTitles ?? 3;
  const maxTitleChars = opts?.maxTitleChars ?? 40;
  const maxChars = opts?.maxChars;

  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of titles ?? []) {
    const t = typeof raw === 'string' ? raw.trim() : '';
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(t);
  }

  let out = '';
  if (kept.length > 0) {
    const taken = kept.slice(0, Math.max(0, maxTitles));
    out = taken.map((t) => clip(t, maxTitleChars)).join('; ');
    const rest = kept.length - taken.length;
    if (rest > 0) out += ` +${rest} more`;
  } else {
    let service = '';
    let first = '';
    for (const line of String(fallbackDescription ?? '').split(/\r?\n/)) {
      const l = line.trim();
      if (!l) continue;
      if (/^service:/i.test(l)) {
        if (!service) service = l.slice(l.indexOf(':') + 1).trim();
        continue;
      }
      if (!first) first = l;
    }
    out = first || service;
  }

  return maxChars !== undefined && out.length > maxChars ? clip(out, maxChars) : out;
}
