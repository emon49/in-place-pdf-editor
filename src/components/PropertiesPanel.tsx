import { AlertTriangle, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { displayRectToPage, pageRectToDisplay, type PageGeometry, type Point, type Rect } from '../lib/coordinates';
import { hasNonUniformBackground } from '../lib/object-labels';
import type { FitMode, PreviewImage, PreviewLine } from '../types/operations';

// ─── Image Properties Panel (IM-3, MV-7) ─────────────────────────────────────

export interface ImagePropertiesPanelProps {
  image: PreviewImage;
  geometry: PageGeometry;
  onMove: (to: Point) => void;
  onResize: (to: Rect) => void;
  onReplace: (file: File, fit: FitMode) => void;
}

const FIT_OPTIONS: { value: FitMode; label: string }[] = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
  { value: 'fill', label: 'Fill' },
];

/** Right-side panel shown when an Image Object is selected (IM-3, MV-7). */
export function ImagePropertiesPanel({ image, geometry, onMove, onResize, onReplace }: ImagePropertiesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dr = pageRectToDisplay(geometry, image.currentBox);

  const [xEdit, setXEdit] = useState<string | null>(null);
  const [yEdit, setYEdit] = useState<string | null>(null);
  const [wEdit, setWEdit] = useState<string | null>(null);
  const [hEdit, setHEdit] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<FitMode>(image.fit ?? 'contain');

  const xVal = Math.round(dr.x * 10) / 10;
  const yVal = Math.round(dr.y * 10) / 10;
  const wVal = Math.round(image.currentBox.width * 10) / 10;
  const hVal = Math.round(image.currentBox.height * 10) / 10;

  const commitXY = (rawX: string, rawY: string) => {
    const nx = parseFloat(rawX);
    const ny = parseFloat(rawY);
    if (!isFinite(nx) || !isFinite(ny)) return;
    const newDr = { x: nx, y: ny, width: dr.width, height: dr.height };
    const pr = displayRectToPage(geometry, newDr);
    onMove({ x: pr.x, y: pr.y });
  };

  const commitWH = (rawW: string, rawH: string) => {
    const nw = parseFloat(rawW);
    const nh = parseFloat(rawH);
    if (!isFinite(nw) || !isFinite(nh) || nw <= 0 || nh <= 0) return;
    onResize({ x: image.currentBox.x, y: image.currentBox.y, width: nw, height: nh });
  };

  const xInput = xEdit ?? String(xVal);
  const yInput = yEdit ?? String(yVal);
  const wInput = wEdit ?? String(wVal);
  const hInput = hEdit ?? String(hVal);

  return (
    <aside
      data-testid="image-properties-panel"
      aria-label="Image Properties"
      className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 text-xs text-slate-700"
    >
      <section aria-labelledby="ipp-position">
        <h2 id="ipp-position" className="mb-1.5 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
          Position
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">X (pt)</span>
            <input
              type="number"
              data-testid="ipp-x"
              aria-label="X position"
              value={xInput}
              onFocus={() => setXEdit(String(xVal))}
              onChange={(e) => setXEdit(e.target.value)}
              onBlur={() => { commitXY(xInput, yInput); setXEdit(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Y (pt)</span>
            <input
              type="number"
              data-testid="ipp-y"
              aria-label="Y position"
              value={yInput}
              onFocus={() => setYEdit(String(yVal))}
              onChange={(e) => setYEdit(e.target.value)}
              onBlur={() => { commitXY(xInput, yInput); setYEdit(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="ipp-size">
        <h2 id="ipp-size" className="mb-1.5 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
          Size
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">W (pt)</span>
            <input
              type="number"
              data-testid="ipp-w"
              aria-label="Width"
              min="1"
              value={wInput}
              onFocus={() => setWEdit(String(wVal))}
              onChange={(e) => setWEdit(e.target.value)}
              onBlur={() => { commitWH(wInput, hInput); setWEdit(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">H (pt)</span>
            <input
              type="number"
              data-testid="ipp-h"
              aria-label="Height"
              min="1"
              value={hInput}
              onFocus={() => setHEdit(String(hVal))}
              onChange={(e) => setHEdit(e.target.value)}
              onBlur={() => { commitWH(wInput, hInput); setHEdit(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="ipp-fit">
        <h2 id="ipp-fit" className="mb-1.5 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
          Fit Mode
        </h2>
        <div className="flex gap-1" role="group" aria-labelledby="ipp-fit">
          {FIT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              data-testid={`ipp-fit-${value}`}
              aria-pressed={fitMode === value}
              onClick={() => setFitMode(value)}
              className={`flex-1 rounded border px-1.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                fitMode === value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="ipp-replace">
        <h2 id="ipp-replace" className="mb-1.5 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
          Replace
        </h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Upload replacement image"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onReplace(file, fitMode);
          }}
        />
        <button
          type="button"
          aria-label="Choose replacement image file"
          data-testid="ipp-replace-btn"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
        >
          <Upload aria-hidden="true" className="size-3" />
          Choose image…
        </button>
        {image.blobKey !== null && (
          <p className="mt-1 text-[10px] text-green-700">Replacement set</p>
        )}
      </section>
    </aside>
  );
}

// ─── Text Editor Panel ────────────────────────────────────────────────────────

export interface TextEditorPanelProps {
  line: PreviewLine;
  /** Controlled draft text shown in the textarea. */
  text: string;
  onTextChange: (text: string) => void;
}

/** Right-side panel shown when a Text Line is selected. Replaces the old PropertiesPanel. */
export function TextEditorPanel({ line, text, onTextChange }: TextEditorPanelProps) {
  const locked = line.lockReason !== null;
  const rf = line.resolvedFont;

  const tierLabel = rf
    ? ['', 'Original font', 'Catalog font', 'Substitute font', 'Fallback font'][rf.tier] ?? ''
    : null;
  const fontLabel = rf ? (rf.tier === 1 ? rf.loadedName : rf.cssFamily) : null;

  const moved = line.currentBox.x !== line.box.x || line.currentBox.y !== line.box.y;
  const coverage = line.font?.coverage ?? null;
  const undrawableChars =
    line.currentStyle.fontFamilyOverride === null && coverage
      ? [...text].filter((ch) => !coverage.has(ch))
      : [];

  return (
    <aside
      data-testid="text-editor-panel"
      aria-label="Text Editor"
      className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 text-xs text-slate-700"
    >
      <section className="flex flex-1 flex-col" aria-labelledby="tep-text">
        <h2 id="tep-text" className="mb-1.5 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
          {locked ? 'Text (locked)' : 'Text'}
        </h2>
        <textarea
          data-testid="text-editor-textarea"
          aria-label="Edit text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          disabled={locked}
          rows={5}
          className="w-full resize-none rounded border border-slate-300 px-2 py-1.5 text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {locked && (
          <p className="mt-1 text-[10px] text-amber-600">This object cannot be edited.</p>
        )}
      </section>

      {rf && (
        <section aria-labelledby="tep-font">
          <h2 id="tep-font" className="mb-1 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
            Font
          </h2>
          <p data-testid="pp-font-tier" title={rf.reason} className="leading-snug">
            <span className="font-medium">{tierLabel}:</span> {fontLabel}
          </p>
          {rf.tier !== 1 && (
            <p className="mt-0.5 text-[10px] text-amber-700" title={rf.reason}>
              <AlertTriangle aria-hidden="true" className="mr-0.5 inline size-3" />
              {rf.reason}
            </p>
          )}
        </section>
      )}

      {(moved || undrawableChars.length > 0) && (
        <section aria-labelledby="tep-warnings">
          <h2 id="tep-warnings" className="mb-1 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
            Warnings
          </h2>
          {moved && hasNonUniformBackground(line) && (
            <p data-testid="pp-mask-warning" className="mb-1 flex items-start gap-1 text-amber-700">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              Mask color may not match the background at the new position.
            </p>
          )}
          {undrawableChars.length > 0 && (
            <p data-testid="pp-undrawable-warning" className="flex items-start gap-1 text-red-700">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              Characters not covered by this font: {[...new Set(undrawableChars)].join('')}
            </p>
          )}
        </section>
      )}
    </aside>
  );
}
