import type { Point, Rect } from './coordinates';

// Glyph box ascent/descent come from font metrics (often the cap height), which ascenders, `f` and
// antialiasing exceed. These floors cover Latin ascenders/descenders and stay inside 1.0 em leading.
const MIN_ABOVE_EM = 0.78;
const MIN_BELOW_EM = 0.24;
const SIDE_EM = 0.06;
// Italic glyphs lean past their advance box on the right.
const ITALIC_OVERHANG_EM = 0.25;

/**
 * Rect (Page Space) that hides an original Text Line at Position A (ADR-0004): its glyph box, grown
 * to cover the glyphs' real ascenders, descenders and antialiased edges. Preview and export share it.
 */
export function maskRect(box: Rect, baseline: Point, fontSize: number, italic = false): Rect {
  const top = Math.max(box.y + box.height, baseline.y + fontSize * MIN_ABOVE_EM);
  const bottom = Math.min(box.y, baseline.y - fontSize * MIN_BELOW_EM);
  const side = fontSize * SIDE_EM;
  const right = side + (italic ? fontSize * ITALIC_OVERHANG_EM : 0);
  return { x: box.x - side, y: bottom, width: box.width + side + right, height: top - bottom };
}

// Covers the antialiased edge pixels a raster image leaves just outside its box.
const IMAGE_PAD_PT = 0.75;

/** Rect (Page Space) that hides an original image at Position A (ADR-0004); preview and export share it. */
export function imageMaskRect(bbox: Rect): Rect {
  return {
    x: bbox.x - IMAGE_PAD_PT,
    y: bbox.y - IMAGE_PAD_PT,
    width: bbox.width + 2 * IMAGE_PAD_PT,
    height: bbox.height + 2 * IMAGE_PAD_PT,
  };
}
