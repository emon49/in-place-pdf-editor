import { pageRectToDisplay, type PageGeometry } from './coordinates';
import type { PageModelCache } from './page-model';
import { sampleGlyphColor, sampleRing, type Raster } from './pdf-color-extractor';
import type { PageModel, TextLine } from '../types/page-model';

/**
 * Fills in what only the rendered page can tell (ADR-0004): the background behind each line, and the text
 * colour of lines whose colour the content stream could not provide. Exact colours are never sampled.
 */
export function sampleLines(lines: readonly TextLine[], raster: Raster, geometry: PageGeometry): TextLine[] {
  return lines.map((line) => {
    const rect = pageRectToDisplay(geometry, line.box);
    const ring = sampleRing(raster, rect);
    const background: TextLine['background'] = ring
      ? { status: 'ready', color: ring.color, uniform: ring.uniform, ratio: ring.ratio }
      : { status: 'ready', color: '#FFFFFF', uniform: true, ratio: 1 };
    const color =
      line.color.source === 'exact'
        ? line.color
        : { hex: sampleGlyphColor(raster, rect) ?? line.color.hex, source: 'sampled' as const };
    return { ...line, background, color };
  });
}

export type IdleScheduler = (run: () => void) => () => void;

/** `requestIdleCallback` where available, a short timeout otherwise (Safari). */
export const scheduleIdle: IdleScheduler = (run) => {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 50);
  return () => clearTimeout(handle);
};

export interface SamplingJob {
  readonly documentId: string;
  readonly pageIndex: number;
  readonly geometry: PageGeometry;
  readonly cache: PageModelCache;
  readonly getRaster: () => Promise<Raster>;
  /** Called after the cached model was replaced; the UI refreshes without the page being rendered again. */
  readonly onUpdated: () => void;
  readonly idle?: IdleScheduler;
}

/**
 * Samples a page after the visible render, in an idle callback (D9). Until it finishes the cached model keeps
 * its lines usable with background `pending`. Returns a canceller.
 */
export function scheduleSampling(job: SamplingJob): () => void {
  let cancelled = false;
  const cancelIdle = (job.idle ?? scheduleIdle)(() => {
    void (async () => {
      try {
        const raster = await job.getRaster();
        const model = job.cache.get(job.documentId, job.pageIndex);
        if (cancelled || !model) return;
        const updated: PageModel = { ...model, lines: sampleLines(model.lines, raster, job.geometry) };
        job.cache.set(job.documentId, job.pageIndex, updated);
        job.onUpdated();
      } catch {
        // Sampling is an enhancement: lines stay usable with their background pending.
      }
    })();
  });
  return () => {
    cancelled = true;
    cancelIdle();
  };
}
