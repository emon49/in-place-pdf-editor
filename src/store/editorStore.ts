import { createStore, type StoreApi } from 'zustand/vanilla';
import type { DocumentRegistry } from '../lib/document-registry';
import { createPageModelCache, pageModelKey, type PageModelCache } from '../lib/page-model';
import type { PageModel, PageModelStatus } from '../types/page-model';
import { documentNotice, type DocumentNotice } from '../lib/document-notice';
import type { LoadError } from '../lib/load-errors';
import type { LoadedDocument } from '../lib/pdf-loader';
import { pickSingleFile, type FileLike } from '../lib/pdf-sniff';
import type { Result } from '../lib/result';
import { clampZoom, nextPreset, prevPreset } from '../lib/zoom';

export type FitMode = 'width' | 'page';

export interface DocumentInfo {
  readonly id: string;
  readonly name: string;
  readonly byteLength: number;
  readonly pageCount: number;
}

export interface ViewState {
  /** 0-based index of the active page. */
  readonly pageIndex: number;
  /** 1 = 100%. */
  readonly zoom: number;
  /** Active fit mode; null once the user picks an explicit zoom. */
  readonly fitMode: FitMode | null;
}

/** Status of one page's read model; `revision` increments whenever its contents change (e.g. sampling results). */
export interface PageModelEntry {
  readonly status: PageModelStatus;
  readonly revision: number;
}

/** Serialisable editor state only; PDF.js handles live in the DocumentRegistry (design D6). */
export interface EditorState {
  readonly document: DocumentInfo | null;
  readonly view: ViewState;
  readonly loading: boolean;
  readonly error: LoadError | null;
  readonly notice: DocumentNotice | null;
  /** Extraction status per `"<documentId>:<pageIndex>"`; the models themselves live in the PageModelCache. */
  readonly pageModels: Readonly<Record<string, PageModelEntry>>;
  /** Id of the selected Text Line on the active page (single selection). */
  readonly selection: string | null;
}

export interface EditorActions {
  openFiles(files: readonly (FileLike & Blob)[]): Promise<void>;
  openBytes(file: FileLike, bytes: Uint8Array): Promise<void>;
  goToPage(pageIndex: number): void;
  nextPage(): void;
  prevPage(): void;
  firstPage(): void;
  lastPage(): void;
  setZoom(zoom: number): void;
  zoomIn(): void;
  zoomOut(): void;
  setFitMode(mode: FitMode): void;
  /** Zoom computed by the viewer for the active fit mode; keeps the fit mode. */
  applyFitZoom(zoom: number): void;
  setError(error: LoadError | null): void;
  dismissNotice(): void;
  /** Extracts the page's read model unless it is already extracted or in progress. */
  ensurePageModel(pageIndex: number): Promise<void>;
  /** Signals that the cached model of the active document's page changed in place. */
  touchPageModel(pageIndex: number): void;
  selectObject(id: string | null): void;
  /** Moves the selection to the next/previous Text Line in reading order. */
  stepSelection(direction: 1 | -1): void;
}

export type EditorStore = StoreApi<EditorState & EditorActions>;

export interface EditorDeps {
  readonly registry: DocumentRegistry;
  readonly open: (file: FileLike, bytes: Uint8Array) => Promise<Result<LoadedDocument, LoadError>>;
  /** Builds a page's read model. Without it no extraction happens (the store works without a PDF engine). */
  readonly extractPage?: (documentId: string, pageIndex: number) => Promise<PageModel>;
  readonly pageModelCache?: PageModelCache;
  /** Called when a document is released, so per-document caches kept elsewhere can be dropped. */
  readonly onDocumentReleased?: (documentId: string) => void;
}

export const INITIAL_VIEW: ViewState = { pageIndex: 0, zoom: 1, fitMode: 'width' };

export function createEditorStore(deps: EditorDeps): EditorStore {
  // Only the most recent open request may change state; earlier ones are discarded when they settle.
  let latestRequest = 0;
  const cache = deps.pageModelCache ?? createPageModelCache();

  return createStore<EditorState & EditorActions>()((set, get) => {
    const setView = (patch: Partial<ViewState>) => set((s) => ({ view: { ...s.view, ...patch } }));
    const lastIndex = () => Math.max(0, (get().document?.pageCount ?? 1) - 1);

    return {
      document: null,
      view: INITIAL_VIEW,
      loading: false,
      error: null,
      notice: null,
      pageModels: {},
      selection: null,

      async openFiles(files) {
        const picked = pickSingleFile(files);
        if (!picked.ok) {
          set({ error: picked.error });
          return;
        }
        const file = picked.value;
        await get().openBytes(file, new Uint8Array(await file.arrayBuffer()));
      },

      async openBytes(file, bytes) {
        const request = ++latestRequest;
        set({ loading: true, error: null });
        const result = await deps.open(file, bytes);
        if (request !== latestRequest) {
          if (result.ok) await result.value.pdf.loadingTask.destroy();
          return;
        }
        if (!result.ok) {
          // A failed open never replaces the current document.
          set({ loading: false, error: result.error });
          return;
        }

        const { pdf, originalBytes, pageCount } = result.value;
        const firstPage = await pdf.getPage(1);
        const previous = get().document;
        const id = deps.registry.register({ pdf, originalBytes });
        set((s) => ({
          document: { id, name: file.name, byteLength: originalBytes.byteLength, pageCount },
          // Opening resets to page 1 and keeps the current zoom mode.
          view: { ...s.view, pageIndex: 0 },
          pageModels: {},
          selection: null,
          loading: false,
          error: null,
          notice: documentNotice({ byteLength: originalBytes.byteLength, pageCount, userUnit: firstPage.userUnit }),
        }));
        if (previous) {
          cache.clear(previous.id);
          deps.onDocumentReleased?.(previous.id);
          await deps.registry.release(previous.id);
        }
        void get().ensurePageModel(0);
      },

      goToPage(pageIndex) {
        if (!get().document || !Number.isInteger(pageIndex)) return;
        if (pageIndex < 0 || pageIndex > lastIndex()) return;
        if (pageIndex !== get().view.pageIndex) set({ selection: null });
        setView({ pageIndex });
        void get().ensurePageModel(pageIndex);
      },
      nextPage: () => get().goToPage(get().view.pageIndex + 1),
      prevPage: () => get().goToPage(get().view.pageIndex - 1),
      firstPage: () => get().goToPage(0),
      lastPage: () => get().goToPage(lastIndex()),

      setZoom: (zoom) => setView({ zoom: clampZoom(zoom), fitMode: null }),
      zoomIn: () => get().setZoom(nextPreset(get().view.zoom)),
      zoomOut: () => get().setZoom(prevPreset(get().view.zoom)),
      setFitMode: (fitMode) => setView({ fitMode }),
      applyFitZoom(zoom) {
        if (get().view.fitMode) setView({ zoom: clampZoom(zoom) });
      },

      setError: (error) => set({ error }),
      dismissNotice: () => set({ notice: null }),

      async ensurePageModel(pageIndex) {
        const documentId = get().document?.id;
        const extract = deps.extractPage;
        if (!documentId || !extract) return;
        const key = pageModelKey(documentId, pageIndex);
        const current = get().pageModels[key];
        if (current && current.status !== 'idle') return;
        const setEntry = (status: PageModelStatus) =>
          set((s) =>
            // The document may have been replaced while extracting; its statuses are gone, so drop the write.
            s.document?.id === documentId
              ? { pageModels: { ...s.pageModels, [key]: { status, revision: (s.pageModels[key]?.revision ?? 0) + 1 } } }
              : s,
          );
        setEntry('extracting');
        try {
          const model = await extract(documentId, pageIndex);
          if (get().document?.id !== documentId) return;
          cache.set(documentId, pageIndex, model);
          setEntry('ready');
        } catch {
          setEntry('failed');
        }
      },
      touchPageModel(pageIndex) {
        const documentId = get().document?.id;
        if (!documentId) return;
        const key = pageModelKey(documentId, pageIndex);
        set((s) => {
          const entry = s.pageModels[key];
          return entry ? { pageModels: { ...s.pageModels, [key]: { ...entry, revision: entry.revision + 1 } } } : s;
        });
      },

      selectObject: (id) => set({ selection: id }),
      stepSelection(direction) {
        const { document, view, selection } = get();
        const lines = document ? cache.get(document.id, view.pageIndex)?.lines : undefined;
        if (!lines?.length) return;
        const at = lines.findIndex((l) => l.id === selection);
        const next = at === -1 ? (direction === 1 ? 0 : lines.length - 1) : at + direction;
        const target = lines[next];
        if (target) set({ selection: target.id });
      },
    };
  });
}
