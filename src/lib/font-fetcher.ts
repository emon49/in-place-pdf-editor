import type { CatalogEntry } from './font-catalog';

/** Per-family consent state for Google Fonts downloads. */
export type ConsentState = 'pending' | 'granted' | 'denied' | 'always-allow';

/** In-memory consent registry. Per-family; persists for the session. */
const consentMap = new Map<string, ConsentState>();
/** Set to true when the user chose "always allow" Google Fonts. */
let globalAlwaysAllow = false;

export function getConsent(family: string): ConsentState {
  if (globalAlwaysAllow) return 'always-allow';
  return consentMap.get(family) ?? 'pending';
}

export function setConsent(family: string, state: 'granted' | 'denied' | 'always-allow'): void {
  if (state === 'always-allow') globalAlwaysAllow = true;
  consentMap.set(family, state);
}

/** Reset consent state (used in tests). */
export function resetConsentState(): void {
  consentMap.clear();
  globalAlwaysAllow = false;
}

// ─── Cache Storage ─────────────────────────────────────────────────────────────

const CACHE_NAME = 'pdf-editor-fonts-v1';

async function cacheGet(url: string): Promise<ArrayBuffer | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await cache.match(url);
    if (!resp) return null;
    return resp.arrayBuffer();
  } catch {
    return null;
  }
}

async function cachePut(url: string, data: ArrayBuffer): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, new Response(data));
  } catch {
    // Ignore cache write failures (quota, unavailable, etc.)
  }
}

// ─── @font-face registration ──────────────────────────────────────────────────

const registeredFonts = new Map<string, FontFace>();

/**
 * Registers a font file with the document's FontFaceSet and returns the
 * CSS family name so it can be used in inline styles.
 */
export async function registerFont(cssFamily: string, data: ArrayBuffer): Promise<string> {
  if (registeredFonts.has(cssFamily)) return cssFamily;
  const face = new FontFace(cssFamily, data);
  await face.load();
  document.fonts.add(face);
  registeredFonts.set(cssFamily, face);
  return cssFamily;
}

// ─── Catalog font loader ───────────────────────────────────────────────────────

/**
 * Fetches a catalog font, caches it in Cache Storage, registers it via
 * @font-face, and returns the CSS family name.
 */
export async function fetchCatalogFont(entry: CatalogEntry): Promise<string> {
  const url = entry.path;

  const cached = await cacheGet(url);
  if (cached) {
    return registerFont(entry.cssFamily, cached);
  }

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch font: ${url} (${resp.status})`);
  const data = await resp.arrayBuffer();
  await cachePut(url, data);
  return registerFont(entry.cssFamily, data);
}

// ─── Google Fonts loader ───────────────────────────────────────────────────────

const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2?family=';

/**
 * Attempts to fetch and register a font from Google Fonts (with consent).
 *
 * Returns the CSS family name on success, or null when consent is denied,
 * the font is unavailable, or the network is offline.
 *
 * Note: this is the only call to a third-party service this app makes;
 * the URL carries only the font family name, not document content (ADR-0007).
 */
export async function fetchGoogleFont(
  family: string,
  consent: ConsentState,
): Promise<string | null> {
  if (consent === 'denied') return null;
  if (consent === 'pending') return null; // caller must prompt and retry

  const cacheKey = `google-font:${family}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return registerFont(family, cached);
  }

  try {
    // Fetch the CSS2 API to get the WOFF2 URL
    const cssUrl = `${GOOGLE_FONTS_API}${encodeURIComponent(family)}&display=swap`;
    const cssResp = await fetch(cssUrl);
    if (!cssResp.ok) return null;
    const css = await cssResp.text();
    const match = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(css);
    if (!match) return null;
    const woff2Url = match[1] ?? '';
    const fontResp = await fetch(woff2Url);
    if (!fontResp.ok) return null;
    const data = await fontResp.arrayBuffer();
    await cachePut(cacheKey, data);
    return registerFont(family, data);
  } catch {
    return null;
  }
}
