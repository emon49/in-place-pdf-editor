# ADR-0004: Masks use a sampled background color, not white

- **Status:** Accepted (2026-10-03)
- **Requirements:** VW-7, MV-3, EX-2

## Context

A white rectangle over a tinted table cell, header band or colored page is clearly visible, which defeats in-place editing. The spec assumed white.

## Decision

- The fill color of a Mask is the **Sampled Background**: the dominant color of rendered pixels in a thin ring just outside the object's box, computed from the PDF.js render of the Original Document.
- When the ring is not uniform (image, gradient, pattern beneath), still use the dominant color but flag the object with a "mask may be visible" warning.
- Masks apply to every object whose original appearance must disappear: edited, moved or deleted Text Lines, and moved, resized, deleted or replaced Image Objects.
- The same computed color is used in preview and export.
- Text color uses the content-stream fill color from the PDF.js operator list (`setFillRGBColor` and similar), falling back to pixel sampling only when that cannot be resolved (patterns, unusual color spaces).

## Consequences

- Edits on colored backgrounds look clean in common cases.
- Masks are still **not redaction**: the original content remains in the content stream.
- Sampling needs a render pass; keep it off the main interaction path (compute lazily on first edit of an object, or in a worker).
