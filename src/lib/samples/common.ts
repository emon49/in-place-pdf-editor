import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

/** Fixed metadata so the same sample always produces identical bytes (sample-documents spec). */
const FIXED_DATE = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

export async function createSampleDocument(title: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(title);
  doc.setAuthor('PDF In-Place Editor samples');
  doc.setCreator('PDF In-Place Editor');
  doc.setProducer('PDF In-Place Editor sample generator');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  return doc;
}

export const saveSample = (doc: PDFDocument): Promise<Uint8Array> => doc.save({ useObjectStreams: false });

export const INK = rgb(0.12, 0.16, 0.23);
export const MUTED = rgb(0.39, 0.45, 0.55);
export const ACCENT = rgb(0.15, 0.39, 0.92);

/** Greedy word wrap using the font's real advance widths. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface ParagraphOptions {
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
  lineHeight?: number;
  color?: RGB;
}

/** Draws wrapped text top-down starting at baseline `y`; returns the baseline below the last line. */
export function drawParagraph(page: PDFPage, text: string, o: ParagraphOptions): number {
  const lineHeight = o.lineHeight ?? o.size * 1.35;
  let y = o.y;
  for (const line of wrapText(text, o.font, o.size, o.width)) {
    page.drawText(line, { x: o.x, y, size: o.size, font: o.font, color: o.color ?? INK });
    y -= lineHeight;
  }
  return y;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
