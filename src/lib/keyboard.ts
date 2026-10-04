export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

export interface NudgeAction {
  readonly direction: NudgeDirection;
  readonly large: boolean;
}

/**
 * Returns a nudge action when an arrow key is pressed while an object is selected
 * and no text input has focus. Returns null otherwise.
 */
export function nudgeKeyAction(e: KeyLike): NudgeAction | null {
  if (e.altKey || e.ctrlKey || e.metaKey || isTextInput(e.target)) return null;
  const large = e.shiftKey ?? false;
  switch (e.key) {
    case 'ArrowUp': return { direction: 'up', large };
    case 'ArrowDown': return { direction: 'down', large };
    case 'ArrowLeft': return { direction: 'left', large };
    case 'ArrowRight': return { direction: 'right', large };
    default: return null;
  }
}

/** Viewer keyboard shortcuts (page-viewer spec). Pure so they can be unit-tested. */
export type ViewerKeyAction =
  | 'nextPage'
  | 'prevPage'
  | 'firstPage'
  | 'lastPage'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom'
  | 'undo'
  | 'redo';

export interface KeyLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey?: boolean;
  /** The element that has focus when the key is pressed. */
  readonly target: EventTarget | null;
  /** True when focus is inside the page viewer (zoom shortcuts apply only there). */
  readonly inViewer: boolean;
}

const TEXT_INPUT_TYPES = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password']);

export function isTextInput(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; type?: string; isContentEditable?: boolean };
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && TEXT_INPUT_TYPES.has((el.type ?? 'text').toLowerCase());
}

export function viewerKeyAction(e: KeyLike): ViewerKeyAction | null {
  if (e.altKey || isTextInput(e.target)) return null;
  const mod = e.ctrlKey || e.metaKey;
  if (mod) {
    // Undo/redo are global (no inViewer gate).
    if (e.key === 'z' || e.key === 'Z') {
      if (e.shiftKey ?? false) return 'redo';
      return 'undo';
    }
    if (e.key === 'y' || e.key === 'Y') return 'redo';
    if (!e.inViewer) return null;
    if (e.key === '=' || e.key === '+') return 'zoomIn';
    if (e.key === '-' || e.key === '_') return 'zoomOut';
    if (e.key === '0') return 'resetZoom';
    return null;
  }
  switch (e.key) {
    case 'PageDown':
      return 'nextPage';
    case 'PageUp':
      return 'prevPage';
    case 'Home':
      return 'firstPage';
    case 'End':
      return 'lastPage';
    default:
      return null;
  }
}
