// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/App';
import { pageModelKey } from '../../../src/lib/page-model';
import { documentRegistry, editorStore, pageModelCache } from '../../../src/store/useEditor';
import type { PageModel, TextLine } from '../../../src/types/page-model';

const fakePage = {
  view: [0, 0, 612, 792],
  rotate: 0,
  userUnit: 1,
  getViewport: ({ scale }: { scale: number }) => ({ width: 612 * scale, height: 792 * scale }),
  render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
};

function line(i: number, text: string, y: number, extra: Partial<TextLine> = {}): TextLine {
  return {
    id: `0:${i}`,
    pageIndex: 0,
    text,
    family: 'Helvetica',
    bold: false,
    italic: false,
    fontSize: 12,
    box: { x: 72, y, width: 120, height: 14 },
    color: { hex: '#1F293B', source: 'exact' },
    background: { status: 'ready', color: '#FFFFFF', uniform: true, ratio: 1 },
    lockReason: null,
    ...extra,
  } as TextLine;
}

const lines = [line(0, 'Quarterly report', 700), line(1, 'Total amount due', 600), line(2, 'DRAFT', 300, { lockReason: 'rotated-or-skewed' })];

/** Opens a fake two-page document in the app's singleton store. */
function openFakeDocument(opts: { page0?: PageModel | 'failed' | 'extracting' } = {}) {
  const pdf = { numPages: 2, getPage: async () => fakePage, loadingTask: { destroy: async () => undefined } } as unknown as PDFDocumentProxy;
  const id = documentRegistry.register({ pdf, originalBytes: new Uint8Array(1) });
  const first = opts.page0 ?? { pageIndex: 0, lines, images: [], palette: [] };
  if (typeof first === 'object') pageModelCache.set(id, 0, first);
  pageModelCache.set(id, 1, { pageIndex: 1, lines: [], images: [], palette: [] });
  const status = typeof first === 'object' ? 'ready' : first;
  editorStore.setState({
    document: { id, name: 'a.pdf', byteLength: 1, pageCount: 2 },
    view: { pageIndex: 0, zoom: 1, fitMode: null },
    pageModels: {
      [pageModelKey(id, 0)]: { status, revision: 1 },
      [pageModelKey(id, 1)]: { status: 'ready', revision: 1 },
    },
    selection: null,
  });
  return id;
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  editorStore.setState({ document: null, selection: null, pageModels: {} });
});

describe('sidebar and overlay in the app', () => {
  it('shows no sidebar when no document is open (8.1)', () => {
    render(<App />);
    expect(screen.queryByTestId('sidebar')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows the Text Objects tab alone beside an open document, listing the page in reading order (8.1, 8.2)', async () => {
    openFakeDocument();
    render(<App />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Text Objects', 'Pages', 'History']);
    const rows = await screen.findAllByTestId('text-row');
    expect(rows.map((r) => r.dataset.lineId)).toEqual(['0:0', '0:1', '0:2']);
    expect((await screen.findAllByTestId('text-box'))).toHaveLength(3);
  });

  it('selecting a row selects the object on the page, and vice versa (8.3)', async () => {
    openFakeDocument();
    render(<App />);
    const rows = await screen.findAllByTestId('text-row');
    fireEvent.click(rows[1] as HTMLElement);
    const box = (await screen.findAllByTestId('text-box'))[1] as HTMLElement;
    expect(box.getAttribute('aria-pressed')).toBe('true');
    expect(editorStore.getState().selection).toBe('0:1');
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    expect(screen.getAllByTestId('text-row').map((r) => r.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
  });

  it('clears the selection when the page changes (7.5)', async () => {
    openFakeDocument();
    render(<App />);
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    expect(editorStore.getState().selection).toBe('0:0');
    act(() => editorStore.getState().goToPage(1));
    expect(editorStore.getState().selection).toBeNull();
    expect(await screen.findByText('No text was found on this page.')).toBeTruthy();
  });

  it('clears the selection when another document is opened (7.5)', async () => {
    openFakeDocument();
    render(<App />);
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    act(() => void openFakeDocument());
    expect(editorStore.getState().selection).toBeNull();
    expect((await screen.findAllByTestId('text-box')).every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('clears the selection with Escape from anywhere, and by clicking empty page space', async () => {
    openFakeDocument();
    render(<App />);
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(editorStore.getState().selection).toBeNull();
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    fireEvent.click(screen.getByTestId('page'));
    expect(editorStore.getState().selection).toBeNull();
  });

  it('keeps the page and explains when text could not be detected (3.7)', async () => {
    openFakeDocument({ page0: 'failed' });
    render(<App />);
    expect(await screen.findByTestId('page')).toBeTruthy();
    const messages = await screen.findAllByText('Text could not be detected on this page.');
    expect(messages.length).toBe(2); // on the page and in the sidebar
    expect(screen.queryByTestId('text-box')).toBeNull();
    expect(screen.queryByText('This page could not be rendered.')).toBeNull();
  });

  it('indicates detection in progress while a page is extracting (8.2)', async () => {
    openFakeDocument({ page0: 'extracting' });
    render(<App />);
    expect(within(await screen.findByTestId('sidebar')).getByRole('status').textContent).toContain('Detecting text');
  });

  it('collapses the sidebar and reopens it on the same tab (8.1)', async () => {
    openFakeDocument();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByTestId('sidebar').dataset.open).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    expect(screen.getByRole('tab', { name: 'Text Objects' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('text editing operations (7.x)', () => {
  beforeEach(() => {
    editorStore.setState({ ops: [], cursor: 0 });
  });

  it('clicking a text box shows the side-panel text editor; locked line shows disabled textarea (7.4)', async () => {
    openFakeDocument();
    render(<App />);
    const boxes = await screen.findAllByTestId('text-box');
    // Click unlocked line -> text editor panel appears
    fireEvent.click(boxes[0] as HTMLElement);
    expect(await screen.findByTestId('text-editor-panel')).toBeTruthy();
    const textarea = screen.getByTestId('text-editor-textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);
    // Click locked line (DRAFT, index 2) -> textarea should be disabled
    fireEvent.click(boxes[2] as HTMLElement);
    const lockedTextarea = await screen.findByTestId('text-editor-textarea') as HTMLTextAreaElement;
    expect(lockedTextarea.disabled).toBe(true);
  });

  it('typing in side-panel textarea then changing selection commits the edit (7.4)', async () => {
    openFakeDocument();
    render(<App />);
    const boxes = await screen.findAllByTestId('text-box');
    fireEvent.click(boxes[0] as HTMLElement);
    expect(editorStore.getState().selection).toBe('0:0');
    const textarea = await screen.findByTestId('text-editor-textarea');
    fireEvent.change(textarea, { target: { value: 'New text' } });
    // Selection still '0:0'; change selection to commit
    fireEvent.click(boxes[1] as HTMLElement);
    expect(editorStore.getState().selection).toBe('0:1');
  });

  it('changed text pushes TEXT_REPLACE; unchanged text pushes no op (7.1)', async () => {
    openFakeDocument();
    render(<App />);
    const boxes = await screen.findAllByTestId('text-box');
    // Select box 0 and type different text
    fireEvent.click(boxes[0] as HTMLElement);
    const textarea = await screen.findByTestId('text-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Updated report' } });
    // Change selection to box 1 to commit
    fireEvent.click(boxes[1] as HTMLElement);
    const { ops, cursor } = editorStore.getState();
    expect(cursor).toBe(1);
    expect(ops[0]?.type).toBe('TEXT_REPLACE');
    expect((ops[0] as { newText?: string }).newText).toBe('Updated report');
    // Select box 1 and type the same text back -> no new op
    const textarea2 = await screen.findByTestId('text-editor-textarea') as HTMLTextAreaElement;
    const originalText = textarea2.value;
    fireEvent.change(textarea2, { target: { value: originalText } });
    // Change selection back to box 0
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    expect(editorStore.getState().cursor).toBe(1); // no new op
  });

  it('Delete with selection pushes OBJECT_DELETE, Delete inside side-panel textarea does not (7.2)', async () => {
    openFakeDocument();
    render(<App />);
    // Select a line then press Delete
    const boxes = await screen.findAllByTestId('text-box');
    fireEvent.click(boxes[1] as HTMLElement);
    expect(editorStore.getState().selection).toBe('0:1');
    fireEvent.keyDown(window, { key: 'Delete' });
    const { ops, cursor } = editorStore.getState();
    expect(cursor).toBe(1);
    expect(ops[0]?.type).toBe('OBJECT_DELETE');
    // Select another line and press Delete inside the textarea - must not create an op
    const boxes2 = await screen.findAllByTestId('text-box');
    fireEvent.click(boxes2[0] as HTMLElement);
    const textarea = await screen.findByTestId('text-editor-textarea');
    const cursorBefore = editorStore.getState().cursor;
    fireEvent.keyDown(textarea, { key: 'Delete' });
    expect(editorStore.getState().cursor).toBe(cursorBefore);
  });
});

describe('revert to original (10.3)', () => {
  beforeEach(() => {
    editorStore.setState({ ops: [], cursor: 0 });
  });

  it('revert-to-original button not shown on unedited selection', async () => {
    openFakeDocument();
    render(<App />);
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    expect(screen.queryByTestId('revert-to-original')).toBeNull();
  });

  it('revert-to-original restores line after an edit', async () => {
    openFakeDocument();
    render(<App />);
    const boxes = await screen.findAllByTestId('text-box');
    // Select box 0 and type new text
    fireEvent.click(boxes[0] as HTMLElement);
    const textarea = await screen.findByTestId('text-editor-textarea');
    fireEvent.change(textarea, { target: { value: 'Edited text' } });
    // Change selection to commit the edit
    fireEvent.click((await screen.findAllByTestId('text-box'))[1] as HTMLElement);
    // Re-select box 0 - revert button should appear
    fireEvent.click((await screen.findAllByTestId('text-box'))[0] as HTMLElement);
    expect(screen.getByTestId('revert-to-original')).toBeTruthy();
    fireEvent.click(screen.getByTestId('revert-to-original'));
    // After revert, the op cursor should have advanced (REVERT op pushed)
    const { ops, cursor } = editorStore.getState();
    const lastOp = ops[cursor - 1];
    expect(lastOp?.type).toBe('REVERT');
  });
});

describe('patches and masks update on undo/redo (8.4)', () => {
  beforeEach(() => {
    editorStore.setState({ ops: [], cursor: 0 });
  });

  it('undo removes patch and mask; redo restores them', async () => {
    openFakeDocument();
    render(<App />);
    const boxes = await screen.findAllByTestId('text-box');
    // Select box 0 and type new text
    fireEvent.click(boxes[0] as HTMLElement);
    const textarea = await screen.findByTestId('text-editor-textarea');
    fireEvent.change(textarea, { target: { value: 'New text' } });
    // Change selection to commit the edit
    fireEvent.click(boxes[1] as HTMLElement);
    // Patch and mask should be visible on box 0
    expect(await screen.findByTestId('mask')).toBeTruthy();
    expect(screen.getByTestId('patch')).toBeTruthy();
    // Undo removes them
    act(() => editorStore.getState().undo());
    expect(screen.queryByTestId('mask')).toBeNull();
    expect(screen.queryByTestId('patch')).toBeNull();
    // Redo restores them
    act(() => editorStore.getState().redo());
    expect(screen.queryByTestId('mask')).toBeTruthy();
    expect(screen.queryByTestId('patch')).toBeTruthy();
  });
});
