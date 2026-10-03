import { StandardFonts, degrees, rgb } from 'pdf-lib';
import { INK, MUTED, createSampleDocument, drawParagraph, saveSample } from './common';

/** CropBox of page 3 (x, y, width, height); differs from its 612×792 MediaBox. */
export const TECH_SPEC_CROP = { x: 36, y: 36, width: 540, height: 720 } as const;

/**
 * Three pages: portrait text, a `/Rotate 90` landscape table, and a page whose
 * CropBox is inset from its MediaBox (sample-documents spec).
 */
export async function buildTechSpec(): Promise<Uint8Array> {
  const doc = await createSampleDocument('Technical Spec (sample)');
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const monoBold = await doc.embedFont(StandardFonts.CourierBold);

  // Page 1: portrait overview.
  const p1 = doc.addPage([612, 792]);
  p1.drawText('Widget Controller - Technical Specification', { x: 54, y: 730, size: 18, font: sansBold, color: INK });
  p1.drawText('Revision 0.1 (fictional sample)', { x: 54, y: 710, size: 10, font: sans, color: MUTED });
  let y = drawParagraph(
    p1,
    'This document describes a fictional widget controller. It exists to exercise the editor with monospaced text, a rotated landscape page and a cropped page.',
    { x: 54, y: 680, width: 504, font: sans, size: 11 },
  );
  y -= 10;
  for (const line of ['GET /widgets/{id}', 'POST /widgets', 'DELETE /widgets/{id}']) {
    p1.drawText(line, { x: 72, y, size: 10, font: mono, color: INK });
    y -= 16;
  }

  // Page 2: /Rotate 90. Content is drawn rotated so it reads horizontally once displayed.
  // With /Rotate 90, Display (dx, dy) corresponds to Page (dy, dx) on a [0 0 612 792] page.
  const p2 = doc.addPage([612, 792]);
  p2.setRotation(degrees(90));
  const at = (dx: number, dyBaseline: number) => ({ x: dyBaseline, y: dx, rotate: degrees(90) });
  p2.drawText('Register map (landscape)', { ...at(54, 70), size: 16, font: sansBold, color: INK });
  const headers = ['Offset', 'Name', 'Access', 'Reset', 'Description'];
  const colX = [54, 140, 300, 380, 470];
  headers.forEach((h, i) => p2.drawText(h, { ...at(colX[i] ?? 0, 110), size: 10, font: monoBold, color: INK }));
  const rows = [
    ['0x00', 'CTRL', 'RW', '0x0000', 'Enable and mode bits'],
    ['0x04', 'STATUS', 'RO', '0x0001', 'Ready, busy and error flags'],
    ['0x08', 'DATA', 'RW', '0x0000', 'Data in/out register'],
    ['0x0C', 'IRQ_MASK', 'RW', '0xFFFF', 'Interrupt enable mask'],
  ];
  rows.forEach((row, r) =>
    row.forEach((cell, i) =>
      p2.drawText(cell, { ...at(colX[i] ?? 0, 132 + r * 20), size: 10, font: mono, color: INK }),
    ),
  );

  // Page 3: CropBox inset from MediaBox; crop marks outside the CropBox are hidden.
  const p3 = doc.addPage([612, 792]);
  p3.setCropBox(TECH_SPEC_CROP.x, TECH_SPEC_CROP.y, TECH_SPEC_CROP.width, TECH_SPEC_CROP.height);
  p3.drawRectangle({ x: 0, y: 0, width: 612, height: 30, color: rgb(0.9, 0.2, 0.2) });
  p3.drawText('Appendix: timing (cropped page)', { x: 72, y: 700, size: 14, font: sansBold, color: INK });
  drawParagraph(p3, 'This page has a CropBox inset by 36 pt from its MediaBox. The red band at the bottom of the MediaBox lies outside the CropBox and must not be visible.', {
    x: 72, y: 676, width: 468, font: sans, size: 11,
  });
  return saveSample(doc);
}
