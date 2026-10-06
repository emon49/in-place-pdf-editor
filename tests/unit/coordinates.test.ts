import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  clampToSafeArea,
  createPageGeometry,
  displayRectToPage,
  displaySize,
  displayToPage,
  displayToScreen,
  normalizeRotation,
  pageRectToDisplay,
  pageToDisplay,
  pageToScreen,
  screenToCanvas,
  screenToPage,
  wrapMarginX,
  type Box,
  type Rotation,
} from '../../src/lib/coordinates';

const LETTER: Box = [0, 0, 612, 792];
const geo = (box: Box, rotate: number) => createPageGeometry(box, rotate);

const expectPoint = (actual: { x: number; y: number }, x: number, y: number) => {
  expect(actual.x).toBeCloseTo(x, 9);
  expect(actual.y).toBeCloseTo(y, 9);
};

describe('Page Space → Display Coordinates (coordinate-mapping spec)', () => {
  it('unrotated, uncropped page: (100, 700) → (100, 92)', () => {
    expectPoint(pageToDisplay(geo(LETTER, 0), { x: 100, y: 700 }), 100, 92);
  });

  it('CropBox offset: (36, 756) → (0, 0) and displayed size 540×720', () => {
    const g = geo([36, 36, 576, 756], 0);
    expectPoint(pageToDisplay(g, { x: 36, y: 756 }), 0, 0);
    expect(displaySize(g)).toEqual({ width: 540, height: 720 });
  });

  it('Rotate 90: size 792×612, (0,0) → (0,0), (100,700) → (700,100)', () => {
    const g = geo(LETTER, 90);
    expect(displaySize(g)).toEqual({ width: 792, height: 612 });
    expectPoint(pageToDisplay(g, { x: 0, y: 0 }), 0, 0);
    expectPoint(pageToDisplay(g, { x: 100, y: 700 }), 700, 100);
  });

  it('Rotate 180: (100, 700) → (512, 700)', () => {
    expectPoint(pageToDisplay(geo(LETTER, 180), { x: 100, y: 700 }), 512, 700);
  });

  it('Rotate 270: size 792×612, (100, 700) → (92, 512)', () => {
    const g = geo(LETTER, 270);
    expect(displaySize(g)).toEqual({ width: 792, height: 612 });
    expectPoint(pageToDisplay(g, { x: 100, y: 700 }), 92, 512);
  });

  it('non-normalized rotation: −90 → 270, 450 → 90', () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(45)).toBe(0);
    expect(normalizeRotation(Number.NaN)).toBe(0);
  });

  it('normalizes boxes listed with corners in reverse order', () => {
    expect(geo([612, 792, 0, 0], 0).box).toEqual([0, 0, 612, 792]);
  });

  it('page corners map to display corners for every rotation', () => {
    for (const rotate of [0, 90, 180, 270] as const) {
      const g = geo([36, 36, 576, 756], rotate);
      const { width, height } = displaySize(g);
      const corners = [
        { x: 36, y: 36 },
        { x: 576, y: 36 },
        { x: 36, y: 756 },
        { x: 576, y: 756 },
      ].map((p) => pageToDisplay(g, p));
      const xs = corners.map((c) => Math.round(c.x)).sort((a, b) => a - b);
      const ys = corners.map((c) => Math.round(c.y)).sort((a, b) => a - b);
      expect([xs[0], xs[3], ys[0], ys[3]]).toEqual([0, width, 0, height]);
    }
  });
});

describe('Rectangle conversion', () => {
  it('Page rect on a Rotate 90 page → x=600, y=100, w=50, h=200', () => {
    const r = pageRectToDisplay(geo(LETTER, 90), { x: 100, y: 600, width: 200, height: 50 });
    expect(r.x).toBeCloseTo(600);
    expect(r.y).toBeCloseTo(100);
    expect(r.width).toBeCloseTo(50);
    expect(r.height).toBeCloseTo(200);
  });

  it('unrotated rect: bottom-left origin becomes top-left origin', () => {
    const r = pageRectToDisplay(geo(LETTER, 0), { x: 72, y: 700, width: 100, height: 12 });
    expect(r).toEqual({ x: 72, y: 80, width: 100, height: 12 });
  });
});

describe('Screen Space', () => {
  it('Zoomed point: Display (100, 92) at 150% → Screen (150, 138), canvas (300, 276) at dpr 2', () => {
    const screen = displayToScreen({ x: 100, y: 92 }, 1.5);
    expectPoint(screen, 150, 138);
    expectPoint(screenToCanvas(screen, 2), 300, 276);
  });
});

describe('Lossless round trips (property-based)', () => {
  const rotation = fc.constantFrom<Rotation>(0, 90, 180, 270);
  const coord = fc.double({ min: -2000, max: 2000, noNaN: true });
  const box = fc
    .tuple(fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true }))
    .chain(([x0, y0]) =>
      fc
        .tuple(fc.double({ min: 10, max: 2000, noNaN: true }), fc.double({ min: 10, max: 2000, noNaN: true }))
        .map(([w, h]): Box => [x0, y0, x0 + w, y0 + h]),
    );
  const zoom = fc.double({ min: 0.25, max: 4, noNaN: true });

  it('Page → Screen → Page returns the original point within 1e-6 pt', () => {
    fc.assert(
      fc.property(box, rotation, zoom, coord, coord, (b, r, z, x, y) => {
        const g = geo(b, r);
        const back = screenToPage(g, pageToScreen(g, { x, y }, z), z);
        return Math.abs(back.x - x) < 1e-6 && Math.abs(back.y - y) < 1e-6;
      }),
    );
  });

  it('Display → Page → Display returns the original point within 1e-6 pt', () => {
    fc.assert(
      fc.property(box, rotation, coord, coord, (b, r, x, y) => {
        const g = geo(b, r);
        const back = pageToDisplay(g, displayToPage(g, { x, y }));
        return Math.abs(back.x - x) < 1e-6 && Math.abs(back.y - y) < 1e-6;
      }),
    );
  });

  it('Page rect → Display → Page returns the original rect within 1e-6 pt', () => {
    const size = fc.double({ min: 0, max: 1000, noNaN: true });
    fc.assert(
      fc.property(box, rotation, coord, coord, size, size, (b, r, x, y, width, height) => {
        const g = geo(b, r);
        const back = displayRectToPage(g, pageRectToDisplay(g, { x, y, width, height }));
        return (
          Math.abs(back.x - x) < 1e-6 &&
          Math.abs(back.y - y) < 1e-6 &&
          Math.abs(back.width - width) < 1e-6 &&
          Math.abs(back.height - height) < 1e-6
        );
      }),
    );
  });

  it('Rotate 270 with CropBox offset and zoom 37% round-trips (spec scenario)', () => {
    const g = geo([20, 30, 600, 780], 270);
    fc.assert(
      fc.property(coord, coord, (x, y) => {
        const back = screenToPage(g, pageToScreen(g, { x, y }, 0.37), 0.37);
        return Math.abs(back.x - x) < 1e-6 && Math.abs(back.y - y) < 1e-6;
      }),
    );
  });
});

describe('Safe Area clamping (MV-4)', () => {
  const page = { width: 612, height: 792 };

  it('box past the left edge: x −5 → 10', () => {
    expect(clampToSafeArea({ x: -5, y: 300, width: 100, height: 20 }, page)).toMatchObject({ x: 10, y: 300 });
  });

  it('box past the bottom-right corner: (600, 790) → (502, 762)', () => {
    expect(clampToSafeArea({ x: 600, y: 790, width: 100, height: 20 }, page)).toMatchObject({ x: 502, y: 762 });
  });

  it('box wider than the Safe Area is pinned to the left inset', () => {
    expect(clampToSafeArea({ x: 50, y: 300, width: 600, height: 20 }, page)).toMatchObject({ x: 10 });
  });

  it('box already inside is unchanged', () => {
    const r = { x: 100, y: 100, width: 50, height: 20 };
    expect(clampToSafeArea(r, page)).toEqual(r);
  });
});

describe('Wrap Margin', () => {
  it('follows rotation: [0 0 612 792] with Rotate 90 → x = 752', () => {
    expect(wrapMarginX(displaySize(geo(LETTER, 90)))).toBe(752);
  });

  it('unrotated Letter page → x = 572', () => {
    expect(wrapMarginX(displaySize(geo(LETTER, 0)))).toBe(572);
  });
});
