import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface BannerProps {
  tone: 'error' | 'info';
  children: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
}

/** Non-blocking message bar. Errors are announced assertively, notices politely. */
export function Banner({ tone, children, onDismiss, action }: BannerProps) {
  const styles = tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-center gap-3 border-b px-4 py-2 text-sm ${styles}`}>
      <p className="flex-1">{children}</p>
      {action}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="rounded p-1 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
