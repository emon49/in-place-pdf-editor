import type { ResolvedFont } from '../types/operations';

interface FontTierExplanationProps {
  resolvedFont: ResolvedFont | null;
}

/** Displays the Resolved Font tier and reason (TY-12). */
export function FontTierExplanation({ resolvedFont }: FontTierExplanationProps) {
  if (!resolvedFont) return null;

  const label =
    resolvedFont.tier === 1
      ? resolvedFont.loadedName
      : resolvedFont.cssFamily;

  const tierLabel = ['', 'Original font', 'Catalog font', 'Substitute font', 'Fallback font'][resolvedFont.tier] ?? '';

  return (
    <span
      data-testid="font-tier-explanation"
      data-tier={resolvedFont.tier}
      className="ml-1 text-xs text-slate-500"
      title={resolvedFont.reason}
    >
      {tierLabel}: {label}
    </span>
  );
}
