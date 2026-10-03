// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFViewer, type RenderablePage } from '../../../src/components/PDFViewer';
import { TextOverlay } from '../../../src/components/TextOverlay';
import { createPageGeometry } from '../../../src/lib/coordinates';
import { LOCK_MESSAGES, MASK_WARNING } from '../../../src/lib/object-labels';
import type { TextLine } from '../../../src/types/page-model';

afterEach(cleanup);

const upright = createPageGeometry([0, 0, 612, 792], 0);
const rotated = createPageGeometry([0, 0, 612, 792], 90);

function mk(id: string, text: string, box: TextLine['box'], extra: Partial<TextLine> = {}): TextLine {
  return { id, text, box, lockReason: null, background: { status: 'pending' }, ...extra } as TextLine;
}
const heading = mk('0:0', 'Quarterly report', { x: 72, y: 688, width: 142, height: 14 });
const body = mk('0:1', 'Total amount due', { x: 72, y: 600, width: 100, height: 12 });
const stamp = mk('0:2', 'DRAFT', { x: 200, y: 300, width: 90, height: 60 }, { lockReason: 'rotated-or-skewed' });

const boxes = () => screen.getAllByTestId('text-box');
const boxFor = (name: RegExp | string) => screen.getByRole('button', { name });

/** Stateful host so selection behaves as it does in the app. */
function Host({
  lines,
  geometry = upright,
  zoom = 1,
  initial = null,
  onSelectSpy,
}: {
  lines: TextLine[];
  geometry?: typeof upright;
  zoom?: number;
  initial?: string | null;
  onSelectSpy?: (id: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const select = (id: string | null) => {
    onSelectSpy?.(id);
    setSelected(id);
  };
  const step = (direction: 1 | -1) => {
    const at = lines.findIndex((l) => l.id === selected);
    const target = lines[at === -1 ? (direction === 1 ? 0 : lines.length - 1) : at + direction];
    if (target) setSelected(target.id);
  };
  return <TextOverlay lines={lines} geometry={geometry} zoom={zoom} selectedId={selected} onSelect={select} onStep={step} />;
}

describe('box positions (7.1)', () => {
  it('positions a box through the page geometry at 100% zoom', () => {
    render(<Host lines={[heading]} />);
    const style = boxes()[0]?.style;
    // Display y = 792 − (688 + 14).
    expect([style?.left, style?.top, style?.width, style?.height]).toEqual(['72px', '90px', '142px', '14px']);
  });

  it('scales with zoom: 250%', () => {
    render(<Host lines={[heading]} zoom={2.5} />);
    const style = boxes()[0]?.style;
    expect([style?.left, style?.top, style?.width, style?.height]).toEqual(['180px', '225px', '355px', '35px']);
  });

  it('positions boxes on a /Rotate 90 page in the displayed landscape orientation', () => {
    render(<Host lines={[mk('0:0', 'Rotated page', { x: 100, y: 200, width: 50, height: 10 })]} geometry={rotated} />);
    const style = boxes()[0]?.style;
    expect([style?.left, style?.top, style?.width, style?.height]).toEqual(['200px', '100px', '10px', '50px']);
  });

  it('renders one box per Text Line and ignores the pointer on its container', () => {
    render(<Host lines={[heading, body, stamp]} />);
    expect(boxes()).toHaveLength(3);
    expect(screen.getByTestId('text-overlay').className).toContain('pointer-events-none');
    expect(boxes()[0]?.className).toContain('pointer-events-auto');
  });
});

describe('selection (7.2)', () => {
  it('selects a clicked box, and only one at a time', () => {
    render(<Host lines={[heading, body]} />);
    fireEvent.click(boxFor('Quarterly report'));
    expect(boxFor('Quarterly report').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(boxFor('Total amount due'));
    expect(boxFor('Quarterly report').getAttribute('aria-pressed')).toBe('false');
    expect(boxFor('Total amount due').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows corner indicators and a ring on the selected box only', () => {
    render(<Host lines={[heading, body]} initial="0:0" />);
    const selected = boxFor('Quarterly report');
    expect(selected.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(4);
    expect(selected.className).toContain('ring-blue-600');
    expect(boxFor('Total amount due').querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0);
  });

  it('gives unselected boxes a hover state distinct from the selection ring', () => {
    render(<Host lines={[heading, body]} initial="0:0" />);
    const other = boxFor('Total amount due');
    expect(other.className).toContain('hover:bg-blue-400/20');
    expect(other.className).not.toContain('ring-blue-600');
  });

  it('stops click propagation so a box click is not a background click', () => {
    const background = vi.fn();
    render(<Host lines={[heading]} />);
    document.body.addEventListener('click', background);
    fireEvent.click(boxes()[0] as HTMLElement);
    expect(background).not.toHaveBeenCalled();
  });
});

describe('locked objects (7.3)', () => {
  it('marks a locked box, explains why, and still lets it be selected', () => {
    render(<Host lines={[stamp]} />);
    const box = screen.getByRole('button', { name: /DRAFT/ });
    expect(box.dataset.locked).toBe('true');
    const tip = document.getElementById(box.getAttribute('aria-describedby') ?? '');
    expect(tip?.getAttribute('role')).toBe('tooltip');
    expect(tip?.textContent).toBe('Rotated or skewed text cannot be edited in this version.');
    fireEvent.click(box);
    expect(box.getAttribute('aria-pressed')).toBe('true');
    expect(box.dataset.locked).toBe('true');
  });

  it('has no tooltip on an editable line', () => {
    render(<Host lines={[heading]} />);
    expect(boxes()[0]?.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('words each lock reason', () => {
    expect(LOCK_MESSAGES['vertical-writing']).toMatch(/vertical/i);
    expect(LOCK_MESSAGES['type3-font']).toMatch(/type 3/i);
  });
});

describe('keyboard selection (7.4)', () => {
  it('steps through reading order with Tab and back with Shift+Tab', () => {
    render(<Host lines={[heading, body, stamp]} />);
    const overlay = screen.getByTestId('text-overlay');
    fireEvent.keyDown(overlay, { key: 'Tab' });
    expect(boxFor('Quarterly report').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(overlay, { key: 'Tab' });
    expect(boxFor('Total amount due').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(overlay, { key: 'Tab', shiftKey: true });
    expect(boxFor('Quarterly report').getAttribute('aria-pressed')).toBe('true');
  });

  it('lets Tab leave the overlay past the last object', () => {
    render(<Host lines={[heading, body]} initial="0:1" />);
    const notPrevented = fireEvent.keyDown(screen.getByTestId('text-overlay'), { key: 'Tab' });
    expect(notPrevented).toBe(true);
  });

  it('Escape clears the selection', () => {
    render(<Host lines={[heading]} initial="0:0" />);
    fireEvent.keyDown(screen.getByTestId('text-overlay'), { key: 'Escape' });
    expect(boxes()[0]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('focusing a box selects it and only the active box is a tab stop', () => {
    render(<Host lines={[heading, body]} />);
    expect(boxes().map((b) => b.tabIndex)).toEqual([0, -1]);
    act(() => boxFor('Total amount due').focus());
    expect(boxFor('Total amount due').getAttribute('aria-pressed')).toBe('true');
    expect(boxes().map((b) => b.tabIndex)).toEqual([-1, 0]);
  });

  it('scrolls a newly selected box into view and moves focus with a keyboard selection', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<Host lines={[heading, body]} />);
    act(() => boxFor('Quarterly report').focus());
    fireEvent.keyDown(screen.getByTestId('text-overlay'), { key: 'Tab' });
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(boxFor('Total amount due'));
  });

  it('announces the selected object with its text, and its lock reason', () => {
    render(<Host lines={[body, stamp]} initial="0:1" />);
    expect(screen.getByRole('status').textContent).toBe('Selected: Total amount due');
    cleanup();
    render(<Host lines={[stamp]} initial="0:2" />);
    expect(screen.getByRole('status').textContent).toContain('locked: Rotated or skewed text cannot be edited');
  });
});

describe('mask warning (7.5)', () => {
  const photo = mk('0:3', 'Over a photo', { x: 10, y: 10, width: 80, height: 12 }, { background: { status: 'ready', color: '#778899', uniform: false, ratio: 0.4 } });
  const flat = mk('0:4', 'On white', { x: 10, y: 40, width: 80, height: 12 }, { background: { status: 'ready', color: '#FFFFFF', uniform: true, ratio: 1 } });

  it('warns about a selected line over a non-uniform background', () => {
    render(<Host lines={[photo]} initial="0:3" />);
    expect(screen.getByTestId('mask-warning').textContent).toBe(MASK_WARNING);
  });

  it('does not warn for uniform or still-pending backgrounds, or when nothing is selected', () => {
    render(<Host lines={[flat, heading, photo]} initial="0:4" />);
    expect(screen.queryByTestId('mask-warning')).toBeNull();
    act(() => boxFor('Quarterly report').focus());
    expect(screen.queryByTestId('mask-warning')).toBeNull();
    fireEvent.keyDown(screen.getByTestId('text-overlay'), { key: 'Escape' });
    expect(screen.queryByTestId('mask-warning')).toBeNull();
  });
});

describe('inside the viewer: background clicks and re-rendering (7.2, 6.3)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderCount = { n: 0 };
  const page: RenderablePage = {
    view: [0, 0, 612, 792],
    rotate: 0,
    getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
    render: () => {
      renderCount.n++;
      return { promise: Promise.resolve(), cancel: () => undefined };
    },
  };

  const getPage = async () => page; // stable identity, as the app's memoised getPage

  function ViewerHost({ lines }: { lines: TextLine[] }) {
    const [selected, setSelected] = useState<string | null>(null);
    const [current, setCurrent] = useState(lines);
    return (
      <>
        <button type="button" onClick={() => setCurrent(lines.map((l) => ({ ...l, background: { status: 'ready', color: '#FFFFFF', uniform: true, ratio: 1 } })))}>
          sampling finished
        </button>
        <PDFViewer
          getPage={getPage}
          pageIndex={0}
          pageCount={1}
          zoom={1}
          fitMode={null}
          onFitZoom={() => undefined}
          onBackgroundClick={() => setSelected(null)}
          renderOverlay={({ geometry, zoom }) => (
            <TextOverlay lines={current} geometry={geometry} zoom={zoom} selectedId={selected} onSelect={setSelected} onStep={() => undefined} />
          )}
        />
      </>
    );
  }

  it('clears the selection when empty page space is clicked', async () => {
    render(<ViewerHost lines={[heading]} />);
    await screen.findByTestId('page');
    fireEvent.click(boxFor('Quarterly report'));
    expect(boxFor('Quarterly report').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('page'));
    expect(boxFor('Quarterly report').getAttribute('aria-pressed')).toBe('false');
  });

  it('lines are selectable while sampling is pending, and sampling results do not re-render the page', async () => {
    renderCount.n = 0;
    render(<ViewerHost lines={[heading]} />);
    await screen.findByTestId('page');
    await act(async () => undefined);
    expect(renderCount.n).toBe(1);
    fireEvent.click(boxFor('Quarterly report')); // background still pending
    expect(boxFor('Quarterly report').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'sampling finished' }));
    await act(async () => undefined);
    expect(renderCount.n).toBe(1);
    expect(within(screen.getByTestId('page')).getAllByTestId('text-box')).toHaveLength(1);
  });
});
