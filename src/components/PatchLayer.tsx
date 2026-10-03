import { pageToScreen, type PageGeometry } from '../lib/coordinates';
import type { LayoutLine, PreviewLine } from '../types/operations';

interface PatchLayerProps {
  lines: readonly PreviewLine[];
  geometry: PageGeometry;
  zoom: number;
}

/** Compute bounding box (in PDF user space) for a set of LayoutLines. */
function patchBounds(layout: LayoutLine[]): { x: number; y: number; x2: number; y2: number } | null {
  if (layout.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of layout) {
    minX = Math.min(minX, l.x);
    maxX = Math.max(maxX, l.x + l.width);
    // y is baseline in PDF space; approximate top/bottom within the line height
    minY = Math.min(minY, l.y);
    maxY = Math.max(maxY, l.y);
  }
  return { x: minX, y: minY, x2: maxX, y2: maxY };
}

function boxesOverlap(
  a: { x: number; y: number; x2: number; y2: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  // b is a rect with bottom-left origin (PDF space): y is bottom, y+height is top
  const bTop = b.y + b.height;
  const bBot = b.y;
  // a is from patchBounds: y values are baselines (approximate)
  return !(a.x2 <= b.x || a.x >= b.x + b.width || a.y2 < bBot || a.y > bTop);
}

/**
 * Layer 1 (above masks): renders the new text for each active TEXT_REPLACE or
 * TEXT_ADD at the line's page position using the Resolved Font's CSS family,
 * matching size/spacing/color (D7, VW-6).
 * Multi-line patches use a flex column of absolutely-positioned spans.
 * Deleted lines have no patch.
 */
export function PatchLayer({ lines, geometry, zoom }: PatchLayerProps) {
  const patched = lines.filter((l) => !l.deleted && l.patchLayout !== null);

  if (patched.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {patched.map((line) => {
        const layout = line.patchLayout as LayoutLine[];
        const style = line.currentStyle;
        const rf = line.resolvedFont;
        const cssFamily = rf && rf.tier !== 1 ? `${rf.cssFamily}, sans-serif` : 'Liberation Sans, sans-serif';
        const fontSize = style.size * zoom;
        const lineHeightPx = style.size * style.lineHeight * zoom;

        // Detect if this patch overlaps any other (non-deleted) object's original box (TE-6)
        const bounds = patchBounds(layout);
        const hasOverlap = bounds !== null && lines.some((other) => {
          if (other.id === line.id || other.deleted) return false;
          return boxesOverlap(bounds, other.box);
        });

        return (
          <div
            key={line.id}
            data-testid="patch"
            data-line-id={line.id}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {layout.map((layoutLine, i) => {
              // Each LayoutLine has a page-space origin (x, y). Convert to screen.
              const screenPt = pageToScreen(geometry, { x: layoutLine.x, y: layoutLine.y }, zoom);
              // The y returned by pageToScreen is the top-left in screen space (PDF y=bottom).
              // We need to offset upward by the full line height so baseline aligns correctly.
              return (
                <span
                  key={i}
                  data-testid="patch-line"
                  style={{
                    position: 'absolute',
                    left: screenPt.x,
                    top: screenPt.y - lineHeightPx,
                    fontFamily: cssFamily,
                    fontSize: `${fontSize}px`,
                    fontWeight: style.bold ? 'bold' : 'normal',
                    fontStyle: style.italic ? 'italic' : 'normal',
                    color: style.color,
                    letterSpacing: `${style.charSpacing * zoom}px`,
                    lineHeight: `${lineHeightPx}px`,
                    wordSpacing: `${style.wordSpacing * zoom}px`,
                    whiteSpace: 'pre',
                  }}
                >
                  {layoutLine.text}
                </span>
              );
            })}
            {hasOverlap && (
              <span
                data-testid="overlap-hint"
                style={{
                  position: 'absolute',
                  left: pageToScreen(geometry, { x: line.box.x, y: line.box.y }, zoom).x,
                  top: pageToScreen(geometry, { x: line.box.x, y: line.box.y }, zoom).y - lineHeightPx - 20,
                  fontSize: '11px',
                  color: '#b45309',
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                Text overlaps other content
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
