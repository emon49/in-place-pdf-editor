import React, { useEffect, useRef, useState } from 'react';
import { displayRectToScreen, pageRectToDisplay, type PageGeometry } from '../lib/coordinates';
import { loadBlob } from '../lib/image-replacement-engine';
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

/** Loads a blob by key and returns an object URL, revoking the previous one on change. */
function useBlobUrl(blobKey: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const prevKey = useRef<string | null>(null);
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    if (blobKey === prevKey.current) return;
    // Revoke previous URL
    if (prevUrl.current) {
      URL.revokeObjectURL(prevUrl.current);
      prevUrl.current = null;
    }
    prevKey.current = blobKey;
    if (!blobKey) { setUrl(null); return; }

    let cancelled = false;
    loadBlob(blobKey).then((blob) => {
      if (cancelled || !blob) return;
      const objectUrl = URL.createObjectURL(blob);
      prevUrl.current = objectUrl;
      setUrl(objectUrl);
    }).catch(() => { /* blob unavailable */ });

    return () => {
      cancelled = true;
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobKey]);

  return url;
}

/** One replaced image rendered as a positioned <img> element. */
function ReplacedImage({ image, geometry, zoom }: { image: PreviewImage; geometry: PageGeometry; zoom: number }) {
  const url = useBlobUrl(image.blobKey);
  if (!url) return null;
  const rect = displayRectToScreen(pageRectToDisplay(geometry, image.currentBox), zoom);
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        objectFit: fitToCss(image.fit),
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Layer 1b: renders replacement image blobs as <img> elements positioned over the PDF canvas.
 * Sits below the interactive ImageLayer so selection handles appear above the previews.
 */
export function ImagePreviewLayer({ images, geometry, zoom }: ImagePreviewLayerProps) {
  const replaced = images.filter((img) => !img.deleted && img.blobKey !== null);
  if (replaced.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {replaced.map((img) => (
        <ReplacedImage key={img.id} image={img} geometry={geometry} zoom={zoom} />
      ))}
    </div>
  );
}
