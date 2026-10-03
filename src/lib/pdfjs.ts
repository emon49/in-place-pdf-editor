// The legacy build polyfills very recent JS built-ins (e.g. Map.prototype.getOrInsertComputed)
// that the modern build assumes, so current Safari/Chrome/Firefox releases all work (design D2).
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import type { FileLike } from './pdf-sniff';
import { loadPdfBytes, type GetDocument } from './pdf-loader';

/**
 * Browser PDF.js setup (design D2): same-origin module worker and self-hosted
 * CMaps, standard fonts, WASM decoders and ICC profiles, so nothing is fetched
 * from a CDN and everything works offline under the strict CSP.
 */
let workerConfigured = false;
function ensureWorker(): void {
  if (workerConfigured) return;
  GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), {
    type: 'module',
  });
  workerConfigured = true;
}

const base = import.meta.env.BASE_URL;

export const PDFJS_PARAMS: Omit<DocumentInitParameters, 'data'> = {
  cMapUrl: `${base}pdfjs/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
  wasmUrl: `${base}pdfjs/wasm/`,
  iccUrl: `${base}pdfjs/iccs/`,
  enableXfa: false,
};

export function openPdf(file: FileLike, bytes: Uint8Array) {
  ensureWorker();
  return loadPdfBytes(getDocument as unknown as GetDocument, file, bytes, PDFJS_PARAMS);
}
