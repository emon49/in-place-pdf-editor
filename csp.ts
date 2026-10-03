/**
 * Single source of the Content-Security-Policy (design D3, ADR-0005).
 * Delivered as HTTP headers (vite preview, generated dist/_headers) and as a
 * <meta> fallback for hosts that cannot set headers.
 */
export const CSP_DIRECTIVES: ReadonlyArray<readonly [string, string]> = [
  ['default-src', "'self'"],
  // PDF.js image decoders (OpenJPEG, JBIG2) are WebAssembly.
  ['script-src', "'self' 'wasm-unsafe-eval'"],
  ['worker-src', "'self'"],
  // No third-party connections. Google Fonts hosts are added with the font milestone (ADR-0007).
  ['connect-src', "'self'"],
  ['img-src', "'self' blob: data:"],
  ['font-src', "'self' data:"],
  ['style-src', "'self'"],
  // Dynamic geometry (canvas/overlay sizes) uses inline style attributes only.
  ['style-src-attr', "'unsafe-inline'"],
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'none'"],
  ['frame-ancestors', "'none'"],
];

/** Directives a <meta http-equiv> CSP cannot carry (browsers ignore them there). */
const HEADER_ONLY = new Set(['frame-ancestors']);

const serialize = (directives: ReadonlyArray<readonly [string, string]>): string =>
  directives.map(([name, value]) => `${name} ${value}`).join('; ');

export const cspHeaderValue = (): string => serialize(CSP_DIRECTIVES);

export const cspMetaValue = (): string =>
  serialize(CSP_DIRECTIVES.filter(([name]) => !HEADER_ONLY.has(name)));

export const securityHeaders = (): Record<string, string> => ({
  'Content-Security-Policy': cspHeaderValue(),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
});

/** Netlify / Cloudflare Pages `_headers` file content. */
export const headersFile = (): string =>
  ['/*', ...Object.entries(securityHeaders()).map(([k, v]) => `  ${k}: ${v}`)].join('\n') + '\n';
