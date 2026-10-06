// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MaskLayer } from '../../../src/components/MaskLayer';
import { createPageGeometry } from '../../../src/lib/coordinates';
import type { PreviewLine } from '../../../src/types/operations';
import type { TextLine } from '../../../src/types/page-model';

afterEach(cleanup);

const GEO = createPageGeometry([0, 0, 612, 792], 0);

function baseLine(id: string, text: string): TextLine {
  return {
    id,
    pageIndex: 0,
    text,
    origin: { x: 0, y: 0 },
    box: { x: 72, y: 600, width: 120, height: 14 },
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

function preview(id: string, text: string, currentText: string, deleted = false): PreviewLine {
  return {
    ...baseLine(id, text),
    currentBox: baseLine(id, text).box,
    currentText,
    currentStyle: { fontClass: 'sans', bold: false, italic: false, fontFamilyOverride: null, size: 12, color: '#000000', charSpacing: 0, wordSpacing: 0, lineHeight: 1.2, hScale: 100, rise: 0, renderMode: 0 },
    deleted,
    patchLayout: null,
    resolvedFont: null,
  };
}

describe('MaskLayer (8.1)', () => {
  it('renders a mask for an edited line (currentText differs from text)', () => {
    const lines = [preview('0:0', 'Original', 'Updated')];
    render(<MaskLayer lines={lines} geometry={GEO} zoom={1} />);
    const masks = screen.getAllByTestId('mask');
    expect(masks).toHaveLength(1);
    expect(masks[0]?.dataset.lineId).toBe('0:0');
  });

  it('renders a mask for a deleted line', () => {
    const lines = [preview('0:1', 'DRAFT', 'DRAFT', true)];
    render(<MaskLayer lines={lines} geometry={GEO} zoom={1} />);
    const masks = screen.getAllByTestId('mask');
    expect(masks).toHaveLength(1);
    expect(masks[0]?.dataset.lineId).toBe('0:1');
  });

  it('does not render a mask for an unedited line', () => {
    const lines = [preview('0:2', 'Unchanged', 'Unchanged')];
    render(<MaskLayer lines={lines} geometry={GEO} zoom={1} />);
    expect(screen.queryByTestId('mask')).toBeNull();
  });

  it('does not render a mask for added text (id starts with add-)', () => {
    const lines = [preview('add-abc123', 'New text', 'New text', false)];
    render(<MaskLayer lines={lines} geometry={GEO} zoom={1} />);
    expect(screen.queryByTestId('mask')).toBeNull();
  });

  it('uses sampled background color when available, falls back to white', () => {
    const withColor = preview('0:3', 'A', 'B');
    (withColor as PreviewLine & { background: { status: string; color: string } }).background = { status: 'ready', color: '#f0f0f0', uniform: true, ratio: 1 } as never;
    const noColor = { ...preview('0:4', 'C', 'D'), background: { status: 'pending' } } as PreviewLine;
    render(<MaskLayer lines={[withColor, noColor]} geometry={GEO} zoom={1} />);
    const masks = screen.getAllByTestId('mask');
    expect(masks[0]?.style.backgroundColor).toBe('rgb(240, 240, 240)');
    expect(masks[1]?.style.backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('positions the mask at the correct screen coordinates', () => {
    const lines = [preview('0:5', 'Text', 'Updated')];
    render(<MaskLayer lines={lines} geometry={GEO} zoom={2} />);
    const mask = screen.getByTestId('mask');
    // box: { x:72, y:600, w:120, h:14 } at zoom=2 on a 792-tall page
    // displayRect: y = 792 - 600 - 14 = 178; screenRect at zoom=2: top=356
    expect(parseFloat(mask.style.top)).toBeCloseTo(356, 0);
    expect(parseFloat(mask.style.left)).toBeCloseTo(144, 0);
  });
});
