// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineTextEditor } from '../../src/components/InlineTextEditor';
import type { PreviewLine } from '../../src/types/operations';
import type { PageGeometry } from '../../src/lib/coordinates';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GEO: PageGeometry = {
  box: [0, 0, 595, 842],
  rotate: 0,
};

function makeLine(overrides: Partial<PreviewLine> = {}): PreviewLine {
  return {
    id: '0:1',
    pageIndex: 0,
    text: 'Hello',
    origin: { x: 0, y: 0 },
    box: { x: 50, y: 700, width: 200, height: 14 },
    matrix: [1, 0, 0, 1, 0, 0],
    fontRef: 'F1',
    family: 'Helvetica',
    subsetPrefix: null,
    fontClass: 'sans',
    bold: false,
    italic: false,
    fontSize: 12,
    hScale: 100,
    charSpacing: 0,
    wordSpacing: 0,
    rise: 0,
    renderMode: 0,
    lineHeight: 1.2,
    color: { hex: '#000000', source: 'exact' },
    background: { status: 'pending' },
    lockReason: null,
    font: {
      rawName: 'Helvetica',
      subtype: 'Type1',
      embedding: null,
      licence: null,
      encoding: null,
      coverage: null,
    },
    currentText: 'Hello',
    currentStyle: {
      fontClass: 'sans',
      bold: false,
      italic: false,
      fontFamilyOverride: null,
      size: 12,
      color: '#000000',
      charSpacing: 0,
      wordSpacing: 0,
      lineHeight: 1.2,
      hScale: 100,
      rise: 0,
      renderMode: 0,
    },
    deleted: false,
    patchLayout: null,
    resolvedFont: null,
    ...overrides,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InlineTextEditor', () => {
  it('renders at a position derived from the line box', () => {
    const line = makeLine();
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={onCommit} onCancel={onCancel} />,
    );
    const textarea = screen.getByTestId('inline-text-editor') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    // position is set via inline style
    const left = parseFloat(textarea.style.left);
    const top = parseFloat(textarea.style.top);
    expect(left).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(0);
  });

  it('shows text matching line content', () => {
    const line = makeLine({ currentText: 'Initial Text' });
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={vi.fn()} onCancel={vi.fn()} />,
    );
    const textarea = screen.getByTestId('inline-text-editor') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial Text');
  });

  it('Enter commits with current text', () => {
    const onCommit = vi.fn();
    const line = makeLine({ currentText: 'Hello' });
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={onCommit} onCancel={vi.fn()} />,
    );
    const textarea = screen.getByTestId('inline-text-editor');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onCommit).toHaveBeenCalledWith('Hello');
  });

  it('Shift+Enter does not commit', () => {
    const onCommit = vi.fn();
    const line = makeLine({ currentText: 'Hello' });
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={onCommit} onCancel={vi.fn()} />,
    );
    const textarea = screen.getByTestId('inline-text-editor');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Esc cancels', () => {
    const onCancel = vi.fn();
    const line = makeLine();
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={vi.fn()} onCancel={onCancel} />,
    );
    const textarea = screen.getByTestId('inline-text-editor');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('blur commits', () => {
    const onCommit = vi.fn();
    const line = makeLine({ currentText: 'Blur test' });
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={onCommit} onCancel={vi.fn()} />,
    );
    const textarea = screen.getByTestId('inline-text-editor');
    fireEvent.blur(textarea);
    expect(onCommit).toHaveBeenCalledWith('Blur test');
  });

  it('warning shown for undrawable char after debounce', async () => {
    const line = makeLine({ currentText: '' });
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={vi.fn()} onCancel={vi.fn()} />,
    );
    const textarea = screen.getByTestId('inline-text-editor');
    // CJK character outside guaranteed coverage
    fireEvent.change(textarea, { target: { value: '你好' } });
    // Advance timers past 200ms debounce
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByTestId('drawability-warning')).toBeTruthy();
  });

  it('warning cleared when undrawable char removed', async () => {
    const line = makeLine({ currentText: '' });
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={vi.fn()} onCancel={vi.fn()} />,
    );
    const textarea = screen.getByTestId('inline-text-editor');
    fireEvent.change(textarea, { target: { value: '你' } });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByTestId('drawability-warning')).toBeTruthy();
    // Remove the bad char
    fireEvent.change(textarea, { target: { value: 'A' } });
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.queryByTestId('drawability-warning')).toBeNull();
  });

  it('commit disabled while warning is active', async () => {
    const onCommit = vi.fn();
    const line = makeLine({ currentText: '' });
    render(
      <InlineTextEditor line={line} zoom={1} pageGeometry={GEO} onCommit={onCommit} onCancel={vi.fn()} />,
    );
    const textarea = screen.getByTestId('inline-text-editor');
    fireEvent.change(textarea, { target: { value: '你好' } });
    await act(async () => { vi.advanceTimersByTime(250); });
    // Try to commit via Enter
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onCommit).not.toHaveBeenCalled();
  });
});
