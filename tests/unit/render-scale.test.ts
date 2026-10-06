import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_PIXELS, planCanvas } from '../../src/lib/render-scale';

const LETTER = { width: 612, height: 792 };

describe('canvas planning (page-viewer spec)', () => {
  it('Retina at 100%: CSS 612×792, backing 1224×1584', () => {
    const plan = planCanvas(LETTER, 1, 2);
    expect(plan.css).toEqual({ width: 612, height: 792 });
    expect(plan.canvas).toEqual({ width: 1224, height: 1584 });
    expect(plan.renderScale).toBe(2);
  });

  it('400% at dpr 2: CSS 2448×3168, backing ≤ 16,777,216 pixels', () => {
    const plan = planCanvas(LETTER, 4, 2);
    expect(plan.css).toEqual({ width: 2448, height: 3168 });
    expect(plan.canvas.width * plan.canvas.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    // As large as possible: within 1% of the limit.
    expect(plan.canvas.width * plan.canvas.height).toBeGreaterThan(MAX_CANVAS_PIXELS * 0.99);
    expect(plan.renderScale).toBeLessThan(2);
  });

  it('falls back to dpr 1 for invalid ratios', () => {
    expect(planCanvas(LETTER, 1, Number.NaN).renderScale).toBe(1);
    expect(planCanvas(LETTER, 1, 0).renderScale).toBe(1);
  });
});
