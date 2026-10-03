// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FontTierExplanation } from '../../../src/components/FontTierExplanation';

afterEach(cleanup);

describe('FontTierExplanation (9.3)', () => {
  it('renders nothing when resolvedFont is null', () => {
    render(<FontTierExplanation resolvedFont={null} />);
    expect(screen.queryByTestId('font-tier-explanation')).toBeNull();
  });

  it('shows tier 1 (original font) with loadedName', () => {
    render(
      <FontTierExplanation
        resolvedFont={{ tier: 1, source: 'original', pdfFontRef: 'F1', loadedName: 'Helvetica', reason: 'Original font' }}
      />,
    );
    const el = screen.getByTestId('font-tier-explanation');
    expect(el.dataset.tier).toBe('1');
    expect(el.textContent).toContain('Helvetica');
    expect(el.textContent).toContain('Original font');
  });

  it('shows tier 2 (catalog font) with cssFamily and reason', () => {
    render(
      <FontTierExplanation
        resolvedFont={{ tier: 2, source: 'catalog', cssFamily: 'Carlito', reason: "Original font lacks 'é' → using Carlito" }}
      />,
    );
    const el = screen.getByTestId('font-tier-explanation');
    expect(el.dataset.tier).toBe('2');
    expect(el.textContent).toContain('Carlito');
    expect(el.title).toContain('Carlito');
  });

  it('shows tier 4 (liberation fallback)', () => {
    render(
      <FontTierExplanation
        resolvedFont={{ tier: 4, source: 'liberation', cssFamily: 'Liberation Sans', reason: 'Liberation fallback: sans' }}
      />,
    );
    const el = screen.getByTestId('font-tier-explanation');
    expect(el.dataset.tier).toBe('4');
    expect(el.textContent).toContain('Liberation');
  });
});
