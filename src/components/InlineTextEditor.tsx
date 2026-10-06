import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { pageToScreen, type PageGeometry, type Point } from '../lib/coordinates';
import { ensureCatalogFont } from '../lib/font-fetcher';
import { rowStep } from '../lib/text-layout';
import type { TextStyle } from '../types/operations';

export interface InlineTextEditorProps {
  /** Top-left of the new text in Page Space (where the user clicked). */
  point: Point;
  style: TextStyle;
  /** CSS font stack the committed text will be drawn with. */
  fontFamily: string;
  zoom: number;
  pageGeometry: PageGeometry;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

// Right-hand wrap limit (pageWidth − 40 pt), as in text layout.
const WRAP_INSET_PT = 40;
const PAD_PX = 4;

/** Guaranteed coverage (Latin, Latin Extended, Greek, Cyrillic); returns the first character outside it. */
function firstUndrawableChar(text: string): string | null {
  for (const ch of text) {
    if (ch === '\n') continue;
    const cp = ch.codePointAt(0) ?? 0;
    const ok = (cp >= 0x0020 && cp <= 0x024f) || (cp >= 0x0370 && cp <= 0x03ff) || (cp >= 0x0400 && cp <= 0x04ff);
    if (!ok) return ch;
  }
  return null;
}

/**
 * Layer 4: the Add Text editor. A visible box whose top-left is the click point, typed in the font,
 * size and colour the text will be drawn with. It grows with its content up to the page's wrap
 * limit. Enter or clicking elsewhere commits; Shift+Enter adds a line; Escape cancels.
 */
export function InlineTextEditor({ point, style, fontFamily, zoom, pageGeometry, onCommit, onCancel }: InlineTextEditorProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef(false);
  const undrawable = firstUndrawableChar(value);

  const topLeft = pageToScreen(pageGeometry, point, zoom);
  const wrapRight = pageToScreen(pageGeometry, { x: pageGeometry.box[2] - WRAP_INSET_PT, y: point.y }, zoom).x;
  const fontSize = style.size * zoom;
  const lineHeightPx = rowStep(style) * zoom;
  const font = `${style.italic ? 'italic' : 'normal'} ${style.bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
  const maxWidth = Math.max(fontSize * 4, wrapRight - topLeft.x);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Load the catalog face the text will be drawn in (no-op for other stacks).
  useEffect(() => {
    const family = /^"([^"]+)"/.exec(fontFamily)?.[1];
    if (family) ensureCatalogFont(family, style.bold, style.italic);
  }, [fontFamily, style.bold, style.italic]);

  // Fit width to the longest typed line (min ~8 em, max the wrap limit), then height to the content.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = document.createElement('canvas').getContext('2d');
    let textWidth = 0;
    if (ctx) {
      ctx.font = font;
      ctx.letterSpacing = `${style.charSpacing * zoom}px`;
      for (const row of value.split('\n')) textWidth = Math.max(textWidth, ctx.measureText(row).width);
    }
    el.style.width = `${Math.min(maxWidth, Math.max(fontSize * 8, textWidth + fontSize) + PAD_PX * 2)}px`;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, font, maxWidth, fontSize, style.charSpacing, zoom]);

  const commit = () => {
    if (doneRef.current || undrawable !== null) return;
    doneRef.current = true;
    onCommit(value);
  };
  const cancel = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onCancel();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation(); // keep editor keys away from global shortcuts (Delete, Ctrl+Z…)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <>
      <textarea
        ref={ref}
        data-testid="inline-text-editor"
        value={value}
        placeholder="Type text…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        rows={1}
        wrap="soft"
        aria-label="New text"
        aria-invalid={undrawable !== null}
        className={`absolute z-40 resize-none overflow-hidden rounded-sm bg-white shadow-md outline-none ring-2 placeholder:text-slate-400 ${
          undrawable !== null ? 'ring-red-500' : 'ring-blue-500'
        }`}
        style={{
          left: topLeft.x - PAD_PX,
          top: topLeft.y - PAD_PX,
          padding: PAD_PX,
          font,
          color: style.color,
          letterSpacing: `${style.charSpacing * zoom}px`,
          wordSpacing: `${style.wordSpacing * zoom}px`,
          lineHeight: `${lineHeightPx}px`,
          boxSizing: 'border-box',
        }}
      />
      {undrawable !== null && (
        <div
          data-testid="drawability-warning"
          role="alert"
          className="absolute z-40 whitespace-nowrap rounded border border-red-500 bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700"
          style={{ left: topLeft.x - PAD_PX, top: topLeft.y - PAD_PX - 22 }}
        >
          {`Cannot draw character: "${undrawable}" (U+${undrawable.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')})`}
        </div>
      )}
    </>
  );
}
