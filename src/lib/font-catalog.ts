/**
 * Font Catalog manifest and substitute table for the Font Resolution Chain (ADR-0007).
 *
 * Catalog fonts are self-hosted under /fonts/ (OFL; licences in /fonts/licenses/), each with
 * regular, bold, italic and bold-italic files so edited text keeps its weight and slant in both the
 * preview and the export. The substitute table maps common commercial faces to metric-compatible ones.
 */
import type { FontClass } from '../types/page-model';

export type FontVariant = 'regular' | 'bold' | 'italic' | 'boldItalic';

export interface CatalogEntry {
  readonly family: string;
  /** Normalized lowercase family name for lookup. */
  readonly key: string;
  /** Paths under /fonts/ for each style. */
  readonly files: Readonly<Record<FontVariant, string>>;
  /** CSS font-family name after @font-face registration. */
  readonly cssFamily: string;
}

export function fontVariant(bold: boolean, italic: boolean): FontVariant {
  if (bold && italic) return 'boldItalic';
  if (bold) return 'bold';
  return italic ? 'italic' : 'regular';
}

function entry(family: string, file: string): CatalogEntry {
  const path = (style: string) => `/fonts/${file}-${style}.ttf`;
  return {
    family,
    key: family.toLowerCase(),
    cssFamily: family,
    files: { regular: path('Regular'), bold: path('Bold'), italic: path('Italic'), boldItalic: path('BoldItalic') },
  };
}

/** Self-hosted families. Tinos/Cousine/Liberation Sans match Times/Courier/Arial metrics. */
const CATALOG_ENTRIES: CatalogEntry[] = [
  entry('Liberation Sans', 'LiberationSans'),
  entry('Tinos', 'Tinos'),
  entry('Cousine', 'Cousine'),
  // Metric-compatible with Calibri / Cambria / Georgia.
  entry('Carlito', 'Carlito'),
  entry('Caladea', 'Caladea'),
  entry('Gelasio', 'Gelasio'),
  // Computer Modern Unicode, for TeX / LaTeX documents.
  entry('CMU Serif', 'CMUSerif'),
  entry('CMU Sans Serif', 'CMUSansSerif'),
  entry('CMU Typewriter Text', 'CMUTypewriterText'),
];

/** Maps normalized commercial family names to catalog family names (metric-compatible substitutes). */
const SUBSTITUTE_TABLE: Record<string, string> = {
  // Microsoft / Apple core faces
  'arial': 'Liberation Sans',
  'arial narrow': 'Liberation Sans',
  'helvetica': 'Liberation Sans',
  'helvetica neue': 'Liberation Sans',
  'arimo': 'Liberation Sans',
  'times': 'Tinos',
  'times new roman': 'Tinos',
  'times roman': 'Tinos',
  'liberation serif': 'Tinos',
  'courier': 'Cousine',
  'courier new': 'Cousine',
  'liberation mono': 'Cousine',
  // Microsoft Office faces
  'calibri': 'Carlito',
  'cambria': 'Caladea',
  'georgia': 'Gelasio',
  'trebuchet ms': 'Liberation Sans',
  'verdana': 'Liberation Sans',
  'tahoma': 'Liberation Sans',
  'segoe ui': 'Liberation Sans',
  // Common sans fallbacks
  'myriad pro': 'Liberation Sans',
  'gill sans': 'Liberation Sans',
  'franklin gothic': 'Liberation Sans',
  'frutiger': 'Liberation Sans',
  'univers': 'Liberation Sans',
  // Common serif fallbacks
  'minion pro': 'Tinos',
  'garamond': 'Tinos',
  'palatino': 'Tinos',
  'book antiqua': 'Tinos',
  // Monospace
  'consolas': 'Cousine',
  'monaco': 'Cousine',
  'menlo': 'Cousine',
};

/** Index of catalog entries by normalized family name. */
const CATALOG_INDEX = new Map<string, CatalogEntry>(CATALOG_ENTRIES.map((e) => [e.key, e]));

/** Normalize a family name for catalog lookup. */
export function normalizeFamily(family: string): string {
  return family.toLowerCase().trim().replace(/\s+/g, ' ');
}

export interface TexFontStyle {
  readonly fontClass: FontClass;
  readonly bold: boolean;
  readonly italic: boolean;
}

// Computer Modern (cm*), EC / cm-super (ec*, sf*) shape codes, e.g. CMBX12, ECTI1000, SFRM1095.
const TEX_ROMAN = new Set(['r', 'rm', 'b', 'bx', 'bxti', 'bxsl', 'bi', 'bl', 'ti', 'sl', 'csc', 'cc', 'u', 'dunh', 'ff', 'fi', 'fib', 'mi', 'mib', 'sy', 'bsy', 'ex']);
const TEX_SANS = new Set(['ss', 'ssbx', 'ssi', 'ssdc', 'ssq', 'ssqi', 'sx', 'si', 'sxi']);
const TEX_MONO = new Set(['tt', 'itt', 'sltt', 'tcsc', 'vtt', 'it', 'st', 'tc', 'tti']);

/**
 * Class, weight and slant from a TeX font name (Computer Modern, EC, cm-super, Latin Modern).
 * TeX fonts encode style in the name and often carry no usable descriptor flags. Null if not TeX.
 */
export function texFontStyle(family: string): TexFontStyle | null {
  const f = family.toLowerCase().replace(/[\s_-]/g, '');
  const lm = /^lm(roman|sans|mono|typewriter)/.exec(f);
  if (lm) {
    const kind = lm[1];
    return {
      fontClass: kind === 'sans' ? 'sans' : kind === 'roman' ? 'serif' : 'mono',
      bold: /bold|demi/.test(f),
      italic: /italic|slant|oblique/.test(f),
    };
  }
  const tex = /^(?:cm|ec|sf)([a-z]+)\d*$/.exec(f);
  const shape = tex?.[1];
  if (!shape) return null;
  const fontClass: FontClass | null = TEX_ROMAN.has(shape) ? 'serif' : TEX_SANS.has(shape) ? 'sans' : TEX_MONO.has(shape) ? 'mono' : null;
  if (!fontClass) return null;
  const bold = /^(b|bx|sx|mib|bsy)/.test(shape) || shape === 'ssbx' || shape === 'sxi';
  const italic = /(ti|sl|bi|bl|mi|u)$/.test(shape) || ['ssi', 'ssqi', 'si', 'sxi', 'itt', 'sltt', 'it', 'st', 'tti'].includes(shape);
  return { fontClass, bold, italic };
}

const CMU_BY_CLASS: Record<FontClass, string> = { serif: 'CMU Serif', sans: 'CMU Sans Serif', mono: 'CMU Typewriter Text' };

/**
 * Looks up the font catalog by (normalized) family name. Returns the CatalogEntry
 * directly, via the substitute table, or for TeX fonts the matching CMU face; null when not found.
 */
export function lookupCatalog(family: string): CatalogEntry | null {
  const key = normalizeFamily(family);
  const direct = CATALOG_INDEX.get(key);
  if (direct) return direct;
  const substituteFamily = SUBSTITUTE_TABLE[key];
  if (substituteFamily) return CATALOG_INDEX.get(normalizeFamily(substituteFamily)) ?? null;
  const tex = texFontStyle(family);
  if (tex) return CATALOG_INDEX.get(normalizeFamily(CMU_BY_CLASS[tex.fontClass])) ?? null;
  return null;
}

/**
 * Returns the substitute family name for a given family, or null when no
 * metric-compatible substitute is known.
 */
export function lookupSubstitute(family: string): string | null {
  const key = normalizeFamily(family);
  const sub = SUBSTITUTE_TABLE[key];
  if (sub) return sub;
  if (CATALOG_INDEX.has(key)) return family;
  const tex = texFontStyle(family);
  return tex ? CMU_BY_CLASS[tex.fontClass] : null;
}

/** Key of one catalog font file in the export payload: family plus style. */
export function catalogFontKey(family: string, variant: FontVariant): string {
  return `${family}|${variant}`;
}

/** Export fallback when nothing else can draw a line. */
export const FALLBACK_FONT_KEY = catalogFontKey('Liberation Sans', 'regular');

export { CATALOG_ENTRIES };
