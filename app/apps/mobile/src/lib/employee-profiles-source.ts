// Read path for employee profile rows (migrations 0110 + 0111).
//
// Pay columns on public.profiles are hidden from other org members. The masked view
// public.employee_profiles_v (0110) shows each pay column only to admins and to the
// row's owner. Once 0111 is applied the table itself refuses reads of the pay columns,
// so list/get reads of employee rows go through the view.
//
// Rollout-proof: until 0110 is applied the view does not exist. A missing-relation
// error (PostgREST PGRST205 or SQL 42P01 naming the view) retries once on the table
// and the answer is remembered for this session. If the table later refuses the read
// with 42501 (0111 landed while the app stayed open) the memo is dropped and the view
// is tried again. So the app works before 0110, between 0110 and 0111, and after 0111.

export const EMPLOYEE_PROFILES_VIEW = 'employee_profiles_v';
export type EmployeeProfilesSource = typeof EMPLOYEE_PROFILES_VIEW | 'profiles';

type SourceError = { code?: string | null; message?: string | null } | null;

let tableFallback = false;

export function isMissingEmployeeProfilesView(error: SourceError): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  return (
    (code === 'PGRST205' || code === '42P01') &&
    (error.message ?? '').includes(EMPLOYEE_PROFILES_VIEW)
  );
}

/**
 * Runs `run` against the masked view; if the view is missing, runs it once on the
 * profiles table instead. `run` builds the whole query for the source it is given.
 */
export async function readEmployeeProfiles<R extends { error: SourceError }>(
  run: (source: EmployeeProfilesSource) => PromiseLike<R>,
): Promise<R> {
  if (!tableFallback) {
    const viaView = await run(EMPLOYEE_PROFILES_VIEW);
    if (!isMissingEmployeeProfilesView(viaView.error)) return viaView;
    tableFallback = true;
  }
  const viaTable = await run('profiles');
  if (viaTable.error?.code === '42501') {
    tableFallback = false;
    return run(EMPLOYEE_PROFILES_VIEW);
  }
  return viaTable;
}

export function resetEmployeeProfilesSourceForTests(): void {
  tableFallback = false;
}
