/** Role-based landing route (tech-only). No runtime imports. */
export function landingRouteFor(
  role: string | null | undefined,
  moduleIds: readonly string[],
): '/m/field-tech' | null {
  return role === 'tech' && moduleIds.includes('field-tech') ? '/m/field-tech' : null;
}
