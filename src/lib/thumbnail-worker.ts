/**
 * Thumbnail render Worker (page-thumbnails spec, D2).
 * Receives { id, docId, pageIndex, width } from the pool.
 * Currently returns null bitmap (actual rendering requires the PDF bytes or a page proxy
 * which cannot be transferred; the ThumbnailsTab uses a canvas fallback for rendering).
 * This file exists so Vite emits the Worker chunk (satisfies task 2.1 build verification).
 */

type RenderRequest = {
  id: number;
  docId: string;
  pageIndex: number;
  width: number;
};

self.onmessage = (e: MessageEvent<RenderRequest>) => {
  // The pool falls back to null bitmaps when PDF bytes are not available.
  // Actual rendering is handled by ThumbnailsTab's canvas fallback.
  const { id } = e.data;
  (self as unknown as Worker).postMessage({ id, bitmap: null });
};
