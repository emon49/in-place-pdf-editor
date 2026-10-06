import { Maximize, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import { canZoomIn, canZoomOut, formatZoom } from '../lib/zoom';
import type { FitMode } from '../store/editorStore';
import { IconButton } from './IconButton';

interface ZoomControlsProps {
  zoom: number;
  fitMode: FitMode | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onActualSize: () => void;
  onFit: (mode: FitMode) => void;
}

/** Zoom presets, 100%, and fit modes (ST-4). */
export function ZoomControls({ zoom, fitMode, onZoomIn, onZoomOut, onActualSize, onFit }: ZoomControlsProps) {
  return (
    <div role="group" aria-label="Zoom" className="flex items-center gap-1">
      <IconButton label="Zoom out" disabled={!canZoomOut(zoom)} onClick={onZoomOut}>
        <ZoomOut aria-hidden="true" className="size-4" />
      </IconButton>
      <button
        type="button"
        onClick={onActualSize}
        title="Actual size (100%)"
        aria-label={`Zoom ${formatZoom(zoom)}, reset to 100%`}
        data-testid="zoom-level"
        className="min-w-14 rounded-md px-2 py-1 text-sm text-slate-700 tabular-nums hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        {formatZoom(zoom)}
      </button>
      <IconButton label="Zoom in" disabled={!canZoomIn(zoom)} onClick={onZoomIn}>
        <ZoomIn aria-hidden="true" className="size-4" />
      </IconButton>
      <IconButton label="Fit to width" aria-pressed={fitMode === 'width'} onClick={() => onFit('width')}>
        <MoveHorizontal aria-hidden="true" className="size-4" />
      </IconButton>
      <IconButton label="Fit to page" aria-pressed={fitMode === 'page'} onClick={() => onFit('page')}>
        <Maximize aria-hidden="true" className="size-4" />
      </IconButton>
    </div>
  );
}
