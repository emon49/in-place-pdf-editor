# ADR-0002: The merged Text Line is the editable unit

- **Status:** Accepted (2026-10-03)
- **Requirements:** VW-2, TE-1, EX-3

## Context

PDF.js returns Text Runs whose granularity depends on the producer: a run can be a glyph fragment, a word or a whole line. Exposing raw runs gives users half-words; paragraph-level editing implies reflow, which is a non-goal.

## Decision

Adjacent Text Runs are merged into one **Text Line** when they share a baseline (within tolerance), have the same font, size and color, are non-rotated, and the horizontal gap is below a threshold derived from the font size. The Text Line is the unit for selection, editing, moving, styling, deletion and masking. Merging is a pure function in `pdf-text-extractor.ts`, unit-tested against the sample PDFs.

## Consequences

- Fixing a typo or a date is one click on a natural unit.
- Paragraphs do not reflow; editing one line never moves its neighbours (a documented limitation).
- Mixed-style lines (e.g. one bold word) become several Text Lines. This is accepted for v1.
- Rotated or skewed runs are not merged and are Locked Objects in v1.
