import { describe, expect, it, vi } from 'vitest';
import { coverOriginalPosition } from '../../src/lib/export-worker';
import type { PDFPage } from 'pdf-lib';
import type { Rect } from '../../src/lib/coordinates';

describe('coverOriginalPosition', () => {
  it('calls page.drawRectangle with correct coordinates and color', () => {
    const drawRectangle = vi.fn();
    const page = { drawRectangle } as unknown as PDFPage;
    const bbox: Rect = { x: 10, y: 20, width: 100, height: 30 };

    coverOriginalPosition(page, bbox, '#ff8040');

    expect(drawRectangle).toHaveBeenCalledOnce();
    const args = drawRectangle.mock.calls[0]?.[0] as Record<string, unknown> & { color: { red: number; green: number; blue: number } };
    expect(args.x).toBe(10);
    expect(args.y).toBe(20);
    expect(args.width).toBe(100);
    expect(args.height).toBe(30);
    expect(args.borderWidth).toBe(0);
    // r=255, g=128, b=64 → floats ≈ 1, 0.502, 0.251
    expect(args.color.red).toBeCloseTo(1.0, 2);
    expect(args.color.green).toBeCloseTo(128 / 255, 2);
    expect(args.color.blue).toBeCloseTo(64 / 255, 2);
  });

  it('uses white (#ffffff) as default mask color', () => {
    const drawRectangle = vi.fn();
    const page = { drawRectangle } as unknown as PDFPage;
    const bbox: Rect = { x: 0, y: 0, width: 50, height: 10 };

    coverOriginalPosition(page, bbox, '#ffffff');

    const args = drawRectangle.mock.calls[0]?.[0] as Record<string, unknown> & { color: { red: number; green: number; blue: number } };
    expect(args.color.red).toBeCloseTo(1.0, 2);
    expect(args.color.green).toBeCloseTo(1.0, 2);
    expect(args.color.blue).toBeCloseTo(1.0, 2);
  });
});
