/**
 * The single conversion helper between coordinate spaces (CONTEXT.md, design D7).
 *
 * - Page Space: PDF user-space points, origin bottom-left. All stored geometry.
 * - Display Coordinates: points, origin top-left of the visible page (CropBox) after rotation.
 * - Screen Space: CSS pixels = Display × zoom.
 * - Canvas pixels: Screen × render scale (normally devicePixelRatio).
 *
 * Pure and independent of PDF.js so the exporter can use it too.
 */

export type Rotation = 0 | 90 | 180 | 270;

/** [x0, y0, x1, y1] in Page Space. */
export type Box = readonly [number, number, number, number];

export interface PageGeometry {
  /** Visible page box (CropBox ∩ MediaBox, as PDF.js `page.view`). */
  readonly box: Box;
  readonly rotate: Rotation;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned rectangle. In Page Space (x, y) is the bottom-left corner; in Display/Screen it is the top-left. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** 2D affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

/** Safe Area inset on every side, in points (MV-4). */
export const SAFE_AREA_INSET = 10;
/** Distance of the Wrap Margin from the displayed page's right edge, in points (TE-6). */
export const WRAP_MARGIN_FROM_RIGHT = 40;

/** Normalizes any `/Rotate` value to 0/90/180/270. Values that are not multiples of 90 are treated as 0, as PDF.js does. */
export function normalizeRotation(rotate: number): Rotation {
  if (!Number.isFinite(rotate) || rotate % 90 !== 0) return 0;
  return (((rotate % 360) + 360) % 360) as Rotation;
}

/** Returns the box with x0 ≤ x1 and y0 ≤ y1. PDF boxes may list corners in any order. */
export function normalizeBox([ax, ay, bx, by]: Box): Box {
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}

export function createPageGeometry(box: Box, rotate: number): PageGeometry {
  return { box: normalizeBox(box), rotate: normalizeRotation(rotate) };
}

export function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** Composition `outer ∘ inner`: applies `inner` first, then `outer`. */
export function multiplyMatrix(outer: Matrix, inner: Matrix): Matrix {
  const [a, b, c, d, e, f] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a * a2 + c * b2,
    b * a2 + d * b2,
    a * c2 + c * d2,
    b * c2 + d * d2,
    a * e2 + c * f2 + e,
    b * e2 + d * f2 + f,
  ];
}

export function invertMatrix(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (det === 0) throw new Error('Matrix is not invertible');
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** Matrix mapping Page Space to Display Coordinates. */
export function pageToDisplayMatrix({ box, rotate }: PageGeometry): Matrix {
  const [x0, y0, x1, y1] = box;
  switch (rotate) {
    case 0:
      return [1, 0, 0, -1, -x0, y1];
    case 90:
      return [0, 1, 1, 0, -y0, -x0];
    case 180:
      return [-1, 0, 0, 1, x1, -y0];
    case 270:
      return [0, -1, -1, 0, y1, x1];
  }
}

/** Displayed page size in points: the box size, with width/height swapped for 90/270. */
export function displaySize({ box, rotate }: PageGeometry): Size {
  const width = box[2] - box[0];
  const height = box[3] - box[1];
  return rotate === 90 || rotate === 270 ? { width: height, height: width } : { width, height };
}

export function pageToDisplay(geometry: PageGeometry, p: Point): Point {
  return applyMatrix(pageToDisplayMatrix(geometry), p);
}

export function displayToPage(geometry: PageGeometry, p: Point): Point {
  return applyMatrix(invertMatrix(pageToDisplayMatrix(geometry)), p);
}

/** Maps a rectangle through a matrix and returns the axis-aligned bounds of its corners. */
export function transformRect(m: Matrix, r: Rect): Rect {
  const corners = [
    applyMatrix(m, { x: r.x, y: r.y }),
    applyMatrix(m, { x: r.x + r.width, y: r.y }),
    applyMatrix(m, { x: r.x, y: r.y + r.height }),
    applyMatrix(m, { x: r.x + r.width, y: r.y + r.height }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export function pageRectToDisplay(geometry: PageGeometry, r: Rect): Rect {
  return transformRect(pageToDisplayMatrix(geometry), r);
}

export function displayRectToPage(geometry: PageGeometry, r: Rect): Rect {
  return transformRect(invertMatrix(pageToDisplayMatrix(geometry)), r);
}

export function displayToScreen(p: Point, zoom: number): Point {
  return { x: p.x * zoom, y: p.y * zoom };
}

export function screenToDisplay(p: Point, zoom: number): Point {
  return { x: p.x / zoom, y: p.y / zoom };
}

export function displayRectToScreen(r: Rect, zoom: number): Rect {
  return { x: r.x * zoom, y: r.y * zoom, width: r.width * zoom, height: r.height * zoom };
}

export function screenRectToDisplay(r: Rect, zoom: number): Rect {
  return { x: r.x / zoom, y: r.y / zoom, width: r.width / zoom, height: r.height / zoom };
}

/** Screen (CSS px) → canvas backing pixels. */
export function screenToCanvas(p: Point, renderScale: number): Point {
  return { x: p.x * renderScale, y: p.y * renderScale };
}

export function pageToScreen(geometry: PageGeometry, p: Point, zoom: number): Point {
  return displayToScreen(pageToDisplay(geometry, p), zoom);
}

export function screenToPage(geometry: PageGeometry, p: Point, zoom: number): Point {
  return displayToPage(geometry, screenToDisplay(p, zoom));
}

function clampAxis(start: number, length: number, pageLength: number, inset: number): number {
  const max = pageLength - inset - length;
  // Larger than the Safe Area on this axis: pin to the top/left edge.
  if (max < inset) return inset;
  return Math.min(Math.max(start, inset), max);
}

/**
 * Keeps a whole Display-Coordinates rectangle inside the Safe Area (MV-4), moving it as little as possible.
 */
export function clampToSafeArea(r: Rect, page: Size, inset: number = SAFE_AREA_INSET): Rect {
  return {
    ...r,
    x: clampAxis(r.x, r.width, page.width, inset),
    y: clampAxis(r.y, r.height, page.height, inset),
  };
}

/** Display x of the Wrap Margin (TE-6): displayed page width minus 40 pt. */
export function wrapMarginX(page: Size): number {
  return page.width - WRAP_MARGIN_FROM_RIGHT;
}
