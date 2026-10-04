import type { Matrix, Point, Rect } from '../lib/coordinates';

/** Why a Text Line is read-only in v1 (VW-8). */
export type LockReason = 'rotated-or-skewed' | 'vertical-writing' | 'type3-font';

export type FontClass = 'sans' | 'serif' | 'mono';

/** `exact` colours come from the content stream; `sampled` from glyph pixels; `pending` awaits sampling. */
export type ColorSource = 'exact' | 'sampled' | 'pending';

export interface LineColor {
  /** CSS hex, e.g. `#cc1a1a`. */
  readonly hex: string;
  readonly source: ColorSource;
}

/** Background behind a line. `pending` until the sampler has run (color-detection spec). */
export type LineBackground =
  | { readonly status: 'pending' }
  | { readonly status: 'ready'; readonly color: string; readonly uniform: boolean; readonly ratio: number };

/** A font fact that could not be determined is `null`, never guessed (font-detection spec). */
export type Unknown<T> = T | null;

export interface FontEmbedding {
  /** True only when the document itself carries a font program. */
  readonly embedded: boolean;
  /** A reference to one of the standard fonts with no program in the file. */
  readonly standardReference: boolean;
  readonly programType: 'TrueType' | 'Type1' | 'CFF' | 'OpenType' | null;
  readonly programSize: number;
}

export interface FontLicence {
  /** Raw `OS/2` `fsType`; null when the program has no such table. */
  readonly fsType: number | null;
  readonly editable: boolean;
  /** Names the restriction when editing is not permitted. */
  readonly restriction: string | null;
}

export interface FontEncoding {
  readonly kind: 'simple' | 'composite';
  /** e.g. `WinAnsiEncoding` or `Identity-H`; null when the dictionary names none. */
  readonly name: string | null;
}

/** The document's own facts about a font, for M2's Font Resolution Chain (ADR-0007). */
export interface FontFacts {
  /** The BaseFont as written in the document, subset prefix included. */
  readonly rawName: string;
  readonly subtype: string | null;
  /** Null when the font could not be matched to a dictionary in the document. */
  readonly embedding: Unknown<FontEmbedding>;
  readonly licence: Unknown<FontLicence>;
  readonly encoding: Unknown<FontEncoding>;
  /** Characters the font can draw; null when unknown. */
  readonly coverage: Unknown<ReadonlySet<string>>;
}

export interface TextLine {
  /** `"<pageIndex>:<sequence>"`, stable across re-extraction (D8). */
  readonly id: string;
  readonly pageIndex: number;
  readonly text: string;
  /** Baseline origin in Page Space. */
  readonly origin: Point;
  /** Glyph bounding box in Page Space (x, y = bottom-left). */
  readonly box: Rect;
  readonly matrix: Matrix;
  /** PDF.js font reference (`loadedName`) used by the preview. */
  readonly fontRef: string;
  readonly family: string;
  readonly subsetPrefix: string | null;
  readonly fontClass: FontClass;
  readonly bold: boolean;
  readonly italic: boolean;
  /** Points, from the vertical matrix scale (TY-1). */
  readonly fontSize: number;
  /** Percent; 100 = unscaled. */
  readonly hScale: number;
  readonly charSpacing: number;
  readonly wordSpacing: number;
  readonly rise: number;
  /** PDF text rendering mode; 0 = fill. */
  readonly renderMode: number;
  readonly lineHeight: number;
  readonly color: LineColor;
  readonly background: LineBackground;
  readonly lockReason: LockReason | null;
  readonly font: FontFacts;
}

/** An image embedded in the PDF page (IM-1). */
export interface ImageObject {
  /** `"img:<pageIndex>:<sequence>"`, stable across re-extraction. */
  readonly id: string;
  readonly pageIndex: number;
  /** Bounding box in Page Space (bottom-left origin). */
  readonly bbox: Rect;
  /** True when the color space is unsupported (e.g. CMYK); image is read-only. */
  readonly locked: boolean;
  /** Sampled background color for masking; null until sampled. */
  readonly maskColor: string | null;
}

export interface PageModel {
  readonly pageIndex: number;
  /** In reading order. */
  readonly lines: readonly TextLine[];
  /** Detected image objects on this page. */
  readonly images: readonly ImageObject[];
}

export type PageModelStatus = 'idle' | 'extracting' | 'ready' | 'failed';
