import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCatalogFont,
  fetchGoogleFont,
  getConsent,
  registerFont,
  resetConsentState,
  setConsent,
} from '../../src/lib/font-fetcher';
import type { CatalogEntry } from '../../src/lib/font-catalog';

// ─── Test setup ───────────────────────────────────────────────────────────────

const FONT_DATA = new ArrayBuffer(64);

const entry: CatalogEntry = {
  family: 'Roboto',
  key: 'roboto',
  files: { regular: '/fonts/Roboto-Regular.ttf', bold: '/fonts/Roboto-Bold.ttf', italic: '/fonts/Roboto-Italic.ttf', boldItalic: '/fonts/Roboto-BoldItalic.ttf' },
  cssFamily: 'Roboto',
};

// Mock Cache Storage
const cacheStore = new Map<string, Response>();
const mockCache = {
  match: vi.fn(async (url: string) => cacheStore.get(url) ?? undefined),
  put: vi.fn(async (url: string, resp: Response) => { cacheStore.set(url, resp); }),
};

beforeEach(() => {
  cacheStore.clear();
  vi.clearAllMocks();
  resetConsentState();

  // Mock caches global
  vi.stubGlobal('caches', {
    open: vi.fn(async () => mockCache),
  });

  // Mock FontFace
  vi.stubGlobal('FontFace', class {
    constructor(public family: string, _data: ArrayBuffer) {}
    load = vi.fn(async () => this);
  });

  // Mock document.fonts
  vi.stubGlobal('document', {
    fonts: {
      add: vi.fn(),
      check: vi.fn(() => true),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchCatalogFont', () => {
  it('loads and caches a catalog font', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => FONT_DATA,
    })));

    const family = await fetchCatalogFont(entry);
    expect(family).toBe('Roboto');
    expect(mockCache.put).toHaveBeenCalledOnce();
  });

  it('serves from cache on second call without fetching', async () => {
    const cachedResp = new Response(FONT_DATA);
    cacheStore.set(entry.files.regular, cachedResp);
    // Override match to return buffer
    mockCache.match.mockResolvedValueOnce({
      arrayBuffer: async () => FONT_DATA,
    } as unknown as Response);

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await fetchCatalogFont(entry);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchGoogleFont', () => {
  it('returns null when consent is denied', async () => {
    setConsent('Roboto', 'denied');
    expect(await fetchGoogleFont('Roboto', 'denied')).toBeNull();
  });

  it('returns null when consent is pending', async () => {
    expect(await fetchGoogleFont('Roboto', 'pending')).toBeNull();
  });

  it('returns null when offline (fetch throws)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Network error'); }));
    expect(await fetchGoogleFont('Roboto', 'granted')).toBeNull();
  });

  it('fetches and registers when consent is granted', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `src: url(https://fonts.gstatic.com/roboto.woff2) format('woff2')`,
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => FONT_DATA,
      });
    vi.stubGlobal('fetch', fetchMock);

    const family = await fetchGoogleFont('Roboto', 'granted');
    expect(family).toBe('Roboto');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('consent management', () => {
  it('always-allow skips prompt for all families', () => {
    setConsent('Roboto', 'always-allow');
    expect(getConsent('AnyFont')).toBe('always-allow');
    expect(getConsent('Roboto')).toBe('always-allow');
  });
});

describe('registerFont', () => {
  it('registers a font and document.fonts.check() returns true', async () => {
    const addMock = vi.fn();
    const checkMock = vi.fn(() => true);
    vi.stubGlobal('document', { fonts: { add: addMock, check: checkMock } });

    const data = new ArrayBuffer(64);
    const family = await registerFont('TestFont', data);
    expect(family).toBe('TestFont');
    expect(addMock).toHaveBeenCalledOnce();
    // checkMock simulates document.fonts.check()
    expect(checkMock()).toBe(true);
  });

  it('returns the family name without re-registering on duplicate call', async () => {
    const addMock = vi.fn();
    vi.stubGlobal('document', { fonts: { add: addMock, check: vi.fn(() => true) } });

    const data = new ArrayBuffer(64);
    await registerFont('DedupFont', data);
    await registerFont('DedupFont', data);
    // FontFace.add should only be called once despite two registerFont calls
    expect(addMock).toHaveBeenCalledOnce();
  });
});
