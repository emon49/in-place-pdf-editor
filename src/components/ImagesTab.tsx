import { ImageOff } from 'lucide-react';
import type { PreviewImage } from '../types/operations';

export interface ImagesTabProps {
  images: readonly PreviewImage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function imageStatus(img: PreviewImage): { label: string; cls: string } {
  if (img.deleted) return { label: 'Deleted', cls: 'bg-red-100 text-red-700' };
  if (img.blobKey !== null) return { label: 'Replaced', cls: 'bg-green-100 text-green-700' };
  const moved = img.currentBox.x !== img.bbox.x || img.currentBox.y !== img.bbox.y;
  const resized = img.currentBox.width !== img.bbox.width || img.currentBox.height !== img.bbox.height;
  if (moved || resized) return { label: 'Moved', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Original', cls: 'bg-slate-100 text-slate-600' };
}

/**
 * Sidebar tab listing each Image Object on the active page with its edit status (IM-4).
 * Shows when images exist; content is null otherwise so the Sidebar hides the tab.
 */
export function ImagesTab({ images, selectedId, onSelect }: ImagesTabProps) {
  if (images.length === 0) {
    return (
      <p className="p-3 text-sm text-slate-600">No images were found on this page.</p>
    );
  }

  return (
    <div data-testid="images-list" className="min-h-0 flex-1 overflow-y-auto">
      <ul aria-label={`${images.length} image object${images.length === 1 ? '' : 's'}`}>
        {images.map((img, i) => {
          const selected = img.id === selectedId;
          const { label, cls } = imageStatus(img);
          const w = Math.round(img.currentBox.width);
          const h = Math.round(img.currentBox.height);

          return (
            <li key={img.id}>
              <button
                type="button"
                data-testid="image-row"
                data-image-id={img.id}
                aria-pressed={selected}
                onClick={() => onSelect(img.id)}
                className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                  selected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                }`}
              >
                <ImageOff aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{`Image ${i + 1}`}</span>
                  <span className="block truncate text-xs text-slate-500">{`${w} × ${h} pt`}</span>
                </span>
                <span
                  aria-label={`Status: ${label}`}
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
