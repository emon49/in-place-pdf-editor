import { useEffect, useRef, useState } from 'react';
import { getThumbnailPool } from '../lib/thumbnail-renderer';

export interface ThumbnailsTabProps {
  documentId: string;
  pageCount: number;
  activePageIndex: number;
  /** Called when the user clicks a thumbnail. */
  onGoToPage: (pageIndex: number) => void;
}

interface ThumbnailState {
  url: string | null;
  loading: boolean;
}

const THUMB_WIDTH = 120;

/**
 * Scrollable thumbnail strip for the Sidebar (page-thumbnails spec, D2).
 * Uses IntersectionObserver to lazy-enqueue renders; clicking a thumbnail navigates to that page.
 * Relies on a parent key reset (Sidebar key={document.id}) to clear state between documents.
 */
export function ThumbnailsTab({ documentId, pageCount, activePageIndex, onGoToPage }: ThumbnailsTabProps) {
  const [thumbs, setThumbs] = useState<ThumbnailState[]>(() =>
    Array.from({ length: pageCount }, () => ({ url: null, loading: false })),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const entryRefs = useRef<(HTMLDivElement | null)[]>([]);
  const renderedRef = useRef<Set<number>>(new Set());
  const activeRef = useRef<HTMLDivElement | null>(null);
  // Tracks URLs for cleanup on unmount.
  const urlsRef = useRef<string[]>([]);

  // Scroll active page into view when it changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [activePageIndex]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const pool = getThumbnailPool();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset['pageIndex']);
          if (!Number.isFinite(idx) || renderedRef.current.has(idx)) continue;
          renderedRef.current.add(idx);
          observer.unobserve(el);

          setThumbs((prev) => {
            const next = [...prev];
            const cur = next[idx] ?? { url: null, loading: false };
            next[idx] = { ...cur, loading: true };
            return next;
          });

          void pool
            .render({ docId: documentId, pageIndex: idx, width: THUMB_WIDTH })
            .then((result) => {
              if (result.bitmap) {
                const offscreen = new OffscreenCanvas(result.bitmap.width, result.bitmap.height);
                const ctx = offscreen.getContext('2d');
                ctx?.drawImage(result.bitmap, 0, 0);
                result.bitmap.close();
                void offscreen.convertToBlob().then((blob) => {
                  const url = URL.createObjectURL(blob);
                  urlsRef.current.push(url);
                  setThumbs((prev) => {
                    const next = [...prev];
                    next[idx] = { url, loading: false };
                    return next;
                  });
                });
              } else {
                setThumbs((prev) => {
                  const next = [...prev];
                  next[idx] = { url: null, loading: false };
                  return next;
                });
              }
            })
            .catch(() => {
              setThumbs((prev) => {
                const next = [...prev];
                next[idx] = { url: null, loading: false };
                return next;
              });
            });
        }
      },
      { root: containerRef.current, rootMargin: '200px' },
    );

    for (const el of entryRefs.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [documentId, pageCount]);

  // Revoke object URLs on unmount. Capture the array ref so the cleanup uses the same object.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="thumbnails-tab"
      className="flex flex-col gap-2 overflow-y-auto p-2"
    >
      {Array.from({ length: pageCount }, (_, i) => {
        const thumb = thumbs[i];
        const isActive = i === activePageIndex;
        return (
          <div
            key={i}
            ref={(el) => {
              entryRefs.current[i] = el;
              if (isActive) activeRef.current = el;
            }}
            data-page-index={i}
            data-testid={`thumbnail-${i}`}
          >
            <button
              type="button"
              aria-label={`Go to page ${i + 1}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onGoToPage(i)}
              className={`w-full rounded-md border-2 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isActive ? 'border-blue-600' : 'border-transparent hover:border-slate-300'
              }`}
            >
              {thumb?.url ? (
                <img
                  src={thumb.url}
                  alt={`Page ${i + 1}`}
                  className="w-full rounded"
                  draggable={false}
                />
              ) : (
                <div
                  className="flex aspect-[3/4] w-full items-center justify-center rounded bg-slate-100 text-xs text-slate-400"
                  aria-hidden="true"
                >
                  {thumb?.loading ? (
                    <span className="animate-pulse">…</span>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
              )}
            </button>
            <p className="mt-0.5 text-center text-xs text-slate-500">{i + 1}</p>
          </div>
        );
      })}
    </div>
  );
}
