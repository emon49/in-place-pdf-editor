import type { EditOperation } from '../types/operations';

function opObjectId(op: EditOperation): string | null {
  if (op.type === 'REVERT') return null;
  return op.objectId;
}

export interface HistoryTabProps {
  ops: readonly EditOperation[];
  cursor: number;
  onRevert: (opId: string) => void;
  selectedObjectId?: string | null;
  onSelectObject?: (objectId: string | null) => void;
}

function opSummary(op: EditOperation): string {
  switch (op.type) {
    case 'TEXT_REPLACE': return `Replaced text on object ${op.objectId}`;
    case 'TEXT_STYLE_CHANGE': return `Style change on object ${op.objectId}`;
    case 'TEXT_ADD': return `Added text "${op.text.slice(0, 30)}${op.text.length > 30 ? '…' : ''}"`;
    case 'OBJECT_DELETE': return `Deleted object ${op.objectId}`;
    case 'REVERT': return `Reverted ${op.targetOpIds.length} operation${op.targetOpIds.length > 1 ? 's' : ''}`;
  }
}

function opIcon(op: EditOperation): string {
  switch (op.type) {
    case 'TEXT_REPLACE': return '✏️';
    case 'TEXT_STYLE_CHANGE': return '🎨';
    case 'TEXT_ADD': return '➕';
    case 'OBJECT_DELETE': return '🗑️';
    case 'REVERT': return '↩️';
  }
}

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** Returns the set of op IDs that have been reverted by active REVERT ops. */
function revertedIds(ops: readonly EditOperation[], cursor: number): Set<string> {
  const reverted = new Set<string>();
  for (let i = 0; i < cursor; i++) {
    const op = ops[i];
    if (!op) continue;
    if (op.type === 'REVERT') {
      for (const id of op.targetOpIds) reverted.add(id);
    }
  }
  // A REVERT op that is itself reverted un-reverts its targets
  for (let i = 0; i < cursor; i++) {
    const op = ops[i];
    if (!op) continue;
    if (op.type === 'REVERT') {
      for (const id of op.targetOpIds) {
        const target = ops.slice(0, cursor).find((o) => o.id === id);
        if (target?.type === 'REVERT') {
          for (const tid of target.targetOpIds) reverted.delete(tid);
          reverted.delete(id);
        }
      }
    }
  }
  return reverted;
}

/** History tab showing the operation log in reverse chronological order. */
export function HistoryTab({ ops, cursor, onRevert, selectedObjectId, onSelectObject }: HistoryTabProps) {
  const activeOps = ops.slice(0, cursor);

  if (activeOps.length === 0) {
    return (
      <p data-testid="history-empty" className="px-4 py-8 text-center text-sm text-slate-400">
        No edits yet. Edit text on the page to see your history here.
      </p>
    );
  }

  const reverted = revertedIds(ops, cursor);

  return (
    <ol role="listbox" aria-label="Edit history" data-testid="history-list" className="flex flex-col divide-y divide-slate-100">
      {[...activeOps].reverse().map((op) => {
        const isReverted = reverted.has(op.id);
        const objectId = opObjectId(op);
        const isSelected = objectId !== null && objectId === selectedObjectId;
        const handleSelect = () => { if (objectId) onSelectObject?.(objectId); };
        return (
          <li
            key={op.id}
            role="option"
            tabIndex={0}
            data-testid="history-entry"
            data-op-id={op.id}
            data-op-type={op.type}
            aria-selected={isSelected}
            onClick={handleSelect}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(); } }}
            className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${isReverted ? 'opacity-40' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-base">{opIcon(op)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-slate-700">{opSummary(op)}</p>
              <p className="text-xs text-slate-400">{relativeTime(op.ts)}</p>
            </div>
            {isReverted && (
              <span data-testid="reverted-badge" className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                Reverted
              </span>
            )}
            {!isReverted && op.type !== 'REVERT' && (
              <button
                type="button"
                data-testid="revert-button"
                onClick={() => onRevert(op.id)}
                className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                aria-label={`Revert: ${opSummary(op)}`}
              >
                Revert
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
