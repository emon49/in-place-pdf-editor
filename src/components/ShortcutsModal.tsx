import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ShortcutRow {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  category: string;
  shortcuts: ShortcutRow[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'File',
    shortcuts: [
      { keys: 'Ctrl+S / Cmd+S', description: 'Export PDF' },
    ],
  },
  {
    category: 'Edit',
    shortcuts: [
      { keys: 'Ctrl+Z / Cmd+Z', description: 'Undo' },
      { keys: 'Ctrl+Y / Ctrl+Shift+Z', description: 'Redo' },
      { keys: 'Delete / Backspace', description: 'Delete selected object' },
      { keys: 'Enter', description: 'Commit text edit' },
      { keys: 'Shift+Enter', description: 'Insert newline in editor' },
      { keys: 'Esc', description: 'Cancel edit / Deselect' },
    ],
  },
  {
    category: 'Navigation',
    shortcuts: [
      { keys: 'PageDown', description: 'Next page' },
      { keys: 'PageUp', description: 'Previous page' },
      { keys: 'Home', description: 'First page' },
      { keys: 'End', description: 'Last page' },
    ],
  },
  {
    category: 'View',
    shortcuts: [
      { keys: 'Ctrl+= / Cmd+=', description: 'Zoom in' },
      { keys: 'Ctrl+- / Cmd+-', description: 'Zoom out' },
      { keys: 'Ctrl+0 / Cmd+0', description: 'Reset zoom' },
      { keys: 'Ctrl+? / Cmd+?', description: 'Show keyboard shortcuts' },
    ],
  },
  {
    category: 'Object',
    shortcuts: [
      { keys: 'Arrow keys', description: 'Nudge selected object (1 pt)' },
      { keys: 'Shift+Arrow', description: 'Nudge selected object (10 pt)' },
    ],
  },
];

export interface ShortcutsModalProps {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save and restore focus
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Trap focus inside the modal
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter(
        (el) => !el.hasAttribute('disabled'),
      );
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => dialog.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        data-testid="shortcuts-modal"
        className="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 id="shortcuts-modal-title" className="text-lg font-semibold text-slate-800">
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close keyboard shortcuts"
            data-testid="shortcuts-modal-close"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="px-6 py-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.category} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group.category}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  {group.shortcuts.map((s) => (
                    <tr key={s.keys} className="border-t border-slate-100 first:border-0">
                      <td className="py-1.5 pr-4">
                        <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                          {s.keys}
                        </kbd>
                      </td>
                      <td className="py-1.5 text-slate-600">{s.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
