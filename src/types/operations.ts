import type { Point, Rect } from '../lib/coordinates';
import type { FontClass, ImageObject, TextLine } from './page-model';

/** Fit mode for image replacement (IM-3). */
export type FitMode = 'contain' | 'cover' | 'fill';

/** Hex color string, e.g. `#cc1a1a`. */
export type CssHex = string;

export interface TextStyle {
  readonly fontClass: FontClass;
  readonly bold: boolean;
  readonly italic: boolean;
  /** Override the font family; null means use the original. */
  readonly fontFamilyOverride: string | null;
  /** Font size in points. */
  readonly size: number;
  readonly color: CssHex;
  /** Character spacing (Tc). */
  readonly charSpacing: number;
  /** Word spacing (Tw). */
  readonly wordSpacing: number;
  /** Line height multiplier. */
  readonly lineHeight: number;
  /** Horizontal scaling percent (Tz); 100 = normal. */
  readonly hScale: number;
  /** Text rise (Ts) in points. */
  readonly rise: number;
  /** PDF text rendering mode (0 = fill). */
  readonly renderMode: number;
}

/** Tier 1: the embedded original font. */
export interface ResolvedFontTier1 {
  readonly tier: 1;
  readonly source: 'original';
  /** pdf-lib font reference key. */
  readonly pdfFontRef: string;
  /** PDF.js loadedName, used for preview CSS. */
  readonly loadedName: string;
  /** Human-readable reason, e.g. "Original font". */
  readonly reason: string;
}

/** Tier 2: self-hosted catalog or consented Google Font. */
export interface ResolvedFontTier2 {
  readonly tier: 2;
  readonly source: 'catalog' | 'google';
  /** CSS font-family name from @font-face registration. */
  readonly cssFamily: string;
  readonly reason: string;
}

/** Tier 3: metric-compatible substitute. */
export interface ResolvedFontTier3 {
  readonly tier: 3;
  readonly source: 'substitute';
  readonly cssFamily: string;
  readonly reason: string;
}

/** Tier 4: Liberation fallback by FontClass. */
export interface ResolvedFontTier4 {
  readonly tier: 4;
  readonly source: 'liberation';
  readonly cssFamily: string;
  readonly reason: string;
}

export type ResolvedFont =
  | ResolvedFontTier1
  | ResolvedFontTier2
  | ResolvedFontTier3
  | ResolvedFontTier4;

// ─── Operation types ─────────────────────────────────────────────────────────

interface OpBase {
  readonly id: string;
  readonly ts: number;
  readonly pageIndex: number;
}

export interface TextReplaceOp extends OpBase {
  readonly type: 'TEXT_REPLACE';
  readonly objectId: string;
  readonly newText: string;
}

export interface TextStyleChangeOp extends OpBase {
  readonly type: 'TEXT_STYLE_CHANGE';
  readonly objectId: string;
  readonly style: Partial<TextStyle>;
}

export interface TextAddOp extends OpBase {
  readonly type: 'TEXT_ADD';
  /** Unique id for this new text object (generated at creation). */
  readonly objectId: string;
  readonly text: string;
  /** Position in Page Space. */
  readonly at: Point;
  readonly style: TextStyle;
}

export interface ObjectMoveOp extends OpBase {
  readonly type: 'OBJECT_MOVE';
  readonly objectId: string;
  /** Box origin before the move, in Page Space. */
  readonly from: Point;
  /** Box origin after the move, in Page Space. */
  readonly to: Point;
}

export interface ObjectDeleteOp extends OpBase {
  readonly type: 'OBJECT_DELETE';
  readonly objectId: string;
}

export interface ImageReplaceOp extends OpBase {
  readonly type: 'IMAGE_REPLACE';
  readonly objectId: string;
  /** UUID key into IndexedDB blob store (D1). */
  readonly blobKey: string;
  readonly fit: FitMode;
}

export interface ObjectResizeOp extends OpBase {
  readonly type: 'OBJECT_RESIZE';
  readonly objectId: string;
  /** Original bounding box in Page Space (D5). */
  readonly from: Rect;
  /** New bounding box in Page Space (D5). */
  readonly to: Rect;
}

export interface RevertOp extends OpBase {
  readonly type: 'REVERT';
  /** IDs of operations that this REVERT cancels. */
  readonly targetOpIds: string[];
}

export type EditOperation =
  | TextReplaceOp
  | TextStyleChangeOp
  | TextAddOp
  | ObjectMoveOp
  | ObjectDeleteOp
  | ImageReplaceOp
  | ObjectResizeOp
  | RevertOp;

export interface OperationLog {
  readonly ops: EditOperation[];
  /** Index into `ops`; only ops[0..cursor) are active. */
  readonly cursor: number;
}

// ─── Preview types ────────────────────────────────────────────────────────────

/** One positioned line segment from text layout. */
export interface LayoutLine {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** ImageObject extended with the results of applied operations. */
export interface PreviewImage extends ImageObject {
  /** Effective bounding box after moves; equals `bbox` when not moved. */
  readonly currentBox: Rect;
  /** True when an OBJECT_DELETE is active on this image. */
  readonly deleted: boolean;
  /** Blob key from the active IMAGE_REPLACE, or null if unchanged. */
  readonly blobKey: string | null;
  /** Fit mode from the active IMAGE_REPLACE, or null if unchanged. */
  readonly fit: FitMode | null;
}

/** TextLine extended with the results of applied operations. */
export interface PreviewLine extends TextLine {
  /** Text after applying operations; same as `text` if no edit. */
  readonly currentText: string;
  /** Style after applying style-change operations. */
  readonly currentStyle: TextStyle;
  /** Effective bounding box after moves; equals `box` when not moved. */
  readonly currentBox: Rect;
  /** True when an OBJECT_DELETE is active on this line. */
  readonly deleted: boolean;
  /** Wrapped layout lines for rendering patches; null if no edit or deleted. */
  readonly patchLayout: LayoutLine[] | null;
  /** Resolved font for this line; null until resolved. */
  readonly resolvedFont: ResolvedFont | null;
}
