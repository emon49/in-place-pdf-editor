import { describe, expect, it, vi } from 'vitest';
import type { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { createDocumentRegistry } from '../../src/lib/document-registry';

const handle = () => ({
  pdf: { loadingTask: { destroy: vi.fn(async () => undefined) } } as unknown as PDFDocumentProxy,
  originalBytes: new Uint8Array([1, 2, 3]),
});

describe('document registry pdf-lib handle (2.1)', () => {
  it('creates the handle on first request only and reuses it', async () => {
    const load = vi.fn(async () => ({}) as PDFDocument);
    const registry = createDocumentRegistry(() => 'd1', load);
    const id = registry.register(handle());
    expect(load).not.toHaveBeenCalled();
    const first = await registry.getPdfLib(id);
    const second = await registry.getPdfLib(id);
    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('loads over a copy of the original bytes', async () => {
    const h = handle();
    const load = vi.fn(async (_bytes: Uint8Array) => ({}) as PDFDocument);
    const registry = createDocumentRegistry(() => 'd1', load);
    await registry.getPdfLib(registry.register(h));
    const passed = load.mock.calls[0]?.[0];
    expect(passed).toEqual(h.originalBytes);
    expect(passed).not.toBe(h.originalBytes);
  });

  it('releasing the document releases the handle', async () => {
    const load = vi.fn(async () => ({}) as PDFDocument);
    const registry = createDocumentRegistry(() => 'd1', load);
    const id = registry.register(handle());
    await registry.getPdfLib(id);
    await registry.release(id);
    await expect(registry.getPdfLib(id)).rejects.toThrow('No document open');
  });

  it('does not cache a failed load', async () => {
    const load = vi.fn<() => Promise<PDFDocument>>().mockRejectedValueOnce(new Error('bad')).mockResolvedValue({} as PDFDocument);
    const registry = createDocumentRegistry(() => 'd1', load);
    const id = registry.register(handle());
    await expect(registry.getPdfLib(id)).rejects.toThrow('bad');
    await expect(registry.getPdfLib(id)).resolves.toBeDefined();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
