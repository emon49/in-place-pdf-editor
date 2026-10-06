# Design

## Context

M0–M5 complete the MVP. M6 completes v1.0 by adding visible quality features: search, thumbnails, shortcuts modal, color palette presets, accessibility audit, Web Worker render offload and cross-browser test coverage. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** Full-document search; lazy thumbnail strip; shortcuts modal; palette presets; A11y audit; render Worker; cross-browser Playwright suite.

**Non-Goals:** OCR or full-text indexing of scanned pages; animated transitions; mobile-first redesign.

## Decisions

### D1: Search state lives in the store, match positions derived from the read model

The search query and current-match index live in `editorStore`. Matches are computed reactively from the `pageModels` already in the store (Text Lines already have their text and bbox). No new extraction pass is needed. Highlights are rendered as an extra overlay layer (below Layer 2).

### D2: Thumbnails rendered in a shared render Worker pool

Rather than a per-thumbnail Worker, a small pool (2–4 Workers) renders thumbnails via `OffscreenCanvas` at low resolution (96 px wide). The same pool can be reused for the page render Worker (D3). Requests are queued; only thumbnails in the Intersection Observer viewport are enqueued.

### D3: PDF.js render offloaded to OffscreenCanvas Worker

`page-raster.ts` already encapsulates the render logic. It will be refactored to accept an `OffscreenCanvas` transferred from the main thread, run the PDF.js render task on it, and `postMessage` back the `ImageBitmap`. The main thread draws the `ImageBitmap` to the visible `<canvas>` via `drawImage`. Browser support: all target browsers support `OffscreenCanvas` and `transferControlToOffscreen`.

### D4: Color palette extracted from existing operator-list data

`content-stream-state.ts` already collects fill colors per span. After the page model is built, a `extractPalette(pageModel)` function deduplicates colors (ΔE < threshold, or simpler: bucket by rounding to 5-unit intervals per channel). The result is stored in the `PageModel` and read by the Properties Panel color picker.

### D5: Accessibility audit — fix gaps found during M6

M6 includes a structured accessibility audit: tab through every control, check screen reader announcements with `aria-label` coverage, verify contrast. Gaps are fixed inline. The `jsx-a11y` ESLint plugin already runs; M6 resolves any remaining warnings.

### D6: Cross-browser Playwright tests using `--project` flags

Playwright's project configuration already supports Chromium, Firefox and WebKit. M6 adds a `smoke` project that runs on all three. Tests run in CI on every PR.

## Risks / Trade-offs

- [Risk] `OffscreenCanvas` Worker render may conflict with the existing PDF.js `DocumentRegistry` (which holds pdf-lib handles, not PDF.js) → `pdf-image-extractor` and page-raster need separate handles; verify that `PDFDocumentProxy.getPage()` can be called from a Worker context (it can, using the PDF.js message-passing abstraction).
- [Risk] Thumbnail Worker pool may exhaust memory for very large documents → cap the pool and the thumbnail cache size; evict off-screen entries when the cache grows beyond a threshold.
- [Risk] Color palette deduplication threshold may be too aggressive for documents with subtle gradient text colors → make the ΔE threshold a constant (not user-tunable); manual QA on a sample of real invoices.

## Migration Plan

All additive. No data-model changes.

## Open Questions

None.
