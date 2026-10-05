import { displayRectToScreen, pageRectToDisplay, type PageGeometry } from '../lib/coordinates';
import type { PreviewLine } from '../types/operations';

export interface SearchHighlightLayerProps {
  lines: readonly PreviewLine[];
  geometry: PageGeometry;
  zoom: number;
  /** IDs of lines that match the current search query. */
  matchIds: ReadonlySet<string>;
  /** ID of the currently focused match (visually distinguished). */
  currentMatchId: string | null;
}

/**
 * Renders semi-transparent highlight overlays for search matches on the active page (VW-4).
 * Sits below Layer 2 (TextOverlay) so it doesn't intercept pointer events.
 */
export function SearchHighlightLayer({ lines, geometry, zoom, matchIds, currentMatchId }: SearchHighlightLayerProps) {
  if (matchIds.size === 0) return null;

  return (
    <div aria-hidden="true" data-testid="search-highlight-layer" className="pointer-events-none absolute inset-0">
      {lines.map((line) => {
        if (!matchIds.has(line.id)) return null;
        const isCurrent = line.id === currentMatchId;
        const displayRect = pageRectToDisplay(geometry, line.box);
        const screenRect = displayRectToScreen(displayRect, zoom);
        return (
          <div
            key={line.id}
            data-testid={isCurrent ? 'search-current-match' : 'search-match'}
            className={`absolute rounded-sm ${isCurrent ? 'bg-amber-400/60 ring-2 ring-amber-500' : 'bg-yellow-300/40'}`}
            style={{
              left: screenRect.x,
              top: screenRect.y,
              width: screenRect.width,
              height: screenRect.height,
            }}
          />
        );
      })}
    </div>
  );
}
