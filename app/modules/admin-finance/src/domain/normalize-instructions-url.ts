/**
 * Forgiving cleanup for a pasted Instructions URL (uber 218).
 * Trims spaces, adds https:// when no scheme was typed, and only accepts http(s).
 * Returns null for blank or unusable input so the caller stores "no link".
 */
export function normalizeInstructionsUrl(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (!text || /\s/.test(text)) return null;
  let candidate = text;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    if (!/^https?:\/\//i.test(candidate)) return null;
  } else if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(candidate)) {
    return null; // javascript:, mailto:, data: ...
  } else {
    candidate = `https://${candidate.replace(/^\/\//, '')}`;
  }
  try {
    const host = new URL(candidate).hostname;
    return host.includes('.') || host === 'localhost' ? candidate : null;
  } catch {
    return null;
  }
}
