// RN-free helper: remove a stored photo file after its row is deleted.
// Storage remove returns its error instead of throwing, so a dropped connection used
// to be ignored and the file stayed in storage with no row pointing at it. A network
// or sign-in failure is now thrown, so the queue sends the whole delete again later
// (deleting a row that is already gone is a no-op). Any other failure is ignored as
// before: the row is gone and the photo no longer shows anywhere.
import { classifyReplayError } from '@jobcore/core';

type Remover = { remove: (paths: string[]) => PromiseLike<{ error: unknown }> };

export async function removeStoredFile(bucket: Remover, path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await bucket.remove([path]);
  if (!error) return;
  const kind = classifyReplayError(error);
  if (kind === 'network' || kind === 'auth') throw error;
}
