import { FileText, FolderOpen } from 'lucide-react';
import { useRef } from 'react';
import { SAMPLE_CATALOG, type SampleId } from '../lib/sample-catalog';
import type { FitMode } from '../store/editorStore';
import { PageNavigator } from './PageNavigator';
import { ZoomControls } from './ZoomControls';

export interface HeaderProps {
  documentName: string | null;
  pageIndex: number;
  pageCount: number;
  zoom: number;
  fitMode: FitMode | null;
  onOpenFiles: (files: File[]) => void;
  onLoadSample: (id: SampleId) => void;
  onGoToPage: (pageIndex: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onActualSize: () => void;
  onFit: (mode: FitMode) => void;
}

/** Top toolbar (PRD §7.1, M0 subset). */
export function Header(props: HeaderProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const hasDocument = props.documentName !== null;

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-2 font-semibold text-slate-800">
        <FileText aria-hidden="true" className="size-5 text-blue-600" />
        <span>PDF In-Place Editor</span>
      </div>

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <FolderOpen aria-hidden="true" className="size-4" />
        Open PDF
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        data-testid="file-input"
        aria-label="Choose a PDF file"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) props.onOpenFiles(files);
        }}
      />

      <label className="text-sm text-slate-700">
        <span className="sr-only">Load sample</span>
        <select
          value=""
          onChange={(e) => {
            const id = e.target.value as SampleId;
            if (id) props.onLoadSample(id);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <option value="">Load sample…</option>
          {SAMPLE_CATALOG.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>

      {hasDocument && (
        <>
          <span className="max-w-60 truncate text-sm text-slate-500" title={props.documentName ?? ''}>
            {props.documentName}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <PageNavigator pageIndex={props.pageIndex} pageCount={props.pageCount} onGoTo={props.onGoToPage} />
            <ZoomControls
              zoom={props.zoom}
              fitMode={props.fitMode}
              onZoomIn={props.onZoomIn}
              onZoomOut={props.onZoomOut}
              onActualSize={props.onActualSize}
              onFit={props.onFit}
            />
          </div>
        </>
      )}
    </header>
  );
}
