/**
 * A minimal sfnt (TrueType/OpenType) reader for the two facts the editor needs from a font program:
 * the `OS/2` embedding permission and, when present, the `cmap` (design D4). Subset programs routinely omit
 * both tables, so absence is a normal answer rather than an error; only structurally invalid data throws.
 */

export interface SfntTable {
  readonly offset: number;
  readonly length: number;
}

export type SfntTables = ReadonlyMap<string, SfntTable>;

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export function readSfntTables(bytes: Uint8Array): SfntTables {
  if (bytes.byteLength < 12) throw new Error('Font program is too short');
  const v = view(bytes);
  const count = v.getUint16(4);
  if (bytes.byteLength < 12 + count * 16) throw new Error('Font program is truncated');
  const tables = new Map<string, SfntTable>();
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...bytes.subarray(at, at + 4));
    const offset = v.getUint32(at + 8);
    const length = v.getUint32(at + 12);
    if (offset + length > bytes.byteLength) throw new Error(`Font table ${tag} is truncated`);
    tables.set(tag, { offset, length });
  }
  return tables;
}

/** The `OS/2` `fsType` (uint16 at offset 8), or null when the program has no `OS/2` table. */
export function readFsType(bytes: Uint8Array, tables: SfntTables = readSfntTables(bytes)): number | null {
  const os2 = tables.get('OS/2');
  if (!os2 || os2.length < 10) return null;
  return view(bytes).getUint16(os2.offset + 8);
}

export interface EmbeddingPermission {
  readonly editable: boolean;
  /** Names the restriction when editing is not permitted. */
  readonly restriction: string | null;
}

/** Interprets `fsType`. A program that states nothing (no `OS/2` table) permits editing. */
export function embeddingPermission(fsType: number | null): EmbeddingPermission {
  if (fsType === null) return { editable: true, restriction: null };
  if (fsType & 0x0008) return { editable: true, restriction: null }; // editable embedding
  if (fsType & 0x0004) return { editable: false, restriction: 'preview-and-print' };
  if (fsType & 0x0002) return { editable: false, restriction: 'restricted licence' };
  return { editable: true, restriction: null }; // installable
}

const MAX_CODEPOINTS = 0x110000;

/**
 * Unicode code points mapped by the font's own `cmap` (formats 4 and 12), or null when it has no usable
 * Unicode subtable.
 */
export function readCmapCodePoints(bytes: Uint8Array, tables: SfntTables = readSfntTables(bytes)): Set<number> | null {
  const cmap = tables.get('cmap');
  if (!cmap || cmap.length < 4) return null;
  const v = view(bytes);
  const count = v.getUint16(cmap.offset + 2);
  const out = new Set<number>();
  let found = false;
  for (let i = 0; i < count; i++) {
    const record = cmap.offset + 4 + i * 8;
    const platform = v.getUint16(record);
    const encoding = v.getUint16(record + 2);
    const isUnicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!isUnicode) continue;
    const sub = cmap.offset + v.getUint32(record + 4);
    const format = v.getUint16(sub);
    if (format === 4) {
      found = true;
      const segX2 = v.getUint16(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = v.getUint16(ends + s * 2);
        const start = v.getUint16(starts + s * 2);
        for (let cp = start; cp <= end && cp < 0xffff; cp++) out.add(cp);
      }
    } else if (format === 12) {
      found = true;
      const groups = v.getUint32(sub + 12);
      for (let g = 0; g < groups; g++) {
        const at = sub + 16 + g * 12;
        const start = v.getUint32(at);
        const end = Math.min(v.getUint32(at + 4), MAX_CODEPOINTS - 1);
        for (let cp = start; cp <= end; cp++) out.add(cp);
      }
    }
  }
  return found ? out : null;
}
