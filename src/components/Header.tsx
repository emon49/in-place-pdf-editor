import { ChevronDown, ChevronUp, Download, FileText, FolderOpen, Keyboard, Type, X } from 'lucide-react';
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
  addTextMode: boolean;
  onToggleAddText: () => void;
  editCount: number;
  onExport?: () => void;
  onOpenShortcuts?: () => void;
  /** Current search query. */
  searchQuery?: string;
  /** Total match count across all pages. */
  searchMatchCount?: number;
  /** 1-based index of the current match (0 when no matches). */
  searchMatchNumber?: number;
  onSearchChange?: (query: string) => void;
  onSearchNext?: () => void;
  onSearchPrev?: () => void;
}

/** Top toolbar (PRD §7.1, M0 subset). */
export function Header(props: HeaderProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const hasDocument = props.documentName !== null;
  const matchCount = props.searchMatchCount ?? 0;
  const matchNumber = props.searchMatchNumber ?? 0;

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
          {props.editCount > 0 && (
            <span
              data-testid="edit-count-badge"
              className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              {props.editCount} {props.editCount === 1 ? 'edit' : 'edits'} applied
            </span>
          )}
          {props.onSearchChange !== undefined && (
            <div className="flex items-center gap-1" data-testid="search-bar">
              <label className="sr-only" htmlFor="header-search">Search</label>
              <input
                id="header-search"
                type="search"
                data-testid="search-input"
                placeholder="Search…"
                value={props.searchQuery ?? ''}
                onChange={(e) => props.onSearchChange?.(e.target.value)}
                className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-blue-600"
                aria-label="Search document"
              />
              {(props.searchQuery ?? '').length > 0 && (
                <>
                  <span className="min-w-[4rem] text-center text-xs text-slate-500" aria-live="polite" data-testid="search-count">
                    {matchCount === 0 ? 'No matches' : `${matchNumber} / ${matchCount}`}
                  </span>
                  <button
                    type="button"
                    aria-label="Previous match"
                    data-testid="search-prev"
                    onClick={props.onSearchPrev}
                    disabled={matchCount === 0}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <ChevronUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next match"
                    data-testid="search-next"
                    onClick={props.onSearchNext}
                    disabled={matchCount === 0}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <ChevronDown aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Clear search"
                    data-testid="search-clear"
                    onClick={() => props.onSearchChange?.('')}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </>
              )}
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {props.onOpenShortcuts && (
              <button
                type="button"
                aria-label="Keyboard shortcuts"
                data-testid="shortcuts-button"
                onClick={props.onOpenShortcuts}
                className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Keyboard aria-hidden="true" className="size-4" />
              </button>
            )}
            {props.onExport && (
              <button
                type="button"
                data-testid="export-button"
                onClick={props.onExport}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Download aria-hidden="true" className="size-4" />
                Export PDF
              </button>
            )}
            <button
              type="button"
              data-testid="add-text-button"
              onClick={props.onToggleAddText}
              aria-pressed={props.addTextMode}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                props.addTextMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Type aria-hidden="true" className="size-4" />
              Add text
            </button>
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
