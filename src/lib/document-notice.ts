/** Non-blocking notices shown after opening a document (document-loading spec, design Risks). */
export type DocumentNotice = 'large-document' | 'unusual-units';

export const LARGE_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const LARGE_DOCUMENT_PAGES = 100;

export const NOTICE_MESSAGES: Readonly<Record<DocumentNotice, string>> = {
  'large-document': 'This is a large document. Rendering and editing may be slower than usual.',
  'unusual-units': 'This PDF uses unusual page units. Positions and sizes may not be shown accurately.',
};

export function documentNotice(info: { byteLength: number; pageCount: number; userUnit: number }): DocumentNotice | null {
  if (info.byteLength > LARGE_DOCUMENT_BYTES || info.pageCount > LARGE_DOCUMENT_PAGES) return 'large-document';
  if (info.userUnit !== 1) return 'unusual-units';
  return null;
}
