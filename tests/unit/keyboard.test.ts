import { describe, expect, it } from 'vitest';
import { viewerKeyAction, type KeyLike } from '../../src/lib/keyboard';

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'DIV' } as unknown as EventTarget, inViewer: true, ...extra,
});

describe('viewer keyboard shortcuts', () => {
  it.each([
    ['PageDown', 'nextPage'],
    ['PageUp', 'prevPage'],
    ['Home', 'firstPage'],
    ['End', 'lastPage'],
  ])('%s → %s', (k, action) => expect(viewerKeyAction(key(k))).toBe(action));

  it('page keys also work when focus is outside the viewer', () => {
    expect(viewerKeyAction(key('PageDown', { inViewer: false }))).toBe('nextPage');
  });

  it.each([
    ['=', 'zoomIn'],
    ['+', 'zoomIn'],
    ['-', 'zoomOut'],
    ['0', 'resetZoom'],
  ])('Ctrl/Cmd + %s → %s in the viewer', (k, action) => {
    expect(viewerKeyAction(key(k, { ctrlKey: true }))).toBe(action);
    expect(viewerKeyAction(key(k, { metaKey: true }))).toBe(action);
  });

  it('zoom shortcuts are ignored outside the viewer (browser zoom keeps working)', () => {
    expect(viewerKeyAction(key('=', { ctrlKey: true, inViewer: false }))).toBeNull();
  });

  it('ignores keys while typing in a text input or textarea', () => {
    const input = { tagName: 'INPUT', type: 'text' } as unknown as EventTarget;
    const textarea = { tagName: 'TEXTAREA' } as unknown as EventTarget;
    expect(viewerKeyAction(key('PageDown', { target: input }))).toBeNull();
    expect(viewerKeyAction(key('Home', { target: textarea }))).toBeNull();
    expect(viewerKeyAction(key('=', { ctrlKey: true, target: input }))).toBeNull();
  });

  it('a focused button does not block shortcuts', () => {
    expect(viewerKeyAction(key('End', { target: { tagName: 'BUTTON' } as unknown as EventTarget }))).toBe('lastPage');
  });

  it('ignores unrelated keys and Alt combinations', () => {
    expect(viewerKeyAction(key('ArrowDown'))).toBeNull();
    expect(viewerKeyAction(key('PageDown', { altKey: true }))).toBeNull();
    expect(viewerKeyAction(key('s', { ctrlKey: true }))).toBeNull();
  });

  it('Ctrl+Z → undo (global, not gated on inViewer)', () => {
    expect(viewerKeyAction(key('z', { ctrlKey: true }))).toBe('undo');
    expect(viewerKeyAction(key('z', { ctrlKey: true, inViewer: false }))).toBe('undo');
    expect(viewerKeyAction(key('z', { metaKey: true }))).toBe('undo');
  });

  it('Ctrl+Shift+Z → redo', () => {
    expect(viewerKeyAction(key('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(viewerKeyAction(key('Z', { metaKey: true, shiftKey: true }))).toBe('redo');
  });

  it('Ctrl+Y → redo', () => {
    expect(viewerKeyAction(key('y', { ctrlKey: true }))).toBe('redo');
    expect(viewerKeyAction(key('Y', { ctrlKey: true }))).toBe('redo');
  });

  it('undo/redo are suppressed when focus is in a text input (browser native undo handles it)', () => {
    const input = { tagName: 'INPUT', type: 'text' } as unknown as EventTarget;
    expect(viewerKeyAction(key('z', { ctrlKey: true, target: input }))).toBeNull();
    expect(viewerKeyAction(key('y', { ctrlKey: true, target: input }))).toBeNull();
  });
});
