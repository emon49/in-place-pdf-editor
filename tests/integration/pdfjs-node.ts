import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import type { GetDocument } from '../../src/lib/pdf-loader';

const root = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
const dirUrl = (d: string) => pathToFileURL(join(root, d)).href + '/';

/** PDF.js (legacy build) for Node integration tests, using the same asset set as the browser. */
export const nodeGetDocument = getDocument as unknown as GetDocument;
export const NODE_PDFJS_PARAMS: Omit<DocumentInitParameters, 'data'> = {
  cMapUrl: dirUrl('cmaps'),
  cMapPacked: true,
  standardFontDataUrl: dirUrl('standard_fonts'),
  wasmUrl: dirUrl('wasm'),
  enableXfa: false,
  verbosity: 0,
};
