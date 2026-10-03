/** Zoom logic (page-viewer spec, design D9). Zoom is a factor: 1 = 100%. */

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_PRESETS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/** Space kept around the page when fitting, in CSS px (per side). */
export const FIT_PADDING = 24;

const EPSILON = 1e-9;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Next preset strictly above `zoom` (110% → 125%), or MAX_ZOOM. */
export function nextPreset(zoom: number): number {
  return ZOOM_PRESETS.find((p) => p > zoom + EPSILON) ?? MAX_ZOOM;
}

/** Next preset strictly below `zoom`, or MIN_ZOOM. */
export function prevPreset(zoom: number): number {
  return [...ZOOM_PRESETS].reverse().find((p) => p < zoom - EPSILON) ?? MIN_ZOOM;
}

export const canZoomIn = (zoom: number): boolean => zoom < MAX_ZOOM - EPSILON;
export const canZoomOut = (zoom: number): boolean => zoom > MIN_ZOOM + EPSILON;

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** Zoom so the displayed page width (points → CSS px at 100%) fills the viewer width minus padding. */
export function fitWidth(viewer: ViewportSize, page: ViewportSize, padding = FIT_PADDING): number {
  return clampZoom((viewer.width - 2 * padding) / page.width);
}

/** Zoom so the whole displayed page fits inside the viewer minus padding. */
export function fitPage(viewer: ViewportSize, page: ViewportSize, padding = FIT_PADDING): number {
  return clampZoom(Math.min((viewer.width - 2 * padding) / page.width, (viewer.height - 2 * padding) / page.height));
}

export const formatZoom = (zoom: number): string => `${Math.round(zoom * 100)}%`;
