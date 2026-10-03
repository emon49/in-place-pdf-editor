import { CATALOG_ENTRIES } from '../lib/font-catalog';
import type { TextStyle } from '../types/operations';

export interface StyleControlsProps {
  style: TextStyle;
  onChange: (patch: Partial<TextStyle>) => void;
}

const FONT_FAMILIES = CATALOG_ENTRIES.map((e) => e.family);

/** Minimal style controls: font family, size, bold/italic, color. */
export function StyleControls({ style, onChange }: StyleControlsProps) {
  return (
    <div className="flex items-center gap-2" data-testid="style-controls">
      <label className="sr-only" htmlFor="style-font-family">Font family</label>
      <select
        id="style-font-family"
        data-testid="style-font-family"
        value={style.fontFamilyOverride ?? ''}
        onChange={(e) => onChange({ fontFamilyOverride: e.target.value || null })}
        className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
      >
        <option value="">Original font</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <label className="sr-only" htmlFor="style-font-size">Font size</label>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Decrease font size"
          data-testid="style-size-down"
          onClick={() => onChange({ size: Math.max(6, style.size - 1) })}
          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs hover:bg-slate-50"
        >−</button>
        <input
          id="style-font-size"
          data-testid="style-font-size"
          type="number"
          min={6}
          max={144}
          value={style.size}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 6) onChange({ size: v });
          }}
          className="w-10 rounded border border-slate-300 bg-white px-1 py-1 text-center text-xs"
          aria-label="Font size"
        />
        <button
          type="button"
          aria-label="Increase font size"
          data-testid="style-size-up"
          onClick={() => onChange({ size: Math.min(144, style.size + 1) })}
          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs hover:bg-slate-50"
        >+</button>
      </div>

      <button
        type="button"
        aria-label="Bold"
        aria-pressed={style.bold}
        data-testid="style-bold"
        onClick={() => onChange({ bold: !style.bold })}
        className={`rounded border px-2 py-1 text-xs font-bold ${style.bold ? 'border-blue-400 bg-blue-100 text-blue-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
      >B</button>

      <button
        type="button"
        aria-label="Italic"
        aria-pressed={style.italic}
        data-testid="style-italic"
        onClick={() => onChange({ italic: !style.italic })}
        className={`rounded border px-2 py-1 text-xs italic ${style.italic ? 'border-blue-400 bg-blue-100 text-blue-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
      ><em>I</em></button>

      <label className="sr-only" htmlFor="style-color">Text color</label>
      <input
        id="style-color"
        type="color"
        data-testid="style-color"
        value={style.color}
        onChange={(e) => onChange({ color: e.target.value })}
        className="h-7 w-7 cursor-pointer rounded border border-slate-300 p-0.5"
        aria-label="Text color"
      />
    </div>
  );
}
