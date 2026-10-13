export interface PhotoAssetLike {
  mimeType?: string | null;
  fileName?: string | null;
  uri?: string | null;
}
export interface PhotoMeta {
  ext: string;
  contentType: string;
}

const KNOWN = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];

function metaFromExt(raw: string | undefined | null): PhotoMeta | null {
  if (!raw) return null;
  const e = raw.toLowerCase();
  if (!KNOWN.includes(e)) return null;
  const ext = e === 'jpeg' ? 'jpg' : e;
  return { ext, contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
}

function extOf(name: string): string | null {
  const clean = name.split(/[?#]/)[0] ?? '';
  const m = /\.([A-Za-z0-9]+)$/.exec(clean);
  return m ? (m[1] ?? null) : null;
}

export function photoMetaFrom(asset: PhotoAssetLike): PhotoMeta {
  try {
    const mime = asset?.mimeType?.trim().toLowerCase();
    if (mime && mime.startsWith('image/')) {
      const sub = mime.slice(6).split(';')[0] ?? '';
      if (sub) {
        const ext = sub === 'jpeg' ? 'jpg' : sub;
        return { ext, contentType: mime };
      }
    }
    const fromName = asset?.fileName ? metaFromExt(extOf(asset.fileName)) : null;
    if (fromName) return fromName;
    const uri = asset?.uri;
    if (uri) {
      if (/^data:/i.test(uri)) {
        const m = /^data:image\/([a-z0-9+.-]+)/i.exec(uri);
        const d = m ? metaFromExt(m[1]) : null;
        if (d) return d;
      } else if (!/^blob:/i.test(uri)) {
        const fromUri = metaFromExt(extOf(uri));
        if (fromUri) return fromUri;
      }
    }
  } catch {
    // fall through
  }
  return { ext: 'jpg', contentType: 'image/jpeg' };
}
