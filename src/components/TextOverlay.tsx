import { Lock, Move } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  displayRectToScreen,
  pageRectToDisplay,
  screenToPage,
  type PageGeometry,
  type Point,
  type Rect,
} from '../lib/coordinates';
import { LOCK_MESSAGES, MASK_WARNING, hasNonUniformBackground, lineLabel } from '../lib/object-labels';
import type { PreviewLine } from '../types/operations';

export interface TextOverlayProps {
  lines: readonly PreviewLine[];
  geometry: PageGeometry;
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Keyboard stepping through reading order (Tab / Shift+Tab). */
  onStep: (direction: 1 | -1) => void;
  /** Double-click on an unlocked line to start editing. */
  onDoubleClick?: (id: string) => void;
  /** Called when a drag gesture commits a move; receives the new box origin in Page Space. */
  onMove?: (id: string, to: Point) => void;
}

const CORNERS = ['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'];

const DEADBAND_PX = 2;

interface DragState {
  lineId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startBox: Rect; // currentBox at drag start, Page Space
}

/**
 * Layer 2: one clickable box per Text Line, positioned through `coordinates.ts` (VW-2, VW-3, VW-8, VW-9).
 * Boxes are real buttons so focus, keyboard operation and announcement come from the platform (design D10).
 * The container ignores the pointer so clicks on empty page space reach the viewer and clear the selection.
 */
export function TextOverlay({ lines, geometry, zoom, selectedId, onSelect, onStep, onDoubleClick, onMove }: TextOverlayProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const overlayRef = useRef<HTMLDivElement>(null);
  const selected = lines.find((l) => l.id === selectedId) ?? null;

  // Drag state: tracked per pointer interaction.
  const [drag, setDrag] = useState<DragState | null>(null);
  // Screen-pixel offset applied visually during drag.
  const [dragDeltaPx, setDragDeltaPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Blocks the next onClick after a real drag commits.
  const didDragRef = useRef(false);

  // Drag is only active when the dragged line is still selected. If selection
  // changes externally the drag becomes a no-op visually; the pointer-up
  // handler will clear it when the pointer is released.
  const activeDrag = drag !== null && drag.lineId === selectedId ? drag : null;

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
      const at = lines.findIndex((l) => l.id === selectedId);
      const next = at + (event.shiftKey ? -1 : 1);
      if (next >= 0 && next < lines.length) {
        event.preventDefault();
        onStep(event.shiftKey ? -1 : 1);
      }
    }
  };

  const activeId = selectedId ?? lines[0]?.id ?? null;

  const handlePointerDown = (line: PreviewLine, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (line.lockReason !== null || line.id !== selectedId || !onMove) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      lineId: line.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBox: line.currentBox,
    });
    setDragDeltaPx({ x: 0, y: 0 });
    didDragRef.current = false;
  };

  const handlePointerMove = (line: PreviewLine, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.lineId !== line.id || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    setDragDeltaPx({ x: dx, y: dy });
  };

  const handlePointerUp = (line: PreviewLine, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.lineId !== line.id || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    setDrag(null);
    setDragDeltaPx({ x: 0, y: 0 });

    const moved = Math.hypot(dx, dy) > DEADBAND_PX;
    if (moved && onMove) {
      didDragRef.current = true;
      // Convert start and current pointer to page space using overlay-relative coords.
      const overlayRect = overlayRef.current?.getBoundingClientRect();
      const startScreen = {
        x: drag.startClientX - (overlayRect?.left ?? 0),
        y: drag.startClientY - (overlayRect?.top ?? 0),
      };
      const endScreen = {
        x: event.clientX - (overlayRect?.left ?? 0),
        y: event.clientY - (overlayRect?.top ?? 0),
      };
      const startPage = screenToPage(geometry, startScreen, zoom);
      const endPage = screenToPage(geometry, endScreen, zoom);
      const ddx = endPage.x - startPage.x;
      const ddy = endPage.y - startPage.y;
      const newTo: Point = {
        x: drag.startBox.x + ddx,
        y: drag.startBox.y + ddy,
      };
      onMove(line.id, newTo);
    }
  };

  const handlePointerCancel = (line: PreviewLine, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.lineId !== line.id || drag.pointerId !== event.pointerId) return;
    setDrag(null);
    setDragDeltaPx({ x: 0, y: 0 });
  };

  return (
    // The container only forwards key events from the boxes it holds; it is not itself interactive.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={overlayRef}
      data-testid="text-overlay"
      data-sampled={lines.every((l) => l.background.status === 'ready')}
      className="pointer-events-none absolute inset-0"
      onKeyDown={onKeyDown}
    >
      {lines.map((line) => {
        const baseRect = displayRectToScreen(pageRectToDisplay(geometry, line.currentBox), zoom);
        const isSelected = line.id === selectedId;
        const isDragging = activeDrag?.lineId === line.id;
        const rect: { x: number; y: number; width: number; height: number } = isDragging
          ? { ...baseRect, x: baseRect.x + dragDeltaPx.x, y: baseRect.y + dragDeltaPx.y }
          : baseRect;
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
              if (didDragRef.current) { didDragRef.current = false; return; }
              onSelect(line.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (!locked && onDoubleClick) onDoubleClick(line.id);
            }}
            onFocus={() => {
              if (!isSelected) onSelect(line.id);
            }}
            onPointerDown={(e) => handlePointerDown(line, e)}
            onPointerMove={(e) => handlePointerMove(line, e)}
            onPointerUp={(e) => handlePointerUp(line, e)}
            onPointerCancel={(e) => handlePointerCancel(line, e)}
            className={`group pointer-events-auto absolute rounded-[1px] outline-none transition-colors ${
              isDragging
                ? 'cursor-grabbing bg-blue-500/20 ring-2 ring-blue-600'
                : isSelected
                  ? 'cursor-grab bg-blue-500/10 ring-2 ring-blue-600'
                  : locked
                    ? 'cursor-pointer outline-1 outline-dashed outline-amber-500 hover:bg-amber-400/20'
                    : 'cursor-pointer hover:bg-blue-400/20 hover:outline-1 hover:outline-blue-400'
            } focus-visible:ring-2 focus-visible:ring-blue-700`}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          >
            {isSelected && (
              <>
                {CORNERS.map((corner) => (
                  <span key={corner} aria-hidden="true" className={`absolute size-2 border border-blue-600 bg-white ${corner}`} />
                ))}
                {!locked && onMove && (
                  <span
                    data-testid="move-badge"
                    aria-hidden="true"
                    className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded bg-blue-600 px-1 py-0.5 text-[10px] text-white shadow"
                  >
                    <Move aria-hidden="true" className="size-2.5" />
                    Move
                  </span>
                )}
              </>
            )}
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

function WarningNote({ line, geometry, zoom }: { line: PreviewLine; geometry: PageGeometry; zoom: number }) {
  const rect = displayRectToScreen(pageRectToDisplay(geometry, line.currentBox), zoom);
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
