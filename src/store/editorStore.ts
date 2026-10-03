import { createStore, type StoreApi } from 'zustand/vanilla';
import type { DocumentRegistry } from '../lib/document-registry';
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

/** Serialisable editor state only; PDF.js handles live in the DocumentRegistry (design D6). */
export interface EditorState {
  readonly document: DocumentInfo | null;
  readonly view: ViewState;
  readonly loading: boolean;
  readonly error: LoadError | null;
  readonly notice: DocumentNotice | null;
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
}

export type EditorStore = StoreApi<EditorState & EditorActions>;

export interface EditorDeps {
  readonly registry: DocumentRegistry;
  readonly open: (file: FileLike, bytes: Uint8Array) => Promise<Result<LoadedDocument, LoadError>>;
}

export const INITIAL_VIEW: ViewState = { pageIndex: 0, zoom: 1, fitMode: 'width' };

export function createEditorStore(deps: EditorDeps): EditorStore {
  // Only the most recent open request may change state; earlier ones are discarded when they settle.
  let latestRequest = 0;

  return createStore<EditorState & EditorActions>()((set, get) => {
    const setView = (patch: Partial<ViewState>) => set((s) => ({ view: { ...s.view, ...patch } }));
    const lastIndex = () => Math.max(0, (get().document?.pageCount ?? 1) - 1);

    return {
      document: null,
      view: INITIAL_VIEW,
      loading: false,
      error: null,
      notice: null,

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
          loading: false,
          error: null,
          notice: documentNotice({ byteLength: originalBytes.byteLength, pageCount, userUnit: firstPage.userUnit }),
        }));
        if (previous) await deps.registry.release(previous.id);
      },

      goToPage(pageIndex) {
        if (!get().document || !Number.isInteger(pageIndex)) return;
        if (pageIndex < 0 || pageIndex > lastIndex()) return;
        setView({ pageIndex });
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
    };
  });
}
