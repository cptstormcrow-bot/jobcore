/**
 * Photo note carrier: the XMP `dc:description` property inside a JPEG APP1 segment.
 *
 * Limits:
 * - Writing replaces the whole XMP packet, so any other XMP properties are dropped.
 * - EXIF (APP1 `Exif\0\0`, incl. orientation) and every other segment are copied untouched.
 * - Notes are capped at MAX_PHOTO_NOTE_LENGTH UTF-16 units; longer text is CUT (not rejected),
 *   never splitting a surrogate pair.
 * - Pure TypeScript, no imports, no TextEncoder/TextDecoder/Buffer (Hermes may lack them).
 */

export const MAX_PHOTO_NOTE_LENGTH = 500;

const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';
const MAX_SEGMENT_PAYLOAD = 65533;

interface Segment {
  marker: number;
  start: number; // offset of first byte (incl. any 0xFF padding)
  end: number; // exclusive
}

interface Walk {
  segments: Segment[];
  rest: number; // offset where the untouched remainder begins (SOS / EOI / garbage / end)
}

function utf8Encode(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd; // lone surrogate
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return out;
}

function cpToString(cp: number): string {
  if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '�';
  if (cp < 0x10000) return String.fromCharCode(cp);
  const c = cp - 0x10000;
  return String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
}

function utf8Decode(bytes: Uint8Array, start: number, end: number): string {
  let s = '';
  let i = start;
  while (i < end) {
    const b = bytes[i] as number;
    let need = 0;
    let cp = 0;
    if (b < 0x80) {
      cp = b;
    } else if (b >= 0xc2 && b < 0xe0) {
      need = 1;
      cp = b & 0x1f;
    } else if (b >= 0xe0 && b < 0xf0) {
      need = 2;
      cp = b & 0x0f;
    } else if (b >= 0xf0 && b < 0xf5) {
      need = 3;
      cp = b & 0x07;
    } else {
      s += '�';
      i++;
      continue;
    }
    if (need > 0 && i + need >= end) {
      s += '�';
      i++;
      continue;
    }
    let ok = true;
    for (let k = 1; k <= need; k++) {
      const c = bytes[i + k] as number;
      if ((c & 0xc0) !== 0x80) {
        ok = false;
        break;
      }
      cp = (cp << 6) | (c & 0x3f);
    }
    if (!ok) {
      s += '�';
      i++;
      continue;
    }
    s += cpToString(cp);
    i += need + 1;
  }
  return s;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlUnescape(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (m, ent: string) => {
    switch (ent) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
    }
    const cp = ent.charAt(1) === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
    return Number.isFinite(cp) ? cpToString(cp) : m;
  });
}

/** Walk segments after FFD8 up to (not including) SOS/EOI. Defensive: stops on any oddity. */
function walkSegments(bytes: Uint8Array): Walk {
  const segments: Segment[] = [];
  const len = bytes.length;
  let i = 2;
  while (i + 1 < len) {
    if (bytes[i] !== 0xff) break; // garbage
    let m = i;
    while (m + 1 < len && bytes[m] === 0xff && bytes[m + 1] === 0xff) m++; // fill bytes
    if (m + 1 >= len) break;
    const marker = bytes[m + 1] as number;
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({ marker, start: i, end: m + 2 }); // stand-alone, no length
      i = m + 2;
      continue;
    }
    if (m + 3 >= len) break;
    const segLen = ((bytes[m + 2] as number) << 8) | (bytes[m + 3] as number);
    if (segLen < 2 || m + 2 + segLen > len) break;
    segments.push({ marker, start: i, end: m + 2 + segLen });
    i = m + 2 + segLen;
  }
  return { segments, rest: i < len ? i : len };
}

function matchesAt(bytes: Uint8Array, at: number, end: number, text: string): boolean {
  if (at + text.length > end) return false;
  for (let k = 0; k < text.length; k++) {
    if (bytes[at + k] !== text.charCodeAt(k)) return false;
  }
  return true;
}

/** Offset of the first payload byte (after FF marker and 2-byte length), or -1 if none. */
function dataOffset(bytes: Uint8Array, seg: Segment): number {
  let m = seg.start;
  while (m + 1 < seg.end && bytes[m] === 0xff && bytes[m + 1] === 0xff) m++;
  return m + 4;
}

function isXmp(bytes: Uint8Array, seg: Segment): boolean {
  return seg.marker === 0xe1 && matchesAt(bytes, dataOffset(bytes, seg), seg.end, XMP_HEADER);
}

function isLeadingMeta(bytes: Uint8Array, seg: Segment): boolean {
  if (seg.marker === 0xe0) return true;
  return seg.marker === 0xe1 && matchesAt(bytes, dataOffset(bytes, seg), seg.end, 'Exif\0\0');
}

/** Read the note stored by writeJpegDescription (or any XMP dc:description). Never throws. */
export function readJpegDescription(bytes: Uint8Array): string | null {
  try {
    if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    const { segments } = walkSegments(bytes);
    for (const seg of segments) {
      if (!isXmp(bytes, seg)) continue;
      const xml = utf8Decode(bytes, dataOffset(bytes, seg) + XMP_HEADER.length, seg.end);
      const d = /<dc:description(?:\s[^>]*)?>([\s\S]*?)<\/dc:description>/.exec(xml);
      if (!d) continue;
      const inner = d[1] ?? '';
      const li = /<rdf:li(?:\s[^>]*)?>([\s\S]*?)<\/rdf:li>/.exec(inner);
      const raw = li ? (li[1] ?? '') : inner.replace(/<[^>]*>/g, '');
      const text = xmlUnescape(raw).trim();
      if (text) return text;
    }
    return null;
  } catch {
    return null;
  }
}

function buildXmpSegment(text: string): number[] {
  const xml =
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">' +
    xmlEscape(text) +
    '</rdf:li></rdf:Alt></dc:description>' +
    '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  const payload = utf8Encode(XMP_HEADER).concat(utf8Encode(xml));
  if (payload.length > MAX_SEGMENT_PAYLOAD) throw new Error('Photo note too large for XMP segment');
  const total = payload.length + 2;
  return [0xff, 0xe1, (total >> 8) & 0xff, total & 0xff].concat(payload);
}

/**
 * Return a new JPEG carrying `text` as its XMP description. Replaces an existing XMP segment in
 * place, else inserts after leading APP0/Exif segments. Empty (after trim) text removes the XMP
 * segment. Text over MAX_PHOTO_NOTE_LENGTH is cut (surrogate-safe). Throws if not a JPEG.
 */
export function writeJpegDescription(bytes: Uint8Array, text: string): Uint8Array {
  if (!bytes || bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Not a JPEG');
  }
  let note = (text ?? '').trim();
  if (note.length > MAX_PHOTO_NOTE_LENGTH) {
    note = note.slice(0, MAX_PHOTO_NOTE_LENGTH);
    const last = note.charCodeAt(note.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) note = note.slice(0, -1);
    note = note.trim();
  }
  const seg = note ? buildXmpSegment(note) : null;
  const { segments, rest } = walkSegments(bytes);

  let insertAt = 0;
  while (insertAt < segments.length && isLeadingMeta(bytes, segments[insertAt] as Segment)) {
    insertAt++;
  }
  const hasXmp = segments.some((s) => isXmp(bytes, s));

  const parts: Array<{ from: number; to: number } | number[]> = [{ from: 0, to: 2 }];
  let placed = false;
  for (let idx = 0; idx < segments.length; idx++) {
    const s = segments[idx] as Segment;
    if (!hasXmp && !placed && idx === insertAt && seg) {
      parts.push(seg);
      placed = true;
    }
    if (isXmp(bytes, s)) {
      if (seg && !placed) {
        parts.push(seg);
        placed = true;
      }
      continue; // replaced or removed (duplicates dropped)
    }
    parts.push({ from: s.start, to: s.end });
  }
  if (!placed && seg) parts.push(seg);
  parts.push({ from: rest, to: bytes.length });

  let size = 0;
  for (const p of parts) size += Array.isArray(p) ? p.length : p.to - p.from;
  const out = new Uint8Array(size);
  let pos = 0;
  for (const p of parts) {
    if (Array.isArray(p)) {
      for (let k = 0; k < p.length; k++) out[pos++] = p[k] as number;
    } else {
      for (let k = p.from; k < p.to; k++) out[pos++] = bytes[k] as number;
    }
  }
  return out;
}
