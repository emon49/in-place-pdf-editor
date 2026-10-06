// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFViewer, type RenderablePage } from '../../../src/components/PDFViewer';
import { Sidebar } from '../../../src/components/Sidebar';
import { ROW_HEIGHT, TextObjectsTab, VIRTUALIZE_ABOVE } from '../../../src/components/TextObjectsTab';
import { fitWidth } from '../../../src/lib/zoom';
import type { TextLine } from '../../../src/types/page-model';

afterEach(cleanup);

const line = (i: number, extra: Partial<TextLine> = {}): TextLine =>
  ({
    id: `0:${i}`,
    text: `Line number ${i}`,
    family: 'Helvetica',
    bold: false,
    italic: false,
    fontSize: 11,
    color: { hex: '#1F293B', source: 'exact' },
    lockReason: null,
    ...extra,
  }) as TextLine;

describe('Sidebar shell (8.1)', () => {
  const tabs = [
    { id: 'text', label: 'Text Objects', content: <p>text panel</p> },
    { id: 'images', label: 'Images', content: <p>image panel</p> },
  ];

  it('offers only tabs that have content', () => {
    render(<Sidebar tabs={[tabs[0] as (typeof tabs)[number], { id: 'x', label: 'Empty', content: null }]} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Text Objects']);
  });

  it('renders nothing when no tab has content', () => {
    const { container } = render(<Sidebar tabs={[{ id: 'x', label: 'Empty', content: null }]} />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes one selected tab and shows its panel', () => {
    render(<Sidebar tabs={tabs} />);
    const [first, second] = screen.getAllByRole('tab');
    expect(first?.getAttribute('aria-selected')).toBe('true');
    expect(second?.getAttribute('aria-selected')).toBe('false');
    expect(within(screen.getByRole('tabpanel')).getByText('text panel')).toBeTruthy();
  });

  it('moves between tabs with the arrow keys, wrapping, and with Home/End', () => {
    render(<Sidebar tabs={tabs} />);
    const [first, second] = screen.getAllByRole('tab') as [HTMLElement, HTMLElement];
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(second);
    expect(screen.getByRole('tabpanel').textContent).toBe('image panel');
    fireEvent.keyDown(second, { key: 'ArrowRight' });
    expect(first.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(first, { key: 'End' });
    expect(second.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(second, { key: 'Home' });
    expect(first.getAttribute('aria-selected')).toBe('true');
  });

  it('collapses and reopens with the same tab selected', () => {
    render(<Sidebar tabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByTestId('sidebar').dataset.open).toBe('false');
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    expect(screen.getByRole('tab', { name: 'Images' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('image panel');
  });
});

describe('Text Objects tab states (8.2)', () => {
  const noop = () => undefined;

  it('lists lines in order with text, family, size and a colour swatch', () => {
    const lines = [
      line(0, { text: 'INVOICE', bold: true, fontSize: 20 }),
      line(1, { text: 'Bill to', color: { hex: '#63738C', source: 'exact' } }),
    ];
    render(<TextObjectsTab status="ready" lines={lines} selectedId={null} onSelect={noop} />);
    const rows = screen.getAllByTestId('text-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('INVOICE');
    expect(rows[0]?.textContent).toContain('Helvetica Bold, 20 pt');
    expect(within(rows[0] as HTMLElement).getByRole('img').getAttribute('aria-label')).toBe('Colour #1F293B');
    expect((within(rows[0] as HTMLElement).getByRole('img') as HTMLElement).style.backgroundColor).toBe('rgb(31, 41, 59)');
    expect(rows[1]?.textContent).toContain('Bill to');
  });

  it('lists eight lines as eight rows', () => {
    render(<TextObjectsTab status="ready" lines={Array.from({ length: 8 }, (_, i) => line(i))} selectedId={null} onSelect={noop} />);
    expect(screen.getAllByTestId('text-row')).toHaveLength(8);
  });

  it('marks a locked row', () => {
    render(<TextObjectsTab status="ready" lines={[line(0, { lockReason: 'rotated-or-skewed' }), line(1)]} selectedId={null} onSelect={noop} />);
    const [locked, plain] = screen.getAllByTestId('text-row') as [HTMLElement, HTMLElement];
    expect(locked.textContent).toContain('Locked');
    expect(plain.textContent).not.toContain('Locked');
  });

  it('flags an approximate colour', () => {
    render(<TextObjectsTab status="ready" lines={[line(0, { color: { hex: '#102030', source: 'sampled' } })]} selectedId={null} onSelect={noop} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Colour #102030 (approximate)');
  });

  it('says no text was found on an empty page', () => {
    render(<TextObjectsTab status="ready" lines={[]} selectedId={null} onSelect={noop} />);
    expect(screen.getByText('No text was found on this page.')).toBeTruthy();
  });

  it('indicates detection in progress instead of an empty list', () => {
    for (const status of ['idle', 'extracting'] as const) {
      render(<TextObjectsTab status={status} lines={[]} selectedId={null} onSelect={noop} />);
      expect(screen.getByRole('status').textContent).toContain('Detecting text');
      expect(screen.queryByText('No text was found on this page.')).toBeNull();
      cleanup();
    }
  });

  it('reports a failed page', () => {
    render(<TextObjectsTab status="failed" lines={[]} selectedId={null} onSelect={noop} />);
    expect(screen.getByRole('alert').textContent).toBe('Text could not be detected on this page.');
  });
});

describe('two-way selection and virtualisation (8.3)', () => {
  it('selects the line when its row is clicked', () => {
    const onSelect = vi.fn();
    render(<TextObjectsTab status="ready" lines={[line(0), line(1)]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByTestId('text-row')[1] as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith('0:1');
  });

  it('highlights the selected row', () => {
    render(<TextObjectsTab status="ready" lines={[line(0), line(1)]} selectedId="0:1" onSelect={() => undefined} />);
    const rows = screen.getAllByTestId('text-row');
    expect(rows.map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('scrolls a selection made on the page into view', () => {
    const lines = Array.from({ length: 100 }, (_, i) => line(i));
    const { rerender } = render(<TextObjectsTab status="ready" lines={lines} selectedId={null} onSelect={() => undefined} />);
    const list = screen.getByTestId('text-objects-list');
    Object.defineProperty(list, 'clientHeight', { value: 300, configurable: true });
    rerender(<TextObjectsTab status="ready" lines={lines} selectedId="0:80" onSelect={() => undefined} />);
    // Row 80 ends at 81 × row height; it must now be the bottom visible row.
    expect(list.scrollTop).toBe(81 * ROW_HEIGHT - 300);
  });

  it('renders only a bounded number of rows for a thousand lines, and follows scrolling', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => line(i));
    render(<TextObjectsTab status="ready" lines={lines} selectedId={null} onSelect={() => undefined} />);
    expect(VIRTUALIZE_ABOVE).toBeLessThan(1000);
    const first = screen.getAllByTestId('text-row').length;
    expect(first).toBeLessThan(40);
    const list = screen.getByTestId('text-objects-list');
    list.scrollTop = 500 * ROW_HEIGHT;
    fireEvent.scroll(list);
    const rows = screen.getAllByTestId('text-row');
    expect(rows.length).toBeLessThan(40);
    expect(rows.some((r) => r.dataset.lineId === '0:500')).toBe(true);
    expect(rows.some((r) => r.dataset.lineId === '0:0')).toBe(false);
  });

  it('does not virtualise a short list', () => {
    render(<TextObjectsTab status="ready" lines={Array.from({ length: 50 }, (_, i) => line(i))} selectedId={null} onSelect={() => undefined} />);
    expect(screen.getAllByTestId('text-row')).toHaveLength(50);
  });
});

describe('fit modes at the narrower width (8.4)', () => {
  let resizeCallback: ((entries: { contentRect: { width: number; height: number } }[]) => void) | null = null;
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { constructor(cb: typeof resizeCallback) { resizeCallback = cb; } observe() {} disconnect() {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  const page: RenderablePage = {
    view: [0, 0, 612, 792],
    rotate: 0,
    getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
  };
  const getPage = async () => page;

  it('recomputes the fit-to-width zoom when the sidebar is collapsed and the viewer grows', async () => {
    const onFitZoom = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              // The browser would report the wider viewer once the 288 px sidebar collapses to 40 px.
              act(() => resizeCallback?.([{ contentRect: { width: 1000 + 248, height: 800 } }]));
            }}
          >
            collapse
          </button>
          <span hidden>{String(open)}</span>
          <PDFViewer getPage={getPage} pageIndex={0} pageCount={1} zoom={1} fitMode="width" onFitZoom={onFitZoom} />
        </>
      );
    }
    render(<Host />);
    await screen.findByTestId('page');
    act(() => resizeCallback?.([{ contentRect: { width: 1000, height: 800 } }]));
    const narrow = onFitZoom.mock.lastCall?.[0] as number;
    expect(narrow).toBeCloseTo(fitWidth({ width: 1000, height: 800 }, { width: 612, height: 792 }));
    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    const wide = onFitZoom.mock.lastCall?.[0] as number;
    expect(wide).toBeGreaterThan(narrow);
    expect(wide).toBeCloseTo(fitWidth({ width: 1248, height: 800 }, { width: 612, height: 792 }));
  });
});
