import { describe, expect, it, vi } from 'vitest';
import { createPageGeometry } from '../../src/lib/coordinates';
import { createPageModelCache } from '../../src/lib/page-model';
import { createRasterProvider } from '../../src/lib/page-raster';
import { scheduleSampling, sampleLines, type IdleScheduler } from '../../src/lib/page-sampler';
import type { Raster } from '../../src/lib/pdf-color-extractor';
import type { PageModel, TextLine } from '../../src/types/page-model';

const geometry = createPageGeometry([0, 0, 100, 60], 0);

/** White page with a light-blue band and red ink drawn inside one line box. */
function raster(): Raster {
  const [width, height] = [100, 60];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let px: [number, number, number] = y >= 0 && y < 30 ? [219, 232, 250] : [255, 255, 255];
      if (x >= 12 && x < 40 && y >= 40 && y < 48 && (x + y) % 2 === 0) px = [204, 26, 26];
      data.set([...px, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const line = (id: string, box: TextLine['box'], source: TextLine['color']['source']): TextLine =>
  ({
    id,
    box,
    color: source === 'exact' ? { hex: '#123456', source } : { hex: '#000000', source },
    background: { status: 'pending' },
  }) as TextLine;

// Display y = 60 - page y on this unrotated page.
const header = line('0:0', { x: 10, y: 42, width: 30, height: 10 }, 'exact'); // display y 8..18: fully inside the tint band
const body = line('0:1', { x: 10, y: 10, width: 30, height: 10 }, 'pending'); // display y 40..50: red ink

describe('sampleLines (5.3, 6.2)', () => {
  it('samples the background behind each line', () => {
    const [h, b] = sampleLines([header, body], raster(), geometry);
    expect(h?.background).toMatchObject({ status: 'ready', color: '#DBE8FA', uniform: true });
    expect(b?.background).toMatchObject({ status: 'ready', color: '#FFFFFF', uniform: true });
  });

  it('never samples an exact colour', () => {
    const [h] = sampleLines([header], raster(), geometry);
    expect(h?.color).toEqual({ hex: '#123456', source: 'exact' });
  });

  it('samples an unresolved colour and marks it sampled', () => {
    const [, b] = sampleLines([header, body], raster(), geometry);
    expect(b?.color).toEqual({ hex: '#CC1A1A', source: 'sampled' });
  });

  it('keeps the placeholder colour, marked sampled, when the area has no ink', () => {
    const [h] = sampleLines([line('0:2', { x: 60, y: 10, width: 20, height: 10 }, 'pending')], raster(), geometry);
    expect(h?.color).toEqual({ hex: '#000000', source: 'sampled' });
  });
});

describe('scheduleSampling (6.3)', () => {
  const manualIdle = () => {
    let pending: (() => void) | null = null;
    const idle: IdleScheduler = (run) => {
      pending = run;
      return () => (pending = null);
    };
    return { idle, flush: () => pending?.(), hasPending: () => pending !== null };
  };
  const settle = () => new Promise((r) => setTimeout(r, 0));

  function setup() {
    const cache = createPageModelCache();
    const model: PageModel = { pageIndex: 0, lines: [header, body], images: [], palette: [] };
    cache.set('d', 0, model);
    const onUpdated = vi.fn();
    const getRaster = vi.fn(async () => raster());
    const scheduler = manualIdle();
    const cancel = scheduleSampling({ documentId: 'd', pageIndex: 0, geometry, cache, getRaster, onUpdated, idle: scheduler.idle });
    return { cache, model, onUpdated, getRaster, scheduler, cancel };
  }

  it('does nothing until the idle callback runs and leaves lines usable with a pending background', () => {
    const { cache, model, getRaster, onUpdated } = setup();
    expect(getRaster).not.toHaveBeenCalled();
    expect(cache.get('d', 0)).toBe(model);
    expect(cache.get('d', 0)?.lines.every((l) => l.background.status === 'pending')).toBe(true);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('updates the cached model and notifies once when sampling finishes', async () => {
    const { cache, scheduler, onUpdated } = setup();
    scheduler.flush();
    await settle();
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(cache.get('d', 0)?.lines.every((l) => l.background.status === 'ready')).toBe(true);
  });

  it('can be cancelled before it runs, and ignores a result that arrives after cancelling', async () => {
    const first = setup();
    first.cancel();
    expect(first.scheduler.hasPending()).toBe(false);
    const second = setup();
    second.scheduler.flush();
    second.cancel();
    await settle();
    expect(second.onUpdated).not.toHaveBeenCalled();
  });

  it('swallows a failed sampling render', async () => {
    const cache = createPageModelCache();
    cache.set('d', 0, { pageIndex: 0, lines: [header], images: [], palette: [] });
    const onUpdated = vi.fn();
    const scheduler = manualIdle();
    scheduleSampling({ documentId: 'd', pageIndex: 0, geometry, cache, getRaster: async () => Promise.reject(new Error('x')), onUpdated, idle: scheduler.idle });
    scheduler.flush();
    await settle();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});

describe('raster provider (6.1)', () => {
  it('renders each page once however often it is requested, whatever the zoom', async () => {
    const render = vi.fn(async () => raster());
    const provider = createRasterProvider(render);
    const [a, b] = await Promise.all([provider.get('d', 0), provider.get('d', 0)]);
    await provider.get('d', 0);
    expect(render).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    await provider.get('d', 1);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('forgets a document, and retries after a failure', async () => {
    const render = vi.fn<() => Promise<Raster>>().mockRejectedValueOnce(new Error('x')).mockResolvedValue(raster());
    const provider = createRasterProvider(render);
    await expect(provider.get('d', 0)).rejects.toThrow('x');
    await provider.get('d', 0);
    provider.clear('d');
    await provider.get('d', 0);
    expect(render).toHaveBeenCalledTimes(3);
  });
});
