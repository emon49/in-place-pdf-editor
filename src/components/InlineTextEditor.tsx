import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { pageRectToDisplay, displayRectToScreen, type PageGeometry } from '../lib/coordinates';
import type { PreviewLine } from '../types/operations';

export interface InlineTextEditorProps {
  line: PreviewLine;
  zoom: number;
  pageGeometry: PageGeometry;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Check whether all characters in text fall within the Liberation font's
 * guaranteed coverage: Basic Latin, Latin Extended (A–B), Greek, Cyrillic.
 * Returns the first undrawable character or null if all pass.
 */
function firstUndrawableChar(text: string): string | null {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const ok =
      (cp >= 0x0020 && cp <= 0x024f) || // Basic Latin + Latin Extended A/B
      (cp >= 0x0370 && cp <= 0x03ff) || // Greek and Coptic
      (cp >= 0x0400 && cp <= 0x04ff); // Cyrillic
    if (!ok) return ch;
  }
  return null;
}

/**
 * Layer 4: a textarea positioned over the Text Line using pageRectToDisplay × zoom.
 * Styled to match the line's resolved font family, size, letter-spacing, line-height and color.
 * Auto-expands vertically as the user types.
 */
export function InlineTextEditor({ line, zoom, pageGeometry, onCommit, onCancel }: InlineTextEditorProps) {
  const [value, setValue] = useState(line.currentText);
  const [undrawableChar, setUndrawableChar] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);
  const drawCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayRect = pageRectToDisplay(pageGeometry, line.box);
  const screenRect = displayRectToScreen(displayRect, zoom);

  // Derive CSS font family from resolved font
  const cssFamily = (() => {
    const rf = line.resolvedFont;
    if (!rf) return 'Liberation Sans, sans-serif';
    if (rf.tier === 1) return 'inherit'; // use whatever the browser has from the PDF
    return `${rf.cssFamily}, sans-serif`;
  })();

  const style = line.currentStyle;

  // Debounced drawability check (200 ms) on each text change
  const scheduleDrawCheck = useCallback((text: string) => {
    if (drawCheckTimer.current) clearTimeout(drawCheckTimer.current);
    drawCheckTimer.current = setTimeout(() => {
      setUndrawableChar(firstUndrawableChar(text));
    }, 200);
  }, []);

  // Auto-resize textarea to content height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    if (undrawableChar !== null) return; // blocked by undrawable character
    committedRef.current = true;
    onCommit(value);
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
    // Shift+Enter: let default newline insertion happen
  };

  const fontSize = style.size * zoom;
  const letterSpacing = style.charSpacing * zoom;
  const lineHeightPx = style.size * style.lineHeight * zoom;

  return (
    <>
      <textarea
        ref={textareaRef}
        data-testid="inline-text-editor"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          scheduleDrawCheck(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={commit}
        rows={1}
        aria-label={`Edit text: ${line.currentText}`}
        aria-invalid={undrawableChar !== null}
        style={{
          position: 'absolute',
          left: screenRect.x,
          top: screenRect.y,
          width: screenRect.width,
          minHeight: screenRect.height,
          fontSize: `${fontSize}px`,
          fontFamily: cssFamily,
          fontWeight: style.bold ? 'bold' : 'normal',
          fontStyle: style.italic ? 'italic' : 'normal',
          color: style.color,
          letterSpacing: `${letterSpacing}px`,
          lineHeight: `${lineHeightPx}px`,
          wordSpacing: `${style.wordSpacing * zoom}px`,
          background: 'transparent',
          border: `1px solid ${undrawableChar !== null ? '#ef4444' : '#3b82f6'}`,
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          padding: 0,
          margin: 0,
          boxSizing: 'border-box',
          zIndex: 40,
        }}
      />
      {undrawableChar !== null && (
        <div
          data-testid="drawability-warning"
          role="alert"
          style={{
            position: 'absolute',
            left: screenRect.x,
            top: screenRect.y + screenRect.height + 2,
            background: '#fef2f2',
            border: '1px solid #ef4444',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
            color: '#b91c1c',
            zIndex: 41,
            whiteSpace: 'nowrap',
          }}
        >
          {`Cannot draw character: "${undrawableChar}" (U+${undrawableChar.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')})`}
        </div>
      )}
    </>
  );
}
