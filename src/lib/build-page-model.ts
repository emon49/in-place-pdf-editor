import type { PDFDocument } from 'pdf-lib';
import { correlateSpans, walkOperatorList } from './content-stream-state';
import type { PageGeometry } from './coordinates';
import { findFontDictionary, fontFactsFromDictionary, readFontDictionary, unknownFontFacts } from './font-descriptor';
import { identifyFont } from './font-resolver';
import { fontSizeFromMatrix, horizontalScalingFromMatrix, lineHeight } from './font-style-extractor';
import { extractPalette } from './pdf-color-extractor';
import { extractImages, type ImageSourcePage } from './pdf-image-extractor';
import { readPageText, type PdfJsFont, type TextSourcePage } from './pdf-text-extractor';
import { lineId, mergeFragments, readingOrder, runBox, runHead } from './text-geometry';
import type { FontFacts, PageModel, TextLine } from '../types/page-model';

export interface BuildPageModelContext {
  readonly page: TextSourcePage & ImageSourcePage;
  readonly pageIndex: number;
  readonly geometry: PageGeometry;
  /** The document's pdf-lib handle; created lazily by the registry. */
  readonly getPdfLib: () => Promise<PDFDocument>;
}

interface ResolvedFont {
  readonly identity: ReturnType<typeof identifyFont>;
  readonly facts: FontFacts;
  readonly fontRef: string;
}

/** Facts for one PDF.js font, from the document's own dictionary; unknown on any failure (font-detection spec). */
async function resolveFont(ctx: BuildPageModelContext, fontName: string, font: PdfJsFont | undefined): Promise<ResolvedFont> {
  const rawName = font?.name ?? fontName;
  const fontRef = font?.loadedName ?? fontName;
  try {
    const doc = await ctx.getPdfLib();
    const dict = findFontDictionary(doc, ctx.pageIndex, rawName);
    if (dict) {
      const parsed = readFontDictionary(dict);
      return { identity: identifyFont(rawName, parsed.hints), facts: fontFactsFromDictionary(parsed), fontRef };
    }
  } catch {
    // fall through: the name still identifies the family and style
  }
  return { identity: identifyFont(rawName), facts: unknownFontFacts(rawName), fontRef };
}

/**
 * Builds a page's read model: fragments → styled fragments → merged Text Lines → reading order (D1, D5, D6).
 * Background colours and sampled text colours are filled in later by the sampler.
 */
export async function buildPageModel(ctx: BuildPageModelContext): Promise<PageModel> {
  const text = await readPageText(ctx.page);
  const styled = correlateSpans(text.fragments, walkOperatorList(text.operatorList));
  const runs = readingOrder(mergeFragments(styled, ctx.geometry), ctx.geometry).filter((run) => run.text.trim() !== '');

  const fonts = new Map<string, Promise<ResolvedFont>>();
  const fontFor = (name: string) => {
    const existing = fonts.get(name);
    if (existing) return existing;
    const created = resolveFont(ctx, name, text.fonts.get(name));
    fonts.set(name, created);
    return created;
  };

  const lines: TextLine[] = [];
  for (const [sequence, run] of runs.entries()) {
    const head = runHead(run);
    const font = await fontFor(head.fontName);
    const fontSize = fontSizeFromMatrix(head.matrix);
    lines.push({
      id: lineId(ctx.pageIndex, sequence),
      pageIndex: ctx.pageIndex,
      text: run.text,
      origin: { x: head.matrix[4], y: head.matrix[5] },
      box: runBox(run),
      matrix: head.matrix,
      fontRef: font.fontRef,
      ...font.identity,
      fontSize,
      hScale: head.match === 'none' ? horizontalScalingFromMatrix(head.matrix) : head.style.hScale,
      charSpacing: head.style.charSpacing,
      wordSpacing: head.style.wordSpacing,
      rise: head.style.rise,
      renderMode: head.style.renderMode,
      lineHeight: lineHeight(head.ascent, head.descent),
      color: head.colorResolved ? { hex: head.style.colorKey, source: 'exact' } : { hex: '#000000', source: 'pending' },
      background: { status: 'pending' },
      lockReason: run.lockReason,
      font: font.facts,
    });
  }
  const images = await extractImages(ctx.page, ctx.pageIndex);
  const palette = extractPalette(lines);
  return { pageIndex: ctx.pageIndex, lines, images, palette };
}
