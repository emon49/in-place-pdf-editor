import { displayRectToScreen, pageRectToDisplay, type PageGeometry } from '../lib/coordinates';
import type { PreviewLine } from '../types/operations';

interface MaskLayerProps {
  lines: readonly PreviewLine[];
  geometry: PageGeometry;
  zoom: number;
}

/**
 * Layer 1: renders a solid-color mask over the original position of each
 * edited or deleted text line (TEXT_REPLACE, OBJECT_DELETE). The color comes
 * from line.background.color when sampled; falls back to white (D7, VW-7).
 * Added lines (TEXT_ADD) have no original position and receive no mask.
 */
export function MaskLayer({ lines, geometry, zoom }: MaskLayerProps) {
  const masked = lines.filter((l) => {
    // Mask applies to lines that existed in the original document and have been
    // either modified (currentText differs from text) or deleted.
    const isOriginal = !l.id.startsWith('add-');
    return isOriginal && (l.deleted || l.currentText !== l.text);
  });

  if (masked.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {masked.map((line) => {
        const rect = displayRectToScreen(pageRectToDisplay(geometry, line.box), zoom);
        const color =
          line.background.status === 'ready' ? line.background.color : '#ffffff';
        return (
          <div
            key={line.id}
            data-testid="mask"
            data-line-id={line.id}
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );
}
