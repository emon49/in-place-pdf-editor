import { Upload } from 'lucide-react';
import { Fragment, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  displayRectToScreen,
  pageRectToDisplay,
  screenToPage,
  type PageGeometry,
  type Point,
  type Rect,
} from '../lib/coordinates';
import type { FitMode, PreviewImage } from '../types/operations';

export interface ImageLayerProps {
  images: readonly PreviewImage[];
  geometry: PageGeometry;
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called when a drag gesture commits a move; receives the new box origin in Page Space. */
  onMove?: (id: string, to: Point) => void;
  /** Called when a corner-handle drag commits a resize; receives the new bounding box in Page Space. */
  onResize?: (id: string, to: Rect) => void;
  /** Called when the user selects a replacement file via the upload control. */
  onReplace?: (id: string, file: File, fit: FitMode) => void;
}

type HandleCorner = 'tl' | 'tr' | 'bl' | 'br';

interface DragState {
  imgId: string;
  pointerId: number;
  mode: 'move' | HandleCorner;
  startClientX: number;
  startClientY: number;
  startScreenRect: Rect; // overlay-relative, pixels
  startAspect: number; // width / height in page space
}

const DEADBAND_PX = 2;

const CORNER_HANDLES: { cls: string; corner: HandleCorner; cursor: string }[] = [
  { cls: '-left-1.5 -top-1.5', corner: 'tl', cursor: 'cursor-nwse-resize' },
  { cls: '-right-1.5 -top-1.5', corner: 'tr', cursor: 'cursor-nesw-resize' },
  { cls: '-left-1.5 -bottom-1.5', corner: 'bl', cursor: 'cursor-nesw-resize' },
  { cls: '-right-1.5 -bottom-1.5', corner: 'br', cursor: 'cursor-nwse-resize' },
];

/** Compute a new screen-space rect by moving one corner by (dxPx, dyPx). */
function applyCornerDrag(
  start: Rect,
  corner: HandleCorner,
  dxPx: number,
  dyPx: number,
  shiftKey: boolean,
  aspect: number,
): Rect {
  let { x, y, width, height } = start;

  switch (corner) {
    case 'tl':
      x += dxPx; width -= dxPx;
      y += dyPx; height -= dyPx;
      if (shiftKey) {
        if (Math.abs(dxPx) >= Math.abs(dyPx)) { height = width / aspect; y = start.y + start.height - height; }
        else { width = height * aspect; x = start.x + start.width - width; }
      }
      break;
    case 'tr':
      width += dxPx;
      y += dyPx; height -= dyPx;
      if (shiftKey) {
        if (Math.abs(dxPx) >= Math.abs(dyPx)) { height = width / aspect; y = start.y + start.height - height; }
        else { width = height * aspect; }
      }
      break;
    case 'bl':
      x += dxPx; width -= dxPx;
      height += dyPx;
      if (shiftKey) {
        if (Math.abs(dxPx) >= Math.abs(dyPx)) { height = width / aspect; }
        else { width = height * aspect; x = start.x + start.width - width; }
      }
      break;
    case 'br':
      width += dxPx;
      height += dyPx;
      if (shiftKey) {
        if (Math.abs(dxPx) >= Math.abs(dyPx)) { height = width / aspect; }
        else { width = height * aspect; }
      }
      break;
  }

  return { x, y, width: Math.max(width, 4), height: Math.max(height, 4) };
}

/** Convert a screen-space (overlay-relative) rect to Page Space. */
function screenRectToPage(geometry: PageGeometry, zoom: number, screenRect: Rect): Rect {
  const tl = screenToPage(geometry, { x: screenRect.x, y: screenRect.y }, zoom);
  const br = screenToPage(geometry, { x: screenRect.x + screenRect.width, y: screenRect.y + screenRect.height }, zoom);
  return {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
  };
}

/**
 * Layer 3: one interactive box per Image Object in the active page (IM-3, VW-2).
 * Positioned in the same coordinate space as TextOverlay (Layer 2).
 * Supports selection, drag-to-move (MV-3), corner-handle resize (MV-7), and image replacement (IM-2).
 */
export function ImageLayer({ images, geometry, zoom, selectedId, onSelect, onMove, onResize, onReplace }: ImageLayerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragDeltaPx, setDragDeltaPx] = useState({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  const activeDrag = drag !== null && drag.imgId === selectedId ? drag : null;

  const getScreenRect = (img: PreviewImage): Rect =>
    displayRectToScreen(pageRectToDisplay(geometry, img.currentBox), zoom);

  const getVisualRect = (img: PreviewImage): Rect => {
    const base = getScreenRect(img);
    if (!activeDrag || activeDrag.imgId !== img.id) return base;
    if (activeDrag.mode === 'move') {
      return { ...base, x: base.x + dragDeltaPx.x, y: base.y + dragDeltaPx.y };
    }
    return applyCornerDrag(activeDrag.startScreenRect, activeDrag.mode, dragDeltaPx.x, dragDeltaPx.y, false, activeDrag.startAspect);
  };

  const startDrag = (imgId: string, mode: DragState['mode'], img: PreviewImage, event: ReactPointerEvent<HTMLElement>) => {
    setDrag({
      imgId,
      pointerId: event.pointerId,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScreenRect: getScreenRect(img),
      startAspect: img.currentBox.width / img.currentBox.height,
    });
    setDragDeltaPx({ x: 0, y: 0 });
    didDragRef.current = false;
  };

  const handleBodyPointerDown = (img: PreviewImage, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (img.id !== selectedId || !onMove) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startDrag(img.id, 'move', img, event);
  };

  const handleCornerPointerDown = (img: PreviewImage, corner: HandleCorner, event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!onResize) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    startDrag(img.id, corner, img, event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDragDeltaPx({ x: event.clientX - drag.startClientX, y: event.clientY - drag.startClientY });
  };

  const handlePointerUp = (img: PreviewImage, event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || drag.imgId !== img.id || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    const moved = Math.hypot(dx, dy) > DEADBAND_PX;

    const savedDrag = drag;
    setDrag(null);
    setDragDeltaPx({ x: 0, y: 0 });

    if (moved) {
      didDragRef.current = true;
      const overlayRect = overlayRef.current?.getBoundingClientRect();

      if (savedDrag.mode === 'move' && onMove) {
        const startPage = screenToPage(geometry, {
          x: savedDrag.startClientX - (overlayRect?.left ?? 0),
          y: savedDrag.startClientY - (overlayRect?.top ?? 0),
        }, zoom);
        const endPage = screenToPage(geometry, {
          x: event.clientX - (overlayRect?.left ?? 0),
          y: event.clientY - (overlayRect?.top ?? 0),
        }, zoom);
        const startBox = screenRectToPage(geometry, zoom, savedDrag.startScreenRect);
        onMove(img.id, { x: startBox.x + (endPage.x - startPage.x), y: startBox.y + (endPage.y - startPage.y) });
      } else if (savedDrag.mode !== 'move' && onResize) {
        const newScreenRect = applyCornerDrag(savedDrag.startScreenRect, savedDrag.mode as HandleCorner, dx, dy, event.shiftKey, savedDrag.startAspect);
        onResize(img.id, screenRectToPage(geometry, zoom, newScreenRect));
      }
    }
  };

  const handlePointerCancel = (img: PreviewImage, event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || drag.imgId !== img.id || drag.pointerId !== event.pointerId) return;
    setDrag(null);
    setDragDeltaPx({ x: 0, y: 0 });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const targetId = replaceTargetRef.current;
    event.target.value = '';
    if (file && targetId && onReplace) onReplace(targetId, file, 'contain');
  };

  const visible = images.filter((img) => !img.deleted);

  return (
    <div
      ref={overlayRef}
      data-testid="image-layer"
      className="pointer-events-none absolute inset-0"
    >
      {onReplace && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Replace image"
          className="sr-only"
          onChange={handleFileChange}
        />
      )}
      {visible.map((img) => {
        const rect = getVisualRect(img);
        const isSelected = img.id === selectedId;
        const isDraggingMove = activeDrag?.imgId === img.id && activeDrag.mode === 'move';

        return (
          <Fragment key={img.id}>
            <button
              type="button"
              data-testid="image-box"
              data-image-id={img.id}
              aria-label={`Image ${img.id}`}
              aria-pressed={isSelected}
              className={`pointer-events-auto absolute outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-700 ${
                isDraggingMove
                  ? 'cursor-grabbing ring-2 ring-blue-600'
                  : isSelected
                    ? 'cursor-grab ring-2 ring-blue-500'
                    : 'cursor-pointer hover:ring-2 hover:ring-blue-300'
              }`}
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
              onClick={(e) => {
                e.stopPropagation();
                if (didDragRef.current) { didDragRef.current = false; return; }
                onSelect(img.id);
              }}
              onFocus={() => { if (!isSelected) onSelect(img.id); }}
              onPointerDown={(e) => handleBodyPointerDown(img, e)}
              onPointerMove={(e) => handlePointerMove(e)}
              onPointerUp={(e) => handlePointerUp(img, e)}
              onPointerCancel={(e) => handlePointerCancel(img, e)}
            >
              {isSelected && CORNER_HANDLES.map(({ cls, corner, cursor }) => (
                <span
                  key={corner}
                  aria-hidden="true"
                  data-testid={`corner-handle-${corner}`}
                  className={`pointer-events-auto absolute size-3 rounded-sm border border-blue-600 bg-white ${cls} ${cursor}`}
                  onPointerDown={(e) => handleCornerPointerDown(img, corner, e)}
                  onPointerMove={(e) => handlePointerMove(e)}
                  onPointerUp={(e) => handlePointerUp(img, e)}
                  onPointerCancel={(e) => handlePointerCancel(img, e)}
                />
              ))}
            </button>

            {isSelected && onReplace && (
              <button
                type="button"
                aria-label={`Replace image ${img.id}`}
                className="pointer-events-auto absolute flex -translate-x-1/2 items-center gap-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white shadow"
                style={{ left: rect.x + rect.width / 2, top: Math.max(0, rect.y - 24) }}
                onClick={(e) => {
                  e.stopPropagation();
                  replaceTargetRef.current = img.id;
                  fileInputRef.current?.click();
                }}
              >
                <Upload aria-hidden="true" className="size-2.5" />
                Replace
              </button>
            )}
          </Fragment>
        );
      })}
      <p role="status" className="sr-only">
        {selectedId ? `Selected image: ${selectedId}` : ''}
      </p>
    </div>
  );
}
