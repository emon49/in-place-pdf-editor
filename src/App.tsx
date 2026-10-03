import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner } from './components/Banner';
import { Header } from './components/Header';
import { PDFUploader } from './components/PDFUploader';
import { PDFViewer } from './components/PDFViewer';
import { Sidebar } from './components/Sidebar';
import { TextObjectsTab } from './components/TextObjectsTab';
import { TextOverlay } from './components/TextOverlay';
import { UpdatePrompt } from './components/UpdatePrompt';
import { NOTICE_MESSAGES } from './lib/document-notice';
import { viewerKeyAction } from './lib/keyboard';
import { LOAD_ERROR_MESSAGES } from './lib/load-errors';
import type { SampleId } from './lib/sample-catalog';
import { usePageModel, usePageSampling } from './store/usePageModel';
import { documentRegistry, editorStore, openSample, useEditor } from './store/useEditor';
import type { PageGeometry } from './lib/coordinates';

/** Layer 2 for the page the viewer has loaded: boxes over every Text Line of that page's read model. */
function PageOverlay({ documentId, pageIndex, geometry, zoom }: { documentId: string; pageIndex: number; geometry: PageGeometry; zoom: number }) {
  const { status, model } = usePageModel(documentId, pageIndex);
  const selection = useEditor((s) => s.selection);
  const { selectObject, stepSelection } = editorStore.getState();
  return (
    <>
      {model && <TextOverlay lines={model.lines} geometry={geometry} zoom={zoom} selectedId={selection} onSelect={selectObject} onStep={stepSelection} />}
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
  const viewerRef = useRef<HTMLDivElement>(null);
  const selection = useEditor((s) => s.selection);
  const [rendered, setRendered] = useState<{ documentId: string; pageIndex: number } | null>(null);
  const docIdForPage = document?.id;
  const activeModel = usePageModel(docIdForPage, view.pageIndex);
  usePageSampling(docIdForPage, view.pageIndex, rendered && rendered.documentId === docIdForPage ? rendered.pageIndex : null);
  const clearSelection = useCallback(() => editorStore.getState().selectObject(null), []);

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
      // Escape clears the selection from anywhere outside a text field (object-selection spec).
      if (e.key === 'Escape' && editorStore.getState().selection && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        editorStore.getState().selectObject(null);
        return;
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
                  renderOverlay={({ geometry, pageIndex, zoom }) => (
                    <PageOverlay documentId={document.id} pageIndex={pageIndex} geometry={geometry} zoom={zoom} />
                  )}
                />
              </div>
            </div>
          )}
        </PDFUploader>
      </main>
    </div>
  );
}
