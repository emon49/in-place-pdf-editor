import type { Matrix } from './coordinates';

/** Font size from the vertical matrix scale `√(c² + d²)` (TY-1); never the horizontal scale. */
export function fontSizeFromMatrix([, , c, d]: Matrix): number {
  return Math.hypot(c, d);
}

/** Horizontal scaling in percent implied by the matrix (a compressed 6×12 matrix is 50%). */
export function horizontalScalingFromMatrix([a, b, c, d]: Matrix): number {
  const vertical = Math.hypot(c, d);
  return vertical === 0 ? 100 : (Math.hypot(a, b) / vertical) * 100;
}

/** Line height in points from the font's ascent and descent (em fractions; descent is negative). */
export function lineHeight(fontSize: number, ascent: number, descent: number): number {
  return fontSize * (ascent - descent);
}
