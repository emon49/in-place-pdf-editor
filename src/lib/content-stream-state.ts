import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applyMatrix, multiplyMatrix, type Matrix } from './coordinates';
import { DEFAULT_STYLE, type Fragment, type TextStyleState } from './text-geometry';

/**
 * Walks a PDF.js operator list and records the drawing state in force at every show-text operation (D5).
 * `getTextContent` omits colour and most text-state parameters and neither walk indexes into the other,
 * so the two are correlated afterwards by start point and font.
 */

export interface OperatorListLike {
  readonly fnArray: ArrayLike<number>;
  readonly argsArray: ArrayLike<unknown>;
}

/** The state at the start of one show operation. */
export interface StyledSpan {
  /** Start point of the shown text in Page Space. */
  readonly x: number;
  readonly y: number;
  readonly fontName: string;
  readonly fontSize: number;
  /** Fill colour as upper-case hex, or null when it cannot be resolved (pattern, unsupported space). */
  readonly color: string | null;
  readonly renderMode: number;
  readonly hScale: number;
  readonly charSpacing: number;
  readonly wordSpacing: number;
  readonly rise: number;
}

interface Glyph {
  readonly width?: number;
  readonly isSpace?: boolean;
}

interface GraphicsState {
  ctm: Matrix;
  color: string | null;
  fontName: string;
  fontSize: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  rise: number;
  renderMode: number;
  leading: number;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

const translate = (m: Matrix, tx: number, ty: number): Matrix => multiplyMatrix(m, [1, 0, 0, 1, tx, ty]);

/** A matrix operand: PDF.js passes it as one array argument, but flat operands are accepted too. */
function matrixArg(args: ArrayLike<unknown>): Matrix {
  const source = args.length === 1 && typeof args[0] === 'object' && args[0] !== null ? (args[0] as ArrayLike<unknown>) : args;
  return Array.from({ length: 6 }, (_, k) => num(source[k])) as unknown as Matrix;
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Fill colour from the operand of a colour operator, or null when it cannot be resolved. */
function fillColor(op: number, args: ArrayLike<unknown>): string | null {
  switch (op) {
    case OPS.setFillRGBColor: {
      // PDF.js has already converted the colour to a CSS hex string.
      const first = args[0];
      if (typeof first === 'string' && /^#[0-9a-f]{6}$/i.test(first)) return first.toUpperCase();
      return args.length >= 3 ? toHex(num(args[0]) , num(args[1]), num(args[2])) : null;
    }
    case OPS.setFillGray: {
      const g = num(args[0]);
      const v = g <= 1 ? g * 255 : g;
      return toHex(v, v, v);
    }
    case OPS.setFillCMYKColor: {
      const [c, m, y, k] = [0, 1, 2, 3].map((i) => num(args[i]));
      return toHex(255 * (1 - (c ?? 0)) * (1 - (k ?? 0)), 255 * (1 - (m ?? 0)) * (1 - (k ?? 0)), 255 * (1 - (y ?? 0)) * (1 - (k ?? 0)));
    }
    default:
      return null; // setFillColorN (patterns), setFillColorSpace and friends
  }
}

export function walkOperatorList(list: OperatorListLike): StyledSpan[] {
  const spans: StyledSpan[] = [];
  let g: GraphicsState = {
    ctm: IDENTITY,
    color: '#000000',
    fontName: '',
    fontSize: 0,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 100,
    rise: 0,
    renderMode: 0,
    leading: 0,
  };
  const stack: GraphicsState[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;

  const emit = (glyphs: ArrayLike<unknown>) => {
    // Text-space → page: [Tfs·Th 0 0 Tfs 0 Trise] × Tm × CTM; the start point is its translation.
    const toPage = multiplyMatrix(g.ctm, tm);
    const start = applyMatrix(toPage, { x: 0, y: g.rise });
    spans.push({
      x: start.x,
      y: start.y,
      fontName: g.fontName,
      fontSize: g.fontSize,
      color: g.color,
      renderMode: g.renderMode,
      hScale: g.hScale,
      charSpacing: g.charSpacing,
      wordSpacing: g.wordSpacing,
      rise: g.rise,
    });
    // Advance the text matrix so a following show operation (no repositioning) starts in the right place.
    let tx = 0;
    for (let i = 0; i < glyphs.length; i++) {
      const item = glyphs[i];
      if (typeof item === 'number') tx -= (item / 1000) * g.fontSize * (g.hScale / 100);
      else if (item && typeof item === 'object') {
        const glyph = item as Glyph;
        tx += ((num(glyph.width) / 1000) * g.fontSize + g.charSpacing + (glyph.isSpace ? g.wordSpacing : 0)) * (g.hScale / 100);
      }
    }
    tm = translate(tm, tx, 0);
  };

  const nextLine = () => {
    tlm = translate(tlm, 0, -g.leading);
    tm = tlm;
  };

  for (let i = 0; i < list.fnArray.length; i++) {
    const op = list.fnArray[i];
    const args = (list.argsArray[i] ?? []) as ArrayLike<unknown>;
    switch (op) {
      case OPS.save:
        stack.push({ ...g });
        break;
      case OPS.restore:
        g = stack.pop() ?? g;
        break;
      case OPS.transform:
        g.ctm = multiplyMatrix(g.ctm, matrixArg(args));
        break;
      case OPS.paintFormXObjectBegin: {
        stack.push({ ...g });
        if (args[0] && typeof args[0] === 'object') g.ctm = multiplyMatrix(g.ctm, matrixArg(args));
        break;
      }
      case OPS.paintFormXObjectEnd:
        g = stack.pop() ?? g;
        break;
      case OPS.beginText:
        tm = IDENTITY;
        tlm = IDENTITY;
        break;
      case OPS.setCharSpacing:
        g.charSpacing = num(args[0]);
        break;
      case OPS.setWordSpacing:
        g.wordSpacing = num(args[0]);
        break;
      case OPS.setHScale:
        g.hScale = num(args[0], 100);
        break;
      case OPS.setLeading:
        g.leading = num(args[0]);
        break;
      case OPS.setTextRise:
        g.rise = num(args[0]);
        break;
      case OPS.setTextRenderingMode:
        g.renderMode = num(args[0]);
        break;
      case OPS.setFont:
        g.fontName = String(args[0]);
        g.fontSize = num(args[1]);
        break;
      case OPS.moveText:
        tlm = translate(tlm, num(args[0]), num(args[1]));
        tm = tlm;
        break;
      case OPS.setLeadingMoveText:
        g.leading = -num(args[1]);
        tlm = translate(tlm, num(args[0]), num(args[1]));
        tm = tlm;
        break;
      case OPS.setTextMatrix:
        tm = matrixArg(args);
        tlm = tm;
        break;
      case OPS.nextLine:
        nextLine();
        break;
      case OPS.showText:
      case OPS.showSpacedText:
        emit((args[0] ?? []) as ArrayLike<unknown>);
        break;
      case OPS.nextLineShowText:
        nextLine();
        emit((args[0] ?? []) as ArrayLike<unknown>);
        break;
      case OPS.nextLineSetSpacingShowText:
        g.wordSpacing = num(args[0]);
        g.charSpacing = num(args[1]);
        nextLine();
        emit((args[2] ?? []) as ArrayLike<unknown>);
        break;
      case OPS.setFillRGBColor:
      case OPS.setFillGray:
      case OPS.setFillCMYKColor:
        g.color = fillColor(op, args);
        break;
      case OPS.setFillColorN:
      case OPS.setFillColorSpace:
      case OPS.setFillColor:
        // A pattern or an unsupported colour space: the exact colour is unknown until pixels are sampled.
        if (op === OPS.setFillColorN && args.length > 0 && typeof args[0] === 'string' && args[0].startsWith('#')) g.color = args[0].toUpperCase();
        else g.color = null;
        break;
      default:
        break;
    }
  }
  return spans;
}

/** How a fragment was matched to a span (5.2). */
export type MatchKind = 'exact' | 'nearest' | 'sequence' | 'none';

export interface StyledFragment extends Fragment {
  readonly colorResolved: boolean;
  readonly match: MatchKind;
}

/** Spans are bucketed by 0.1 pt cells so the 0.01 pt exact match tolerates float noise at cell edges. */
const cell = (v: number) => Math.round(v * 10);
const key = (cx: number, cy: number, font: string) => `${cx},${cy}|${font}`;
const EXACT_TOLERANCE = 0.01;
export const UNRESOLVED_COLOR = 'unresolved';

function styleOf(span: StyledSpan): TextStyleState {
  return {
    colorKey: span.color ?? UNRESOLVED_COLOR,
    renderMode: span.renderMode,
    hScale: span.hScale,
    charSpacing: span.charSpacing,
    wordSpacing: span.wordSpacing,
    rise: span.rise,
  };
}

/**
 * Gives each fragment the style of the span it was drawn by: exact start point and font first, then the
 * nearest span within half an em in the same font, then the next unconsumed span in stream order using that
 * font. A fragment matching nothing keeps default state and is marked colour-unresolved (D5). Whitespace-only
 * items that start no show operation are gap placeholders and are dropped.
 */
export function correlateSpans(fragments: readonly Fragment[], spans: readonly StyledSpan[]): StyledFragment[] {
  const exact = new Map<string, number[]>();
  spans.forEach((s, i) => {
    const k = key(cell(s.x), cell(s.y), s.fontName);
    exact.set(k, [...(exact.get(k) ?? []), i]);
  });
  const exactCandidates = (x: number, y: number, font: string): number[] => {
    const found: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const i of exact.get(key(cell(x) + dx, cell(y) + dy, font)) ?? []) {
          const s = spans[i];
          if (s && Math.abs(s.x - x) <= EXACT_TOLERANCE && Math.abs(s.y - y) <= EXACT_TOLERANCE) found.push(i);
        }
      }
    }
    return found.sort((a, b) => a - b);
  };
  const used = new Set<number>();
  let cursor = -1;

  const claim = (index: number, kind: MatchKind, fragment: Fragment): StyledFragment => {
    const span = spans[index];
    if (!span) throw new Error('span index out of range');
    used.add(index);
    cursor = index;
    return { ...fragment, style: styleOf(span), colorResolved: span.color !== null, match: kind };
  };

  const matchOne = (fragment: Fragment): StyledFragment | null => {
    const [, , c, d, e, f] = fragment.matrix;
    const size = Math.hypot(c, d);
    const candidates = exactCandidates(e, f, fragment.fontName);
    const exactIndex = candidates.find((i) => !used.has(i)) ?? candidates[candidates.length - 1];
    if (exactIndex !== undefined) return claim(exactIndex, 'exact', fragment);

    // A whitespace item that starts no show operation is a placeholder PDF.js inserted for a gap (it can span a
    // whole table column). It is dropped: spacing is re-derived from geometry when fragments merge.
    if (fragment.text.trim() === '') return null;

    let best = -1;
    let bestDistance = Infinity;
    spans.forEach((s, i) => {
      if (s.fontName !== fragment.fontName) return;
      const distance = Math.hypot(s.x - e, s.y - f);
      if (distance <= size / 2 && distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    if (best >= 0) return claim(best, 'nearest', fragment);

    const next = spans.findIndex((s, i) => i > cursor && !used.has(i) && s.fontName === fragment.fontName);
    if (next >= 0) return claim(next, 'sequence', fragment);

    return { ...fragment, style: { ...DEFAULT_STYLE, colorKey: UNRESOLVED_COLOR }, colorResolved: false, match: 'none' };
  };

  const result: StyledFragment[] = [];
  for (const fragment of fragments) {
    const matched = matchOne(fragment);
    if (matched) result.push(matched);
  }
  return result;
}
