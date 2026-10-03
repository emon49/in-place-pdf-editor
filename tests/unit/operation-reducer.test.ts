import { describe, expect, it } from 'vitest';
import { applyOperations } from '../../src/lib/operation-reducer';
import type { TextLine } from '../../src/types/page-model';
import type {
  EditOperation,
  ObjectDeleteOp,
  RevertOp,
  TextAddOp,
  TextReplaceOp,
  TextStyle,
  TextStyleChangeOp,
} from '../../src/types/operations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0;
function makeReplace(objectId: string, newText: string): TextReplaceOp {
  return { id: `op-${++_seq}`, ts: _seq, pageIndex: 0, type: 'TEXT_REPLACE', objectId, newText };
}
function makeStyleChange(objectId: string, style: Partial<TextStyle>): TextStyleChangeOp {
  return { id: `op-${++_seq}`, ts: _seq, pageIndex: 0, type: 'TEXT_STYLE_CHANGE', objectId, style };
}
function makeDelete(objectId: string): ObjectDeleteOp {
  return { id: `op-${++_seq}`, ts: _seq, pageIndex: 0, type: 'OBJECT_DELETE', objectId };
}
function makeAdd(objectId: string, text: string, style: TextStyle): TextAddOp {
  return {
    id: `op-${++_seq}`, ts: _seq, pageIndex: 0, type: 'TEXT_ADD',
    objectId, text, at: { x: 50, y: 100 }, style,
  };
}
function makeRevert(targetOpIds: string[]): RevertOp {
  return { id: `op-${++_seq}`, ts: _seq, pageIndex: 0, type: 'REVERT', targetOpIds };
}

function makeLine(id: string, text: string): TextLine {
  return {
    id,
    pageIndex: 0,
    text,
    origin: { x: 0, y: 0 },
    box: { x: 0, y: 0, width: 100, height: 12 },
    matrix: [1, 0, 0, 1, 0, 0],
    fontRef: 'font1',
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
      subtype: null,
      embedding: null,
      licence: null,
      encoding: null,
      coverage: null,
    },
  };
}

const style: TextStyle = {
  fontClass: 'sans', bold: false, italic: false, fontFamilyOverride: null,
  size: 12, color: '#000000', charSpacing: 0, wordSpacing: 0,
  lineHeight: 1.2, hScale: 100, rise: 0, renderMode: 0,
};

const lines: TextLine[] = [makeLine('0:1', 'Hello'), makeLine('0:2', 'World')];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('applyOperations', () => {
  it('returns PreviewLines mirroring originals when no ops', () => {
    const result = applyOperations(lines, [], 0);
    expect(result).toHaveLength(2);
    expect(result.at(0)?.currentText).toBe('Hello');
    expect(result.at(1)?.currentText).toBe('World');
    expect(result.at(0)?.deleted).toBe(false);
  });

  it('TEXT_REPLACE changes currentText', () => {
    const ops: EditOperation[] = [makeReplace('0:1', 'Hi')];
    const result = applyOperations(lines, ops, ops.length);
    expect(result.at(0)?.currentText).toBe('Hi');
    expect(result.at(1)?.currentText).toBe('World');
  });

  it('TEXT_STYLE_CHANGE merges style', () => {
    const ops: EditOperation[] = [makeStyleChange('0:1', { bold: true, size: 18 })];
    const result = applyOperations(lines, ops, ops.length);
    expect(result.at(0)?.currentStyle.bold).toBe(true);
    expect(result.at(0)?.currentStyle.size).toBe(18);
    expect(result.at(0)?.currentStyle.italic).toBe(false);
  });

  it('TEXT_STYLE_CHANGE family override updates fontFamilyOverride in currentStyle', () => {
    const ops: EditOperation[] = [makeStyleChange('0:1', { fontFamilyOverride: 'Carlito' })];
    const result = applyOperations(lines, ops, ops.length);
    expect(result.at(0)?.currentStyle.fontFamilyOverride).toBe('Carlito');
    // Base style preserved except override
    expect(result.at(0)?.currentStyle.size).toBe(12);
  });

  it('multiple TEXT_STYLE_CHANGE ops stack correctly (each is a separate operation)', () => {
    const op1 = makeStyleChange('0:1', { size: 14 });
    const op2 = makeStyleChange('0:1', { bold: true });
    const ops: EditOperation[] = [op1, op2];
    // Both at cursor 2
    const result = applyOperations(lines, ops, 2);
    expect(result.at(0)?.currentStyle.size).toBe(14);
    expect(result.at(0)?.currentStyle.bold).toBe(true);
    // Cursor 1: only first op applied
    const partial = applyOperations(lines, ops, 1);
    expect(partial.at(0)?.currentStyle.size).toBe(14);
    expect(partial.at(0)?.currentStyle.bold).toBe(false);
  });

  it('OBJECT_DELETE marks deleted', () => {
    const ops: EditOperation[] = [makeDelete('0:2')];
    const result = applyOperations(lines, ops, ops.length);
    expect(result.at(1)?.deleted).toBe(true);
    expect(result.at(0)?.deleted).toBe(false);
  });

  it('TEXT_ADD appends a new line', () => {
    const ops: EditOperation[] = [makeAdd('new-1', 'Added', style)];
    const result = applyOperations(lines, ops, ops.length);
    expect(result).toHaveLength(3);
    expect(result.at(2)?.id).toBe('new-1');
    expect(result.at(2)?.currentText).toBe('Added');
  });

  it('REVERT cancels a single operation', () => {
    const replace = makeReplace('0:1', 'Changed');
    const ops: EditOperation[] = [replace, makeRevert([replace.id])];
    const result = applyOperations(lines, ops, ops.length);
    expect(result.at(0)?.currentText).toBe('Hello');
  });

  it('REVERT cancels multiple operations', () => {
    const op1 = makeReplace('0:1', 'A');
    const op2 = makeReplace('0:2', 'B');
    const ops: EditOperation[] = [op1, op2, makeRevert([op1.id, op2.id])];
    const result = applyOperations(lines, ops, ops.length);
    expect(result.at(0)?.currentText).toBe('Hello');
    expect(result.at(1)?.currentText).toBe('World');
  });

  it('REVERT-of-REVERT re-activates the original edit', () => {
    const replace = makeReplace('0:1', 'Changed');
    const revert1 = makeRevert([replace.id]);
    const revert2 = makeRevert([revert1.id]);
    const ops: EditOperation[] = [replace, revert1, revert2];
    const result = applyOperations(lines, ops, ops.length);
    // revert1 is itself reverted, so replace is active again
    expect(result.at(0)?.currentText).toBe('Changed');
  });

  it('cursor truncation: ops past cursor are ignored', () => {
    const op1 = makeReplace('0:1', 'A');
    const op2 = makeReplace('0:1', 'B');
    const ops: EditOperation[] = [op1, op2];
    const result = applyOperations(lines, ops, 1);
    expect(result.at(0)?.currentText).toBe('A');
  });

  it('no-op on empty log', () => {
    const result = applyOperations(lines, [], 0);
    expect(result.at(0)?.currentText).toBe('Hello');
    expect(result.at(0)?.deleted).toBe(false);
  });

  it('is deterministic: same input gives same output', () => {
    const ops: EditOperation[] = [makeReplace('0:1', 'X')];
    const r1 = applyOperations(lines, ops, ops.length);
    const r2 = applyOperations(lines, ops, ops.length);
    expect(r1.at(0)?.currentText).toBe(r2.at(0)?.currentText);
  });
});
