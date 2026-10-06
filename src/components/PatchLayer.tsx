import { useEffect } from 'react';
import { pageToScreen, type PageGeometry } from '../lib/coordinates';
import { ensureCatalogFont } from '../lib/font-fetcher';
import { patchFont, resolveFontSync } from '../lib/font-resolver';
import { PatchText } from './PatchText';
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
 * TEXT_ADD at the line's page position in the Resolved Font (the embedded face for tier 1),
 * matching size/spacing/color (D7, VW-6).
 * Multi-line patches use a flex column of absolutely-positioned spans.
 * Deleted lines have no patch.
 */
export function PatchLayer({ lines, geometry, zoom }: PatchLayerProps) {
  const patched = lines.filter((l) => !l.deleted && l.patchLayout !== null);

  // Catalog faces (in the line's weight and slant) are registered on demand; patches redraw once loaded.
  const faces = patched.flatMap((l) =>
    l.resolvedFont && l.resolvedFont.tier !== 1
      ? [`${l.resolvedFont.cssFamily}|${l.currentStyle.bold ? 1 : 0}|${l.currentStyle.italic ? 1 : 0}`]
      : [],
  );
  const faceKey = [...new Set(faces)].sort().join('\n');
  useEffect(() => {
    for (const face of faceKey ? faceKey.split('\n') : []) {
      const [family = '', bold, italic] = face.split('|');
      ensureCatalogFont(family, bold === '1', italic === '1');
    }
  }, [faceKey]);

  if (patched.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {patched.map((line) => {
        const layout = line.patchLayout as LayoutLine[];
        const style = line.currentStyle;
        const rf = line.resolvedFont ?? resolveFontSync({ ...line, fontFamilyOverride: style.fontFamilyOverride }, line.currentText);
        const fontSize = style.size * zoom;
        const lineHeightPx = style.size * style.lineHeight * zoom;

        // Detect if this patch overlaps any other (non-deleted) object's original box (TE-6)
        const bounds = patchBounds(layout);
        const hasOverlap = bounds !== null && lines.some((other) => {
          // A rotated (locked) line's level bounding box is far larger than its glyphs.
          if (other.id === line.id || other.deleted || other.lockReason !== null) return false;
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
              // Layout rows are baselines (laid out from patchOrigin).
              const at = pageToScreen(geometry, { x: layoutLine.x, y: layoutLine.y }, zoom);
              const drawn = patchFont(rf, line.font, line.fontClass, layoutLine.text);
              return (
                <PatchText
                  key={i}
                  text={drawn.text}
                  fontFamily={drawn.fontFamily}
                  bold={style.bold}
                  italic={style.italic}
                  fontSizePx={fontSize}
                  color={style.color}
                  letterSpacingPx={style.charSpacing * zoom}
                  wordSpacingPx={style.wordSpacing * zoom}
                  hScale={style.hScale / 100}
                  left={at.x}
                  baseline={at.y}
                />
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
