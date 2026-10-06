import { encodingCharacters } from './standard-encodings';
import type { FontFacts } from '../types/page-model';

/**
 * Reverses the font's character encoding to convert a Unicode string into the
 * character-code array the PDF font expects. Returns null when encoding is
 * unsupported or any character in `text` cannot be mapped.
 *
 * Supported paths:
 *   - Simple fonts with WinAnsiEncoding or StandardEncoding: linear scan of the
 *     256-entry encoding table produced by standard-encodings.ts.
 *   - Composite (CID) fonts with Identity-H: the code is the Unicode code point
 *     (BMP only; surrogate pairs not supported).
 *   - Fonts with a ToUnicode CMap: invert the parsed coverage set. Because
 *     `parseToUnicode` discards multi-character mappings (ligatures), any
 *     character in the text that only exists as a ligature target returns null.
 */
export function encodeText(text: string, font: FontFacts): number[] | null {
  if (!text) return [];

  const encoding = font.encoding;
  const coverage = font.coverage;

  // The document's own ToUnicode data (read by PDF.js) gives exact codes for simple fonts and for
  // two-byte Identity CMaps; other CMaps have variable-width codes this encoder cannot write.
  const identityOrSimple = encoding?.kind !== 'composite' || encoding.name === 'Identity-H' || encoding.name === 'Identity-V';
  if (font.charCodes && identityOrSimple) {
    const codes: number[] = [];
    for (const ch of text) {
      const code = font.charCodes.get(ch);
      if (code === undefined) return null;
      codes.push(code);
    }
    return codes;
  }

  // Identity-H composite font without ToUnicode data: assume code point == Unicode code point
  if (encoding?.kind === 'composite' && encoding.name === 'Identity-H') {
    const codes: number[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined || cp > 0xffff) return null; // surrogate pairs unsupported
      codes.push(cp);
    }
    return codes;
  }

  // Simple font with named encoding: reverse the encoding table
  if (encoding?.kind === 'simple') {
    const chars = encodingCharacters(encoding.name);
    if (!chars) return null; // unknown named encoding
    const codes: number[] = [];
    for (const ch of text) {
      if (!chars.has(ch)) return null;
      // Find the byte code in WinAnsi / Standard (0x20–0xFF range)
      const code = reverseSimpleEncoding(ch, encoding.name);
      if (code === null) return null;
      codes.push(code);
    }
    return codes;
  }

  // No encoding info: fall back to coverage check only, can't produce codes
  if (coverage) {
    for (const ch of text) {
      if (!coverage.has(ch)) return null;
    }
    // Return Unicode code points as a best-effort fallback
    const codes: number[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) return null;
      codes.push(cp);
    }
    return codes;
  }

  return null;
}

/**
 * Returns the character code (0–255) for a character in WinAnsi or Standard
 * encoding, or null when it cannot be mapped.
 */
function reverseSimpleEncoding(ch: string, encodingName: string | null): number | null {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return null;

  if (encodingName === 'WinAnsiEncoding') {
    // ASCII range 0x20–0x7E maps 1:1
    if (cp >= 0x20 && cp <= 0x7e) return cp;
    // Latin-1 Supplement 0xA1–0xFF maps 1:1
    if (cp >= 0xa1 && cp <= 0xff) return cp;
    // Windows-1252 extensions at 0x80–0x9F
    const WIN1252_EXTRA: Record<number, number> = {
      0x20ac: 0x80, // €
      0x201a: 0x82, // ‚
      0x0192: 0x83, // ƒ
      0x201e: 0x84, // „
      0x2026: 0x85, // …
      0x2020: 0x86, // †
      0x2021: 0x87, // ‡
      0x02c6: 0x88, // ˆ
      0x2030: 0x89, // ‰
      0x0160: 0x8a, // Š
      0x2039: 0x8b, // ‹
      0x0152: 0x8c, // Œ
      0x017d: 0x8e, // Ž
      0x2018: 0x91, // '
      0x2019: 0x92, // '
      0x201c: 0x93, // "
      0x201d: 0x94, // "
      0x2022: 0x95, // •
      0x2013: 0x96, // –
      0x2014: 0x97, // —
      0x02dc: 0x98, // ˜
      0x2122: 0x99, // ™
      0x0161: 0x9a, // š
      0x203a: 0x9b, // ›
      0x0153: 0x9c, // œ
      0x017e: 0x9e, // ž
      0x0178: 0x9f, // Ÿ
    };
    return WIN1252_EXTRA[cp] ?? null;
  }

  // StandardEncoding: ASCII range with quoteright/quoteleft substitutions
  if (cp >= 0x20 && cp <= 0x7e && cp !== 0x27 && cp !== 0x60) return cp;

  // TODO: full StandardEncoding reverse table for the extended characters;
  // returning null here causes encodeText to fail for non-ASCII Standard chars.
  return null;
}

/**
 * Checks whether every character in `text` can be drawn by some font in the
 * resolution chain. For the drawability check (TE-9) we only need to verify
 * that the coverage set contains all characters; actual encoding is checked
 * separately in encodeText.
 */
export function checkDrawability(
  text: string,
  font: FontFacts,
  coverage: ReadonlySet<string> | null,
): { drawable: boolean; firstUndrawable?: string } {
  if (!text) return { drawable: true };

  const chars = coverage ?? font.coverage;
  if (!chars) {
    // No coverage info; assume drawable (will be blocked at encode time if needed)
    return { drawable: true };
  }

  for (const ch of text) {
    if (!chars.has(ch)) return { drawable: false, firstUndrawable: ch };
  }
  return { drawable: true };
}
