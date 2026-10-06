import { describe, expect, it } from 'vitest';
import { canZoomIn, canZoomOut, clampZoom, fitPage, fitWidth, nextPreset, prevPreset } from '../../src/lib/zoom';

describe('zoom presets (page-viewer spec)', () => {
  it('100% → 125%', () => expect(nextPreset(1)).toBe(1.25));
  it('110% → 125% (next preset above a non-preset value)', () => expect(nextPreset(1.1)).toBe(1.25));
  it('110% → 100% when zooming out', () => expect(prevPreset(1.1)).toBe(1));
  it('stays within bounds', () => {
    expect(nextPreset(4)).toBe(4);
    expect(prevPreset(0.25)).toBe(0.25);
    expect(canZoomIn(4)).toBe(false);
    expect(canZoomOut(0.25)).toBe(false);
    expect(canZoomIn(3)).toBe(true);
  });
  it('clamps to 25%–400%', () => {
    expect(clampZoom(10)).toBe(4);
    expect(clampZoom(0.01)).toBe(0.25);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe('fit modes', () => {
  const portrait = { width: 612, height: 792 };
  const landscape = { width: 792, height: 612 };
  it('fit width uses viewer width minus padding', () => {
    expect(fitWidth({ width: 660, height: 500 }, portrait, 24)).toBeCloseTo(1);
  });
  it('fit page on a rotated (landscape) page fits the whole page', () => {
    const viewer = { width: 1000, height: 700 };
    const z = fitPage(viewer, landscape, 24);
    expect(landscape.width * z).toBeLessThanOrEqual(1000 - 48 + 1e-9);
    expect(landscape.height * z).toBeLessThanOrEqual(700 - 48 + 1e-9);
    expect(z).toBeCloseTo(Math.min(952 / 792, 652 / 612));
  });
  it('fit results are clamped', () => {
    expect(fitWidth({ width: 10000, height: 100 }, portrait)).toBe(4);
    expect(fitPage({ width: 60, height: 60 }, portrait)).toBe(0.25);
  });
});
