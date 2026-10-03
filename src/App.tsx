import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner } from './components/Banner';
import { Header } from './components/Header';
import { InlineTextEditor } from './components/InlineTextEditor';
import { PDFUploader } from './components/PDFUploader';
import { PDFViewer } from './components/PDFViewer';
import { Sidebar } from './components/Sidebar';
import { TextObjectsTab } from './components/TextObjectsTab';
import { TextOverlay } from './components/TextOverlay';
import { UpdatePrompt } from './components/UpdatePrompt';
import { createOperation } from './lib/create-operation';
import type { ObjectDeleteOp, PreviewLine, TextAddOp, TextReplaceOp, TextStyle } from './types/operations';
import { NOTICE_MESSAGES } from './lib/document-notice';
import { viewerKeyAction } from './lib/keyboard';
import { LOAD_ERROR_MESSAGES } from './lib/load-errors';
import type { SampleId } from './lib/sample-catalog';
import { usePageModel, usePageSampling } from './store/usePageModel';
import { documentRegistry, editorStore, openSample, useEditor } from './store/useEditor';
import { screenToPage, type PageGeometry, type Point } from './lib/coordinates';

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

/** Layer 2 + Layer 4 for the page the viewer has loaded. */
function PageOverlay({
  documentId,
  pageIndex,
  geometry,
  zoom,
  editingId,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  addTextPos,
  onCommitAddText,
  onCancelAddText,
}: {
  documentId: string;
  pageIndex: number;
  geometry: PageGeometry;
  zoom: number;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onCommitEdit: (id: string, text: string) => void;
  onCancelEdit: () => void;
  addTextPos: { point: Point; geometry: PageGeometry } | null;
  onCommitAddText: (text: string, style: TextStyle) => void;
  onCancelAddText: () => void;
}) {
  const { status, model } = usePageModel(documentId, pageIndex);
  const selection = useEditor((s) => s.selection);
  const { selectObject, stepSelection, previewLines } = editorStore.getState();
  const lines = model ? previewLines(pageIndex) : [];
  const editingLine = editingId ? lines.find((l) => l.id === editingId) ?? null : null;

  // Infer style from the nearest non-deleted TextLine above the add-text point
  const addTextStyle = (() => {
    if (!addTextPos || !model) return DEFAULT_ADD_TEXT_STYLE;
    const pt = addTextPos.point;
    const above = lines
      .filter((l) => !l.deleted && l.box.y <= pt.y)
      .sort((a, b) => b.box.y - a.box.y);
    const nearest = above[0];
    if (!nearest) return DEFAULT_ADD_TEXT_STYLE;
    return nearest.currentStyle;
  })();

  // Synthetic PreviewLine for the add-text editor
  const addTextLine = addTextPos
    ? ({
        id: '__add_text__',
        pageIndex,
        text: '',
        origin: addTextPos.point,
        box: { x: addTextPos.point.x, y: addTextPos.point.y, width: 200, height: addTextStyle.size * 1.2 },
        matrix: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number],
        fontRef: '',
        family: addTextStyle.fontFamilyOverride ?? 'Liberation Sans',
        subsetPrefix: null,
        fontClass: addTextStyle.fontClass,
        bold: addTextStyle.bold,
        italic: addTextStyle.italic,
        fontSize: addTextStyle.size,
        hScale: addTextStyle.hScale,
        charSpacing: addTextStyle.charSpacing,
        wordSpacing: addTextStyle.wordSpacing,
        rise: addTextStyle.rise,
        renderMode: addTextStyle.renderMode,
        lineHeight: addTextStyle.lineHeight,
        color: { hex: addTextStyle.color, source: 'exact' as const },
        background: { status: 'pending' as const },
        lockReason: null,
        font: { rawName: 'Liberation Sans', subtype: null, embedding: null, licence: null, encoding: null, coverage: null },
        currentText: '',
        currentStyle: addTextStyle,
        deleted: false,
        patchLayout: null,
        resolvedFont: null,
      } as PreviewLine)
    : null;

  return (
    <>
      {model && (
        <TextOverlay
          lines={lines}
          geometry={geometry}
          zoom={zoom}
          selectedId={editingId ?? selection}
          onSelect={selectObject}
          onStep={stepSelection}
          onDoubleClick={onStartEdit}
        />
      )}
      {editingLine && (
        <InlineTextEditor
          line={editingLine}
          zoom={zoom}
          pageGeometry={geometry}
          onCommit={(text) => onCommitEdit(editingLine.id, text)}
          onCancel={onCancelEdit}
        />
      )}
      {addTextLine && (
        <InlineTextEditor
          line={addTextLine}
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addTextPos, setAddTextPos] = useState<{ point: Point; geometry: PageGeometry } | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const selection = useEditor((s) => s.selection);
  const [rendered, setRendered] = useState<{ documentId: string; pageIndex: number } | null>(null);
  const docIdForPage = document?.id;
  const activeModel = usePageModel(docIdForPage, view.pageIndex);
  usePageSampling(docIdForPage, view.pageIndex, rendered && rendered.documentId === docIdForPage ? rendered.pageIndex : null);
  const currentGeometryRef = useRef<{ geometry: PageGeometry; zoom: number } | null>(null);

  const clearSelection = useCallback((e?: MouseEvent) => {
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

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCommitEdit = useCallback((id: string, newText: string) => {
    setEditingId(null);
    const s = editorStore.getState();
    // Get original text from current preview lines
    const preview = s.previewLines(s.view.pageIndex);
    const line = preview.find((l) => l.id === id);
    if (!line) return;
    if (newText !== line.currentText) {
      s.pushOperation(
        createOperation<TextReplaceOp>({
          type: 'TEXT_REPLACE',
          objectId: id,
          newText,
          pageIndex: s.view.pageIndex,
        }),
      );
    }
    s.selectObject(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

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
        at: addTextPos.point,
        style,
        pageIndex: s.view.pageIndex,
      }),
    );
  }, [addTextPos]);

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
      />
      <UpdatePrompt />
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
                    return (
                      <PageOverlay
                        documentId={document.id}
                        pageIndex={pageIndex}
                        geometry={geometry}
                        zoom={zoom}
                        editingId={editingId}
                        onStartEdit={handleStartEdit}
                        onCommitEdit={handleCommitEdit}
                        onCancelEdit={handleCancelEdit}
                        addTextPos={addTextPos}
                        onCommitAddText={handleCommitAddText}
                        onCancelAddText={() => {
                          setAddTextPos(null);
                          editorStore.getState().setAddTextMode(false);
                        }}
                      />
                    );
                  }}
                />
              </div>
            </div>
          )}
        </PDFUploader>
      </main>
    </div>
  );
}
