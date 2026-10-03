# Proposal

## Why

M0–M5 deliver MVP functionality. M6 completes v1.0 by adding the features that make the app genuinely usable day-to-day: search to navigate long documents, a thumbnail strip, a keyboard shortcuts modal, keyboard nudging for fine positioning, document color palette presets, accessibility audit fixes, Web Worker performance for rendering and sampling, and cross-browser QA. Without these, the app meets the technical spec but falls short of the usability and reliability bar for v1.0.

## What Changes

- Full-document text search with real-time highlighting and next/previous match navigation.
- Thumbnail strip in the Sidebar (Thumbnails tab) with the active page highlighted.
- Keyboard Shortcuts modal (Ctrl+? or toolbar button).
- Arrow-key nudging (already in M3 via `nudgeObject`); M6 adds the coalesced-nudge integration test.
- Document color palette extraction for the color picker presets (P2, TY-10).
- Accessibility audit: keyboard-operable toolbar and panels, visible focus, ARIA labels on icon buttons.
- Render and sampling performance: move PDF.js rendering and background color sampling into Web Workers.
- Cross-browser smoke tests (Chrome, Edge, Firefox, Safari) in Playwright.

## Capabilities

### New Capabilities

- `document-search`: Real-time text search, highlighted matches, next/previous navigation (VW-4).
- `page-thumbnails`: Thumbnail strip in the Sidebar Thumbnails tab, active page highlighted (P1).
- `shortcuts-modal`: Keyboard shortcuts reference modal, accessible, opened with Ctrl+? or a toolbar button.
- `color-palette`: Extract the document color palette and surface it as presets in the color picker (TY-10, P2).

### Modified Capabilities

- `page-viewer`: Add Web Worker offload for PDF.js rendering so the main thread is not blocked during page draw (NFR: Performance).
- `document-sidebar`: Add Thumbnails tab to the existing tabbed sidebar.
- `app-shell`: Accessibility audit — complete ARIA label coverage, visible focus rings, keyboard-operable toolbar; cross-browser smoke tests.

## Impact

- `src/lib/pdf-text-extractor.ts` / `src/store/editorStore.ts` — search state and match highlighting.
- `src/components/Header.tsx` — search bar, shortcuts button, palette presets in color picker.
- `src/components/Sidebar.tsx` / new `ThumbnailsTab.tsx` — Thumbnails tab.
- `src/components/ShortcutsModal.tsx` — new modal.
- `src/lib/pdf-color-extractor.ts` — extend to extract palette.
- `src/lib/page-raster.ts` — refactor render to use an OffscreenCanvas Worker.
- `tests/e2e/` — cross-browser smoke tests.
- PRD IDs covered: VW-4, TY-10, MV-9 (test), NFR Performance, Accessibility, Browsers.
