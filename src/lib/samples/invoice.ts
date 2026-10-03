import { StandardFonts, rgb } from 'pdf-lib';
import { INK, MUTED, base64ToBytes, createSampleDocument, saveSample } from './common';
import { LOGO_PNG_BASE64 } from './logo-png';

/** Tinted header row behind text (exercises sampled-colour masks). */
export const INVOICE_HEADER_TINT = rgb(0.86, 0.91, 0.98);

const ITEMS: ReadonlyArray<readonly [string, number, number]> = [
  ['Design consultation (hours)', 6, 85],
  ['Placeholder widget, model X', 3, 120],
  ['Sample support plan, 12 months', 1, 450],
];

const money = (n: number) => `$${n.toFixed(2)}`;

/** One-page invoice with an embedded PNG logo and a tinted table header. All parties are fictional. */
export async function buildInvoice(): Promise<Uint8Array> {
  const doc = await createSampleDocument('Invoice (sample)');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(base64ToBytes(LOGO_PNG_BASE64));
  const page = doc.addPage([612, 792]);

  page.drawImage(logo, { x: 54, y: 690, width: 56, height: 56 });
  page.drawText('Example Co.', { x: 122, y: 722, size: 18, font: bold, color: INK });
  page.drawText('1 Placeholder Street, Sampletown 00000', { x: 122, y: 704, size: 10, font, color: MUTED });
  page.drawText('INVOICE', { x: 450, y: 722, size: 20, font: bold, color: INK });
  page.drawText('No. INV-0001', { x: 450, y: 704, size: 10, font, color: MUTED });
  page.drawText('Date: 1 January 2026', { x: 450, y: 690, size: 10, font, color: MUTED });

  page.drawText('Bill to', { x: 54, y: 640, size: 10, font: bold, color: MUTED });
  page.drawText('Sample Customer Ltd.', { x: 54, y: 624, size: 12, font, color: INK });
  page.drawText('42 Fictional Avenue, Exampleville', { x: 54, y: 609, size: 10, font, color: INK });

  const cols = [54, 340, 420, 500];
  const headerY = 560;
  page.drawRectangle({ x: 48, y: headerY - 8, width: 516, height: 26, color: INVOICE_HEADER_TINT });
  ['Description', 'Qty', 'Unit price', 'Amount'].forEach((h, i) =>
    page.drawText(h, { x: cols[i] ?? 0, y: headerY, size: 10, font: bold, color: INK }),
  );

  let y = headerY - 30;
  let total = 0;
  for (const [desc, qty, price] of ITEMS) {
    const amount = qty * price;
    total += amount;
    [desc, String(qty), money(price), money(amount)].forEach((t, i) =>
      page.drawText(t, { x: cols[i] ?? 0, y, size: 10, font, color: INK }),
    );
    page.drawLine({ start: { x: 48, y: y - 8 }, end: { x: 564, y: y - 8 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
    y -= 26;
  }
  page.drawText('Total', { x: 420, y: y - 6, size: 12, font: bold, color: INK });
  page.drawText(money(total), { x: 500, y: y - 6, size: 12, font: bold, color: INK });
  page.drawText('Thank you for your business. Payment due within 30 days.', { x: 54, y: 80, size: 9, font, color: MUTED });
  return saveSample(doc);
}
