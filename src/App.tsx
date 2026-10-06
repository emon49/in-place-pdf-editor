import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Banner } from './components/Banner';
import { ExportModal } from './components/ExportModal';
import { FontTierExplanation } from './components/FontTierExplanation';
import { Header } from './components/Header';
import { HistoryTab } from './components/HistoryTab';
import { InlineTextEditor } from './components/InlineTextEditor';
import { MaskLayer } from './components/MaskLayer';
import { PatchLayer } from './components/PatchLayer';
import { PDFUploader } from './components/PDFUploader';
import { PDFViewer } from './components/PDFViewer';
import { ImagePropertiesPanel, TextEditorPanel } from './components/PropertiesPanel';
import { SearchHighlightLayer } from './components/SearchHighlightLayer';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Sidebar } from './components/Sidebar';
import { StyleControls } from './components/StyleControls';
import { TextObjectsTab } from './components/TextObjectsTab';
import { ThumbnailsTab } from './components/ThumbnailsTab';
import { ImageLayer } from './components/ImageLayer';
import { ImagePreviewLayer } from './components/ImagePreviewLayer';
import { ImagesTab } from './components/ImagesTab';
import { TextOverlay } from './components/TextOverlay';
import { UpdatePrompt } from './components/UpdatePrompt';
import { createOperation } from './lib/create-operation';
import { calibratedAdvance, layoutText, patchOrigin } from './lib/text-layout';
import { patchFont, resolveFontSync } from './lib/font-resolver';
import type { FontFacts } from './types/page-model';
import { styleFromLine, withResolvedFont } from './lib/operation-reducer';
import type { FitMode as ImageFitMode, ObjectDeleteOp, PreviewLine, RevertOp, TextAddOp, TextReplaceOp, TextStyle, TextStyleChangeOp } from './types/operations';
import { NOTICE_MESSAGES } from './lib/document-notice';
import { nudgeKeyAction, viewerKeyAction } from './lib/keyboard';
import { LOAD_ERROR_MESSAGES } from './lib/load-errors';
import type { SampleId } from './lib/sample-catalog';
import { usePageModel, usePageSampling } from './store/usePageModel';
import { clearSession, loadSession, useAutoSave } from './store/useAutoSave';
import type { SessionData } from './lib/session-store';
import { documentRegistry, editorStore, openSample, useEditor } from './store/useEditor';
import { displayRectToPage, pageRectToDisplay, screenToPage, type PageGeometry, type Point } from './lib/coordinates';

const DEFAULT_ADD_TEXT_STYLE: TextStyle = {
  fontClass: 'sans',
  bold: false,
  italic: false,
  fontFamilyOverride: 'Liberation Sans',
  size: 12,
  color: '#000000',
  charSpacing: 0,
  wordSpacing: 0,
  lineHeight: 1.2,
  hScale: 100,
  rise: 0,
  renderMode: 0,
};

const MAX_ADD_TEXT_SIZE = 24;
const NO_FONT_FACTS: FontFacts = { rawName: '', subtype: null, embedding: null, licence: null, encoding: null, coverage: null };

/** The font stack added text will be drawn with, resolved as the committed line will be. */
function addTextFontFamily(style: TextStyle): string {
  const input = { font: NO_FONT_FACTS, fontRef: '', family: style.fontFamilyOverride ?? '', fontClass: style.fontClass, fontFamilyOverride: style.fontFamilyOverride };
  return patchFont(resolveFontSync(input, 'x'), NO_FONT_FACTS, style.fontClass, '').fontFamily;
}

/** Layer 2 + Layer 3 + Layer 4 for the page the viewer has loaded. */
function PageOverlay({
  documentId,
  pageIndex,
  geometry,
  zoom,
  draftOverride,
  addTextPos,
  onCommitAddText,
  onCancelAddText,
  onMove,
  onImageResize,
  onImageReplace,
  searchMatchIds,
  currentMatchId,
}: {
  documentId: string;
  pageIndex: number;
  geometry: PageGeometry;
  zoom: number;
  /** Live draft text from the side panel editor, applied before rendering. */
  draftOverride?: { id: string; text: string };
  addTextPos: { point: Point; geometry: PageGeometry } | null;
  onCommitAddText: (text: string, style: TextStyle) => void;
  onCancelAddText: () => void;
  onMove?: (id: string, to: Point) => void;
  onImageResize?: (id: string, to: import('./lib/coordinates').Rect) => void;
  onImageReplace?: (id: string, file: File, fit: ImageFitMode) => void;
  searchMatchIds?: ReadonlySet<string>;
  currentMatchId?: string | null;
}) {
  const { status, model } = usePageModel(documentId, pageIndex);
  const selection = useEditor((s) => s.selection);
  const { selectObject, stepSelection, previewLines, previewImages } = editorStore.getState();
  const rawLines = model ? previewLines(pageIndex) : [];
  const images = model ? previewImages(pageIndex) : [];
  const pageWidth = geometry.box[2] - geometry.box[0];
  const lines: PreviewLine[] = rawLines.map((line) => {
    if (line.deleted) return line;
    const isDraftTarget = draftOverride !== undefined && draftOverride.id === line.id;
    const effectiveText = isDraftTarget ? draftOverride.text : line.currentText;
    const isAdded = line.id.startsWith('add-');
    const moved = line.currentBox.x !== line.box.x || line.currentBox.y !== line.box.y;
    const textChanged = effectiveText !== line.text;
    if (isAdded || textChanged || moved) {
      // Force patchLayout recompute from effectiveText (handles live draft preview).
      const sample = isAdded ? null : { text: line.text, width: line.box.width, style: styleFromLine(line) };
      const { lines: pl } = layoutText(effectiveText, line.currentStyle, patchOrigin(line), pageWidth, calibratedAdvance(sample));
      const laidOut = { ...line, currentText: effectiveText, patchLayout: pl };
      if (!isAdded) return withResolvedFont(laidOut, false);
      // Added text has no measured box: size its hit box to the widest laid-out row.
      const width = Math.max(line.currentStyle.size, ...pl.map((row) => row.width));
      return withResolvedFont({ ...laidOut, box: { ...line.box, width }, currentBox: { ...line.currentBox, width } }, true);
    }
    return isDraftTarget ? { ...line, currentText: effectiveText } : line;
  });

  // New text takes the style of the nearest editable line above the click (body text, not a
  // locked watermark), capped to a text size; otherwise the default style.
  const addTextStyle = (() => {
    if (!addTextPos || !model) return DEFAULT_ADD_TEXT_STYLE;
    const pt = addTextPos.point;
    const nearest = lines
      .filter((l) => !l.deleted && l.lockReason === null && l.origin.y >= pt.y)
      .sort((a, b) => a.origin.y - b.origin.y)[0];
    if (!nearest) return DEFAULT_ADD_TEXT_STYLE;
    return { ...nearest.currentStyle, size: Math.min(nearest.currentStyle.size, MAX_ADD_TEXT_SIZE) };
  })();
  const addTextFont = addTextFontFamily(addTextStyle);

  return (
    <>
      {model && searchMatchIds && searchMatchIds.size > 0 && (
        <SearchHighlightLayer
          lines={lines}
          geometry={geometry}
          zoom={zoom}
          matchIds={searchMatchIds}
          currentMatchId={currentMatchId ?? null}
        />
      )}
      {model && (
        <MaskLayer lines={lines} geometry={geometry} zoom={zoom} />
      )}
      {model && (
        <PatchLayer lines={lines} geometry={geometry} zoom={zoom} />
      )}
      {model && images.length > 0 && (
        <ImagePreviewLayer images={images} geometry={geometry} zoom={zoom} />
      )}
      {model && (
        <TextOverlay
          lines={lines}
          geometry={geometry}
          zoom={zoom}
          selectedId={selection && !selection.startsWith('img:') ? selection : null}
          onSelect={selectObject}
          onStep={stepSelection}
          onMove={onMove}
        />
      )}
      {model && images.length > 0 && (
        <ImageLayer
          images={images}
          geometry={geometry}
          zoom={zoom}
          selectedId={selection?.startsWith('img:') ? selection : null}
          onSelect={selectObject}
          onMove={onMove}
          onResize={onImageResize}
          onReplace={onImageReplace}
        />
      )}
      {addTextPos && (
        <InlineTextEditor
          key={`${addTextPos.point.x},${addTextPos.point.y}`}
          point={addTextPos.point}
          style={addTextStyle}
          fontFamily={addTextFont}
          zoom={zoom}
          pageGeometry={geometry}
          onCommit={(text) => onCommitAddText(text, addTextStyle)}
          onCancel={onCancelAddText}
        />
      )}
      {status === 'failed' && (
        <p role="status" className="absolute left-2 top-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          Text could not be detected on this page.
        </p>
      )}
    </>
  );
}

export function App() {
  const document = useEditor((s) => s.document);
  const view = useEditor((s) => s.view);
  const loading = useEditor((s) => s.loading);
  const error = useEditor((s) => s.error);
  const notice = useEditor((s) => s.notice);
  const addTextMode = useEditor((s) => s.addTextMode);
  const cursor = useEditor((s) => s.cursor);
  const actions = editorStore.getState();
  const [addTextPos, setAddTextPos] = useState<{ point: Point; geometry: PageGeometry } | null>(null);
  /** Draft text for the side-panel text editor (null when no text block is selected). */
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  /** Ref always carries the latest draft so the selection-change effect can read it without a stale closure. */
  const draftRef = useRef<{ id: string; text: string; pageIndex: number } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const selection = useEditor((s) => s.selection);
  const [rendered, setRendered] = useState<{ documentId: string; pageIndex: number } | null>(null);
  const [pageGeometry, setPageGeometry] = useState<PageGeometry | null>(null);
  const [restoreSession, setRestoreSession] = useState<SessionData | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchQuery = useEditor((s) => s.searchQuery);
  const searchMatches = useEditor((s) => s.searchMatches);
  const searchMatchIndex = useEditor((s) => s.searchMatchIndex);
  const docIdForPage = document?.id;
  const activeModel = usePageModel(docIdForPage, view.pageIndex);
  const activeImages = activeModel.model ? editorStore.getState().previewImages(view.pageIndex) : [];
  usePageSampling(docIdForPage, view.pageIndex, rendered && rendered.documentId === docIdForPage ? rendered.pageIndex : null);
  const currentGeometryRef = useRef<{ geometry: PageGeometry; zoom: number } | null>(null);
  // Set by handleMove so the spurious background click that fires at the drag-release
  // position (after the button has already moved) doesn't wipe out the selection.
  const suppressNextClearRef = useRef(false);

  const clearSelection = useCallback((e?: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressNextClearRef.current) {
      suppressNextClearRef.current = false;
      return;
    }
    editorStore.getState().selectObject(null);
    // In add-text mode, a background click opens an editor at the clicked position
    if (addTextMode && e && currentGeometryRef.current) {
      const { geometry, zoom } = currentGeometryRef.current;
      const canvasEl = viewerRef.current?.querySelector('canvas');
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const screenPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const pagePt = screenToPage(geometry, screenPt, zoom);
      setAddTextPos({ point: pagePt, geometry });
    }
  }, [addTextMode]);

  /** Called on every keystroke in the side-panel textarea. Updates draft + ref. */
  const handleDraftChange = useCallback((text: string) => {
    if (!selection || selection.startsWith('img:')) return;
    setDraft({ id: selection, text });
    draftRef.current = { id: selection, text, pageIndex: editorStore.getState().view.pageIndex };
  }, [selection]);

  // A draft belongs to one selection; drop it during render so no frame pairs it with another line.
  const [draftSelection, setDraftSelection] = useState(selection);
  if (draftSelection !== selection) {
    setDraftSelection(selection);
    setDraft(null);
  }

  // When selection changes: commit the pending draft of the previous selection.
  useEffect(() => {
    const prev = draftRef.current;
    if (prev) {
      const s = editorStore.getState();
      const preview = s.previewLines(prev.pageIndex);
      const prevLine = preview.find((l) => l.id === prev.id);
      if (prevLine && prev.text !== prevLine.currentText) {
        s.pushOperation(
          createOperation<TextReplaceOp>({
            type: 'TEXT_REPLACE',
            objectId: prev.id,
            newText: prev.text,
            pageIndex: prev.pageIndex,
          }),
        );
      }
      draftRef.current = null;
    }
  }, [selection]);

  const handleCommitAddText = useCallback((text: string, style: TextStyle) => {
    if (!addTextPos) return;
    setAddTextPos(null);
    editorStore.getState().setAddTextMode(false);
    if (!text.trim()) return;
    const s = editorStore.getState();
    s.pushOperation(
      createOperation<TextAddOp>({
        type: 'TEXT_ADD',
        objectId: `add-${Date.now().toString(36)}`,
        text,
        // The click is the text's top-left; `at` is its first baseline.
        at: { x: addTextPos.point.x, y: addTextPos.point.y - style.size * 0.8 },
        style,
        pageIndex: s.view.pageIndex,
      }),
    );
  }, [addTextPos]);

  // Check for saved session on mount (ST-6)
  useEffect(() => {
    void loadSession().then((saved) => {
      if (saved) setRestoreSession(saved);
    });
  }, []);

  const handleRestoreSession = useCallback(async () => {
    if (!restoreSession) return;
    setRestoreSession(null);
    const fileLike = { name: restoreSession.fileName, type: 'application/pdf' };
    await editorStore.getState().openBytes(fileLike, restoreSession.originalBytes);
    // Replay the operation log from the session
    editorStore.setState({ ops: [...restoreSession.ops], cursor: restoreSession.cursor });
  }, [restoreSession]);

  const handleDiscardSession = useCallback(async () => {
    setRestoreSession(null);
    await clearSession();
  }, []);

  const handleStyleChange = useCallback((patch: Partial<TextStyle>) => {
    const s = editorStore.getState();
    const sel = s.selection;
    if (!sel) return;
    // Guard no-op (6.2)
    const preview = s.previewLines(s.view.pageIndex);
    const line = preview.find((l) => l.id === sel);
    if (line) {
      const hasChange = (Object.keys(patch) as (keyof typeof patch)[]).some(
        (k) => line.currentStyle[k] !== patch[k],
      );
      if (!hasChange) return;
    }
    s.pushOperation(
      createOperation<TextStyleChangeOp>({
        type: 'TEXT_STYLE_CHANGE',
        objectId: sel,
        style: patch,
        pageIndex: s.view.pageIndex,
      }),
    );
  }, []);

  const handleMove = useCallback((id: string, to: Point) => {
    const s = editorStore.getState();
    const geo = pageGeometry;
    if (!geo) return;
    // Suppress the spurious background click that fires after the drag-release pointer-up
    // (click fires at the release position which may no longer be over the button after re-render).
    suppressNextClearRef.current = true;
    s.moveObject(id, to, geo);
  }, [pageGeometry]);

  const handlePositionCommit = useCallback((displayX: number, displayY: number) => {
    if (!pageGeometry || !selection) return;
    const s = editorStore.getState();
    const preview = s.previewLines(s.view.pageIndex);
    const line = preview.find((l) => l.id === selection);
    if (!line) return;
    const displayRect = pageRectToDisplay(pageGeometry, line.currentBox);
    const newDisplayRect = { x: displayX, y: displayY, width: displayRect.width, height: displayRect.height };
    const pageRect = displayRectToPage(pageGeometry, newDisplayRect);
    handleMove(selection, { x: pageRect.x, y: pageRect.y });
  }, [pageGeometry, selection, handleMove]);

  const handleImageResize = useCallback((id: string, to: import('./lib/coordinates').Rect) => {
    editorStore.getState().resizeImage(id, to);
  }, []);

  const handleImageReplace = useCallback((id: string, file: File, fit: ImageFitMode) => {
    void editorStore.getState().replaceImage(id, file, fit);
  }, []);

  // Derive selected line's current style and resolved font for StyleControls
  const selectedLine = (() => {
    if (!selection || selection.startsWith('img:') || !document) return null;
    const preview = editorStore.getState().previewLines(view.pageIndex);
    return preview.find((l) => l.id === selection) ?? null;
  })();
  const selectedStyle = selectedLine?.currentStyle ?? null;
  const selectedResolvedFont = selectedLine?.resolvedFont ?? null;
  const selectedPosition = selectedLine && pageGeometry
    ? (() => {
        const dr = pageRectToDisplay(pageGeometry, selectedLine.currentBox);
        return { x: Math.round(dr.x * 10) / 10, y: Math.round(dr.y * 10) / 10 };
      })()
    : undefined;

  const selectedImage = (() => {
    if (!selection?.startsWith('img:') || !document) return null;
    return editorStore.getState().previewImages(view.pageIndex).find((img) => img.id === selection) ?? null;
  })();

  const handleRevert = useCallback((opId: string) => {
    const s = editorStore.getState();
    s.pushOperation(
      createOperation<RevertOp>({
        type: 'REVERT',
        targetOpIds: [opId],
        pageIndex: s.view.pageIndex,
      }),
    );
  }, []);

  const handleRevertToOriginal = useCallback(() => {
    const s = editorStore.getState();
    const sel = s.selection;
    if (!sel) return;
    // Collect active op IDs for this object (non-REVERT, not already reverted)
    const reverted = new Set<string>();
    for (const op of s.ops.slice(0, s.cursor)) {
      if (op.type === 'REVERT') {
        for (const tid of op.targetOpIds) reverted.add(tid);
      }
    }
    // Reverts of reverts cancel out
    for (const op of s.ops.slice(0, s.cursor)) {
      if (op.type === 'REVERT') {
        for (const tid of op.targetOpIds) {
          const target = s.ops.slice(0, s.cursor).find((o) => o.id === tid);
          if (target?.type === 'REVERT') {
            for (const ttid of target.targetOpIds) reverted.delete(ttid);
            reverted.delete(tid);
          }
        }
      }
    }
    const targetIds = s.ops
      .slice(0, s.cursor)
      .filter((op) => op.type !== 'REVERT' && (op as { objectId?: string }).objectId === sel && !reverted.has(op.id))
      .map((op) => op.id);
    if (targetIds.length === 0) return;
    s.pushOperation(
      createOperation<RevertOp>({
        type: 'REVERT',
        targetOpIds: targetIds,
        pageIndex: s.view.pageIndex,
      }),
    );
  }, []);

  const ops = useEditor((s) => s.ops);

  // Debounced autosave (ST-6, D8)
  const autoSaveStatus = useAutoSave(document?.id ?? null, document?.name ?? null, ops, cursor);

  const handleDiscardCurrentSession = useCallback(async () => {
    await clearSession();
  }, []);

  const openFiles = useCallback((files: File[]) => void editorStore.getState().openFiles(files), []);
  const loadSample = useCallback((id: SampleId) => void openSample(id), []);
  const openPicker = useCallback(() => {
    window.document.querySelector<HTMLInputElement>('[data-testid="file-input"]')?.click();
  }, []);

  const docId = document?.id;
  const getPage = useCallback(
    (pageIndex: number) => {
      const handle = docId ? documentRegistry.get(docId) : undefined;
      if (!handle) return Promise.reject(new Error('No document open'));
      return handle.pdf.getPage(pageIndex + 1);
    },
    [docId],
  );

  // Keyboard shortcuts (page-viewer spec): page keys anywhere outside text inputs, zoom keys in the viewer.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editorStore.getState().document) return;
      const inTextField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      // Escape clears the selection from anywhere outside a text field (object-selection spec).
      if (e.key === 'Escape' && editorStore.getState().selection && !inTextField) {
        editorStore.getState().selectObject(null);
        return;
      }
      // Delete/Backspace on selected (non-editing) text line pushes OBJECT_DELETE (TE-7).
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inTextField) {
        const sel = editorStore.getState().selection;
        if (sel) {
          e.preventDefault();
          const s = editorStore.getState();
          s.pushOperation(
            createOperation<ObjectDeleteOp>({
              type: 'OBJECT_DELETE',
              objectId: sel,
              pageIndex: s.view.pageIndex,
            }),
          );
          s.selectObject(null);
          return;
        }
      }
      // Arrow keys nudge the selected object (MV-6).
      if (!inTextField) {
        const nudge = nudgeKeyAction({
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          target: e.target,
          inViewer: e.target instanceof Node && !!viewerRef.current?.contains(e.target),
        });
        if (nudge && editorStore.getState().selection && currentGeometryRef.current) {
          e.preventDefault();
          editorStore.getState().nudgeObject(nudge.direction, nudge.large, currentGeometryRef.current.geometry);
          return;
        }
      }
      const action = viewerKeyAction({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        target: e.target,
        inViewer: e.target instanceof Node && !!viewerRef.current?.contains(e.target),
      });
      if (!action) return;
      e.preventDefault();
      if (action === 'openExport') {
        setExportModalOpen((prev) => !prev);
        return;
      }
      if (action === 'openShortcuts') {
        setShortcutsOpen((prev) => !prev);
        return;
      }
      const s = editorStore.getState();
      if (action === 'resetZoom') s.setZoom(1);
      else s[action]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-800">
      <Header
        documentName={document?.name ?? null}
        pageIndex={view.pageIndex}
        pageCount={document?.pageCount ?? 0}
        zoom={view.zoom}
        fitMode={view.fitMode}
        onOpenFiles={openFiles}
        onLoadSample={loadSample}
        onGoToPage={actions.goToPage}
        onZoomIn={actions.zoomIn}
        onZoomOut={actions.zoomOut}
        onActualSize={() => actions.setZoom(1)}
        onFit={actions.setFitMode}
        addTextMode={addTextMode}
        onToggleAddText={() => actions.setAddTextMode(!addTextMode)}
        editCount={cursor}
        onExport={document ? () => setExportModalOpen(true) : undefined}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        searchQuery={document ? searchQuery : undefined}
        searchMatchCount={document ? searchMatches.length : undefined}
        searchMatchNumber={document ? (searchMatches.length > 0 ? searchMatchIndex + 1 : 0) : undefined}
        onSearchChange={document ? (q) => actions.setSearchQuery(q) : undefined}
        onSearchNext={document ? actions.nextSearchMatch : undefined}
        onSearchPrev={document ? actions.prevSearchMatch : undefined}
      />
      <UpdatePrompt />
      {autoSaveStatus === 'quota-exceeded' && (
        <Banner tone="error" onDismiss={() => {}}>
          <span data-testid="quota-warning">Storage quota exceeded — session could not be saved.</span>
        </Banner>
      )}
      {document && autoSaveStatus === 'saved' && (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-1 text-xs text-slate-500">
          <span data-testid="session-indicator">Saved on this device</span>
          <button
            type="button"
            data-testid="discard-session"
            onClick={() => void handleDiscardCurrentSession()}
            className="ml-auto rounded border border-slate-200 px-2 py-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Discard session
          </button>
        </div>
      )}
      {selectedStyle && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-1.5">
          <StyleControls
            style={selectedStyle}
            onChange={handleStyleChange}
            palette={activeModel.model?.palette}
            position={selectedPosition}
            onPositionCommit={handlePositionCommit}
            positionLocked={selectedLine?.lockReason !== null}
          />
          <FontTierExplanation resolvedFont={selectedResolvedFont} />
          {selectedLine && (selectedLine.currentText !== selectedLine.text || selectedLine.deleted) && (
            <button
              type="button"
              data-testid="revert-to-original"
              onClick={handleRevertToOriginal}
              className="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              Revert to original
            </button>
          )}
        </div>
      )}
      {restoreSession && (
        <div
          role="dialog"
          aria-label="Restore previous session"
          data-testid="restore-prompt"
          className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900"
        >
          <span className="flex-1">
            Restore previous session? <span className="font-medium">{restoreSession.fileName}</span>{' '}
            — {restoreSession.ops.length} edit{restoreSession.ops.length === 1 ? '' : 's'} unsaved.
          </span>
          <button
            type="button"
            data-testid="restore-button"
            onClick={() => void handleRestoreSession()}
            className="rounded border border-blue-400 bg-blue-100 px-3 py-0.5 font-medium hover:bg-blue-200 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Restore
          </button>
          <button
            type="button"
            data-testid="discard-button"
            onClick={() => void handleDiscardSession()}
            className="rounded border border-blue-300 px-3 py-0.5 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Discard
          </button>
        </div>
      )}
      {error && (
        <Banner tone="error" onDismiss={() => actions.setError(null)}>
          {LOAD_ERROR_MESSAGES[error]}
        </Banner>
      )}
      {notice && (
        <Banner tone="info" onDismiss={actions.dismissNotice}>
          {NOTICE_MESSAGES[notice]}
        </Banner>
      )}
      {loading && (
        <div role="status" className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Opening document…
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col">
        <PDFUploader hasDocument={!!document} onFiles={openFiles} onOpenClick={openPicker} onLoadSample={loadSample}>
          {document && (
            <div className="flex min-h-0 flex-1">
              <Sidebar
                key={document.id}
                tabs={[
                  {
                    id: 'text',
                    label: 'Text Objects',
                    content: (
                      <TextObjectsTab
                        status={activeModel.status}
                        lines={activeModel.model?.lines ?? []}
                        selectedId={selection}
                        onSelect={actions.selectObject}
                      />
                    ),
                  },
                  {
                    id: 'thumbnails',
                    label: 'Pages',
                    content: (
                      <ThumbnailsTab
                        documentId={document.id}
                        pageCount={document.pageCount}
                        activePageIndex={view.pageIndex}
                        onGoToPage={actions.goToPage}
                      />
                    ),
                  },
                  {
                    id: 'images',
                    label: 'Images',
                    content: activeImages.length > 0 ? (
                      <ImagesTab
                        images={activeImages}
                        selectedId={selection?.startsWith('img:') ? selection : null}
                        onSelect={actions.selectObject}
                      />
                    ) : null,
                  },
                  {
                    id: 'history',
                    label: 'History',
                    content: (
                      <HistoryTab
                        ops={ops}
                        cursor={cursor}
                        onRevert={handleRevert}
                        selectedObjectId={selection}
                        onSelectObject={actions.selectObject}
                      />
                    ),
                  },
                ]}
              />
              <div ref={viewerRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
                <PDFViewer
                  key={document.id}
                  getPage={getPage}
                  pageIndex={view.pageIndex}
                  pageCount={document.pageCount}
                  zoom={view.zoom}
                  fitMode={view.fitMode}
                  onFitZoom={actions.applyFitZoom}
                  onBackgroundClick={clearSelection}
                  onPageRendered={(pageIndex) => setRendered({ documentId: document.id, pageIndex })}
                  renderOverlay={({ geometry, pageIndex, zoom }) => {
                    currentGeometryRef.current = { geometry, zoom };
                    if (pageGeometry !== geometry) setPageGeometry(geometry);
                    // Build per-page match ID set for the search highlight layer.
                    const pageMatchIds = new Set(
                      searchMatches
                        .filter((m) => m.pageIndex === pageIndex)
                        .map((m) => m.lineId),
                    );
                    const currentMatch = searchMatches[searchMatchIndex];
                    const currentMatchId =
                      currentMatch && currentMatch.pageIndex === pageIndex ? currentMatch.lineId : null;
                    return (
                      <PageOverlay
                        documentId={document.id}
                        pageIndex={pageIndex}
                        geometry={geometry}
                        zoom={zoom}
                        draftOverride={draft ?? undefined}
                        addTextPos={addTextPos}
                        onCommitAddText={handleCommitAddText}
                        onCancelAddText={() => {
                          setAddTextPos(null);
                          editorStore.getState().setAddTextMode(false);
                        }}
                        onMove={handleMove}
                        onImageResize={handleImageResize}
                        onImageReplace={handleImageReplace}
                        searchMatchIds={pageMatchIds}
                        currentMatchId={currentMatchId}
                      />
                    );
                  }}
                />
              </div>
              {selection && selectedLine && !selectedLine.deleted && (
                <TextEditorPanel
                  line={selectedLine}
                  text={draft?.id === selection ? draft.text : selectedLine.currentText}
                  onTextChange={handleDraftChange}
                />
              )}
              {selection && selectedImage && pageGeometry && (
                <ImagePropertiesPanel
                  image={selectedImage}
                  geometry={pageGeometry}
                  onMove={(to) => handleMove(selection, to)}
                  onResize={(to) => handleImageResize(selection, to)}
                  onReplace={(file, fit) => handleImageReplace(selection, file, fit)}
                />
              )}
            </div>
          )}
        </PDFUploader>
      </main>
      {exportModalOpen && document && (() => {
        const handle = documentRegistry.get(document.id);
        const originalBytes = handle?.originalBytes;
        if (!originalBytes) return null;
        const s = editorStore.getState();
        return (
          <ExportModal
            sourceName={document.name}
            pageCount={document.pageCount}
            previewLinesFn={s.previewLines}
            previewImagesFn={s.previewImages}
            originalBytes={originalBytes}
            onClose={() => setExportModalOpen(false)}
          />
        );
      })()}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
