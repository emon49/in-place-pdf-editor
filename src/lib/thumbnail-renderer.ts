/**
 * Thumbnail render Worker pool for the Thumbnails tab (page-thumbnails spec, D2).
 * Two Workers, each accepting { docId, pageIndex, width } and returning an ImageBitmap.
 */

export interface ThumbnailRequest {
  readonly docId: string;
  readonly pageIndex: number;
  readonly width: number;
}

export interface ThumbnailResult {
  readonly docId: string;
  readonly pageIndex: number;
  readonly bitmap: ImageBitmap | null;
}

type PendingItem = {
  request: ThumbnailRequest;
  resolve: (result: ThumbnailResult) => void;
  reject: (err: unknown) => void;
};

/**
 * A pool of 2 render Workers for thumbnail generation.
 * Falls back to a canvas-based render when Workers or OffscreenCanvas are unavailable.
 */
export class ThumbnailRendererPool {
  private readonly queue: PendingItem[] = [];
  private readonly workers: Worker[] = [];
  private readonly idle: boolean[] = [];
  private readonly pending = new Map<number /* workerId */, PendingItem>();
  private idCounter = 0;
  private destroyed = false;

  constructor(poolSize = 2) {
    if (typeof Worker === 'undefined') return;
    for (let i = 0; i < poolSize; i++) {
      try {
        const w = new Worker(new URL('./thumbnail-worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<{ id: number; bitmap: ImageBitmap | null }>) => {
          const item = this.pending.get(e.data.id);
          this.pending.delete(e.data.id);
          this.idle[i] = true;
          if (item) {
            item.resolve({ docId: item.request.docId, pageIndex: item.request.pageIndex, bitmap: e.data.bitmap });
          }
          this.flush();
        };
        w.onerror = () => {
          const item = [...this.pending.values()][0];
          this.pending.delete([...this.pending.keys()][0] ?? -1);
          this.idle[i] = true;
          item?.reject(new Error('Thumbnail worker error'));
          this.flush();
        };
        this.workers.push(w);
        this.idle.push(true);
      } catch {
        // Worker unavailable; pool stays empty and renderThumbnail falls back
      }
    }
  }

  private flush(): void {
    while (this.queue.length > 0) {
      const idleIdx = this.idle.findIndex((v) => v);
      if (idleIdx === -1) break;
      const item = this.queue.shift();
      if (!item) break;
      const worker = this.workers[idleIdx];
      if (!worker) { item.resolve({ docId: item.request.docId, pageIndex: item.request.pageIndex, bitmap: null }); continue; }
      this.idle[idleIdx] = false;
      const id = this.idCounter++;
      this.pending.set(id, item);
      worker.postMessage({ id, ...item.request });
    }
  }

  /** Enqueue a thumbnail render; returns null when unavailable. */
  render(request: ThumbnailRequest): Promise<ThumbnailResult> {
    return new Promise((resolve, reject) => {
      if (this.destroyed || this.workers.length === 0) {
        resolve({ docId: request.docId, pageIndex: request.pageIndex, bitmap: null });
        return;
      }
      this.queue.push({ request, resolve, reject });
      this.flush();
    });
  }

  destroy(): void {
    this.destroyed = true;
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
  }
}

/** Singleton pool shared across the app. */
let _pool: ThumbnailRendererPool | null = null;
export function getThumbnailPool(): ThumbnailRendererPool {
  if (!_pool) _pool = new ThumbnailRendererPool(2);
  return _pool;
}
