/** Every way opening a document can fail (document-loading spec, design D5). */
export type LoadError = 'multiple-files' | 'unsupported-type' | 'not-pdf' | 'damaged' | 'encrypted';

/** All user-facing load error messages live here. */
export const LOAD_ERROR_MESSAGES: Readonly<Record<LoadError, string>> = {
  'multiple-files': 'Drop one PDF at a time.',
  'unsupported-type': 'Only PDF files are supported.',
  'not-pdf': 'This file is not a PDF, even though its name says it is.',
  damaged: 'This PDF appears to be damaged and could not be opened.',
  encrypted:
    'This PDF is password-protected or encrypted, so it cannot be edited. Remove the protection in another tool (for example, print or save it without a password), then open it again.',
};
