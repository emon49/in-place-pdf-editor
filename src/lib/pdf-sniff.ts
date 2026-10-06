import type { LoadError } from './load-errors';
import { err, ok, type Result } from './result';

/** The PDF spec allows the `%PDF-` header anywhere in the first 1024 bytes. */
export const HEADER_SEARCH_WINDOW = 1024;
const HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export function hasPdfHeader(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, HEADER_SEARCH_WINDOW) - HEADER.length;
  for (let i = 0; i <= limit; i++) {
    if (HEADER.every((b, j) => bytes[i + j] === b)) return true;
  }
  return false;
}

export interface FileLike {
  readonly name: string;
  readonly type: string;
}

/** True when the file claims to be a PDF by extension or MIME type. */
export function claimsPdf(file: FileLike): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Rejects drops of zero or several files. */
export function pickSingleFile<T extends FileLike>(files: readonly T[]): Result<T, LoadError> {
  const [first] = files;
  if (files.length !== 1 || !first) return err('multiple-files');
  return ok(first);
}

/**
 * Identifies a PDF by content, not by name (document-loading spec).
 * Files without a header are "not-pdf" when they claim to be a PDF and "unsupported-type" otherwise.
 */
export function classifyBytes(file: FileLike, head: Uint8Array): Result<true, LoadError> {
  if (hasPdfHeader(head)) return ok(true);
  return err(claimsPdf(file) ? 'not-pdf' : 'unsupported-type');
}
