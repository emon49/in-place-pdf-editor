import { Lock } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { pageRectToDisplay, displayRectToScreen, type PageGeometry } from '../lib/coordinates';
import { LOCK_MESSAGES, MASK_WARNING, hasNonUniformBackground, lineLabel } from '../lib/object-labels';
import type { TextLine } from '../types/page-model';

export interface TextOverlayProps {
  lines: readonly TextLine[];
  geometry: PageGeometry;
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Keyboard stepping through reading order (Tab / Shift+Tab). */
  onStep: (direction: 1 | -1) => void;
}

const CORNERS = ['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'];

/**
 * Layer 2: one clickable box per Text Line, positioned through `coordinates.ts` (VW-2, VW-3, VW-8, VW-9).
 * Boxes are real buttons so focus, keyboard operation and announcement come from the platform (design D10).
 * The container ignores the pointer so clicks on empty page space reach the viewer and clear the selection.
 */
export function TextOverlay({ lines, geometry, zoom, selectedId, onSelect, onStep }: TextOverlayProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const selected = lines.find((l) => l.id === selectedId) ?? null;

  // Selection from elsewhere (the sidebar list, the keyboard) is scrolled into view; keyboard focus follows it.
  useEffect(() => {
    const button = selectedId ? refs.current.get(selectedId) : undefined;
    if (!button) return;
    button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (button.parentElement?.contains(document.activeElement) && document.activeElement !== button) button.focus({ preventScroll: true });
  }, [selectedId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && selectedId) {
      event.preventDefault();
      onSelect(null);
    } else if (event.key === 'Tab') {
      // Step through reading order; leave the overlay (default Tab) only past either end.
      const at = lines.findIndex((l) => l.id === selectedId);
      const next = at + (event.shiftKey ? -1 : 1);
      if (next >= 0 && next < lines.length) {
        event.preventDefault();
        onStep(event.shiftKey ? -1 : 1);
      }
    }
  };

  const activeId = selectedId ?? lines[0]?.id ?? null;

  return (
    // The container only forwards key events from the boxes it holds; it is not itself interactive.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      data-testid="text-overlay"
      data-sampled={lines.every((l) => l.background.status === 'ready')}
      className="pointer-events-none absolute inset-0"
      onKeyDown={onKeyDown}
    >
      {lines.map((line) => {
        const rect = displayRectToScreen(pageRectToDisplay(geometry, line.box), zoom);
        const isSelected = line.id === selectedId;
        const locked = line.lockReason !== null;
        const tooltipId = `tip-${line.id.replace(':', '-')}`;
        return (
          <button
            key={line.id}
            ref={(el) => {
              if (el) refs.current.set(line.id, el);
              else refs.current.delete(line.id);
            }}
            type="button"
            data-testid="text-box"
            data-line-id={line.id}
            data-locked={locked || undefined}
            aria-label={lineLabel(line)}
            aria-pressed={isSelected}
            aria-describedby={locked ? tooltipId : undefined}
            tabIndex={line.id === activeId ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(line.id);
            }}
            onFocus={() => {
              if (!isSelected) onSelect(line.id);
            }}
            className={`group pointer-events-auto absolute cursor-pointer rounded-[1px] outline-none transition-colors ${
              isSelected
                ? 'bg-blue-500/10 ring-2 ring-blue-600'
                : locked
                  ? 'outline-1 outline-dashed outline-amber-500 hover:bg-amber-400/20'
                  : 'hover:bg-blue-400/20 hover:outline-1 hover:outline-blue-400'
            } focus-visible:ring-2 focus-visible:ring-blue-700`}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          >
            {isSelected &&
              CORNERS.map((corner) => (
                <span key={corner} aria-hidden="true" className={`absolute size-2 border border-blue-600 bg-white ${corner}`} />
              ))}
            {locked && line.lockReason && (
              <>
                <Lock aria-hidden="true" className="absolute -right-1 -top-3 size-3 text-amber-600" />
                <span
                  id={tooltipId}
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-max max-w-64 rounded-md bg-slate-900 px-2 py-1 text-left text-xs font-normal text-white shadow-lg group-hover:block group-focus-visible:block"
                >
                  {LOCK_MESSAGES[line.lockReason]}
                </span>
              </>
            )}
          </button>
        );
      })}
      {selected && hasNonUniformBackground(selected) && (
        <WarningNote line={selected} geometry={geometry} zoom={zoom} />
      )}
      <p role="status" className="sr-only">
        {selected ? `Selected: ${lineLabel(selected)}` : ''}
      </p>
    </div>
  );
}

function WarningNote({ line, geometry, zoom }: { line: TextLine; geometry: PageGeometry; zoom: number }) {
  const rect = displayRectToScreen(pageRectToDisplay(geometry, line.box), zoom);
  return (
    <p
      role="note"
      data-testid="mask-warning"
      className="pointer-events-none absolute z-10 w-max max-w-72 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 shadow"
      style={{ left: rect.x, top: rect.y + rect.height + 6 }}
    >
      {MASK_WARNING}
    </p>
  );
}
