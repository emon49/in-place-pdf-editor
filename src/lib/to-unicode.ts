/** Parses a `ToUnicode` CMap and returns the single characters its codes map to (design D3). */

const HEX = /<([0-9a-fA-F\s]*)>/g;

function utf16(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i + 3 < clean.length + 1 && i + 4 <= clean.length; i += 4) out += String.fromCharCode(parseInt(clean.slice(i, i + 4), 16));
  return out;
}

const MAX_RANGE = 0x10000;

/** Characters a font can draw according to its ToUnicode map. Multi-character targets (ligatures) are skipped. */
export function parseToUnicode(cmap: string): Set<string> {
  const chars = new Set<string>();
  const add = (s: string) => {
    if ([...s].length === 1) chars.add(s);
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    const pairs = [...(block[1] ?? '').matchAll(HEX)].map((m) => m[1] ?? '');
    for (let i = 1; i < pairs.length; i += 2) add(utf16(pairs[i] ?? ''));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    // Each entry: <lo> <hi> <dst>  or  <lo> <hi> [<d1> <d2> ...]
    for (const entry of (block[1] ?? '').matchAll(/<([0-9a-fA-F\s]+)>\s*<([0-9a-fA-F\s]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F\s]*>)/g)) {
      const lo = parseInt((entry[1] ?? '').replace(/\s+/g, ''), 16);
      const hi = parseInt((entry[2] ?? '').replace(/\s+/g, ''), 16);
      const target = entry[3] ?? '';
      if (target.startsWith('[')) {
        for (const m of target.matchAll(HEX)) add(utf16(m[1] ?? ''));
      } else {
        const first = utf16(target.slice(1, -1));
        const last = first.charCodeAt(first.length - 1);
        const span = Math.min(hi - lo, MAX_RANGE);
        for (let k = 0; k <= span; k++) add(first.slice(0, -1) + String.fromCharCode(last + k));
      }
    }
  }
  return chars;
}
