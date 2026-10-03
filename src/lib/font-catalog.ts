/**
 * Font Catalog manifest and substitute table for the Font Resolution Chain (ADR-0007).
 *
 * Catalog fonts are self-hosted under /fonts/ with OFL or Apache-2 licences.
 * The substitute table maps common commercial faces to metric-compatible OFL alternatives.
 */

export interface CatalogEntry {
  readonly family: string;
  /** Normalized lowercase family name for lookup. */
  readonly key: string;
  /** Path under /fonts/ to the Regular weight WOFF2 file. */
  readonly path: string;
  /** CSS font-family name after @font-face registration. */
  readonly cssFamily: string;
  readonly hasVariable: boolean;
}

/** Initial self-hosted families (OFL / Apache-2). */
const CATALOG_ENTRIES: CatalogEntry[] = [
  // Liberation — metrics-compatible with Arial / Times / Courier
  { family: 'Liberation Sans', key: 'liberation sans', path: '/fonts/LiberationSans-Regular.woff2', cssFamily: 'Liberation Sans', hasVariable: false },
  { family: 'Liberation Serif', key: 'liberation serif', path: '/fonts/LiberationSerif-Regular.woff2', cssFamily: 'Liberation Serif', hasVariable: false },
  { family: 'Liberation Mono', key: 'liberation mono', path: '/fonts/LiberationMono-Regular.woff2', cssFamily: 'Liberation Mono', hasVariable: false },
  // Google Fonts OFL
  { family: 'Roboto', key: 'roboto', path: '/fonts/Roboto-Regular.woff2', cssFamily: 'Roboto', hasVariable: false },
  { family: 'Open Sans', key: 'open sans', path: '/fonts/OpenSans-Regular.woff2', cssFamily: 'Open Sans', hasVariable: false },
  { family: 'Noto Sans', key: 'noto sans', path: '/fonts/NotoSans-Regular.woff2', cssFamily: 'Noto Sans', hasVariable: false },
  { family: 'Noto Serif', key: 'noto serif', path: '/fonts/NotoSerif-Regular.woff2', cssFamily: 'Noto Serif', hasVariable: false },
  { family: 'Inter', key: 'inter', path: '/fonts/Inter-Regular.woff2', cssFamily: 'Inter', hasVariable: false },
  { family: 'Lato', key: 'lato', path: '/fonts/Lato-Regular.woff2', cssFamily: 'Lato', hasVariable: false },
  { family: 'Montserrat', key: 'montserrat', path: '/fonts/Montserrat-Regular.woff2', cssFamily: 'Montserrat', hasVariable: false },
  { family: 'Source Sans 3', key: 'source sans 3', path: '/fonts/SourceSans3-Regular.woff2', cssFamily: 'Source Sans 3', hasVariable: false },
  { family: 'Source Serif 4', key: 'source serif 4', path: '/fonts/SourceSerif4-Regular.woff2', cssFamily: 'Source Serif 4', hasVariable: false },
  { family: 'PT Sans', key: 'pt sans', path: '/fonts/PTSans-Regular.woff2', cssFamily: 'PT Sans', hasVariable: false },
  { family: 'PT Serif', key: 'pt serif', path: '/fonts/PTSerif-Regular.woff2', cssFamily: 'PT Serif', hasVariable: false },
  { family: 'Fira Sans', key: 'fira sans', path: '/fonts/FiraSans-Regular.woff2', cssFamily: 'Fira Sans', hasVariable: false },
  { family: 'Fira Mono', key: 'fira mono', path: '/fonts/FiraMono-Regular.woff2', cssFamily: 'Fira Mono', hasVariable: false },
  // Carlito / Caladea / Gelasio — metric-compatible with Calibri / Cambria / Georgia
  { family: 'Carlito', key: 'carlito', path: '/fonts/Carlito-Regular.woff2', cssFamily: 'Carlito', hasVariable: false },
  { family: 'Caladea', key: 'caladea', path: '/fonts/Caladea-Regular.woff2', cssFamily: 'Caladea', hasVariable: false },
  { family: 'Gelasio', key: 'gelasio', path: '/fonts/Gelasio-Regular.woff2', cssFamily: 'Gelasio', hasVariable: false },
];

/** Maps normalized commercial family names to catalog family names (metric-compatible substitutes). */
const SUBSTITUTE_TABLE: Record<string, string> = {
  // Microsoft / Apple core faces
  'arial': 'Liberation Sans',
  'arial narrow': 'Liberation Sans',
  'helvetica': 'Liberation Sans',
  'helvetica neue': 'Liberation Sans',
  'times': 'Liberation Serif',
  'times new roman': 'Liberation Serif',
  'courier': 'Liberation Mono',
  'courier new': 'Liberation Mono',
  // Microsoft Office faces
  'calibri': 'Carlito',
  'cambria': 'Caladea',
  'georgia': 'Gelasio',
  'trebuchet ms': 'Liberation Sans',
  'verdana': 'Liberation Sans',
  'tahoma': 'Liberation Sans',
  // Common sans fallbacks
  'myriad pro': 'Open Sans',
  'gill sans': 'Lato',
  'franklin gothic': 'Liberation Sans',
  'frutiger': 'Liberation Sans',
  'univers': 'Liberation Sans',
  'futura': 'Montserrat',
  'century gothic': 'Montserrat',
  // Common serif fallbacks
  'minion pro': 'Source Serif 4',
  'garamond': 'Source Serif 4',
  'palatino': 'Source Serif 4',
  'book antiqua': 'Source Serif 4',
  // Monospace
  'consolas': 'Liberation Mono',
  'monaco': 'Liberation Mono',
  'menlo': 'Liberation Mono',
};

/** Index of catalog entries by normalized family name. */
const CATALOG_INDEX = new Map<string, CatalogEntry>(
  CATALOG_ENTRIES.map((e) => [e.key, e]),
);

/** Normalize a family name for catalog lookup. */
export function normalizeFamily(family: string): string {
  return family.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Looks up the font catalog by (normalized) family name. Returns the CatalogEntry
 * directly, or via the substitute table, or null when not found.
 */
export function lookupCatalog(family: string): CatalogEntry | null {
  const key = normalizeFamily(family);
  const direct = CATALOG_INDEX.get(key);
  if (direct) return direct;
  const substituteFamily = SUBSTITUTE_TABLE[key];
  if (substituteFamily) {
    return CATALOG_INDEX.get(normalizeFamily(substituteFamily)) ?? null;
  }
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
  // If it's already in the catalog, return itself
  if (CATALOG_INDEX.has(key)) return family;
  return null;
}

export { CATALOG_ENTRIES };
