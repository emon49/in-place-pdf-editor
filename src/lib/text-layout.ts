import type { TextStyle } from '../types/operations';

/** One positioned line segment from text layout. */
export interface LayoutLine {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** Result of laying out a block of text. */
export interface LayoutResult {
  readonly lines: LayoutLine[];
}

/** Box in PDF user space (points). */
export interface OriginBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Compute character advance width for a single character given the style.
 * Callers may supply a custom advanceFn (e.g. from canvas measureText) for
 * accurate metrics. The default uses a simple em-based estimate.
 */
export type AdvanceFn = (ch: string, style: TextStyle) => number;

/** Average glyph advance (em) by Font Class, for text with no measured sample. */
const CLASS_ADVANCE_EM: Record<TextStyle['fontClass'], number> = { sans: 0.5, serif: 0.45, mono: 0.6 };

function glyphAdvance(style: TextStyle): number {
  return style.size * CLASS_ADVANCE_EM[style.fontClass] * (style.hScale / 100);
}

function defaultAdvance(_ch: string, style: TextStyle): number {
  return glyphAdvance(style) + style.charSpacing;
}

/** Text whose drawn width is known: the original line as the PDF set it. */
export interface WidthSample {
  readonly text: string;
  readonly width: number;
  readonly style: TextStyle;
}

/**
 * An advance calibrated to the font actually used: the class average is scaled so that the sample
 * text measures exactly its known width. Without a usable sample, the class average alone is used.
 * Pure, so preview and export wrap identically.
 */
export function calibratedAdvance(sample: WidthSample | null): AdvanceFn {
  if (!sample || sample.width <= 0) return defaultAdvance;
  const chars = [...sample.text];
  const spaces = chars.filter((ch) => ch === ' ').length;
  const glyphs = chars.length * glyphAdvance(sample.style);
  const spacing = chars.length * sample.style.charSpacing + spaces * sample.style.wordSpacing;
  if (glyphs <= 0) return defaultAdvance;
  const scale = Math.min(2, Math.max(0.5, (sample.width - spacing) / glyphs));
  return (_ch, style) => glyphAdvance(style) * scale + style.charSpacing;
}

/**
 * Lay out `text` starting at `originBox`, wrapping at `pageWidth − 40 pt`.
 *
 * Lines stack downward by `style.fontSize × style.lineHeight`.
 * Returns an array of `LayoutLine` (one per visual row).
 */
export function layoutText(
  text: string,
  style: TextStyle,
  originBox: OriginBox,
  pageWidth: number,
  advanceFn: AdvanceFn = defaultAdvance,
): LayoutResult {
  const wrapMargin = pageWidth - 40;
  const maxWidth = Math.max(0, wrapMargin - originBox.x);
  const lineStep = style.size * style.lineHeight;

  const lines: LayoutLine[] = [];
  const paragraphs = text.split('\n');

  let y = originBox.y;

  for (const para of paragraphs) {
    if (para.length === 0) {
      // Empty paragraph — emit blank line, advance y
      lines.push({ text: '', x: originBox.x, y, width: 0 });
      y -= lineStep;
      continue;
    }

    // Split paragraph into words, re-adding spaces
    const words = para.split(' ');
    let currentLine = '';
    let currentWidth = 0;

    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi] ?? '';
      const spaceWidth = wi > 0 ? advanceFn(' ', style) + style.wordSpacing : 0;
      const wordWidth = [...word].reduce((sum, ch) => sum + advanceFn(ch, style), 0);

      const needed = spaceWidth + wordWidth;

      if (currentLine.length > 0 && currentWidth + needed > maxWidth) {
        // Flush current line
        lines.push({ text: currentLine, x: originBox.x, y, width: currentWidth });
        y -= lineStep;
        currentLine = word;
        currentWidth = wordWidth;
      } else {
        if (currentLine.length > 0) {
          currentLine += ' ';
          currentWidth += spaceWidth;
        }
        currentLine += word;
        currentWidth += wordWidth;
      }
    }

    // Flush last segment
    if (currentLine.length > 0 || words.length === 0) {
      lines.push({ text: currentLine, x: originBox.x, y, width: currentWidth });
      y -= lineStep;
    }
  }

  return { lines };
}

/**
 * Return true when any rect in `patchLines` intersects the box of any
 * non-deleted TextLine-like object in `allLines`.
 */
export interface BoxLike {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly deleted?: boolean;
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function detectOverlap(
  patchLines: LayoutLine[],
  allLines: BoxLike[],
  patchHeight: number,
): boolean {
  for (const patch of patchLines) {
    const px = patch.x;
    const py = patch.y;
    const pw = patch.width;
    const ph = patchHeight;
    for (const line of allLines) {
      if (line.deleted) continue;
      if (rectsOverlap(px, py, pw, ph, line.x, line.y, line.width, line.height)) {
        return true;
      }
    }
  }
  return false;
}
