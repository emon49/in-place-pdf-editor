import { describe, expect, it } from 'vitest';
import { createOperation } from '../../src/lib/create-operation';
import type { TextReplaceOp } from '../../src/types/operations';

describe('createOperation', () => {
  it('assigns unique ids', () => {
    const a = createOperation<TextReplaceOp>({
      type: 'TEXT_REPLACE',
      pageIndex: 0,
      objectId: 'line-1',
      newText: 'A',
    });
    const b = createOperation<TextReplaceOp>({
      type: 'TEXT_REPLACE',
      pageIndex: 0,
      objectId: 'line-1',
      newText: 'B',
    });
    expect(a.id).not.toBe(b.id);
  });

  it('assigns monotonically non-decreasing timestamps', () => {
    const ops = Array.from({ length: 20 }, () =>
      createOperation<TextReplaceOp>({
        type: 'TEXT_REPLACE',
        pageIndex: 0,
        objectId: 'line-1',
        newText: 'x',
      }),
    );
    for (let i = 1; i < ops.length; i++) {
      expect(ops.at(i)?.ts).toBeGreaterThanOrEqual(ops.at(i - 1)?.ts ?? 0);
    }
  });

  it('preserves the payload fields', () => {
    const op = createOperation<TextReplaceOp>({
      type: 'TEXT_REPLACE',
      pageIndex: 2,
      objectId: 'obj-1',
      newText: 'hello',
    });
    expect(op.type).toBe('TEXT_REPLACE');
    expect(op.pageIndex).toBe(2);
    expect(op.objectId).toBe('obj-1');
    expect(op.newText).toBe('hello');
  });
});
