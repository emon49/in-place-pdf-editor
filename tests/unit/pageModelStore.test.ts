import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { createDocumentRegistry } from '../../src/lib/document-registry';
import type { LoadedDocument } from '../../src/lib/pdf-loader';
import { createPageModelCache, pageModelKey } from '../../src/lib/page-model';
import { ok } from '../../src/lib/result';
import { createEditorStore } from '../../src/store/editorStore';
import type { PageModel, TextLine } from '../../src/types/page-model';

const line = (id: string): TextLine => ({ id }) as TextLine;
const model = (pageIndex: number, ids: string[] = []): PageModel => ({ pageIndex, lines: ids.map(line), images: [] });

function setup(extract: (documentId: string, pageIndex: number) => Promise<PageModel>, pageCount = 100) {
  const results = () => {
    const pdf = {
      numPages: pageCount,
      getPage: async () => ({ userUnit: 1 }),
      loadingTask: { destroy: vi.fn(async () => undefined) },
    } as unknown as PDFDocumentProxy;
    return ok<LoadedDocument>({ pdf, originalBytes: new Uint8Array(10), pageCount });
  };
  let ids = 0;
  const cache = createPageModelCache();
  const store = createEditorStore({
    registry: createDocumentRegistry(() => `doc-${++ids}`),
    open: async () => results(),
    extractPage: extract,
    pageModelCache: cache,
  });
  return { store, cache };
}
const file = { name: 'a.pdf', type: 'application/pdf' };
const open = (s: ReturnType<typeof setup>['store']) => s.getState().openBytes(file, new Uint8Array());
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('page model cache and status (2.2)', () => {
  it('moves idle → extracting → ready and caches the model', async () => {
    let resolve!: (m: PageModel) => void;
    const extract = vi.fn(() => new Promise<PageModel>((r) => (resolve = r)));
    const { store, cache } = setup(extract);
    await open(store);
    const key = pageModelKey('doc-1', 0);
    expect(store.getState().pageModels[key]?.status).toBe('extracting');
    resolve(model(0, ['0:0']));
    await settle();
    expect(store.getState().pageModels[key]?.status).toBe('ready');
    expect(cache.get('doc-1', 0)?.lines).toHaveLength(1);
  });

  it('marks a throwing extraction failed', async () => {
    const { store } = setup(async () => {
      throw new Error('boom');
    });
    await open(store);
    await settle();
    expect(store.getState().pageModels[pageModelKey('doc-1', 0)]?.status).toBe('failed');
  });

  it('replacing the document clears the cache, statuses and selection', async () => {
    const { store, cache } = setup(async (_d, p) => model(p, ['0:0']));
    await open(store);
    await settle();
    store.getState().selectObject('0:0');
    await open(store);
    await settle();
    expect(cache.get('doc-1', 0)).toBeUndefined();
    expect(store.getState().selection).toBeNull();
    expect(Object.keys(store.getState().pageModels)).toEqual([pageModelKey('doc-2', 0)]);
  });

  it('drops a result that arrives after the document was replaced', async () => {
    let resolveFirst!: (m: PageModel) => void;
    const extract = vi
      .fn<(d: string, p: number) => Promise<PageModel>>()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue(model(0));
    const { store, cache } = setup(extract);
    await open(store);
    await open(store);
    resolveFirst(model(0, ['0:0']));
    await settle();
    expect(cache.get('doc-1', 0)).toBeUndefined();
  });

  it('clears the selection when the page changes', async () => {
    const { store } = setup(async (_d, p) => model(p, [`${p}:0`]));
    await open(store);
    store.getState().selectObject('0:0');
    store.getState().goToPage(1);
    expect(store.getState().selection).toBeNull();
  });

  it('steps the selection through reading order', async () => {
    const { store } = setup(async (_d, p) => model(p, ['0:0', '0:1']));
    await open(store);
    await settle();
    const { stepSelection } = store.getState();
    stepSelection(1);
    expect(store.getState().selection).toBe('0:0');
    stepSelection(1);
    expect(store.getState().selection).toBe('0:1');
    stepSelection(1);
    expect(store.getState().selection).toBe('0:1');
    stepSelection(-1);
    expect(store.getState().selection).toBe('0:0');
  });
});

describe('extraction scheduling (2.3)', () => {
  it('a 100-page document extracts only page 1, and revisiting does not re-extract', async () => {
    const extract = vi.fn(async (_d: string, p: number) => model(p));
    const { store } = setup(extract);
    await open(store);
    await settle();
    expect(extract.mock.calls.map((c) => c[1])).toEqual([0]);
    store.getState().goToPage(1);
    await settle();
    store.getState().goToPage(0);
    await settle();
    expect(extract.mock.calls.map((c) => c[1])).toEqual([0, 1]);
  });

  it('a failing page does not stop the next page extracting (3.7)', async () => {
    const extract = vi.fn(async (_d: string, p: number) => {
      if (p === 0) throw new Error('boom');
      return model(p);
    });
    const { store } = setup(extract);
    await open(store);
    store.getState().goToPage(1);
    await settle();
    const s = store.getState().pageModels;
    expect(s[pageModelKey('doc-1', 0)]?.status).toBe('failed');
    expect(s[pageModelKey('doc-1', 1)]?.status).toBe('ready');
  });
});
