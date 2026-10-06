import type { PdfJsFont } from './pdf-text-extractor';
import type { BrowserFace } from '../types/page-model';

/**
 * The browser font the PDF.js canvas draws `font` with, so the preview can draw edits the same way:
 * the face PDF.js registered from the embedded program, or the installed font it substituted for a
 * non-embedded one. Undefined when PDF.js registered no face (Type 3, or an unavailable font).
 */
export function browserFaceOf(font: PdfJsFont): BrowserFace | undefined {
  if (font.isType3Font || !font.toFontChar) return undefined;
  const system = font.systemFontInfo?.css;
  if (font.missingFile && !system) return undefined;
  if (!system && !font.loadedName) return undefined;

  const glyphMap = new Map<number, number>();
  const table = font.toFontChar;
  for (let code = 0; code < table.length; code++) {
    const ch = table[code];
    if (typeof ch === 'number') glyphMap.set(code, ch);
  }
  if (glyphMap.size === 0) return undefined;

  const family = system ?? `"${font.loadedName ?? ''}", ${font.fallbackName ?? 'sans-serif'}`;
  return { family, glyphMap };
}

/**
 * Character → char code for `font`, inverted from PDF.js's ToUnicode data. Only codes the font can
 * draw (present in `drawable`) are kept; the lowest code wins when several map to one character.
 */
export function charCodesOf(font: PdfJsFont, drawable: ReadonlyMap<number, number> | undefined): ReadonlyMap<string, number> | undefined {
  const toUnicode = font.toUnicode;
  if (!toUnicode) return undefined;
  const codes = new Map<string, number>();
  const add = (code: number, unicode: string | undefined) => {
    if (!unicode || [...unicode].length !== 1) return;
    if (drawable && !drawable.has(code)) return;
    if (!codes.has(unicode)) codes.set(unicode, code);
  };

  if (toUnicode._map) {
    const map = toUnicode._map;
    for (let code = 0; code < map.length; code++) add(code, map[code]);
  } else if (typeof toUnicode.firstChar === 'number' && typeof toUnicode.lastChar === 'number') {
    for (let code = toUnicode.firstChar; code <= toUnicode.lastChar; code++) add(code, String.fromCodePoint(code));
  }
  return codes.size > 0 ? codes : undefined;
}
