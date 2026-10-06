import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from './IconButton';

interface PageNavigatorProps {
  pageIndex: number;
  pageCount: number;
  onGoTo: (pageIndex: number) => void;
}

/** `< n / N >` page switcher with a page-number input (ST-4). */
export function PageNavigator({ pageIndex, pageCount, onGoTo }: PageNavigatorProps) {
  // null while the user is not typing, so the input always reflects the current page.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.trim());
    // Invalid or out-of-range numbers revert to the current page.
    if (Number.isInteger(n) && n >= 1 && n <= pageCount) onGoTo(n - 1);
    setDraft(null);
  };

  return (
    <nav aria-label="Pages" className="flex items-center gap-1">
      <IconButton label="Previous page" disabled={pageIndex <= 0} onClick={() => onGoTo(pageIndex - 1)}>
        <ChevronLeft aria-hidden="true" className="size-4" />
      </IconButton>
      <label className="flex items-center gap-1 text-sm text-slate-700">
        <span className="sr-only">Page number</span>
        <input
          type="text"
          inputMode="numeric"
          value={draft ?? String(pageIndex + 1)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setDraft(null);
          }}
          className="w-10 rounded border border-slate-300 px-1 py-0.5 text-center tabular-nums focus-visible:outline-2 focus-visible:outline-blue-600"
        />
      </label>
      <span className="text-sm text-slate-600 tabular-nums" data-testid="page-count">
        / {pageCount}
      </span>
      <IconButton label="Next page" disabled={pageIndex >= pageCount - 1} onClick={() => onGoTo(pageIndex + 1)}>
        <ChevronRight aria-hidden="true" className="size-4" />
      </IconButton>
    </nav>
  );
}
