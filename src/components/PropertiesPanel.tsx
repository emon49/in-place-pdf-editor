import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { displayRectToPage, displaySize, pageRectToDisplay, type PageGeometry, type Point } from '../lib/coordinates';
import { hasNonUniformBackground } from '../lib/object-labels';
import { StyleControls } from './StyleControls';
import type { PreviewLine, TextStyle } from '../types/operations';

export interface PropertiesPanelProps {
  line: PreviewLine;
  geometry: PageGeometry;
  onMove: (to: Point) => void;
  onStyleChange: (patch: Partial<TextStyle>) => void;
}

/** Converts a display-space rect to the X/Y values shown in the panel (Display Coordinates, top-left origin). */
function toDisplayXY(line: PreviewLine, geometry: PageGeometry): { x: number; y: number } {
  const dr = pageRectToDisplay(geometry, line.currentBox);
  return { x: Math.round(dr.x * 10) / 10, y: Math.round(dr.y * 10) / 10 };
}

/** Right-side panel shown when a Text Line is selected (MV-5). */
export function PropertiesPanel({ line, geometry, onMove, onStyleChange }: PropertiesPanelProps) {
  const displayXY = toDisplayXY(line, geometry);
  // null = not currently being edited; show the derived value.
  const [xEdit, setXEdit] = useState<string | null>(null);
  const [yEdit, setYEdit] = useState<string | null>(null);
  const xInput = xEdit ?? String(displayXY.x);
  const yInput = yEdit ?? String(displayXY.y);

  function commitPosition(rawX: string, rawY: string) {
    const nx = parseFloat(rawX);
    const ny = parseFloat(rawY);
    if (!isFinite(nx) || !isFinite(ny)) return;
    // Convert Display Coordinates back to Page Space via displayRectToPage.
    const displayRect = pageRectToDisplay(geometry, line.currentBox);
    const newDisplayRect = { x: nx, y: ny, width: displayRect.width, height: displayRect.height };
    const pageRect = displayRectToPage(geometry, newDisplayRect);
    onMove({ x: pageRect.x, y: pageRect.y });
  }

  const locked = line.lockReason !== null;
  const moved = line.currentBox.x !== line.box.x || line.currentBox.y !== line.box.y;
  const rf = line.resolvedFont;

  const tierLabel = rf
    ? ['', 'Original font', 'Catalog font', 'Substitute font', 'Liberation fallback'][rf.tier] ?? ''
    : null;
  const fontLabel = rf ? (rf.tier === 1 ? rf.loadedName : rf.cssFamily) : null;

  const pageH = displaySize(geometry).height;
  const coverage = line.font?.coverage ?? null;
  const undrawableChars =
    line.currentStyle.fontFamilyOverride === null && coverage
      ? [...line.currentText].filter((ch) => !coverage.has(ch))
      : [];

  return (
    <aside
      data-testid="properties-panel"
      aria-label="Properties"
      className="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 text-xs text-slate-700"
    >
      <section aria-labelledby="pp-position">
        <h2 id="pp-position" className="mb-1.5 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
          Position
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">X (pt)</span>
            <input
              type="number"
              data-testid="pp-x"
              aria-label="X position"
              value={xInput}
              disabled={locked}
              onFocus={() => setXEdit(String(displayXY.x))}
              onChange={(e) => setXEdit(e.target.value)}
              onBlur={() => { commitPosition(xInput, yInput); setXEdit(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Y (pt)</span>
            <input
              type="number"
              data-testid="pp-y"
              aria-label="Y position"
              value={yInput}
              disabled={locked}
              onFocus={() => setYEdit(String(displayXY.y))}
              onChange={(e) => setYEdit(e.target.value)}
              onBlur={() => { commitPosition(xInput, yInput); setYEdit(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            />
          </label>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">Display coordinates, top-left origin. Page height: {Math.round(pageH)} pt</p>
      </section>

      {!locked && (
        <section aria-labelledby="pp-style">
          <h2 id="pp-style" className="mb-1.5 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
            Style
          </h2>
          <StyleControls style={line.currentStyle} onChange={onStyleChange} />
        </section>
      )}

      {rf && (
        <section aria-labelledby="pp-font">
          <h2 id="pp-font" className="mb-1 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
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

      {/* Warnings */}
      {(moved || undrawableChars.length > 0) && (
        <section aria-labelledby="pp-warnings">
          <h2 id="pp-warnings" className="mb-1 font-semibold text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>
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
