import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPageGeometry, displaySize, type Box, type PageGeometry, type Size } from '../lib/coordinates';
import { planCanvas } from '../lib/render-scale';
import { fitPage, fitWidth } from '../lib/zoom';
import type { FitMode } from '../store/editorStore';

/** The subset of PDF.js `PDFPageProxy` the viewer uses (keeps the component testable). */
export interface RenderablePage {
  readonly view: number[];
  readonly rotate: number;
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: { canvas: HTMLCanvasElement; viewport: never }): { promise: Promise<void>; cancel(): void };
}

export interface PDFViewerProps {
  getPage: (pageIndex: number) => Promise<RenderablePage>;
  pageIndex: number;
  pageCount: number;
  zoom: number;
  fitMode: FitMode | null;
  onFitZoom: (zoom: number) => void;
  /** Extra content rendered over the page (overlay layers in later milestones). */
  children?: ReactNode;
}

interface LoadedPage {
  readonly index: number;
  readonly page: RenderablePage;
  readonly geometry: PageGeometry;
}

/** Tracks `devicePixelRatio`, including moves between displays (design D8). */
function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const update = () => setDpr(window.devicePixelRatio || 1);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [dpr]);
  return dpr;
}

/** Observes the viewer's content-box size. */
function useElementSize(ref: React.RefObject<HTMLElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const isCancellation = (e: unknown) =>
  typeof e === 'object' && e !== null && 'name' in e && (e as { name: unknown }).name === 'RenderingCancelledException';

/**
 * Layer 0: renders the active page to a high-DPI canvas (VW-1).
 * Renders are cancellable and double-buffered: the previous canvas stays until the new one is complete.
 */
export function PDFViewer({ getPage, pageIndex, pageCount, zoom, fitMode, onFitZoom, children }: PDFViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [renderedIndex, setRenderedIndex] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const dpr = useDevicePixelRatio();
  const viewerSize = useElementSize(scrollRef);

  // Load the active page; a newer page index supersedes pending loads.
  useEffect(() => {
    let active = true;
    getPage(pageIndex).then(
      (page) => {
        if (!active) return;
        const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view;
        const box: Box = [x0, y0, x1, y1];
        setLoaded({ index: pageIndex, page, geometry: createPageGeometry(box, page.rotate) });
      },
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [getPage, pageIndex]);

  const display = loaded ? displaySize(loaded.geometry) : null;

  // Keep the active fit mode applied as the viewer resizes or the page changes.
  useEffect(() => {
    if (!fitMode || !display || !viewerSize || viewerSize.width === 0) return;
    onFitZoom(fitMode === 'width' ? fitWidth(viewerSize, display) : fitPage(viewerSize, display));
  }, [fitMode, display?.width, display?.height, viewerSize, onFitZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render into an offscreen canvas and swap it in when complete; cancel stale renders.
  useEffect(() => {
    if (!loaded) return;
    const plan = planCanvas(displaySize(loaded.geometry), zoom, dpr);
    const canvas = document.createElement('canvas');
    canvas.width = plan.canvas.width;
    canvas.height = plan.canvas.height;
    canvas.className = 'block size-full';
    canvas.setAttribute('aria-hidden', 'true');
    const viewport = loaded.page.getViewport({ scale: zoom * plan.renderScale });
    const task = loaded.page.render({ canvas, viewport: viewport as never });
    let active = true;
    task.promise.then(
      () => {
        if (!active) return;
        canvasHostRef.current?.replaceChildren(canvas);
        setRenderedIndex(loaded.index);
        setFailed(false);
      },
      (e: unknown) => {
        if (active && !isCancellation(e)) setFailed(true);
      },
    );
    return () => {
      active = false;
      task.cancel();
    };
  }, [loaded, zoom, dpr]);

  const css = display ? { width: display.width * zoom, height: display.height * zoom } : null;

  return (
    <div
      ref={scrollRef}
      data-testid="viewer"
      className="relative min-h-0 flex-1 overflow-auto bg-slate-200 p-6 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
      // The scroll area must be focusable so keyboard users can scroll and use zoom shortcuts.
      tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex
      role="region"
      aria-label="Page viewer"
    >
      {css && (
        <div
          role="img"
          aria-label={`Page ${pageIndex + 1} of ${pageCount}`}
          data-testid="page"
          data-page-index={loaded?.index}
          data-rendered-page-index={renderedIndex ?? undefined}
          className="relative mx-auto bg-white shadow-md"
          style={{ width: css.width, height: css.height }}
        >
          <div ref={canvasHostRef} className="absolute inset-0" />
          {children}
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-4 text-center text-sm text-red-700">
          This page could not be rendered.
        </p>
      )}
    </div>
  );
}
