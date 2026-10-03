import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { destroyDocument, loadPdfBytes } from '../../src/lib/pdf-loader';
import { NODE_PDFJS_PARAMS, nodeGetDocument } from './pdfjs-node';

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, '..', 'fixtures', name)));
const asPdf = (name: string) => ({ name, type: 'application/pdf' });
const load = (name: string, bytes = fixture(name)) => loadPdfBytes(nodeGetDocument, asPdf(name), bytes, NODE_PDFJS_PARAMS);

describe('pdf-loader classifies fixtures (document-loading spec)', () => {
  it('opens a valid PDF and reports its page count', async () => {
    const result = await load('valid.pdf');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pageCount).toBe(1);
      await destroyDocument(result.value.pdf);
    }
  });

  it('keeps originalBytes identical to the input and independent of it', async () => {
    const input = fixture('valid.pdf');
    const snapshot = input.slice();
    const result = await load('valid.pdf', input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.originalBytes).toEqual(snapshot);
    expect(result.value.originalBytes.buffer).not.toBe(input.buffer);
    // The caller's buffer is not detached by PDF.js either.
    expect(input.byteLength).toBe(snapshot.byteLength);
    await destroyDocument(result.value.pdf);
  });

  it.each([
    ['truncated.pdf', 'damaged'],
    ['image-renamed.pdf', 'not-pdf'],
    ['encrypted-user-aes256.pdf', 'encrypted'],
    ['encrypted-user-rc4.pdf', 'encrypted'],
    ['encrypted-owner-only.pdf', 'encrypted'],
  ])('%s → %s', async (name, expected) => {
    expect(await load(name)).toEqual({ ok: false, error: expected });
  });
});
