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
import { applyImageOperations, applyOperations } from '../lib/operation-reducer';
import {
  clampToSafeArea,
  displayRectToPage,
  displaySize,
  pageRectToDisplay,
  type PageGeometry,
  type Point,
} from '../lib/coordinates';
import { createOperation } from '../lib/create-operation';
import { storeBlob } from '../lib/image-replacement-engine';
import type { EditOperation, FitMode as ImageFitMode, ImageReplaceOp, ObjectDeleteOp, ObjectMoveOp, ObjectResizeOp, PreviewImage, PreviewLine } from '../types/operations';
import type { Rect } from '../lib/coordinates';

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
  /** Append-only operation log (ADR-0003). Cleared on document change. */
  readonly ops: EditOperation[];
  /** Undo cursor: only ops[0..cursor) are active. */
  readonly cursor: number;
  /** True when add-text tool is active. */
  readonly addTextMode: boolean;
  /** Transient nudge preview: objectId → pending destination in Page Space (not persisted). */
  readonly nudgePreview: Readonly<Record<string, Point>> | null;
  /** Current search query. Empty string = no active search. */
  readonly searchQuery: string;
  /** Ordered list of all matches across all pages (VW-4). */
  readonly searchMatches: ReadonlyArray<{ pageIndex: number; lineId: string }>;
  /** Index into searchMatches of the currently focused match. */
  readonly searchMatchIndex: number;
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
  /** Appends an operation and advances the cursor. Discards any redo tail. */
  pushOperation(op: EditOperation): void;
  /** Moves cursor back by one (undo). No-op at 0. */
  undo(): void;
  /** Moves cursor forward by one (redo). No-op at end. */
  redo(): void;
  /** Returns the preview lines for a given page, with all active operations applied. */
  previewLines(pageIndex: number): PreviewLine[];
  /** Returns the preview images for a given page, with all active operations applied. */
  previewImages(pageIndex: number): PreviewImage[];
  /** Toggles add-text mode. */
  setAddTextMode(active: boolean): void;
  /** Moves an object to the given page-space position, clamped to the Safe Area. */
  moveObject(objectId: string, to: Point, geometry: PageGeometry): void;
  /** Nudges the selected object in the given direction, debouncing a burst into one OBJECT_MOVE. */
  nudgeObject(direction: 'up' | 'down' | 'left' | 'right', large: boolean, geometry: PageGeometry): void;
  /** Replace the selected image with a new file, storing the blob and appending IMAGE_REPLACE. */
  replaceImage(objectId: string, file: File, fit: ImageFitMode): Promise<void>;
  /** Resize an image to the given bounding box (Page Space) and append OBJECT_RESIZE. */
  resizeImage(objectId: string, to: Rect): void;
  /** Delete the selected object (text or image) and append OBJECT_DELETE. */
  deleteObject(objectId: string): void;
  /** Update the full-document search query and derive matches from loaded page models (VW-4). */
  setSearchQuery(query: string): void;
  /** Advance to the next match (wraps around; switches page if needed). */
  nextSearchMatch(): void;
  /** Move to the previous match (wraps around; switches page if needed). */
  prevSearchMatch(): void;
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

// Nudge burst state (non-reactive, shared across store instances for simplicity).
let nudgeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingNudge: {
  objectId: string;
  from: Point;
  currentTo: Point;
  pageIndex: number;
} | null = null;

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
      ops: [],
      cursor: 0,
      addTextMode: false,
      nudgePreview: null,
      searchQuery: '',
      searchMatches: [],
      searchMatchIndex: 0,

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
          // Clear the operation log on document change (D1).
          ops: [],
          cursor: 0,
          addTextMode: false,
          nudgePreview: null,
          searchQuery: '',
          searchMatches: [],
          searchMatchIndex: 0,
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

      pushOperation(op) {
        set((s) => {
          // Discard the redo tail when a new operation is pushed after an undo.
          const trimmed = s.ops.slice(0, s.cursor);
          return { ops: [...trimmed, op], cursor: s.cursor + 1 };
        });
      },
      undo() {
        set((s) => (s.cursor > 0 ? { cursor: s.cursor - 1 } : s));
      },
      redo() {
        set((s) => (s.cursor < s.ops.length ? { cursor: s.cursor + 1 } : s));
      },
      previewLines(pageIndex) {
        const { document, ops, cursor, nudgePreview } = get();
        if (!document) return [];
        const model = cache.get(document.id, pageIndex);
        if (!model) return [];
        const base = applyOperations(model.lines, ops, cursor);
        if (!nudgePreview) return base;
        return base.map((line) => {
          const to = nudgePreview[line.id];
          if (!to) return line;
          return { ...line, currentBox: { ...line.currentBox, x: to.x, y: to.y } };
        });
      },
      previewImages(pageIndex) {
        const { document, ops, cursor } = get();
        if (!document) return [];
        const model = cache.get(document.id, pageIndex);
        if (!model) return [];
        return applyImageOperations(model.images, ops, cursor);
      },
      setAddTextMode(active) {
        set({ addTextMode: active });
      },

      moveObject(objectId, to, geometry) {
        const { view } = get();
        const lines = get().previewLines(view.pageIndex);
        const line = lines.find((l) => l.id === objectId);
        if (!line) return;
        const from: Point = { x: line.currentBox.x, y: line.currentBox.y };
        // Build a display rect at the desired position and clamp it.
        const origDisplay = pageRectToDisplay(geometry, line.currentBox);
        const desiredDisplay = pageRectToDisplay(geometry, { ...line.currentBox, x: to.x, y: to.y });
        const clamped = clampToSafeArea(
          { x: desiredDisplay.x, y: desiredDisplay.y, width: origDisplay.width, height: origDisplay.height },
          displaySize(geometry),
        );
        const clampedPage = displayRectToPage(geometry, clamped);
        const clampedTo: Point = { x: clampedPage.x, y: clampedPage.y };
        if (clampedTo.x === from.x && clampedTo.y === from.y) return;
        get().pushOperation(
          createOperation<ObjectMoveOp>({
            type: 'OBJECT_MOVE',
            objectId,
            from,
            to: clampedTo,
            pageIndex: view.pageIndex,
          }),
        );
      },

      nudgeObject(direction, large, geometry) {
        const { selection, view } = get();
        if (!selection) return;
        const lines = get().previewLines(view.pageIndex);
        const line = lines.find((l) => l.id === selection);
        if (!line) return;

        const step = large ? 10 : 1;

        // Use pendingNudge.currentTo if burst ongoing, else current position.
        let currentPos: Point;
        if (pendingNudge && pendingNudge.objectId === selection) {
          currentPos = pendingNudge.currentTo;
        } else {
          currentPos = { x: line.currentBox.x, y: line.currentBox.y };
          if (nudgeTimer !== null) clearTimeout(nudgeTimer);
          pendingNudge = {
            objectId: selection,
            from: currentPos,
            currentTo: currentPos,
            pageIndex: view.pageIndex,
          };
        }
        if (nudgeTimer !== null) clearTimeout(nudgeTimer);

        // Nudge in display space then convert back.
        const displayRect = pageRectToDisplay(geometry, { ...line.currentBox, x: currentPos.x, y: currentPos.y });
        const nudgedDisplay = { ...displayRect };
        if (direction === 'up') nudgedDisplay.y -= step;
        else if (direction === 'down') nudgedDisplay.y += step;
        else if (direction === 'left') nudgedDisplay.x -= step;
        else nudgedDisplay.x += step;
        const clamped = clampToSafeArea(nudgedDisplay, displaySize(geometry));
        const pageRect = displayRectToPage(geometry, clamped);
        pendingNudge.currentTo = { x: pageRect.x, y: pageRect.y };

        // Visual preview (no op log change yet).
        set({ nudgePreview: { [selection]: pendingNudge.currentTo } });

        nudgeTimer = setTimeout(() => {
          if (!pendingNudge || pendingNudge.objectId !== selection) return;
          const { from, currentTo, pageIndex } = pendingNudge;
          pendingNudge = null;
          nudgeTimer = null;
          set({ nudgePreview: null });
          if (currentTo.x !== from.x || currentTo.y !== from.y) {
            get().pushOperation(
              createOperation<ObjectMoveOp>({
                type: 'OBJECT_MOVE',
                objectId: selection,
                from,
                to: currentTo,
                pageIndex,
              }),
            );
          }
        }, 80);
      },

      async replaceImage(objectId, file, fit) {
        const { view } = get();
        const blobKey = await storeBlob(file);
        get().pushOperation(
          createOperation<ImageReplaceOp>({
            type: 'IMAGE_REPLACE',
            objectId,
            blobKey,
            fit,
            pageIndex: view.pageIndex,
          }),
        );
      },

      resizeImage(objectId, to) {
        const { view } = get();
        const images = cache.get(get().document?.id ?? '', view.pageIndex)?.images ?? [];
        const img = images.find((i) => i.id === objectId);
        if (!img) return;
        get().pushOperation(
          createOperation<ObjectResizeOp>({
            type: 'OBJECT_RESIZE',
            objectId,
            from: img.bbox,
            to,
            pageIndex: view.pageIndex,
          }),
        );
      },

      deleteObject(objectId) {
        const { view } = get();
        get().pushOperation(
          createOperation<ObjectDeleteOp>({ type: 'OBJECT_DELETE', objectId, pageIndex: view.pageIndex }),
        );
      },

      setSearchQuery(query) {
        const { document } = get();
        if (!query.trim() || !document) {
          set({ searchQuery: query, searchMatches: [], searchMatchIndex: 0 });
          return;
        }
        const lower = query.toLowerCase();
        const matches: { pageIndex: number; lineId: string }[] = [];
        for (let pi = 0; pi < document.pageCount; pi++) {
          const model = cache.get(document.id, pi);
          if (!model) continue;
          for (const line of model.lines) {
            if (line.text.toLowerCase().includes(lower)) {
              matches.push({ pageIndex: pi, lineId: line.id });
            }
          }
        }
        set({ searchQuery: query, searchMatches: matches, searchMatchIndex: 0 });
      },

      nextSearchMatch() {
        const { searchMatches, searchMatchIndex } = get();
        if (!searchMatches.length) return;
        const next = (searchMatchIndex + 1) % searchMatches.length;
        const match = searchMatches[next];
        set({ searchMatchIndex: next });
        if (match && match.pageIndex !== get().view.pageIndex) {
          get().goToPage(match.pageIndex);
        }
      },

      prevSearchMatch() {
        const { searchMatches, searchMatchIndex } = get();
        if (!searchMatches.length) return;
        const prev = (searchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        const match = searchMatches[prev];
        set({ searchMatchIndex: prev });
        if (match && match.pageIndex !== get().view.pageIndex) {
          get().goToPage(match.pageIndex);
        }
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
