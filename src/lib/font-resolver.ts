import type { FontClass } from '../types/page-model';

/**
 * Family normalization and Font Class (TY-2, TY-4). The Font Resolution Chain itself (ADR-0007) arrives in M2;
 * this module only identifies a font from what the document says about it.
 */

/** Font descriptor facts that outrank the name when the document provides them. */
export interface DescriptorHints {
  /** PDF `FontDescriptor` `Flags` bit field. */
  readonly flags: number | null;
  readonly italicAngle: number | null;
  readonly weight: number | null;
}

export interface FontIdentity {
  readonly family: string;
  readonly subsetPrefix: string | null;
  readonly fontClass: FontClass;
  readonly bold: boolean;
  readonly italic: boolean;
}

const FLAG_FIXED_PITCH = 1 << 0;
const FLAG_SERIF = 1 << 1;
const FLAG_ITALIC = 1 << 6;
const FLAG_FORCE_BOLD = 1 << 18;

const SUBSET_PREFIX = /^([A-Z]{6})\+/;
const WEIGHT_WORDS = /(Bold|Black|Heavy|Semibold|Demibold|Demi|Extrabold|Ultrabold)/i;
const ITALIC_WORDS = /(Italic|Oblique|Slanted)/i;
const PROTECTED_COMPOUNDS = ['DejaVu', 'OpenSans', 'IBMPlex', 'PTSans', 'PTSerif'];

/** Strips PostScript decoration like `PSMT`, `MT` and `PS` from the end of a name part. */
const stripPostScript = (part: string): string => part.replace(/(PSMT|MT|PS)$/, '');

function spaceCamelCase(name: string): string {
  let guarded = name;
  PROTECTED_COMPOUNDS.forEach((word, i) => (guarded = guarded.replaceAll(word, `\uE000${i}\uE001 `)));
  const spaced = guarded.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.replace(/\uE000(\d+)\uE001/g, (_, i: string) => PROTECTED_COMPOUNDS[Number(i)] ?? '');
}

export interface ParsedFontName {
  readonly family: string;
  readonly subsetPrefix: string | null;
  /** The style words found in the name (e.g. `Bold`, `Oblique`). */
  readonly styleText: string;
}

/** `BWODTG+Times-Bold` → family `Times`, prefix `BWODTG`, style `Bold`. */
export function parseFontName(rawName: string): ParsedFontName {
  const prefixMatch = SUBSET_PREFIX.exec(rawName);
  const subsetPrefix = prefixMatch?.[1] ?? null;
  const name = rawName.replace(SUBSET_PREFIX, '').replace(/-\d+$/, ''); // numeric suffix: `-2000`
  const [head = '', ...rest] = name.split(/[-,]/);
  const cleanedHead = stripPostScript(head);
  // `ArialBold` style words glued onto the family are also style, not name.
  const gluedStyle = /(Bold|Italic|Oblique)+$/.exec(cleanedHead);
  const base = gluedStyle && gluedStyle.index > 0 ? cleanedHead.slice(0, gluedStyle.index) : cleanedHead;
  const styleText = [gluedStyle?.[0] ?? '', ...rest.map(stripPostScript)].join(' ');
  return { family: spaceCamelCase(base), subsetPrefix, styleText };
}

function classFromName(family: string): FontClass {
  if (/courier|mono|consolas|menlo|typewriter|fixed|lucida console|andale/i.test(family)) return 'mono';
  if (/times|georgia|garamond|palatino|minion|bookman|cambria|century|serif(?!.*sans)|baskerville|caslon|didot|\bsong\b/i.test(family) && !/sans/i.test(family))
    return 'serif';
  return 'sans';
}

/**
 * Normalized family, Font Class, weight and style. Descriptor flags, italic angle and weight win where the
 * document provides them; the name decides otherwise (font-detection spec).
 */
export function identifyFont(rawName: string, hints: DescriptorHints | null = null): FontIdentity {
  const { family, subsetPrefix, styleText } = parseFontName(rawName);
  const flags = hints?.flags ?? null;
  let fontClass: FontClass;
  if (flags !== null) fontClass = flags & FLAG_FIXED_PITCH ? 'mono' : flags & FLAG_SERIF ? 'serif' : 'sans';
  else fontClass = classFromName(family);

  const bold =
    WEIGHT_WORDS.test(styleText) ||
    (hints?.weight ?? 0) >= 600 ||
    (flags !== null && (flags & FLAG_FORCE_BOLD) !== 0);
  const italic =
    ITALIC_WORDS.test(styleText) ||
    (hints?.italicAngle ?? 0) !== 0 ||
    (flags !== null && (flags & FLAG_ITALIC) !== 0);
  return { family, subsetPrefix, fontClass, bold, italic };
}
