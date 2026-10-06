/**
 * PDF export Web Worker.
 * Receives an ExportPayload, applies all operations via pdf-lib, and returns the output bytes.
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFHexString,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  beginText,
  endText,
  moveText,
  setFontAndSize,
  setFillingRgbColor,
  showText,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Point, Rect } from './coordinates';
import type { TextStyle, ResolvedFont, FitMode } from '../types/operations';
import { encodeText } from './font-encoder';
import { fitImageRect } from './image-replacement-engine';
import { catalogFontKey, FALLBACK_FONT_KEY, fontVariant } from './font-catalog';
import { imageMaskRect, maskRect } from './mask-geometry';
import { styleChanged } from './operation-reducer';
import { calibratedAdvance, layoutText, patchOrigin, type LayoutLine } from './text-layout';

// ─── Payload types ────────────────────────────────────────────────────────────

export interface ExportTextLine {
  readonly id: string;
  readonly text: string;
  /** Text after applying operations (same as `text` if unchanged). */
  readonly currentText: string;
  readonly box: Rect;
  /** Baseline origin of the original line, for the mask rect. */
  readonly origin: Point;
  readonly currentBox: Rect;
  readonly deleted: boolean;
  readonly fontSize: number;
  readonly style: TextStyle;
  readonly currentStyle: TextStyle;
  readonly resolvedFont: ResolvedFont | null;
  readonly maskColor: string | null;
  /** BaseFont name from the original PDF, for tier-1 lookup. */
  readonly fontRawName: string;
  /** font.encoding from TextLine, for encodeText. */
  readonly fontFacts: import('../types/page-model').FontFacts;
  /** Whether this is an added text (TEXT_ADD) with no original position. */
  readonly isAdded: boolean;
}

export interface ExportImage {
  readonly id: string;
  readonly bbox: Rect;
  readonly currentBox: Rect;
  readonly deleted: boolean;
  readonly blobKey: string | null;
  readonly fit: FitMode | null;
  readonly maskColor: string | null;
}

export interface ExportPage {
  readonly pageIndex: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly lines: ExportTextLine[];
  readonly images: ExportImage[];
}

export interface ExportPayload {
  readonly originalBytes: Uint8Array;
  readonly pages: ExportPage[];
  /** catalogFontKey(family, style) → TTF bytes for tiers 2-4. */
  readonly fontBytes: Record<string, Uint8Array>;
  /** blobKey → PNG/JPEG bytes for IMAGE_REPLACE. */
  readonly imageBytes: Record<string, Uint8Array>;
}

// ─── Worker message protocol ──────────────────────────────────────────────────

export type WorkerInMessage = { readonly type: 'start'; readonly payload: ExportPayload };
export type WorkerOutMessage =
  | { readonly type: 'progress'; readonly pct: number }
  | { readonly type: 'done'; readonly bytes: Uint8Array }
  | { readonly type: 'error'; readonly message: string };

// ─── Worker entry point ───────────────────────────────────────────────────────

if (typeof self !== 'undefined' && typeof (self as unknown as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined') {
  self.addEventListener('message', (e: MessageEvent<WorkerInMessage>) => {
    if (e.data.type !== 'start') return;
    void runExport(e.data.payload);
  });
}

async function runExport(payload: ExportPayload): Promise<void> {
  try {
    const bytes = await exportPdf(payload, (pct) => {
      const msg: WorkerOutMessage = { type: 'progress', pct };
      (self as unknown as Worker).postMessage(msg);
    });
    const msg: WorkerOutMessage = { type: 'done', bytes };
    (self as unknown as Worker).postMessage(msg, [bytes.buffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const msg: WorkerOutMessage = { type: 'error', message };
    (self as unknown as Worker).postMessage(msg);
  }
}

// ─── Core export logic ────────────────────────────────────────────────────────

async function exportPdf(
  payload: ExportPayload,
  onProgress: (pct: number) => void,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(payload.originalBytes.slice());
  pdfDoc.registerFontkit(fontkit);

  const totalPages = payload.pages.length;
  const embeddedFonts = new Map<string, PDFFont>();

  for (let pi = 0; pi < totalPages; pi++) {
    const pageData = payload.pages[pi];
    if (!pageData) continue;
    const page = pdfDoc.getPages()[pageData.pageIndex];
    if (!page) continue;

    // Process lines on this page.
    for (const line of pageData.lines) {
      const isEdited = line.currentText !== line.text;
      const isMoved = line.currentBox.x !== line.box.x || line.currentBox.y !== line.box.y;
      const needsProcessing = line.deleted || isEdited || isMoved || line.isAdded || styleChanged(line.style, line.currentStyle);
      if (!needsProcessing) continue;

      // Mask at Position A (original position).
      if (!line.isAdded) {
        coverOriginalPosition(page, maskRect(line.box, line.origin, line.fontSize, line.style.italic), line.maskColor ?? '#ffffff');
      }

      // Draw patch at Position B if not deleted.
      if (!line.deleted) {
        const layoutLines = layoutText(
          line.currentText,
          line.currentStyle,
          patchOrigin(line),
          pageData.pageWidth,
          calibratedAdvance(line.isAdded ? null : { text: line.text, width: line.box.width, style: line.style }),
        ).lines;

        await drawTextPatch(
          page,
          layoutLines,
          line.currentStyle,
          line.resolvedFont,
          line.fontRawName,
          line.fontFacts,
          embeddedFonts,
          payload.fontBytes,
          pdfDoc,
        );
      }
    }

    // Process images on this page.
    for (const img of pageData.images) {
      const isReplaced = img.blobKey !== null;
      const isMoved = img.currentBox.x !== img.bbox.x || img.currentBox.y !== img.bbox.y;
      const isResized = img.currentBox.width !== img.bbox.width || img.currentBox.height !== img.bbox.height;
      const needsProcessing = img.deleted || isReplaced || isMoved || isResized;
      if (!needsProcessing) continue;

      // Mask at Position A (original bounding box).
      coverOriginalPosition(page, imageMaskRect(img.bbox), img.maskColor ?? '#ffffff');

      // Draw replacement/moved image at Position B if not deleted.
      if (!img.deleted && isReplaced && img.blobKey) {
        const imgBytes = payload.imageBytes[img.blobKey];
        if (imgBytes) {
          await drawReplacementImage(page, pdfDoc, imgBytes, img.currentBox, img.fit ?? 'contain');
        }
      }
    }

    onProgress(Math.round(((pi + 1) / totalPages) * 90));
  }

  onProgress(95);
  const bytes = await pdfDoc.save();
  onProgress(100);
  return bytes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Draw a solid rectangle over the original position (mask).
 * Uses the sampled background color, or white as a provisional fill.
 */
export function coverOriginalPosition(page: PDFPage, bbox: Rect, maskColor: string): void {
  const [r, g, b] = parseHexColor(maskColor);
  page.drawRectangle({
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
    color: rgb(r, g, b),
    borderWidth: 0,
  });
}

/** Parse a CSS #rrggbb hex color to [r, g, b] floats in [0, 1]. */
function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/**
 * Draw a text patch using the resolved font.
 * Tier 1: raw content stream with original font encoding.
 * Tiers 2-4: embedded font via fontkit.
 */
async function drawTextPatch(
  page: PDFPage,
  layoutLines: LayoutLine[],
  style: TextStyle,
  resolvedFont: ResolvedFont | null,
  fontRawName: string,
  fontFacts: import('../types/page-model').FontFacts,
  embeddedFonts: Map<string, PDFFont>,
  fontBytes: Record<string, Uint8Array>,
  pdfDoc: PDFDocument,
): Promise<void> {
  if (!layoutLines.length) return;

  const [cr, cg, cb] = parseHexColor(style.color);
  const hScaleFraction = style.hScale / 100;
  const rise = style.rise;

  if (resolvedFont?.tier === 1) {
    // Tier 1: reference existing font resource.
    const resourceName = findFontResourceName(page, fontRawName);
    if (resourceName) {
      // Composite (Identity) fonts use two-byte codes; simple fonts one byte.
      const codeWidth = fontFacts.encoding?.kind === 'composite' ? 4 : 2;
      for (const layoutLine of layoutLines) {
        const encoded = encodeText(layoutLine.text, fontFacts);
        if (!encoded) continue;

        const hexStr = PDFHexString.of(
          encoded.map((code) => code.toString(16).padStart(codeWidth, '0')).join(''),
        );

        const ops: PDFOperator[] = [
          pushGraphicsState(),
          setFillingRgbColor(cr, cg, cb),
        ];

        if (Math.abs(hScaleFraction - 1) > 0.001) {
          ops.push(concatTransformationMatrix(hScaleFraction, 0, 0, 1, layoutLine.x, layoutLine.y));
          ops.push(
            beginText(),
            setFontAndSize(resourceName, style.size),
            PDFOperator.of(PDFOperatorNames.MoveText, [PDFNumber.of(0), PDFNumber.of(rise)]),
            showText(hexStr),
            endText(),
          );
        } else {
          ops.push(
            beginText(),
            setFontAndSize(resourceName, style.size),
            moveText(layoutLine.x, layoutLine.y + rise),
            showText(hexStr),
            endText(),
          );
        }
        ops.push(popGraphicsState());
        page.pushOperators(...ops);
      }
      return;
    }
    // Fall through to tiers 2-4 if resource name not found.
  }

  // Tiers 2-4: embed the catalog file for this family and style (bold/italic), else the fallback.
  const embed = async (key: string): Promise<PDFFont | null> => {
    const cached = embeddedFonts.get(key);
    if (cached) return cached;
    const bytes = fontBytes[key];
    if (!bytes) return null;
    try {
      const font = await pdfDoc.embedFont(bytes, { subset: true });
      embeddedFonts.set(key, font);
      return font;
    } catch {
      return null;
    }
  };
  const variant = fontVariant(style.bold, style.italic);
  let pdfFont = resolvedFont && resolvedFont.tier !== 1 ? await embed(catalogFontKey(resolvedFont.cssFamily, variant)) : null;
  pdfFont ??= await embed(FALLBACK_FONT_KEY);

  if (!pdfFont) return;

  for (const layoutLine of layoutLines) {
    if (!layoutLine.text) continue;
    page.drawText(layoutLine.text, {
      x: layoutLine.x,
      y: layoutLine.y + rise,
      font: pdfFont,
      size: style.size,
      color: rgb(cr, cg, cb),
    });
  }
}

/**
 * Find the font's resource name (e.g. "F1") on this page by matching BaseFont.
 * Returns null if not found.
 */
function findFontResourceName(page: PDFPage, baseFont: string): string | null {
  const resources = page.node.Resources();
  if (!resources) return null;
  const fontResources = resources.lookupMaybe(PDFName.of('Font'), PDFDict);
  if (!fontResources) return null;
  for (const [key] of fontResources.entries()) {
    const fontDict = fontResources.lookupMaybe(key, PDFDict);
    if (!fontDict) continue;
    const bf = fontDict.lookupMaybe(PDFName.of('BaseFont'), PDFName)?.decodeText();
    if (bf === baseFont) return key.decodeText();
  }
  return null;
}

/** Draw a replacement image on the page using the specified fit mode. */
async function drawReplacementImage(
  page: PDFPage,
  pdfDoc: PDFDocument,
  imgBytes: Uint8Array,
  targetBox: Rect,
  fit: FitMode,
): Promise<void> {
  // Detect image format by header.
  const isPng =
    imgBytes[0] === 0x89 && imgBytes[1] === 0x50 && imgBytes[2] === 0x4e && imgBytes[3] === 0x47;

  let pdfImage;
  try {
    pdfImage = isPng
      ? await pdfDoc.embedPng(imgBytes)
      : await pdfDoc.embedJpg(imgBytes);
  } catch {
    return; // Cannot embed this image
  }

  const imgSize = { width: pdfImage.width, height: pdfImage.height };
  const destRect = fitImageRect(targetBox, imgSize, fit);

  page.drawImage(pdfImage, {
    x: destRect.x,
    y: destRect.y,
    width: destRect.width,
    height: destRect.height,
  });
}
