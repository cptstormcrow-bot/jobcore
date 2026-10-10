// A screen that has no sub-view still registers with null so a lower owner's subView
// can never leak onto it.
export type SubViewOwner = { id: string; subView: string | null };

export function upsertOwner(
  stack: readonly SubViewOwner[],
  id: string,
  subView: string | null,
): SubViewOwner[] {
  if (stack.some((o) => o.id === id)) {
    return stack.map((o) => (o.id === id ? { id, subView } : o));
  }
  return [...stack, { id, subView }];
}

export function removeOwner(stack: readonly SubViewOwner[], id: string): SubViewOwner[] {
  return stack.filter((o) => o.id !== id);
}

export function currentSubView(stack: readonly SubViewOwner[]): string | null {
  const top = stack[stack.length - 1];
  return top ? top.subView : null;
}
