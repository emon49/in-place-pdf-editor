import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFDocument,
} from 'pdf-lib';
import type { DescriptorHints } from './font-resolver';
import { encodingCharacters } from './standard-encodings';
import { embeddingPermission, readCmapCodePoints, readFsType, readSfntTables } from './sfnt';
import { parseToUnicode } from './to-unicode';
import type { FontEmbedding, FontEncoding, FontFacts, FontLicence } from '../types/page-model';

/** The Standard 14 fonts: a reference to one of these needs no embedded program. */
const STANDARD_14 = new Set([
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
  'Symbol', 'ZapfDingbats',
]);

export type ProgramType = NonNullable<FontEmbedding['programType']>;

/** What the document's own font dictionary says (PDF.js is deliberately not consulted: it hides substitution). */
export interface FontDictionaryFacts {
  readonly baseFont: string;
  readonly subtype: string | null;
  readonly hints: DescriptorHints | null;
  readonly encoding: FontEncoding | null;
  readonly program: { readonly type: ProgramType; readonly bytes: Uint8Array | null; readonly size: number } | null;
  readonly toUnicode: string | null;
}

const NAME = (value: string) => PDFName.of(value);

function lookupDict(source: PDFDict | undefined, key: string): PDFDict | undefined {
  return source?.lookupMaybe(NAME(key), PDFDict);
}

function nameOf(dict: PDFDict | undefined, key: string): string | null {
  return dict?.lookupMaybe(NAME(key), PDFName)?.decodeText() ?? null;
}

function numberOf(dict: PDFDict | undefined, key: string): number | null {
  return dict?.lookupMaybe(NAME(key), PDFNumber)?.asNumber() ?? null;
}

/** Decodes a stream's filters; null when it cannot be decoded. */
function decodeStream(stream: PDFStream | undefined): Uint8Array | null {
  if (!stream) return null;
  try {
    return stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
  } catch {
    return null;
  }
}

/** The page's font dictionaries (page resources, inherited resources, and the resources of Form XObjects). */
function* fontDictionaries(doc: PDFDocument, pageIndex: number): Generator<PDFDict> {
  const seen = new Set<PDFDict>();
  function* fromResources(resources: PDFDict | undefined, depth: number): Generator<PDFDict> {
    if (!resources || seen.has(resources)) return;
    seen.add(resources);
    const fonts = lookupDict(resources, 'Font');
    if (fonts) {
      for (const [key] of fonts.entries()) {
        const font = fonts.lookupMaybe(key, PDFDict);
        if (font) yield font;
      }
    }
    const xobjects = lookupDict(resources, 'XObject');
    if (xobjects && depth < 2) {
      for (const [key] of xobjects.entries()) {
        const form = xobjects.lookupMaybe(key, PDFStream);
        if (form) yield* fromResources(form.dict.lookupMaybe(NAME('Resources'), PDFDict), depth + 1);
      }
    }
  }
  yield* fromResources(doc.getPage(pageIndex).node.Resources(), 0);
}

/** The font dictionary on a page whose BaseFont matches the name PDF.js reports. */
export function findFontDictionary(doc: PDFDocument, pageIndex: number, baseFont: string): PDFDict | undefined {
  for (const font of fontDictionaries(doc, pageIndex)) if (nameOf(font, 'BaseFont') === baseFont) return font;
  return undefined;
}

function programTypeOf(key: string, descriptor: PDFDict, bytes: Uint8Array | null): ProgramType {
  if (key === 'FontFile') return 'Type1';
  if (key === 'FontFile2') return 'TrueType';
  const subtype = nameOf(descriptor.lookupMaybe(NAME(key), PDFStream)?.dict, 'Subtype');
  if (subtype === 'OpenType') return 'OpenType';
  if (bytes && String.fromCharCode(...bytes.subarray(0, 4)) === 'OTTO') return 'OpenType';
  return 'CFF';
}

/** Reads the dictionary facts of one font. Throws only on unexpected structure; callers degrade to unknown. */
export function readFontDictionary(font: PDFDict): FontDictionaryFacts {
  const subtype = nameOf(font, 'Subtype');
  const composite = subtype === 'Type0';
  const descendant = composite ? font.lookupMaybe(NAME('DescendantFonts'), PDFArray)?.lookupMaybe(0, PDFDict) : undefined;
  const descriptor = lookupDict(descendant ?? font, 'FontDescriptor');

  const encodingEntry = font.lookup(NAME('Encoding'));
  let encodingName: string | null = null;
  if (encodingEntry instanceof PDFName) encodingName = encodingEntry.decodeText();
  else if (encodingEntry instanceof PDFDict) encodingName = nameOf(encodingEntry, 'BaseEncoding');
  else if (encodingEntry instanceof PDFStream) encodingName = nameOf(encodingEntry.dict, 'CMapName');
  const encoding: FontEncoding = { kind: composite ? 'composite' : 'simple', name: encodingName };

  let program: FontDictionaryFacts['program'] = null;
  if (descriptor) {
    for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
      const stream = descriptor.lookupMaybe(NAME(key), PDFStream);
      if (!stream) continue;
      const bytes = decodeStream(stream);
      program = { type: programTypeOf(key, descriptor, bytes), bytes, size: bytes?.byteLength ?? 0 };
      break;
    }
  }

  const toUnicodeBytes = decodeStream(font.lookupMaybe(NAME('ToUnicode'), PDFStream));
  return {
    baseFont: nameOf(font, 'BaseFont') ?? '',
    subtype,
    hints: descriptor
      ? { flags: numberOf(descriptor, 'Flags'), italicAngle: numberOf(descriptor, 'ItalicAngle'), weight: numberOf(descriptor, 'FontWeight') }
      : null,
    encoding,
    program,
    toUnicode: toUnicodeBytes ? new TextDecoder('latin1').decode(toUnicodeBytes) : null,
  };
}

const isSfnt = (type: ProgramType) => type === 'TrueType' || type === 'OpenType';

/** Licence from the program's `OS/2` table. Unknown (null) when an sfnt program cannot be parsed. */
function licenceOf(program: NonNullable<FontDictionaryFacts['program']>): FontLicence | null {
  if (!isSfnt(program.type)) return { fsType: null, editable: true, restriction: null };
  if (!program.bytes) return null;
  try {
    const fsType = readFsType(program.bytes);
    return { fsType, ...embeddingPermission(fsType) };
  } catch {
    return null;
  }
}

/**
 * Characters the font can draw, in order of preference (D3): ToUnicode, the program's own cmap, the named
 * standard encoding, otherwise unknown. A damaged embedded program leaves coverage unknown.
 */
function coverageOf(facts: FontDictionaryFacts): ReadonlySet<string> | null {
  const { program, toUnicode, encoding } = facts;
  if (program && isSfnt(program.type) && !program.bytes) return null;
  if (program && isSfnt(program.type) && program.bytes) {
    try {
      readSfntTables(program.bytes);
    } catch {
      return null;
    }
  }
  if (toUnicode) {
    const mapped = parseToUnicode(toUnicode);
    if (mapped.size > 0) return mapped;
  }
  if (program?.bytes && isSfnt(program.type)) {
    try {
      const points = readCmapCodePoints(program.bytes);
      if (points) return new Set([...points].map((cp) => String.fromCodePoint(cp)));
    } catch {
      return null;
    }
  }
  if (!program && encoding?.kind === 'simple') return encodingCharacters(encoding.name);
  return null;
}

/** Assembles the facts later milestones need to reuse a document's own font (ADR-0007 tier 1). */
export function fontFactsFromDictionary(facts: FontDictionaryFacts): FontFacts {
  const { program } = facts;
  const embedding: FontEmbedding = {
    embedded: program !== null,
    standardReference: program === null && STANDARD_14.has(facts.baseFont),
    programType: program?.type ?? null,
    programSize: program?.size ?? 0,
  };
  return {
    rawName: facts.baseFont,
    subtype: facts.subtype,
    embedding,
    licence: program ? licenceOf(program) : { fsType: null, editable: true, restriction: null },
    encoding: facts.encoding,
    coverage: coverageOf(facts),
  };
}

/** Facts for a font the document's dictionaries could not be matched to: everything beyond the name is unknown. */
export function unknownFontFacts(rawName: string): FontFacts {
  return { rawName, subtype: null, embedding: null, licence: null, encoding: null, coverage: null };
}

