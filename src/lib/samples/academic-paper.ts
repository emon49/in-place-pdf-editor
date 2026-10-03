import fontkit from '@pdf-lib/fontkit';
import { StandardFonts, beginMarkedContent, endMarkedContent } from 'pdf-lib';
// Liberation Sans (OFL) ships with pdfjs-dist; inlined so the lazy samples chunk stays self-contained.
import liberationSansDataUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?inline';
import { ACCENT, INK, MUTED, base64ToBytes, createSampleDocument, drawParagraph, saveSample } from './common';

/** Classic six-letter subset tag; fixed so the sample's bytes are deterministic (pdf-lib would add a random suffix). */
export const SUBSET_FONT_NAME = 'QXZKLM+LiberationSans';
/** The single line drawn word by word with no space characters (text-extraction edge case). */
export const FRAGMENTED_LINE_WORDS = ['Keywords:', 'layout,', 'typography,', 'fonts,', 'masks'] as const;

const BODY = [
  'Editing documents in place keeps their original layout intact. This fictional study compares three approaches to correcting small errors in typeset documents and measures how often readers notice the change.',
  'Participants were shown pairs of pages and asked which one had been edited. Edits made with metric-compatible fonts were detected far less often than edits made with arbitrary substitutes, especially when the edited line kept its original letter spacing.',
  'We also found that preserving the exact text colour matters more than expected: a slightly lighter grey is noticed almost as often as a different typeface. Sampling the colour from the content stream avoids the anti-aliasing errors of pixel sampling.',
  'Finally, masks drawn over tinted backgrounds were nearly invisible when their colour was sampled from the surrounding area, and clearly visible when they were plain white.',
];

/** Multi-page, two-column paper using serif, sans and mono styles in regular and bold. */
export async function buildAcademicPaper(): Promise<Uint8Array> {
  const doc = await createSampleDocument('Academic Research Paper (sample)');
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  doc.registerFontkit(fontkit);
  const subsetBytes = base64ToBytes(liberationSansDataUrl.slice(liberationSansDataUrl.indexOf(',') + 1));
  const subset = await doc.embedFont(subsetBytes, { subset: true, customName: SUBSET_FONT_NAME });

  const [W, H] = [612, 792];
  const margin = 54;
  const gutter = 24;
  const colWidth = (W - 2 * margin - gutter) / 2;

  for (let p = 0; p < 3; p++) {
    const page = doc.addPage([W, H]);
    let top = H - margin;
    if (p === 0) {
      page.drawText('On the Invisibility of In-Place Edits', { x: margin, y: top - 20, size: 22, font: serifBold, color: INK });
      page.drawText('A. Example and B. Placeholder, Institute of Sample Studies', {
        x: margin, y: top - 44, size: 11, font: serifItalic, color: MUTED,
      });
      // Each word is positioned individually in its own marked-content span (as tagged PDFs do), and no
      // space character is drawn; PDF.js starts a new text item at every span boundary.
      let wordX = margin;
      for (const word of FRAGMENTED_LINE_WORDS) {
        page.pushOperators(beginMarkedContent('Span'));
        page.drawText(word, { x: wordX, y: top - 60, size: 9, font: subset, color: MUTED });
        page.pushOperators(endMarkedContent());
        wordX += subset.widthOfTextAtSize(word, 9) + subset.widthOfTextAtSize(' ', 9) * 0.8;
      }
      page.drawText('Abstract', { x: margin, y: top - 74, size: 11, font: sansBold, color: ACCENT });
      top = drawParagraph(page, BODY[0] ?? '', { x: margin, y: top - 90, width: W - 2 * margin, font: serif, size: 11 }) - 12;
    }
    for (let col = 0; col < 2; col++) {
      const x = margin + col * (colWidth + gutter);
      let y = top;
      const n = p * 2 + col + 1;
      page.drawText(`${n}. Section ${n}`, { x, y, size: 12, font: sansBold, color: INK });
      y -= 18;
      for (const para of BODY) {
        y = drawParagraph(page, para, { x, y, width: colWidth, font: serif, size: 10.5 }) - 6;
        if (y < margin + 80) break;
      }
      if (col === 1 && y > margin + 40) {
        page.drawText('render(page, zoom * dpr);', { x, y: y - 8, size: 9, font: mono, color: INK });
      }
    }
    page.drawText(`${p + 1}`, { x: W / 2 - 3, y: 30, size: 9, font: sans, color: MUTED });
  }
  return saveSample(doc);
}
