// In-memory signed-URL cache. Signed URLs are never persisted to SQLite.
import { isOnlineNow } from './sync-events';

const SKEW_MS = 5 * 60 * 1000;
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const urls = new Map<string, { url: string; expiresAt: number }>();

export async function getSignedUrlCached(
  bucket: string,
  storagePath: string,
  createSignedUrl: (bucket: string, path: string) => Promise<{ url: string; expiresInSec?: number } | null>,
): Promise<string | null> {
  const id = `${bucket}/${storagePath}`;
  const hit = urls.get(id);
  if (hit && hit.expiresAt - SKEW_MS > Date.now()) return hit.url;
  const r = await createSignedUrl(bucket, storagePath);
  if (!r) return null;
  urls.set(id, { url: r.url, expiresAt: Date.now() + (r.expiresInSec ? r.expiresInSec * 1000 : DEFAULT_TTL_MS) });
  return r.url;
}

export function clearSignedUrls(): void { urls.clear(); }

type Resolver = (storagePath: string) => Promise<string | null>;
let remoteResolver: Resolver | null = null;
/** Wire the online signing function once: storagePath -> signed URL. */
export function setSignedUrlResolver(fn: Resolver | null): void { remoteResolver = fn; }

export async function resolvePhotoUri(
  storagePath: string,
  localPathFor?: (storagePath: string) => string | null,
): Promise<string | null> {
  const local = localPathFor?.(storagePath) ?? null;
  if (local) {
    try {
      const FS = await import('expo-file-system');
      const info = await FS.getInfoAsync(local);
      if (info.exists) return local;
    } catch {
      /* fall through to remote */
    }
  }
  if (!isOnlineNow() || !remoteResolver) return null;
  try { return await remoteResolver(storagePath); } catch { return null; }
}
