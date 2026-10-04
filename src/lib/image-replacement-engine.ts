import type { Rect, Size } from './coordinates';
import type { FitMode } from '../types/operations';

// ─── Fit-mode geometry (D2) ───────────────────────────────────────────────────

/**
 * Compute the destination rectangle for a replacement image inside `originalBox`,
 * given the image's intrinsic size and the chosen fit mode (IM-3).
 *
 * - `contain`: scale to fit inside the box, preserving aspect ratio (default).
 * - `cover`: scale to fill the box, preserving aspect ratio (may crop).
 * - `fill`: stretch to exactly fill the box.
 *
 * The result is always within `originalBox` for contain, and equals it for fill.
 * For cover it equals the box (the caller clips at render time).
 * All coordinates are in the same space as `originalBox`.
 */
export function fitImageRect(originalBox: Rect, imageSize: Size, fit: FitMode): Rect {
  if (fit === 'fill') {
    return { x: originalBox.x, y: originalBox.y, width: originalBox.width, height: originalBox.height };
  }

  const boxAspect = originalBox.width / originalBox.height;
  const imgAspect = imageSize.width / imageSize.height;

  if (fit === 'contain') {
    if (imgAspect >= boxAspect) {
      // Image is wider relative to its height → constrained by width.
      const h = originalBox.width / imgAspect;
      return {
        x: originalBox.x,
        y: originalBox.y + (originalBox.height - h) / 2,
        width: originalBox.width,
        height: h,
      };
    } else {
      // Constrained by height.
      const w = originalBox.height * imgAspect;
      return {
        x: originalBox.x + (originalBox.width - w) / 2,
        y: originalBox.y,
        width: w,
        height: originalBox.height,
      };
    }
  }

  // cover: fill the box while preserving aspect ratio.
  if (imgAspect >= boxAspect) {
    // Image is wider → constrained by height to cover.
    const w = originalBox.height * imgAspect;
    return {
      x: originalBox.x - (w - originalBox.width) / 2,
      y: originalBox.y,
      width: w,
      height: originalBox.height,
    };
  } else {
    const h = originalBox.width / imgAspect;
    return {
      x: originalBox.x,
      y: originalBox.y - (h - originalBox.height) / 2,
      width: originalBox.width,
      height: h,
    };
  }
}

// ─── Blob storage (IndexedDB) (D1) ───────────────────────────────────────────

const DB_NAME = 'image-blobs';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve a stored blob by its key. Returns null if not found. */
export async function loadBlob(blobKey: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(blobKey);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Write a blob and return its UUID key. */
async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(blob, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Convert a WebP file to PNG using OffscreenCanvas (D3), then store in IndexedDB.
 * Non-WebP files are stored as-is.
 * Returns the UUID blobKey.
 */
export async function storeBlob(file: File): Promise<string> {
  const key = crypto.randomUUID();
  let blob: Blob;

  if (file.type === 'image/webp') {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    blob = await canvas.convertToBlob({ type: 'image/png' });
  } else {
    blob = file;
  }

  await putBlob(key, blob);
  return key;
}
