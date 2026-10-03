// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFViewer, type RenderablePage } from '../../../src/components/PDFViewer';
import { MAX_CANVAS_PIXELS } from '../../../src/lib/render-scale';

function fakePage(view = [0, 0, 612, 792], rotate = 0): RenderablePage {
  return {
    view,
    rotate,
    getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
  };
}

let resizeCallback: ((entries: { contentRect: { width: number; height: number } }[]) => void) | null = null;

beforeEach(() => {
  resizeCallback = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: typeof resizeCallback) {
        resizeCallback = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const resize = (width: number, height: number) => act(() => resizeCallback?.([{ contentRect: { width, height } }]));

async function renderViewer(props: Partial<Parameters<typeof PDFViewer>[0]> = {}) {
  const getPage = vi.fn(async () => fakePage());
  const onFitZoom = vi.fn();
  const utils = render(
    <PDFViewer getPage={getPage} pageIndex={0} pageCount={1} zoom={1} fitMode={null} onFitZoom={onFitZoom} {...props} />,
  );
  await screen.findByTestId('page');
  await act(async () => undefined);
  return { ...utils, getPage, onFitZoom };
}

const canvas = () => screen.getByTestId('page').querySelector('canvas');

describe('PDFViewer rendering (5.2)', () => {
  it('Retina at 100%: CSS 612×792 and canvas backing 1224×1584', async () => {
    await renderViewer({ zoom: 1 });
    const page = screen.getByTestId('page');
    expect(page.style.width).toBe('612px');
    expect(page.style.height).toBe('792px');
    expect(canvas()?.width).toBe(1224);
    expect(canvas()?.height).toBe(1584);
    expect(page.getAttribute('aria-label')).toBe('Page 1 of 1');
  });

  it('400% at dpr 2: CSS 2448×3168 and canvas within the pixel limit', async () => {
    await renderViewer({ zoom: 4 });
    const page = screen.getByTestId('page');
    expect(page.style.width).toBe('2448px');
    expect(page.style.height).toBe('3168px');
    const c = canvas();
    expect(c).not.toBeNull();
    expect((c?.width ?? 0) * (c?.height ?? 0)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });

  it('cancels a stale render and shows the latest page only', async () => {
    const cancels: number[] = [];
    let resolveFirst: () => void = () => undefined;
    const pages: RenderablePage[] = [0, 1].map((i) => ({
      ...fakePage(),
      render: () => ({
        promise: i === 0 ? new Promise<void>((r) => (resolveFirst = r)) : Promise.resolve(),
        cancel: () => cancels.push(i),
      }),
    }));
    const getPage = async (i: number) => pages[i] ?? fakePage();
    const { rerender } = render(<PDFViewer getPage={getPage} pageIndex={0} pageCount={2} zoom={1} fitMode={null} onFitZoom={() => undefined} />);
    await screen.findByTestId('page');
    rerender(<PDFViewer getPage={getPage} pageIndex={1} pageCount={2} zoom={1} fitMode={null} onFitZoom={() => undefined} />);
    await act(async () => undefined);
    resolveFirst();
    await act(async () => undefined);
    expect(cancels).toContain(0);
    expect(screen.getByTestId('page').getAttribute('data-rendered-page-index')).toBe('1');
  });
});

describe('PDFViewer fit modes (5.3)', () => {
  it('fit to width follows resize', async () => {
    const { onFitZoom } = await renderViewer({ fitMode: 'width' });
    resize(1260, 800);
    resize(660, 800);
    const zooms = onFitZoom.mock.calls.map(([z]) => z as number);
    expect(zooms.at(-2)).toBeCloseTo((1260 - 48) / 612);
    expect(zooms.at(-1)).toBeCloseTo(1);
  });

  it('without a fit mode (explicit zoom), resizing does not change zoom', async () => {
    const { onFitZoom } = await renderViewer({ fitMode: null });
    resize(900, 700);
    expect(onFitZoom).not.toHaveBeenCalled();
  });

  it('fit to page fits a /Rotate 90 page', async () => {
    const getPage = vi.fn(async () => fakePage([0, 0, 612, 792], 90));
    const { onFitZoom } = await renderViewer({ fitMode: 'page', getPage });
    resize(1000, 700);
    expect(onFitZoom).toHaveBeenLastCalledWith(Math.min(952 / 792, 652 / 612));
  });
});
