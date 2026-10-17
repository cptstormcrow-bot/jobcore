export interface NumberedArea {
  n: number;
  id: string;
  name: string;
}

/** Numbers areas 1..n by list position, in the order given (callers pass the existing name order). Display-only; no DB field. */
export function numberAreas(areas: ReadonlyArray<{ id: string; name: string }>): NumberedArea[] {
  return areas.map((a, i) => ({ n: i + 1, id: a.id, name: a.name }));
}
