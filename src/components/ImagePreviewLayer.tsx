import { displayRectToScreen, pageRectToDisplay, type PageGeometry } from '../lib/coordinates';
import { getCachedObjectUrl } from '../lib/image-replacement-engine';
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
 * Layer 1b: renders replacement image blobs as <img> elements over the PDF canvas.
 * Uses the in-memory object URL cache populated by storeBlob so preview is synchronous.
 * Sits below the interactive ImageLayer so selection handles appear above the previews.
 */
export function ImagePreviewLayer({ images, geometry, zoom }: ImagePreviewLayerProps) {
  const replaced = images.filter((img) => !img.deleted && img.blobKey !== null);
  if (replaced.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {replaced.map((img) => {
        const url = getCachedObjectUrl(img.blobKey!);
        if (!url) return null;
        const rect = displayRectToScreen(pageRectToDisplay(geometry, img.currentBox), zoom);
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
