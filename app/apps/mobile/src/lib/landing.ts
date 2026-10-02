/** Role-based landing route (all roles). No runtime imports. Never returns '/'. */
const ROLE_MODULE: Record<string, string> = {
  owner: 'admin-finance',
  admin: 'admin-finance',
  tech: 'field-tech',
  sales: 'sales-marketing',
};

export function landingRouteFor(
  role: string | null | undefined,
  moduleIds: readonly string[],
): string {
  const target = role ? ROLE_MODULE[role] : undefined;
  if (target && moduleIds.includes(target)) return `/m/${target}`;
  return moduleIds.length > 0 ? `/m/${moduleIds[0]}` : '/sign-in';
}
