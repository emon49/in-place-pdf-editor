import { displayRectToScreen, pageRectToDisplay, type PageGeometry } from '../lib/coordinates';
import { getCachedObjectUrl } from '../lib/image-replacement-engine';
import { imageMaskRect } from '../lib/mask-geometry';
import type { FitMode, PreviewImage } from '../types/operations';

interface ImagePreviewLayerProps {
  images: readonly PreviewImage[];
  geometry: PageGeometry;
  zoom: number;
}

function fitToCss(fit: FitMode | null): React.CSSProperties['objectFit'] {
  if (fit === 'cover') return 'cover';
  if (fit === 'fill') return 'fill';
  return 'contain';
}

/**
 * Layer 1b: hides each deleted or replaced image at its original position with its sampled mask
 * colour (ADR-0004, as the export does), then draws replacement blobs as <img> elements. Without the
 * mask, transparent or letterboxed areas of a replacement show the old image through.
 * Uses the in-memory object URL cache populated by storeBlob so preview is synchronous.
 * Sits below the interactive ImageLayer so selection handles appear above the previews.
 */
export function ImagePreviewLayer({ images, geometry, zoom }: ImagePreviewLayerProps) {
  const masked = images.filter((img) => img.deleted || img.blobKey !== null);
  if (masked.length === 0) return null;
  const toScreen = (box: PreviewImage['bbox']) => displayRectToScreen(pageRectToDisplay(geometry, box), zoom);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {masked.map((img) => {
        const mask = toScreen(imageMaskRect(img.bbox));
        return (
          <div
            key={`mask-${img.id}`}
            data-testid="image-mask"
            style={{ position: 'absolute', left: mask.x, top: mask.y, width: mask.width, height: mask.height, backgroundColor: img.maskColor ?? '#ffffff' }}
          />
        );
      })}
      {masked.map((img) => {
        const url = !img.deleted && img.blobKey !== null ? getCachedObjectUrl(img.blobKey) : null;
        if (!url) return null;
        const rect = toScreen(img.currentBox);
        return (
          <img
            key={img.id}
            src={url}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              objectFit: fitToCss(img.fit),
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );
}
