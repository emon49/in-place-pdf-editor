# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**PDF In-Place Editor**: a 100% client-side, non-destructive WYSIWYG PDF editor. Users click text or images on a rendered PDF, edit them in place, and export a new PDF with the layout preserved. There is no backend. See `docs/PRD.md` for requirements, `CONTEXT.md` for the domain glossary, `docs/adr/` for architecture decisions, and `docs/featurelist.md` for the original spec.

## Tech Stack

- React 18/19 + TypeScript (strict)
- Tailwind CSS + Lucide Icons
- `pdfjs-dist` for rendering and text/font/image extraction
- `pdf-lib` + `@pdf-lib/fontkit` for export (masks, text with bundled fonts, image embedding)
- Font Resolution Chain for edited text (ADR-0007): embedded original font → self-hosted open fonts / consented Google Fonts → metric-compatible substitutes → Liberation
- IndexedDB for local session autosave; static site + PWA with strict CSP (ADR-0005)
- Zustand for state
- Vite, Vitest, Playwright, ESLint (flat config with `jsx-a11y`), PWA via `vite-plugin-pwa`
- PDF.js is imported from `pdfjs-dist/legacy/...` (the modern build needs JS built-ins that stable browsers lack)

## Commands

```bash
npm install          # install deps
npm run dev          # start dev server
npm run build        # type-check + production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest (unit)
npm run test:e2e     # playwright (builds, then runs against `vite preview` with the real CSP + service worker)
npm run fixtures     # regenerate tests/fixtures (needs qpdf)
```

Run `typecheck`, `lint` and `test` before declaring any task done.

## Architecture (read before changing code)

Five stacked layers, all sharing one page coordinate space:

0. PDF.js background canvas (high-DPI)
1. In-place patches and dual-location masks (sampled background color)
2. Interactive text detection / selection boxes
3. Interactive images layer
4. Inline textarea editor

Key rules:

- **Non-destructive.** Never mutate the original document state. Edits are `EditOperation`s (`TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `TEXT_ADD`, `OBJECT_MOVE`, `OBJECT_RESIZE`, `OBJECT_DELETE`, `IMAGE_REPLACE`, `REVERT`) in an append-only Operation Log. `previewDocument` is *derived* from original + operations.
- **Undo/redo comes from the operation log.** Do not add ad-hoc mutations that bypass it. One user gesture = one operation; History reverts append a `REVERT` op (ADR-0003).
- **Editable unit is the merged Text Line** (ADR-0002), not the raw PDF.js run.
- **Dual-location masking.** A moved, edited or deleted object masks its original position (A) with the sampled background color and renders at its new position (B). Both preview and export must do this (ADR-0004).
- **Preview and export share geometry.** Compute font size, line height, spacing and positions once (extractor modules) and reuse them in the viewer and `pdf-exporter.ts`. Do not duplicate the math.
- **Client-side only.** Never add network calls that send document data. No analytics on document content. The single allowed third-party request is a consented Google Fonts download carrying only a family name (ADR-0007).

## Suggested Structure

```
src/
  components/    PDFViewer, TextOverlay, Sidebar, TextObjectsTab, InlineTextEditor, Header,
                 PropertiesPanel, PDFUploader, ExportModal, ShortcutsModal
  store/         editorStore.ts, useEditor.ts, usePageModel.ts (page model + sampling hooks)
  lib/
    coordinates.ts        # the single Page/Display/Screen conversion helper
    zoom.ts, render-scale.ts, keyboard.ts
    pdf-loader.ts, pdf-sniff.ts, pdfjs.ts, load-errors.ts
    document-registry.ts  # PDF.js handles + original bytes (kept out of the store)
    sample-catalog.ts, samples/   # pdf-lib sample generators (lazy-loaded)
    pdf-objects.ts
    pdf-text-extractor.ts   # reads PDF.js text fragments (operator list first)
    text-geometry.ts        # pure: merge fragments into Text Lines, geometry, locking, reading order
    content-stream-state.ts # operator-list state walker + span/item correlation (fill colour, spacing)
    build-page-model.ts     # fragments -> PageModel (lazy-loaded); page-model.ts is its cache
    font-resolver.ts        # family normalization and Font Class (the chain itself is M2)
    font-style-extractor.ts # matrix -> size, scaling, line height
    font-descriptor.ts      # the document's font dictionary via pdf-lib: embedding, encoding, coverage
    sfnt.ts, to-unicode.ts, standard-encodings.ts   # fsType/cmap reader, ToUnicode, named encodings
    pdf-color-extractor.ts  # pixel sampling: glyph colour fallback, background ring + uniformity
    page-raster.ts, page-sampler.ts   # scale-1 sampling render, idle-time sampling job
    object-labels.ts, virtual-window.ts
    pdf-image-extractor.ts
    image-replacement-engine.ts
    text-replacement-engine.ts
    pdf-exporter.ts
    sample-documents.ts
  types/         page-model.ts (TextLine, PageModel, font facts)
tests/           unit (incl. components/), integration (Node PDF.js), e2e, fixtures
csp.ts           single Content-Security-Policy source (headers, _headers, meta)
```

## Coordinate System (common bug source)

- PDF user space: points, **origin bottom-left**.
- Canvas/DOM: pixels, **origin top-left**.
- Store coordinates in PDF points; convert to screen only at the render boundary using a single helper (page height, zoom, `devicePixelRatio`, page rotation, CropBox offset).
- Position clamping: the object's whole bounding box stays inside a 10 pt inset (Safe Area). Text wraps at `pageWidth − 40 pt`.
- The Properties Panel shows X/Y with a **top-left** origin (Display Coordinates); convert in the same helper.
- Rotated pages are supported; rotated/skewed text is a locked (read-only) object in v1.
- When touching geometry code, add or update a unit test.

## Typography Rules

- Font size comes from vertical matrix scale (`√(c²+d²)` / `|d|`) and `item.height`. Do **not** use horizontal scale for size.
- Strip subset prefixes (`ABCDEF+Times` becomes `Times`).
- Edited/added text uses one **Resolved Font** per line from the Font Resolution Chain (ADR-0007): (1) the embedded original font if every character is drawable and `fsType` allows editing (preview via `fontObj.loadedName`, export by referencing the existing font resource); (2) exact open family from the self-hosted catalog or consented Google Fonts; (3) metric-compatible substitute; (4) Liberation by font class. Never mix fonts within a line.
- Resolve in `font-resolver.ts` only; preview and export must use the same result. Explain non-original results in the UI.
- Preserve size, `Tz`, `Tc`, `Tw`, `Ts`, line height, rendering mode and color in every tier.
- Text color comes from the operator-list fill color, with pixel sampling as fallback. Mask color is sampled from pixels around the object (`pdf-color-extractor.ts`); keep sampling off the main render path where possible.
- Guaranteed glyph coverage is Latin, Latin Extended, Greek and Cyrillic; block commit of characters no chain font can draw.

## Code Conventions

- TypeScript strict; no `any` without a comment explaining why.
- Functional components and hooks; keep components presentational and put logic in `lib/` or the store.
- Pure functions for all geometry, extraction and operation-reducer logic so they are unit-testable.
- Keep files focused; split when a file exceeds roughly 300 lines.
- Tailwind utilities for styling; no inline style objects except for dynamic geometry.
- Accessible by default: labels on icon buttons, visible focus states, keyboard support.
- Prefer small, reviewable changes. Do not refactor unrelated code in a feature change.

## Keyboard Shortcuts (must keep working)

`Ctrl/Cmd+Z` undo, `Ctrl+Y` / `Ctrl+Shift+Z` redo, `Ctrl+S` open Export, `Enter` commit edit, `Shift+Enter` newline, `Esc` cancel, `Delete`/`Backspace` delete selected object.

## Testing Expectations

- Unit: matrix to font-size math, coordinate transforms, clamping, font-name resolution, operation apply/undo/redo.
- Integration: extraction on the three sample PDFs plus edge cases (rotated pages, subset fonts, encrypted file).
- Visual: compare preview canvas against the exported PDF rasterized with PDF.js.
- E2E (Playwright): upload, edit text, move, replace image, undo/redo, export.
- Bug fixes need a regression test.

## Known Limitations (do not silently "fix" by changing scope)

- Whiteout hides text visually but does **not** remove it from the PDF; it is not secure redaction.
- Edits are per Text Line; surrounding paragraph text does not reflow.
- Commercial fonts that are not embedded (or lack typed glyphs) export as metric-compatible substitutes, not the exact face.
- Scripts outside Latin/Greek/Cyrillic are not supported (no RTL or complex shaping).
- Masks use one sampled solid color; on images or gradients they may be visible (warn the user).
- Encrypted PDFs are blocked (ADR-0006). Single selection only; no multi-select.

## Working Agreements

- Check `docs/PRD.md` requirement IDs (e.g. `MV-3`, `EX-2`) when implementing; reference them in commits and PRs.
- If a requirement is ambiguous or conflicts with this file, ask before guessing.
- Do not add dependencies without a short justification; prefer the stack above.
- Never commit sample PDFs containing real personal data.
