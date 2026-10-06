import type { TextContent, TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api';
import type { Matrix } from './coordinates';
import { DEFAULT_STYLE, type Fragment } from './text-geometry';

/** The slice of PDF.js `PDFPageProxy` that text reading needs (keeps the reader testable without PDF.js). */
export interface TextSourcePage {
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
  getTextContent(params: { disableNormalization: boolean }): Promise<TextContent>;
  commonObjs: { get(id: string): unknown };
}

/** What PDF.js knows about a font object (only populated once the operator list has been read). */
export interface PdfJsFont {
  readonly name: string;
  readonly loadedName?: string;
  readonly isType3Font?: boolean;
  readonly vertical?: boolean;
  readonly missingFile?: boolean;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly ascent?: number;
  readonly descent?: number;
  readonly fallbackName?: string;
  /** Char code → character in PDF.js's registered font face (needs `fontExtraProperties`). */
  readonly toFontChar?: ArrayLike<number | undefined>;
  /** Char code → Unicode, as PDF.js's ToUnicode map or identity range (needs `fontExtraProperties`). */
  readonly toUnicode?: { readonly _map?: ArrayLike<string | undefined>; readonly firstChar?: number; readonly lastChar?: number };
  /** Set when PDF.js substitutes an installed font for a non-embedded one; `css` is its font stack. */
  readonly systemFontInfo?: { readonly css?: string };
}

export interface PageText {
  readonly operatorList: { fnArray: number[]; argsArray: unknown[] };
  /** Fragments in stream order with default drawing state (colour etc. are added by the span correlation). */
  readonly fragments: readonly Fragment[];
  /** PDF.js font id → font object. */
  readonly fonts: ReadonlyMap<string, PdfJsFont>;
}

const DEFAULT_ASCENT = 0.8;
const DEFAULT_DESCENT = -0.2;

function readFont(page: TextSourcePage, id: string): PdfJsFont | undefined {
  try {
    return page.commonObjs.get(id) as PdfJsFont;
  } catch {
    return undefined; // not resolved: the operator list did not reference it
  }
}

/**
 * Reads a page's text fragments (D1). The operator list comes first because it resolves the font objects and
 * carries the colours and text state; normalization is disabled so the document's own characters survive.
 */
export async function readPageText(page: TextSourcePage): Promise<PageText> {
  const operatorList = await page.getOperatorList();
  const content = await page.getTextContent({ disableNormalization: true });

  const fonts = new Map<string, PdfJsFont>();
  const fragments: Fragment[] = [];
  for (const item of content.items) {
    if (!('str' in item)) continue; // marked-content markers
    const text = item as TextItem;
    // PDF.js emits empty items as line-end markers and as placeholders for wide gaps; they carry no glyphs,
    // and a placeholder spanning a gap would wrongly bridge two cells.
    if (text.str === '') continue;
    const style: TextStyle | undefined = content.styles[text.fontName];
    const font = fonts.get(text.fontName) ?? readFont(page, text.fontName);
    if (font) fonts.set(text.fontName, font);
    fragments.push({
      text: text.str,
      matrix: text.transform as unknown as Matrix,
      width: text.width,
      fontName: text.fontName,
      ascent: style?.ascent ?? font?.ascent ?? DEFAULT_ASCENT,
      descent: style?.descent ?? font?.descent ?? DEFAULT_DESCENT,
      vertical: style?.vertical ?? font?.vertical ?? false,
      type3: font?.isType3Font ?? false,
      style: DEFAULT_STYLE,
    });
  }
  return { operatorList, fragments, fonts };
}
