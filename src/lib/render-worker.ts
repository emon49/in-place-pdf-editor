/**
 * Render Worker entry point (page-viewer spec D3, task 5.1).
 * Receives an OffscreenCanvas (transferred) from PDFViewer and rendered ImageBitmaps.
 * Drawing happens off the main thread so layout is never blocked.
 */

type InitMessage = { type: 'init'; canvas: OffscreenCanvas };
type DrawMessage = { type: 'draw'; id: number; bitmap: ImageBitmap; width: number; height: number };
type WorkerInMessage = InitMessage | DrawMessage;
type WorkerOutMessage = { type: 'done'; id: number };

let offscreen: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    offscreen = msg.canvas;
    ctx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  } else if (msg.type === 'draw' && ctx && offscreen) {
    offscreen.width = msg.width;
    offscreen.height = msg.height;
    ctx.drawImage(msg.bitmap, 0, 0);
    msg.bitmap.close();
    (self as unknown as Worker).postMessage({ type: 'done', id: msg.id } satisfies WorkerOutMessage);
  }
};
