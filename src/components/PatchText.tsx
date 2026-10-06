import { useEffect, useRef, useState } from 'react';

export interface PatchTextProps {
  readonly text: string;
  /** CSS font-family stack (the same one the PDF.js canvas uses for tier 1). */
  readonly fontFamily: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly fontSizePx: number;
  readonly color: string;
  readonly letterSpacingPx: number;
  readonly wordSpacingPx: number;
  /** Horizontal scaling (Tz) as a fraction; 1 = normal. */
  readonly hScale: number;
  /** Screen position of the baseline start. */
  readonly left: number;
  readonly baseline: number;
}

// Room above and below the baseline, in em; generous so no glyph is clipped.
const ASCENT_EM = 1.2;
const DESCENT_EM = 0.5;

/** Bumps whenever the document finishes loading fonts, so canvas text is redrawn in the real face. */
function useFontsVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (!fonts) return;
    const bump = () => setVersion((v) => v + 1);
    fonts.addEventListener('loadingdone', bump);
    return () => fonts.removeEventListener('loadingdone', bump);
  }, []);
  return version;
}

/**
 * One patch row drawn on a canvas with the same `ctx.font` and text rasteriser as the PDF.js page
 * canvas, placed on the original baseline. DOM text is hinted and antialiased differently from
 * canvas text, so a DOM patch looks heavier or lighter than the page around it.
 */
export function PatchText(props: PatchTextProps) {
  const { text, fontFamily, bold, italic, fontSizePx, color, letterSpacingPx, wordSpacingPx, hScale, left, baseline } = props;
  const ref = useRef<HTMLCanvasElement>(null);
  const fontsVersion = useFontsVersion();
  const font = `${italic ? 'italic' : 'normal'} ${bold ? 'bold' : 'normal'} ${fontSizePx}px ${fontFamily}`;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const applyText = () => {
      ctx.font = font;
      ctx.letterSpacing = `${letterSpacingPx}px`;
      ctx.wordSpacing = `${wordSpacingPx}px`;
    };
    applyText();
    const width = Math.ceil(ctx.measureText(text).width * hScale) + 2;
    const height = Math.ceil(fontSizePx * (ASCENT_EM + DESCENT_EM));
    const dpr = window.devicePixelRatio || 1;
    // Resizing the backing store resets the context, so state is applied after it.
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr * hScale, 0, 0, dpr, 0, 0);
    applyText();
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 0, fontSizePx * ASCENT_EM);
  }, [text, font, color, letterSpacingPx, wordSpacingPx, hScale, fontSizePx, fontsVersion]);

  return (
    <canvas
      ref={ref}
      data-testid="patch-line"
      data-font-family={fontFamily}
      style={{ position: 'absolute', left, top: baseline - fontSizePx * ASCENT_EM }}
    >
      {text}
    </canvas>
  );
}
