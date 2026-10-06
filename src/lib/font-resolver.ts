import type { FontClass, FontFacts, TextLine } from '../types/page-model';
import type { ResolvedFont } from '../types/operations';
import { lookupCatalog, lookupSubstitute, normalizeFamily, texFontStyle } from './font-catalog';
import { fetchCatalogFont, fetchGoogleFont, getConsent, type ConsentState } from './font-fetcher';
import { encodeText } from './font-encoder';

/**
 * Family normalization and Font Class (TY-2, TY-4). Extended in M2 with the Font Resolution Chain (ADR-0007).
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
  // TeX fonts name their style (CMBX12 = bold serif) and often carry only the Symbolic flag.
  const tex = texFontStyle(family);
  let fontClass: FontClass;
  if (tex) fontClass = tex.fontClass;
  // Many fonts set neither bit, so only a set bit is evidence; otherwise the name decides.
  else if (flags !== null && flags & FLAG_FIXED_PITCH) fontClass = 'mono';
  else if (flags !== null && flags & FLAG_SERIF) fontClass = 'serif';
  else fontClass = classFromName(family);

  const bold =
    tex?.bold === true ||
    WEIGHT_WORDS.test(styleText) ||
    (hints?.weight ?? 0) >= 600 ||
    (flags !== null && (flags & FLAG_FORCE_BOLD) !== 0);
  const italic =
    tex?.italic === true ||
    ITALIC_WORDS.test(styleText) ||
    (hints?.italicAngle ?? 0) !== 0 ||
    (flags !== null && (flags & FLAG_ITALIC) !== 0);
  return { family, subsetPrefix, fontClass, bold, italic };
}

// ─── Font Resolution Chain (ADR-0007) ─────────────────────────────────────────

/** Fallback family by FontClass (self-hosted; metric-compatible with Arial / Times / Courier). */
const LIBERATION_BY_CLASS: Record<FontClass, string> = {
  sans: 'Liberation Sans',
  serif: 'Tinos',
  mono: 'Cousine',
};

/**
 * Walk the four-tier Font Resolution Chain for the given line and new text.
 *
 * Tier 1: Embedded Original Font (fsType must allow editing, coverage must
 *         include all characters of newText, and encodeText must succeed).
 * Tier 2: Self-hosted catalog font or consented Google Font matching the family.
 * Tier 3: Metric-compatible substitute from the substitute table.
 * Tier 4: Liberation by fontClass — always succeeds for Latin/Greek/Cyrillic.
 */
export async function resolveFont(
  line: TextLine,
  newText: string,
  consent: ConsentState,
): Promise<ResolvedFont> {
  const { font, fontClass, fontRef } = line;

  // ── Tier 1: Embedded Original Font ───────────────────────────────────────
  const tier1Eligible =
    font.licence?.editable === true &&
    font.coverage !== null &&
    [...newText].every((ch) => (font.coverage as ReadonlySet<string>).has(ch)) &&
    encodeText(newText, font) !== null;

  if (tier1Eligible) {
    return {
      tier: 1,
      source: 'original',
      pdfFontRef: fontRef,
      loadedName: fontRef,
      reason: 'Original font',
    };
  }

  // ── Tier 2: Catalog / Google Font ─────────────────────────────────────────
  const normalizedFamily = normalizeFamily(line.family);
  const catalogEntry = lookupCatalog(line.family);
  if (catalogEntry) {
    try {
      const cssFamily = await fetchCatalogFont(catalogEntry);
      const isSub = normalizeFamily(catalogEntry.family) !== normalizedFamily;
      return {
        tier: 2,
        source: 'catalog',
        cssFamily,
        reason: isSub
          ? `Original font '${line.family}' → using ${catalogEntry.family} (metric-compatible)`
          : `Catalog font: ${catalogEntry.family}`,
      };
    } catch {
      // Fall through to next tier
    }
  } else {
    // Try Google Fonts if the family isn't in the catalog
    const effectiveConsent = getConsent(line.family) !== 'pending' ? getConsent(line.family) : consent;
    if (effectiveConsent !== 'denied' && effectiveConsent !== 'pending') {
      const cssFamily = await fetchGoogleFont(line.family, effectiveConsent);
      if (cssFamily) {
        return {
          tier: 2,
          source: 'google',
          cssFamily,
          reason: `Google Fonts: ${line.family}`,
        };
      }
    }
  }

  // ── Tier 3: Metric-Compatible Substitute ─────────────────────────────────
  const substituteName = lookupSubstitute(line.family);
  if (substituteName) {
    const subEntry = lookupCatalog(substituteName);
    if (subEntry) {
      try {
        const cssFamily = await fetchCatalogFont(subEntry);
        return {
          tier: 3,
          source: 'substitute',
          cssFamily,
          reason: `'${line.family}' → ${subEntry.family} (metric-compatible substitute)`,
        };
      } catch {
        // Fall through to tier 4
      }
    }
  }

  // ── Tier 4: Liberation Fallback ───────────────────────────────────────────
  const liberationFamily = LIBERATION_BY_CLASS[fontClass];
  const liberationEntry = lookupCatalog(liberationFamily);
  let cssFamilyFallback = liberationFamily;
  if (liberationEntry) {
    try {
      cssFamilyFallback = await fetchCatalogFont(liberationEntry);
    } catch {
      // Use the family name anyway; fonts may be system-available
    }
  }
  return {
    tier: 4,
    source: 'liberation',
    cssFamily: cssFamilyFallback,
    reason: `${liberationFamily} (${fontClass} fallback)`,
  };
}

// ─── Synchronous resolution shared by preview and export ─────────────────────

/** The parts of a (preview) Text Line the resolution chain reads. */
export interface FontResolutionInput {
  readonly font: FontFacts;
  /** PDF.js `loadedName` of the original font. */
  readonly fontRef: string;
  readonly family: string;
  readonly fontClass: FontClass;
  /** Catalog family the user picked, or null to keep the original. */
  readonly fontFamilyOverride: string | null;
}

const GENERIC_BY_CLASS: Record<FontClass, string> = {
  sans: 'sans-serif',
  serif: 'serif',
  mono: 'monospace',
};

/**
 * Char codes for `text` in the original font, or null when it cannot draw it in both places:
 * export needs the encoded codes, preview needs each code in the face PDF.js draws the font with.
 */
function originalFontCodes(font: FontFacts, text: string): number[] | null {
  const { coverage, face } = font;
  if (font.licence?.editable !== true || !coverage || !face) return null;
  for (const ch of text) if (!coverage.has(ch)) return null;
  const codes = encodeText(text, font);
  if (!codes || codes.some((code) => !face.glyphMap.has(code))) return null;
  return codes;
}

/**
 * The Font Resolution Chain without network access (ADR-0007): an explicit catalog choice, then
 * the embedded original font, then the catalog / metric-compatible substitute for the family,
 * then Liberation by Font Class. Preview and export both read this result.
 */
export function resolveFontSync(input: FontResolutionInput, text: string): ResolvedFont {
  if (input.fontFamilyOverride) {
    const chosen = lookupCatalog(input.fontFamilyOverride);
    if (chosen) return { tier: 2, source: 'catalog', cssFamily: chosen.cssFamily, reason: `Chosen font: ${chosen.family}` };
  }

  if (originalFontCodes(input.font, text.replace(/\n/g, ''))) {
    return { tier: 1, source: 'original', pdfFontRef: input.fontRef, loadedName: input.fontRef, reason: 'Original font' };
  }

  const entry = input.family ? lookupCatalog(input.family) : null;
  if (entry) {
    return normalizeFamily(entry.family) === normalizeFamily(input.family)
      ? { tier: 2, source: 'catalog', cssFamily: entry.cssFamily, reason: `Catalog font: ${entry.family}` }
      : {
          tier: 3,
          source: 'substitute',
          cssFamily: entry.cssFamily,
          reason: `'${input.family}' → ${entry.family} (metric-compatible substitute)`,
        };
  }

  const fallback = LIBERATION_BY_CLASS[input.fontClass];
  return { tier: 4, source: 'liberation', cssFamily: fallback, reason: `${fallback} (${input.fontClass} fallback)` };
}

/** How a patch line is drawn in the browser: a CSS font stack and the characters to draw with it. */
export interface PatchFont {
  readonly fontFamily: string;
  readonly text: string;
}

function cssFamilyName(name: string): string {
  return `"${name.replace(/["\\]/g, '\\$&')}"`;
}

/**
 * The browser font for one patch line of `text` (no newlines). Tier 1 draws exactly as the PDF.js
 * canvas does: char codes mapped into the face PDF.js uses for the original font (embedded or its
 * installed substitute). Other tiers use the catalog family. Fallbacks match the line's Font Class.
 */
export function patchFont(rf: ResolvedFont, font: FontFacts, fontClass: FontClass, text: string): PatchFont {
  const generic = GENERIC_BY_CLASS[fontClass];
  if (rf.tier === 1) {
    const codes = originalFontCodes(font, text);
    const face = font.face;
    if (codes && face) {
      const chars = codes.map((code) => String.fromCodePoint(face.glyphMap.get(code) as number)).join('');
      return { fontFamily: face.family, text: chars };
    }
    return { fontFamily: `${cssFamilyName(LIBERATION_BY_CLASS[fontClass])}, ${generic}`, text };
  }
  return { fontFamily: `${cssFamilyName(rf.cssFamily)}, ${generic}`, text };
}
