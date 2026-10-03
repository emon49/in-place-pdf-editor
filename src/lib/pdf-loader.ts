import type { DocumentInitParameters, PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import type { LoadError } from './load-errors';
import { classifyBytes, type FileLike } from './pdf-sniff';
import { err, ok, type Result } from './result';

export type GetDocument = (params: DocumentInitParameters) => PDFDocumentLoadingTask;

export interface LoadedDocument {
  readonly pdf: PDFDocumentProxy;
  /** The untouched original bytes; never mutated (needed for export and original-font reuse). */
  readonly originalBytes: Uint8Array;
  readonly pageCount: number;
}

const errorName = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : '';

/**
 * Sniffs, opens and gates a PDF (design D5). Never resolves with an encrypted document:
 * encryption is detected before any page can be rendered.
 *
 * @param baseParams PDF.js options (worker, asset URLs); `data` is supplied here.
 */
export async function loadPdfBytes(
  getDocument: GetDocument,
  file: FileLike,
  bytes: Uint8Array,
  baseParams: Omit<DocumentInitParameters, 'data'> = {},
): Promise<Result<LoadedDocument, LoadError>> {
  const sniff = classifyBytes(file, bytes.subarray(0, 1024));
  if (!sniff.ok) return sniff;

  const originalBytes = bytes.slice();
  // PDF.js transfers (detaches) the buffer it is given, so hand it a separate copy.
  const task = getDocument({ ...baseParams, data: bytes.slice() });
  let pdf: PDFDocumentProxy;
  try {
    pdf = await task.promise;
  } catch (e) {
    await task.destroy().catch(() => undefined);
    return err(errorName(e) === 'PasswordException' ? 'encrypted' : 'damaged');
  }

  try {
    // Any /Encrypt dictionary yields permissions, including owner-password-only files (ADR-0006).
    if ((await pdf.getPermissions()) !== null) {
      await task.destroy();
      return err('encrypted');
    }
    if (pdf.numPages < 1) {
      await task.destroy();
      return err('damaged');
    }
  } catch {
    await task.destroy().catch(() => undefined);
    return err('damaged');
  }

  return ok({ pdf, originalBytes, pageCount: pdf.numPages });
}

export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Releases a document and its worker resources (PDF.js 6 destroys through the loading task). */
export function destroyDocument(pdf: PDFDocumentProxy): Promise<void> {
  return pdf.loadingTask.destroy();
}
