import { describe, expect, it } from 'vitest';
import { classifyBytes, hasPdfHeader, pickSingleFile } from '../../src/lib/pdf-sniff';
import { LOAD_ERROR_MESSAGES } from '../../src/lib/load-errors';

const enc = (s: string) => new TextEncoder().encode(s);

describe('header sniffing', () => {
  it('finds %PDF- at the start', () => expect(hasPdfHeader(enc('%PDF-1.7\n'))).toBe(true));
  it('finds %PDF- after leading junk within 1024 bytes', () =>
    expect(hasPdfHeader(enc(`${'x'.repeat(1000)}%PDF-1.4`))).toBe(true));
  it('ignores %PDF- beyond 1024 bytes', () => expect(hasPdfHeader(enc(`${'x'.repeat(1024)}%PDF-1.4`))).toBe(false));
  it('rejects PNG bytes', () => expect(hasPdfHeader(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false));
  it('handles empty input', () => expect(hasPdfHeader(new Uint8Array())).toBe(false));
});

describe('classification', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('PNG renamed to scan.pdf → not-pdf', () => {
    expect(classifyBytes({ name: 'scan.pdf', type: 'application/pdf' }, png)).toEqual({ ok: false, error: 'not-pdf' });
  });

  it('.docx → unsupported-type', () => {
    const docx = { name: 'letter.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    expect(classifyBytes(docx, enc('PK\u0003\u0004'))).toEqual({ ok: false, error: 'unsupported-type' });
  });

  it('PDF content with a wrong extension is accepted (content wins)', () => {
    expect(classifyBytes({ name: 'download.bin', type: '' }, enc('%PDF-1.7')).ok).toBe(true);
  });

  it('several files → multiple-files', () => {
    const f = { name: 'a.pdf', type: 'application/pdf' };
    expect(pickSingleFile([f, f])).toEqual({ ok: false, error: 'multiple-files' });
    expect(pickSingleFile([])).toEqual({ ok: false, error: 'multiple-files' });
    expect(pickSingleFile([f])).toEqual({ ok: true, value: f });
  });

  it('messages match the spec wording', () => {
    expect(LOAD_ERROR_MESSAGES['multiple-files']).toBe('Drop one PDF at a time.');
    expect(LOAD_ERROR_MESSAGES.damaged).toBe('This PDF appears to be damaged and could not be opened.');
    expect(LOAD_ERROR_MESSAGES['not-pdf']).toMatch(/not a PDF/);
    expect(LOAD_ERROR_MESSAGES['unsupported-type']).toMatch(/Only PDF files are supported/);
    expect(LOAD_ERROR_MESSAGES.encrypted).toMatch(/password-protected/);
  });
});
