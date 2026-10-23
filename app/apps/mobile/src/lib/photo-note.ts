import { readJpegDescription } from './jpeg-description';

// The description lives in the first APP1/COM segments, so 64 KiB is plenty.
const HEAD_BYTES = 65536;

// Blob.arrayBuffer() is missing on some React Native runtimes; FileReader
// (always present in RN and web) is the fallback.
export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const b = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof b.arrayBuffer === 'function') {
    return new Uint8Array(await b.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

// Never throws: any failure (network, decode, no description) is null.
export async function readPhotoNote(uri: string): Promise<string | null> {
  try {
    const remote = /^https?:/i.test(uri);
    const res = remote
      ? await fetch(uri, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` } })
      : await fetch(uri);
    // A server that ignores Range returns 200 with the whole body; use it as is.
    const bytes = await blobToBytes(await res.blob());
    return readJpegDescription(bytes);
  } catch {
    return null;
  }
}
