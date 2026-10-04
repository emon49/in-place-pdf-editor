import { describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

vi.mock('../../src/lib/image-replacement-engine', () => ({
  storeBlob: vi.fn(async () => 'mock-blob-key'),
  loadBlob: vi.fn(async () => null),
  fitImageRect: vi.fn(),
}));
import { createDocumentRegistry } from '../../src/lib/document-registry';
import type { LoadError } from '../../src/lib/load-errors';
import type { LoadedDocument } from '../../src/lib/pdf-loader';
import { err, ok, type Result } from '../../src/lib/result';
import { createEditorStore } from '../../src/store/editorStore';
import type { TextReplaceOp } from '../../src/types/operations';

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

describe('previewLines selector (ST-2)', () => {
  it('returns PreviewLines reflecting operations', async () => {
    const { createPageModelCache } = await import('../../src/lib/page-model');
    const cache = createPageModelCache();
    const line = {
      id: '0:1', pageIndex: 0, text: 'Original', origin: { x: 0, y: 0 },
      box: { x: 0, y: 0, width: 100, height: 12 }, matrix: [1, 0, 0, 1, 0, 0] as const,
      fontRef: 'f', family: 'Helvetica', subsetPrefix: null, fontClass: 'sans' as const,
      bold: false, italic: false, fontSize: 12, hScale: 100, charSpacing: 0,
      wordSpacing: 0, rise: 0, renderMode: 0, lineHeight: 1.2,
      color: { hex: '#000', source: 'exact' as const },
      background: { status: 'pending' as const }, lockReason: null,
      font: { rawName: 'Helvetica', subtype: null, embedding: null, licence: null, encoding: null, coverage: null },
    };
    const { store } = setup([loaded(1).result]);
    await store.getState().openBytes(file(), new Uint8Array());
    const docId = store.getState().document?.id ?? "";
    cache.set(docId, 0, { pageIndex: 0, lines: [line], images: [] });
    // Re-create store with the cache that has the model
    const open = vi.fn(async () => loaded(1).result);
    const registry = createDocumentRegistry();
    const storeWithCache = createEditorStore({ open, registry, pageModelCache: cache });
    await storeWithCache.getState().openBytes(file(), new Uint8Array());
    const docId2 = storeWithCache.getState().document?.id ?? "";
    cache.set(docId2, 0, { pageIndex: 0, lines: [line], images: [] });
    const op: TextReplaceOp = { id: 'x', ts: 1, pageIndex: 0, type: 'TEXT_REPLACE', objectId: '0:1', newText: 'Edited' };
    storeWithCache.getState().pushOperation(op);
    const preview = storeWithCache.getState().previewLines(0);
    expect(preview).toHaveLength(1);
    expect(preview.at(0)?.currentText).toBe('Edited');
  });
});

describe('Operation Log (ST-3)', () => {
  function makeOp(n: number): TextReplaceOp {
    return { id: `op-${n}`, ts: n, pageIndex: 0, type: 'TEXT_REPLACE', objectId: 'line-1', newText: `text-${n}` };
  }

  it('push increments cursor and appends to ops', () => {
    const { store } = setup([]);
    store.getState().pushOperation(makeOp(1));
    expect(store.getState().cursor).toBe(1);
    expect(store.getState().ops).toHaveLength(1);
  });

  it('undo decrements cursor', () => {
    const { store } = setup([]);
    store.getState().pushOperation(makeOp(1));
    store.getState().pushOperation(makeOp(2));
    store.getState().undo();
    expect(store.getState().cursor).toBe(1);
  });

  it('redo increments cursor', () => {
    const { store } = setup([]);
    store.getState().pushOperation(makeOp(1));
    store.getState().undo();
    store.getState().redo();
    expect(store.getState().cursor).toBe(1);
  });

  it('new edit after undo discards redo tail', () => {
    const { store } = setup([]);
    store.getState().pushOperation(makeOp(1));
    store.getState().pushOperation(makeOp(2));
    store.getState().undo();
    store.getState().pushOperation(makeOp(3));
    expect(store.getState().ops).toHaveLength(2);
    expect(store.getState().cursor).toBe(2);
    expect(store.getState().ops.at(1)?.id).toBe('op-3');
  });

  it('undo at 0 is no-op', () => {
    const { store } = setup([]);
    store.getState().undo();
    expect(store.getState().cursor).toBe(0);
  });

  it('document change clears the log', async () => {
    const { store } = setup([loaded(2).result, loaded(2).result]);
    await store.getState().openBytes(file(), new Uint8Array());
    store.getState().pushOperation(makeOp(1));
    await store.getState().openBytes(file(), new Uint8Array());
    expect(store.getState().ops).toHaveLength(0);
    expect(store.getState().cursor).toBe(0);
  });
});

describe('addTextMode (6.4)', () => {
  it('toggles on', () => {
    const { store } = setup([]);
    expect(store.getState().addTextMode).toBe(false);
    store.getState().setAddTextMode(true);
    expect(store.getState().addTextMode).toBe(true);
  });

  it('toggles off', () => {
    const { store } = setup([]);
    store.getState().setAddTextMode(true);
    store.getState().setAddTextMode(false);
    expect(store.getState().addTextMode).toBe(false);
  });

  it('resets on document change', async () => {
    const { store } = setup([loaded(1).result]);
    store.getState().setAddTextMode(true);
    await store.getState().openBytes(file(), new Uint8Array());
    expect(store.getState().addTextMode).toBe(false);
  });
});

describe('replaceImage / resizeImage (IM-2, MV-7)', () => {
  const imageObj = {
    id: 'img:0:0', pageIndex: 0,
    bbox: { x: 10, y: 20, width: 100, height: 80 },
    locked: false, maskColor: null,
  };

  async function storeWithImage() {
    const { createPageModelCache } = await import('../../src/lib/page-model');
    const imgCache = createPageModelCache();
    const open = vi.fn(async () => loaded(1).result);
    const registry = createDocumentRegistry();
    const s = createEditorStore({ open, registry, pageModelCache: imgCache });
    await s.getState().openBytes(file(), new Uint8Array());
    const docId = s.getState().document?.id ?? '';
    imgCache.set(docId, 0, { pageIndex: 0, lines: [], images: [imageObj] });
    return s;
  }

  it('replaceImage produces one IMAGE_REPLACE in the log', async () => {
    const s = await storeWithImage();
    const f = new File([new Uint8Array([1, 2, 3])], 'img.png', { type: 'image/png' });
    await s.getState().replaceImage('img:0:0', f, 'contain');
    const ops = s.getState().ops;
    expect(ops).toHaveLength(1);
    const firstOp = ops[0];
    expect(firstOp?.type).toBe('IMAGE_REPLACE');
    const op = firstOp as import('../../src/types/operations').ImageReplaceOp;
    expect(op.objectId).toBe('img:0:0');
    expect(op.fit).toBe('contain');
    expect(typeof op.blobKey).toBe('string');
  });

  it('resizeImage produces one OBJECT_RESIZE in the log', async () => {
    const s = await storeWithImage();
    const newBox = { x: 10, y: 20, width: 120, height: 90 };
    s.getState().resizeImage('img:0:0', newBox);
    const ops = s.getState().ops;
    expect(ops).toHaveLength(1);
    const firstOp = ops[0];
    expect(firstOp?.type).toBe('OBJECT_RESIZE');
    const op = firstOp as import('../../src/types/operations').ObjectResizeOp;
    expect(op.to).toEqual(newBox);
    expect(op.from).toEqual(imageObj.bbox);
  });
});
