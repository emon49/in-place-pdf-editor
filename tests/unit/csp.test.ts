import { describe, expect, it } from 'vitest';
import { CSP_DIRECTIVES, cspHeaderValue, cspMetaValue, headersFile, securityHeaders } from '../../csp';
import viteConfig from '../../vite.config';

describe('Content-Security-Policy single source (6.1)', () => {
  it('allows connections, scripts and workers only from our own origin', () => {
    const policy = Object.fromEntries(CSP_DIRECTIVES);
    expect(policy['connect-src']).toBe("'self'");
    expect(policy['script-src']).toBe("'self' 'wasm-unsafe-eval'");
    expect(policy['worker-src']).toBe("'self'");
    expect(policy['default-src']).toBe("'self'");
    expect(policy['object-src']).toBe("'none'");
    expect(cspHeaderValue()).not.toMatch(/ 'unsafe-eval'|https?:/);
  });

  it('vite preview headers, _headers file and meta fallback derive from the same constant', () => {
    const header = cspHeaderValue();
    expect(viteConfig.preview?.headers?.['Content-Security-Policy']).toBe(header);
    expect(headersFile()).toContain(`Content-Security-Policy: ${header}`);
    expect(headersFile().startsWith('/*\n')).toBe(true);
    expect(securityHeaders()['Content-Security-Policy']).toBe(header);
  });

  it('meta fallback omits frame-ancestors (ignored in meta tags) but keeps everything else', () => {
    expect(cspMetaValue()).not.toContain('frame-ancestors');
    expect(cspHeaderValue()).toContain("frame-ancestors 'none'");
    expect(cspMetaValue().split('; ').length).toBe(CSP_DIRECTIVES.length - 1);
  });
});
