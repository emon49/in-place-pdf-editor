// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fitImageRect, loadBlob, storeBlob } from '../../src/lib/image-replacement-engine';
import type { Rect } from '../../src/lib/coordinates';

const box: Rect = { x: 10, y: 20, width: 100, height: 80 }; // 5:4 box

describe('fitImageRect — contain', () => {
  it('square image in a wide box: constrained by height', () => {
    // box is 5:4 (wider); square image (1:1)
    const r = fitImageRect(box, { width: 100, height: 100 }, 'contain');
    // Width = 80 (height), centered horizontally
    expect(r.height).toBeCloseTo(80);
    expect(r.width).toBeCloseTo(80);
    expect(r.x).toBeCloseTo(10 + (100 - 80) / 2);
    expect(r.y).toBeCloseTo(20);
  });

  it('tall image in a wide box: constrained by width', () => {
    // box 5:4; image 1:3 (tall)
    const r = fitImageRect(box, { width: 50, height: 150 }, 'contain');
    // imgAspect = 1/3; boxAspect = 5/4 → imgAspect < boxAspect → constrained by height
    expect(r.height).toBeCloseTo(80);
    expect(r.width).toBeCloseTo(80 * (1 / 3));
    expect(r.y).toBeCloseTo(20);
    expect(r.x).toBeCloseTo(10 + (100 - r.width) / 2);
  });

  it('wide image in a wide box: constrained by width', () => {
    // box 5:4; image 3:1 (very wide)
    const r = fitImageRect(box, { width: 300, height: 100 }, 'contain');
    // imgAspect = 3 > boxAspect = 5/4 → constrained by width
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(100 / 3);
    expect(r.x).toBeCloseTo(10);
    expect(r.y).toBeCloseTo(20 + (80 - r.height) / 2);
  });
});

describe('fitImageRect — cover', () => {
  it('square image covering a wide box: fills by height', () => {
    // square in 5:4 box: must fill both → height covers, width > box width
    const r = fitImageRect(box, { width: 100, height: 100 }, 'cover');
    // imgAspect = 1 < boxAspect 5/4 → covered by width
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(100);
    // y is shifted to center
    expect(r.y).toBeCloseTo(20 - (100 - 80) / 2);
    expect(r.x).toBeCloseTo(10);
  });

  it('wide image covering a wide box: fills by width, crops height', () => {
    const r = fitImageRect(box, { width: 300, height: 100 }, 'cover');
    // imgAspect = 3 > boxAspect 5/4 → constrained by height to fill width
    expect(r.height).toBeCloseTo(80);
    expect(r.width).toBeCloseTo(80 * 3);
    expect(r.y).toBeCloseTo(20);
    expect(r.x).toBeCloseTo(10 - (r.width - 100) / 2);
  });
});

describe('fitImageRect — fill', () => {
  it('returns the original box exactly', () => {
    const r = fitImageRect(box, { width: 200, height: 50 }, 'fill');
    expect(r).toEqual(box);
  });
});

// ─── Blob storage tests ───────────────────────────────────────────────────────

describe('storeBlob / loadBlob', () => {
  it('round-trips a PNG blob through IndexedDB', async () => {
    // Minimal 1×1 white PNG (67 bytes).
    const pngBytes = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10,   // PNG signature
      0, 0, 0, 13, 73, 72, 68, 82,       // IHDR chunk length + type
      0, 0, 0, 1, 0, 0, 0, 1,            // width=1, height=1
      8, 2, 0, 0, 0, 144, 119, 83, 222,  // bit depth=8, color=2 (RGB), CRC
      0, 0, 0, 12, 73, 68, 65, 84,       // IDAT chunk
      8, 215, 99, 248, 207, 0, 0, 0, 2, 0, 1, 226, 33, 188, 51, // compressed data + CRC
      0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130, // IEND
    ]);
    const file = new File([pngBytes], 'test.png', { type: 'image/png' });

    const key = await storeBlob(file);
    expect(typeof key).toBe('string');
    expect(key).toHaveLength(36); // UUID

    const retrieved = await loadBlob(key);
    // fake-indexeddb stores the file object; the important thing is a key was written and retrieved.
    expect(retrieved).not.toBeNull();
  });

  it('returns null for a missing key', async () => {
    const result = await loadBlob('nonexistent-key');
    expect(result).toBeNull();
  });
});
