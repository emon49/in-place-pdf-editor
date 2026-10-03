import type { Size } from './coordinates';

/** Largest canvas the viewer will allocate (Safari's limit; page-viewer spec). */
export const MAX_CANVAS_PIXELS = 16_777_216;

export interface CanvasPlan {
  /** CSS size of the page element (Display size × zoom). */
  readonly css: Size;
  /** Canvas pixels per CSS pixel; devicePixelRatio unless capped. */
  readonly renderScale: number;
  /** Canvas backing-store size in pixels. */
  readonly canvas: Size;
}

/** Plans a crisp render: backing = CSS × dpr, reduced only to stay within MAX_CANVAS_PIXELS (design D8). */
export function planCanvas(display: Size, zoom: number, devicePixelRatio: number, maxPixels = MAX_CANVAS_PIXELS): CanvasPlan {
  const css = { width: display.width * zoom, height: display.height * zoom };
  const dpr = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const cap = Math.sqrt(maxPixels / Math.max(1, css.width * css.height));
  let renderScale = Math.min(dpr, cap);
  let canvas = { width: Math.floor(css.width * renderScale), height: Math.floor(css.height * renderScale) };
  // Floating-point safety: never exceed the limit after flooring.
  while (canvas.width * canvas.height > maxPixels) {
    renderScale *= 0.999;
    canvas = { width: Math.floor(css.width * renderScale), height: Math.floor(css.height * renderScale) };
  }
  return { css, renderScale, canvas };
}
