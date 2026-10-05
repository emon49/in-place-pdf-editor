/**
 * Export modal (EX-1, EX-2, EX-3).
 * Collects the file name, triggers the export Worker, shows progress, and
 * offers a download link once complete (task 5.1, 5.2, 5.3).
 */
import { Download, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PreviewImage, PreviewLine } from '../types/operations';

export interface ExportModalProps {
  /** Source file name, pre-filled as the default export name. */
  sourceName: string;
  /** Total number of pages in the document. */
  pageCount: number;
  previewLinesFn: (pageIndex: number) => PreviewLine[];
  previewImagesFn: (pageIndex: number) => PreviewImage[];
  /** Original PDF bytes, transferred to the Worker. */
  originalBytes: Uint8Array;
  onClose: () => void;
}

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting'; pct: number }
  | { status: 'done'; bytes: Uint8Array; byteLength: number }
  | { status: 'error'; message: string };

/** Format bytes as a human-readable size string (e.g. "1.4 MB"). */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportModal({
  sourceName,
  pageCount,
  previewLinesFn,
  previewImagesFn,
  originalBytes,
  onClose,
}: ExportModalProps) {
  const baseName = sourceName.replace(/\.pdf$/i, '');
  const [fileName, setFileName] = useState(`${baseName}-edited`);
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Revoke old object URL on unmount.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function handleExport() {
    if (state.status === 'exporting') return;
    setState({ status: 'exporting', pct: 0 });
    try {
      // Lazy-import the exporter to keep it out of the initial bundle.
      const { exportDocument } = await import('../lib/pdf-exporter');
      const bytes = await exportDocument(
        originalBytes,
        pageCount,
        previewLinesFn,
        previewImagesFn,
        (pct) => setState({ status: 'exporting', pct }),
      );

      // Revoke any previous URL.
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      objectUrlRef.current = URL.createObjectURL(blob);

      setState({ status: 'done', bytes, byteLength: bytes.byteLength });

      // Trigger download automatically.
      const a = downloadRef.current;
      if (a) {
        a.href = objectUrlRef.current;
        a.download = `${fileName || baseName}.pdf`;
        a.click();
        // Revoke after click.
        setTimeout(() => {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
          }
        }, 60_000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: 'error', message });
    }
  }

  function handleDownloadAgain() {
    if (state.status !== 'done') return;
    if (objectUrlRef.current) {
      const a = downloadRef.current;
      if (a) {
        a.href = objectUrlRef.current;
        a.download = `${fileName || baseName}.pdf`;
        a.click();
      }
    }
  }

  const isExporting = state.status === 'exporting';
  const isDone = state.status === 'done';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export PDF"
      data-testid="export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="absolute inset-0" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <button
          type="button"
          aria-label="Close export dialog"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <h2 className="mb-4 text-base font-semibold text-slate-900">Export PDF</h2>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">File name</span>
          <div className="flex items-center">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={isExporting}
              data-testid="export-filename"
              className="flex-1 rounded-l-md border border-slate-300 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60"
            />
            <span className="rounded-r-md border border-l-0 border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-500">
              .pdf
            </span>
          </div>
        </label>

        {state.status === 'exporting' && (
          <div className="mb-4">
            <div className="mb-1 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Exporting… {state.pct}%
            </div>
            <div
              role="progressbar"
              aria-valuenow={state.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${state.pct}%` }}
              />
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Export failed: {state.message}
          </p>
        )}

        {isDone && (
          <p data-testid="export-size" className="mb-4 text-sm text-slate-500">
            Exported {formatBytes(state.byteLength)}
          </p>
        )}

        <div className="flex gap-2">
          {!isDone ? (
            <button
              type="button"
              data-testid="export-download-button"
              onClick={() => void handleExport()}
              disabled={isExporting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {isExporting ? 'Exporting…' : 'Download'}
            </button>
          ) : (
            <button
              type="button"
              data-testid="export-download-again-button"
              onClick={handleDownloadAgain}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Download className="size-4" aria-hidden="true" />
              Download again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {isDone ? 'Close' : 'Cancel'}
          </button>
        </div>

        {/* Hidden anchor for programmatic download — not accessible, intentionally hidden */}
        {/* eslint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/anchor-is-valid */}
        <a ref={downloadRef} href="#" className="hidden" aria-hidden="true" />
      </div>
    </div>
  );
}
