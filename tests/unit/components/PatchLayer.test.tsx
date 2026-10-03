// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PatchLayer } from '../../../src/components/PatchLayer';
import { createPageGeometry } from '../../../src/lib/coordinates';
import type { LayoutLine, PreviewLine } from '../../../src/types/operations';
import type { TextLine } from '../../../src/types/page-model';

afterEach(cleanup);

const GEO = createPageGeometry([0, 0, 612, 792], 0);

const BASE_STYLE = {
  fontClass: 'sans' as const,
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
};

function baseLine(id: string, text: string): TextLine {
  return {
    id,
    pageIndex: 0,
    text,
    origin: { x: 0, y: 0 },
    box: { x: 72, y: 600, width: 200, height: 14 },
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
    background: { status: 'ready', color: '#ffffff', uniform: true, ratio: 1 },
    lockReason: null,
    font: { rawName: 'Helvetica', subtype: null, embedding: null, licence: null, encoding: null, coverage: null },
  } as TextLine;
}

function preview(id: string, text: string, patchLayout: LayoutLine[] | null, deleted = false): PreviewLine {
  return {
    ...baseLine(id, text),
    currentText: text,
    currentStyle: BASE_STYLE,
    deleted,
    patchLayout,
    resolvedFont: null,
  };
}

const singleLayout: LayoutLine[] = [{ text: 'New text', x: 72, y: 600, width: 80 }];
const multiLayout: LayoutLine[] = [
  { text: 'First line', x: 72, y: 600, width: 80 },
  { text: 'Second line', x: 72, y: 585, width: 90 },
];

describe('PatchLayer (8.2)', () => {
  it('renders patch with new text', () => {
    const lines = [preview('0:0', 'New text', singleLayout)];
    render(<PatchLayer lines={lines} geometry={GEO} zoom={1} />);
    const patches = screen.getAllByTestId('patch');
    expect(patches).toHaveLength(1);
    expect(patches[0]?.dataset.lineId).toBe('0:0');
    expect(screen.getByText('New text')).toBeTruthy();
  });

  it('renders two patch-line spans for a two-line layout', () => {
    const lines = [preview('0:1', 'Wrapped text', multiLayout)];
    render(<PatchLayer lines={lines} geometry={GEO} zoom={1} />);
    const patchLines = screen.getAllByTestId('patch-line');
    expect(patchLines).toHaveLength(2);
    expect(patchLines[0]?.textContent).toBe('First line');
    expect(patchLines[1]?.textContent).toBe('Second line');
  });

  it('does not render a patch for deleted lines', () => {
    const lines = [preview('0:2', 'Gone', singleLayout, true)];
    render(<PatchLayer lines={lines} geometry={GEO} zoom={1} />);
    expect(screen.queryByTestId('patch')).toBeNull();
  });

  it('does not render a patch when patchLayout is null', () => {
    const lines = [preview('0:3', 'Unchanged', null)];
    render(<PatchLayer lines={lines} geometry={GEO} zoom={1} />);
    expect(screen.queryByTestId('patch')).toBeNull();
  });

  it('uses the resolved font CSS family when available', () => {
    const line: PreviewLine = {
      ...preview('0:4', 'Patched', singleLayout),
      resolvedFont: { tier: 2, source: 'catalog', cssFamily: 'Roboto', reason: 'catalog' },
    };
    render(<PatchLayer lines={[line]} geometry={GEO} zoom={1} />);
    const span = screen.getByTestId('patch-line');
    expect(span.style.fontFamily).toContain('Roboto');
  });

  it('shows overlap hint when patch intersects another object, absent when no overlap (TE-6)', () => {
    // Patch at x=72, y=600 width=80 (singleLayout); another line at x=100, y=600 overlaps
    const patchedLine = preview('0:5', 'Long text overlapping', singleLayout);
    const nearbyLine = preview('0:6', 'Other text', null);
    // box for nearby line overlaps: x=100, y=594 (box height 14, so covers y=594..608)
    (nearbyLine as PreviewLine & { box: { x: number; y: number; width: number; height: number } }).box = { x: 100, y: 594, width: 120, height: 14 };
    render(<PatchLayer lines={[patchedLine, nearbyLine]} geometry={GEO} zoom={1} />);
    expect(screen.getByTestId('overlap-hint')).toBeTruthy();

    cleanup();
    // Patch far from other line — no overlap hint
    const farLine = preview('0:7', 'Far text', null);
    (farLine as PreviewLine & { box: { x: number; y: number; width: number; height: number } }).box = { x: 300, y: 400, width: 120, height: 14 };
    render(<PatchLayer lines={[patchedLine, farLine]} geometry={GEO} zoom={1} />);
    expect(screen.queryByTestId('overlap-hint')).toBeNull();
  });
});
