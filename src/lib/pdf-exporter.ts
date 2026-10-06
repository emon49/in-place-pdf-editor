/**
 * Main-thread PDF export API (EX-1, EX-2, EX-3, EX-4, EX-5, EX-6).
 *
 * Prepares the export payload (fetches font bytes and image blobs from IndexedDB),
 * then delegates CPU-intensive PDF mutation to the export Worker (D1).
 */
import type { PreviewImage, PreviewLine, ResolvedFont } from '../types/operations';
import { loadBlob } from './image-replacement-engine';
import { lookupCatalog } from './font-catalog';
import type { ExportPayload, ExportPage, ExportTextLine, ExportImage, WorkerInMessage, WorkerOutMessage } from './export-worker';

export interface ExportProgressFn {
  (pct: number): void;
}

/**
 * Export the document to a new PDF `Uint8Array`.
 *
 * @param originalBytes   - The original, unmodified PDF bytes.
 * @param pageCount       - Total number of pages in the document.
 * @param previewLinesFn  - `previewLines(pageIndex)` from the editor store.
 * @param previewImagesFn - `previewImages(pageIndex)` from the editor store.
 * @param onProgress      - Optional progress callback (0–100).
 */
export async function exportDocument(
  originalBytes: Uint8Array,
  pageCount: number,
  previewLinesFn: (pageIndex: number) => PreviewLine[],
  previewImagesFn: (pageIndex: number) => PreviewImage[],
  onProgress?: ExportProgressFn,
): Promise<Uint8Array> {
  // 1. Build per-page data from the derived preview state.
  const pages: ExportPage[] = Array.from({ length: pageCount }, (_, i) => {
    const previewLines = previewLinesFn(i);
    const previewImages = previewImagesFn(i);
    return buildExportPage(i, previewLines, previewImages);
  });

  // 2. Collect blobKeys referenced by IMAGE_REPLACE operations.
  const blobKeys = new Set<string>();
  for (const page of pages) {
    for (const img of page.images) {
      if (img.blobKey) blobKeys.add(img.blobKey);
    }
  }

  // 3. Fetch image bytes from IndexedDB.
  const imageBytes: Record<string, Uint8Array> = {};
  await Promise.all(
    [...blobKeys].map(async (key) => {
      const blob = await loadBlob(key);
      if (blob) imageBytes[key] = new Uint8Array(await blob.arrayBuffer());
    }),
  );

  // 4. Collect CSS font families needed for tiers 2–4.
  const fontFamilies = collectFontFamilies(pages);

  // 5. Fetch font bytes from the self-hosted catalog.
  const fontBytes: Record<string, Uint8Array> = {};
  await Promise.all(
    [...fontFamilies].map(async (family) => {
      const entry = lookupCatalog(family);
      if (!entry) return;
      try {
        const resp = await fetch(entry.path);
        if (resp.ok) fontBytes[family] = new Uint8Array(await resp.arrayBuffer());
      } catch {
        // Font fetch failed; Worker will skip or use fallback.
      }
    }),
  );

  // Always include Liberation Sans as the ultimate fallback (tier 4).
  const liberationEntry = lookupCatalog('Liberation Sans');
  if (liberationEntry && !fontBytes['Liberation Sans']) {
    try {
      const resp = await fetch(liberationEntry.path);
      if (resp.ok) fontBytes['Liberation Sans'] = new Uint8Array(await resp.arrayBuffer());
    } catch {
      // Not critical; Worker will continue without it.
    }
  }

  // 6. Build the payload and hand off to the Worker.
  const payload: ExportPayload = { originalBytes, pages, fontBytes, imageBytes };
  return spawnExportWorker(payload, onProgress);
}

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildExportPage(
  pageIndex: number,
  previewLines: PreviewLine[],
  previewImages: PreviewImage[],
): ExportPage {
  // The Worker uses pdf-lib's page object for actual dimensions; these are unused fallbacks.
  const pageWidth = 612;
  const pageHeight = 792;

  const lines: ExportTextLine[] = previewLines.map((pl) => ({
    id: pl.id,
    text: pl.text,
    currentText: pl.currentText,
    box: pl.box,
    origin: pl.origin,
    currentBox: pl.currentBox,
    deleted: pl.deleted,
    fontSize: pl.fontSize,
    style: {
      fontClass: pl.fontClass,
      bold: pl.bold,
      italic: pl.italic,
      fontFamilyOverride: null,
      size: pl.fontSize,
      color: pl.color.hex,
      charSpacing: pl.charSpacing,
      wordSpacing: pl.wordSpacing,
      lineHeight: pl.lineHeight,
      hScale: pl.hScale,
      rise: pl.rise,
      renderMode: pl.renderMode,
    },
    currentStyle: pl.currentStyle,
    resolvedFont: pl.resolvedFont,
    maskColor: pl.background.status === 'ready' ? pl.background.color : null,
    fontRawName: pl.font.rawName,
    fontFacts: pl.font,
    isAdded: pl.id.startsWith('add-'),
  }));

  const images: ExportImage[] = previewImages.map((pi) => ({
    id: pi.id,
    bbox: pi.bbox,
    currentBox: pi.currentBox,
    deleted: pi.deleted,
    blobKey: pi.blobKey,
    fit: pi.fit,
    maskColor: pi.maskColor,
  }));

  return { pageIndex, pageWidth, pageHeight, lines, images };
}

/** Collect all CSS font families needed for tiers 2–4 across all pages. */
function collectFontFamilies(pages: ExportPage[]): Set<string> {
  const families = new Set<string>();
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.deleted) continue;
      // Set exactly on lines drawn as patches (edited, moved or added).
      const rf: ResolvedFont | null = line.resolvedFont;
      if (rf && rf.tier !== 1) families.add(rf.cssFamily);
    }
  }
  return families;
}

// ─── Worker communication ─────────────────────────────────────────────────────

/** Spawn the export Worker, send the payload, and resolve with the output bytes. */
function spawnExportWorker(
  payload: ExportPayload,
  onProgress?: ExportProgressFn,
): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const worker = new Worker(
      // Vite turns this into a separate bundled chunk (task 1.2).
      new URL('./export-worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.(msg.pct);
      } else if (msg.type === 'done') {
        worker.terminate();
        resolve(msg.bytes);
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message ?? 'Export worker error'));
    };

    const msg: WorkerInMessage = { type: 'start', payload };
    // Transfer image and font buffers (freshly fetched; not needed in main thread).
    const transferable: Transferable[] = [
      ...Object.values(payload.imageBytes).map((b) => b.buffer),
      ...Object.values(payload.fontBytes).map((b) => b.buffer),
    ];
    worker.postMessage(msg, transferable);
  });
}
