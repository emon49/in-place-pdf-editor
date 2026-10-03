import type { FontClass, TextLine } from '../types/page-model';
import type { ResolvedFont } from '../types/operations';
import { lookupCatalog, lookupSubstitute, normalizeFamily } from './font-catalog';
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

// ─── Font Resolution Chain (ADR-0007) ─────────────────────────────────────────

/** Liberation fallback family by FontClass. */
const LIBERATION_BY_CLASS: Record<FontClass, string> = {
  sans: 'Liberation Sans',
  serif: 'Liberation Serif',
  mono: 'Liberation Mono',
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
