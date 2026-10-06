// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryTab } from '../../../src/components/HistoryTab';
import type { EditOperation } from '../../../src/types/operations';

afterEach(cleanup);

let _seq = 0;
function makeReplace(objectId: string, newText: string): EditOperation {
  return { id: `op-${++_seq}`, ts: Date.now(), pageIndex: 0, type: 'TEXT_REPLACE', objectId, newText };
}
function makeDelete(objectId: string): EditOperation {
  return { id: `op-${++_seq}`, ts: Date.now(), pageIndex: 0, type: 'OBJECT_DELETE', objectId };
}
function makeRevert(targetOpIds: string[]): EditOperation {
  return { id: `op-${++_seq}`, ts: Date.now(), pageIndex: 0, type: 'REVERT', targetOpIds };
}

describe('HistoryTab (10.1)', () => {
  it('shows empty state when no ops', () => {
    render(<HistoryTab ops={[]} cursor={0} onRevert={() => {}} />);
    expect(screen.getByTestId('history-empty')).toBeTruthy();
    expect(screen.queryByTestId('history-entry')).toBeNull();
  });

  it('lists entries newest-first', () => {
    const op1 = makeReplace('0:1', 'First');
    const op2 = makeReplace('0:2', 'Second');
    const ops = [op1, op2];
    render(<HistoryTab ops={ops} cursor={2} onRevert={() => {}} />);
    const entries = screen.getAllByTestId('history-entry');
    expect(entries).toHaveLength(2);
    // Newest (op2) first
    expect(entries[0]?.dataset.opId).toBe(op2.id);
    expect(entries[1]?.dataset.opId).toBe(op1.id);
  });

  it('only shows ops within cursor (undo truncates visible history)', () => {
    const op1 = makeReplace('0:1', 'A');
    const op2 = makeReplace('0:2', 'B');
    const ops = [op1, op2];
    render(<HistoryTab ops={ops} cursor={1} onRevert={() => {}} />);
    const entries = screen.getAllByTestId('history-entry');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.dataset.opId).toBe(op1.id);
  });

  it('revert button calls onRevert with the op id', () => {
    const onRevert = vi.fn();
    const op1 = makeReplace('0:1', 'X');
    render(<HistoryTab ops={[op1]} cursor={1} onRevert={onRevert} />);
    fireEvent.click(screen.getByTestId('revert-button'));
    expect(onRevert).toHaveBeenCalledWith(op1.id);
  });

  it('reverted entry shows Reverted badge and no revert button', () => {
    const op1 = makeReplace('0:1', 'X');
    const rev = makeRevert([op1.id]);
    const ops = [op1, rev];
    render(<HistoryTab ops={ops} cursor={2} onRevert={() => {}} />);
    const entries = screen.getAllByTestId('history-entry');
    // op1 entry should be dimmed and show "Reverted" badge
    const op1Entry = entries.find((e) => e.dataset.opId === op1.id);
    expect(op1Entry).toBeTruthy();
    expect(op1Entry?.querySelector('[data-testid="reverted-badge"]')).toBeTruthy();
    expect(op1Entry?.querySelector('[data-testid="revert-button"]')).toBeNull();
  });

  it('OBJECT_DELETE entry shows in the list', () => {
    const op = makeDelete('0:5');
    render(<HistoryTab ops={[op]} cursor={1} onRevert={() => {}} />);
    const entry = screen.getByTestId('history-entry');
    expect(entry.dataset.opType).toBe('OBJECT_DELETE');
    expect(entry.textContent).toContain('Deleted object');
  });

  it('clicking a history entry calls onSelectObject with the affected objectId (10.2)', () => {
    const onSelectObject = vi.fn();
    const op1 = makeReplace('0:1', 'X');
    render(<HistoryTab ops={[op1]} cursor={1} onRevert={() => {}} onSelectObject={onSelectObject} />);
    fireEvent.click(screen.getByTestId('history-entry'));
    expect(onSelectObject).toHaveBeenCalledWith('0:1');
  });

  it('selected object highlights its history entry (10.2)', () => {
    const op1 = makeReplace('0:1', 'X');
    const op2 = makeReplace('0:2', 'Y');
    render(<HistoryTab ops={[op1, op2]} cursor={2} onRevert={() => {}} selectedObjectId="0:1" />);
    const entries = screen.getAllByTestId('history-entry');
    // op2 is newest (index 0), op1 is index 1
    const op1Entry = entries.find((e) => e.dataset.opId === op1.id);
    const op2Entry = entries.find((e) => e.dataset.opId === op2.id);
    expect(op1Entry?.getAttribute('aria-selected')).toBe('true');
    expect(op2Entry?.getAttribute('aria-selected')).toBe('false');
  });
});
