export const MAX_BEFORE_PHOTOS = 6;

function clean(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, '');
}

export function beforePhotoFileName(
  jobNumber: number | string | null | undefined,
  jobId: string,
  index: number,
): string {
  if (!Number.isInteger(index) || index < 1 || index > MAX_BEFORE_PHOTOS) {
    throw new RangeError(`before-photo index must be an integer 1..${MAX_BEFORE_PHOTOS}`);
  }
  const hasNumber = jobNumber !== null && jobNumber !== undefined && String(jobNumber).trim() !== '';
  const n = hasNumber ? clean(String(jobNumber)) : clean(jobId.slice(0, 8));
  return `${n}BEF-${index}.jpg`;
}

export function beforePhotoSlot(nameOrPath: string): number | null {
  const last = (nameOrPath ?? '').split(/[/\\]/).pop() ?? '';
  const m = /BEF-([1-6])\.jpe?g$/i.exec(last);
  return m ? Number(m[1]) : null;
}

export function nextFreeBeforeSlot(namesOrPaths: string[]): number | null {
  const used = new Set<number>();
  for (const p of namesOrPaths) {
    const s = beforePhotoSlot(p);
    if (s !== null) used.add(s);
  }
  for (let i = 1; i <= MAX_BEFORE_PHOTOS; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}
