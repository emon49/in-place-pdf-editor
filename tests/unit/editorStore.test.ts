import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { createDocumentRegistry } from '../../src/lib/document-registry';
import type { LoadError } from '../../src/lib/load-errors';
import type { LoadedDocument } from '../../src/lib/pdf-loader';
import { err, ok, type Result } from '../../src/lib/result';
import { createEditorStore } from '../../src/store/editorStore';

function fakePdf(numPages: number, userUnit = 1) {
  const destroy = vi.fn(async () => undefined);
  const pdf = {
    numPages,
    getPage: async () => ({ userUnit }),
    loadingTask: { destroy },
  } as unknown as PDFDocumentProxy;
  return { pdf, destroy };
}

function setup(results: Result<LoadedDocument, LoadError>[]) {
  let n = 0;
  const open = vi.fn(async () => results[n++] ?? err<LoadError>('damaged'));
  let ids = 0;
  const registry = createDocumentRegistry(() => `doc-${++ids}`);
  return { store: createEditorStore({ open, registry }), registry, open };
}

const loaded = (pageCount: number, byteLength = 1000, userUnit = 1) => {
  const { pdf, destroy } = fakePdf(pageCount, userUnit);
  return { result: ok<LoadedDocument>({ pdf, originalBytes: new Uint8Array(byteLength), pageCount }), destroy };
};
const file = (name = 'a.pdf') => ({ name, type: 'application/pdf' });

describe('editorStore document lifecycle', () => {
  it('successful load shows page 1 and the page count', async () => {
    const { store } = setup([loaded(8).result]);
    await store.getState().openBytes(file(), new Uint8Array());
    const s = store.getState();
    expect(s.document).toMatchObject({ name: 'a.pdf', pageCount: 8 });
    expect(s.view.pageIndex).toBe(0);
    expect(s.loading).toBe(false);
  });

  it('failed load leaves the previous document in place', async () => {
    const { store } = setup([loaded(3).result, err('damaged')]);
    await store.getState().openBytes(file('first.pdf'), new Uint8Array());
    store.getState().goToPage(2);
    await store.getState().openBytes(file('broken.pdf'), new Uint8Array());
    const s = store.getState();
    expect(s.document?.name).toBe('first.pdf');
    expect(s.view.pageIndex).toBe(2);
    expect(s.error).toBe('damaged');
  });

  it('second document resets to page 1, keeps fit-to-width, releases the first', async () => {
    const first = loaded(8);
    const { store, registry } = setup([first.result, loaded(2).result]);
    await store.getState().openBytes(file('one.pdf'), new Uint8Array());
    const firstId = store.getState().document?.id ?? '';
    store.getState().goToPage(3);
    store.getState().setFitMode('width');
    await store.getState().openBytes(file('two.pdf'), new Uint8Array());
    const s = store.getState();
    expect(s.document?.name).toBe('two.pdf');
    expect(s.view).toMatchObject({ pageIndex: 0, fitMode: 'width' });
    expect(first.destroy).toHaveBeenCalled();
    expect(registry.get(firstId)).toBeUndefined();
  });

  it('a stale load that finishes after a newer one is discarded', async () => {
    const slow = loaded(5);
    let resolveSlow: (r: Result<LoadedDocument, LoadError>) => void = () => undefined;
    const open = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)))
      .mockImplementationOnce(async () => loaded(2).result);
    const store = createEditorStore({ open, registry: createDocumentRegistry() });
    const p1 = store.getState().openBytes(file('slow.pdf'), new Uint8Array());
    await store.getState().openBytes(file('fast.pdf'), new Uint8Array());
    resolveSlow(slow.result);
    await p1;
    expect(store.getState().document?.name).toBe('fast.pdf');
    expect(slow.destroy).toHaveBeenCalled();
  });

  it('dropping several files reports multiple-files without opening', async () => {
    const { store, open } = setup([]);
    const blob = (name: string) => Object.assign(new Blob(['%PDF-']), { name });
    await store.getState().openFiles([blob('a.pdf'), blob('b.pdf')]);
    expect(store.getState().error).toBe('multiple-files');
    expect(open).not.toHaveBeenCalled();
  });
});

describe('large document notice (3.6)', () => {
  it('120-page document opens with a dismissible notice', async () => {
    const { store } = setup([loaded(120).result]);
    await store.getState().openBytes(file(), new Uint8Array());
    expect(store.getState().document?.pageCount).toBe(120);
    expect(store.getState().notice).toBe('large-document');
    store.getState().dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  it('>50 MB triggers the notice; UserUnit ≠ 1 triggers the units notice', async () => {
    const { store } = setup([loaded(2, 51 * 1024 * 1024).result, loaded(2, 1000, 2).result]);
    await store.getState().openBytes(file(), new Uint8Array());
    expect(store.getState().notice).toBe('large-document');
    await store.getState().openBytes(file(), new Uint8Array());
    expect(store.getState().notice).toBe('unusual-units');
  });

  it('small documents have no notice', async () => {
    const { store } = setup([loaded(10).result]);
    await store.getState().openBytes(file(), new Uint8Array());
    expect(store.getState().notice).toBeNull();
  });
});

describe('navigation and zoom', () => {
  it('stops at first and last pages and ignores invalid pages', async () => {
    const { store } = setup([loaded(8).result]);
    await store.getState().openBytes(file(), new Uint8Array());
    const s = store.getState;
    s().prevPage();
    expect(s().view.pageIndex).toBe(0);
    s().lastPage();
    expect(s().view.pageIndex).toBe(7);
    s().nextPage();
    expect(s().view.pageIndex).toBe(7);
    s().goToPage(11);
    expect(s().view.pageIndex).toBe(7);
    s().goToPage(4);
    expect(s().view.pageIndex).toBe(4);
  });

  it('explicit zoom leaves fit mode; fit zoom keeps it', () => {
    const { store } = setup([]);
    const s = store.getState;
    s().setFitMode('width');
    s().applyFitZoom(1.1);
    expect(s().view).toMatchObject({ zoom: 1.1, fitMode: 'width' });
    s().zoomIn();
    expect(s().view).toMatchObject({ zoom: 1.25, fitMode: null });
    s().applyFitZoom(0.5);
    expect(s().view.zoom).toBe(1.25);
  });
});
