import { Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LOCK_MESSAGES } from '../lib/object-labels';
import { scrollTopToReveal, visibleRange } from '../lib/virtual-window';
import type { PageModelStatus, TextLine } from '../types/page-model';

export interface TextObjectsTabProps {
  status: PageModelStatus;
  lines: readonly TextLine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Lists longer than this render only the rows near the viewport. */
export const VIRTUALIZE_ABOVE = 200;
export const ROW_HEIGHT = 44;
/** Used before the list is measured (and in environments without layout). */
const FALLBACK_VIEWPORT = 480;

const describeFont = (line: TextLine) =>
  `${line.family}${line.bold ? ' Bold' : ''}${line.italic ? ' Italic' : ''}, ${Math.round(line.fontSize * 10) / 10} pt`;

/** Left-sidebar tab listing the active page's Text Lines in reading order (PRD §7.2). */
export function TextObjectsTab({ status, lines, selectedId, onSelect }: TextObjectsTabProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_VIEWPORT);
  const virtual = lines.length > VIRTUALIZE_ABOVE;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.clientHeight > 0) setViewportHeight(el.clientHeight);
  }, [lines.length, status]);

  // A selection made on the page is revealed in the list.
  useEffect(() => {
    const el = scrollRef.current;
    const index = lines.findIndex((l) => l.id === selectedId);
    if (!el || index < 0) return;
    const height = el.clientHeight || viewportHeight;
    const next = scrollTopToReveal(index, ROW_HEIGHT, el.scrollTop, height);
    if (next !== el.scrollTop) {
      el.scrollTop = next;
      setScrollTop(next);
    }
    // Only a change of selection should move the list, not user scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, lines]);

  if (status === 'failed') return <p role="alert" className="p-3 text-sm text-red-700">Text could not be detected on this page.</p>;
  if (status !== 'ready') {
    return (
      <p role="status" className="p-3 text-sm text-slate-600">
        Detecting text on this page…
      </p>
    );
  }
  if (lines.length === 0) return <p className="p-3 text-sm text-slate-600">No text was found on this page.</p>;

  const range = virtual
    ? visibleRange({ count: lines.length, rowHeight: ROW_HEIGHT, scrollTop, viewportHeight })
    : { start: 0, end: lines.length, offsetTop: 0, totalHeight: lines.length * ROW_HEIGHT };

  return (
    <div
      ref={scrollRef}
      data-testid="text-objects-list"
      className="min-h-0 flex-1 overflow-y-auto"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <ul aria-label={`${lines.length} text objects`} className="relative" style={{ height: range.totalHeight }}>
        {lines.slice(range.start, range.end).map((line, i) => {
          const selected = line.id === selectedId;
          return (
            <li key={line.id} className="absolute inset-x-0" style={{ top: (range.start + i) * ROW_HEIGHT, height: ROW_HEIGHT }}>
              <button
                type="button"
                data-testid="text-row"
                data-line-id={line.id}
                aria-pressed={selected}
                onClick={() => onSelect(line.id)}
                className={`flex size-full items-center gap-2 border-b border-slate-100 px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                  selected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                }`}
              >
                <span
                  role="img"
                  aria-label={`Colour ${line.color.hex}${line.color.source === 'exact' ? '' : ' (approximate)'}`}
                  className={`size-4 shrink-0 rounded-sm border ${line.color.source === 'exact' ? 'border-slate-300' : 'border-dashed border-slate-500'}`}
                  style={{ backgroundColor: line.color.hex }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{line.text}</span>
                  <span className="block truncate text-xs text-slate-500">{describeFont(line)}</span>
                </span>
                {line.lockReason && (
                  <span title={LOCK_MESSAGES[line.lockReason]} className="flex shrink-0 items-center gap-1 text-xs text-amber-700">
                    <Lock aria-hidden="true" className="size-3" />
                    Locked
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
