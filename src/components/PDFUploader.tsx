import { FileUp, ShieldCheck } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { SAMPLE_CATALOG, type SampleId } from '../lib/sample-catalog';

interface PDFUploaderProps {
  hasDocument: boolean;
  onFiles: (files: File[]) => void;
  onOpenClick: () => void;
  onLoadSample: (id: SampleId) => void;
  children?: ReactNode;
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * Whole-area drop target (UP-1) with a visible highlight while files are dragged over it,
 * plus the empty-state dropzone shown before a document is open.
 */
export function PDFUploader({ hasDocument, onFiles, onOpenClick, onLoadSample, children }: PDFUploaderProps) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child element; count them to know when the drag really leaves.
  const depth = useRef(0);

  return (
    <div
      data-testid="drop-target"
      data-dragging={dragging || undefined}
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {hasDocument ? (
        children
      ) : (
        <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-lg rounded-xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
            <FileUp aria-hidden="true" className="mx-auto size-10 text-blue-600" />
            <h1 className="mt-3 text-lg font-semibold text-slate-800">Open a PDF to start editing</h1>
            <p className="mt-1 text-sm text-slate-600">Drag and drop a PDF here, or choose one from your device.</p>
            <button
              type="button"
              onClick={onOpenClick}
              className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Choose PDF
            </button>
            <p className="mt-6 text-sm text-slate-600">Or try a sample:</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {SAMPLE_CATALOG.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onLoadSample(s.id)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {s.title}
                </button>
              ))}
            </div>
            <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Your file stays on this device. Nothing is uploaded.
            </p>
          </div>
        </div>
      )}
      {dragging && (
        <div
          data-testid="drop-highlight"
          className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-4 border-dashed border-blue-500 bg-blue-50/80"
        >
          <p className="text-lg font-semibold text-blue-800">Drop PDF to open</p>
        </div>
      )}
    </div>
  );
}
