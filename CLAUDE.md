# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**PDF In-Place Editor**: a 100% client-side, non-destructive WYSIWYG PDF editor. Users click text or images on a rendered PDF, edit them in place, and export a new PDF with the layout preserved. There is no backend. See `PRD.md` for requirements and `featurelist.md` for the original spec.

## Tech Stack

- React 18/19 + TypeScript (strict)
- Tailwind CSS + Lucide Icons
- `pdfjs-dist` for rendering and text/font/image extraction
- `pdf-lib` for export (whiteout masks, text, image embedding)
- Zustand for state
- Vite, Vitest, Playwright (assumed tooling; adjust if the repo differs)

## Commands

```bash
npm install          # install deps
npm run dev          # start dev server
npm run build        # type-check + production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest (unit)
npm run test:e2e     # playwright
```

Run `typecheck`, `lint` and `test` before declaring any task done.

## Architecture (read before changing code)

Five stacked layers, all sharing one page coordinate space:

0. PDF.js background canvas (high-DPI)
1. In-place patches and dual-whiteout masks
2. Interactive text detection / selection boxes
3. Interactive images layer
4. Inline textarea editor

Key rules:

- **Non-destructive.** Never mutate the original document state. Edits are `EditOperation`s (`TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `OBJECT_MOVE`, `IMAGE_REPLACE`) in the store. `previewDocument` is *derived* from original + operations.
- **Undo/redo comes from the operation stack.** Do not add ad-hoc mutations that bypass it.
- **Dual whiteout.** A moved or edited text object masks its original position (A) and renders at its new position (B). Both preview and export must do this.
- **Preview and export share geometry.** Compute font size, line height, spacing and positions once (extractor modules) and reuse them in the viewer and `pdf-exporter.ts`. Do not duplicate the math.
- **Client-side only.** Never add network calls that send document data. No analytics on document content.

## Suggested Structure

```
src/
  components/    PDFViewer, InlineTextEditor, Header, Sidebar, PropertiesPanel,
                 PDFUploader, ExportModal, ShortcutsModal
  store/         editorStore.ts
  lib/
    pdf-objects.ts
    pdf-text-extractor.ts
    font-resolver.ts
    font-style-extractor.ts
    pdf-color-extractor.ts
    pdf-image-extractor.ts
    image-replacement-engine.ts
    text-replacement-engine.ts
    pdf-exporter.ts
    sample-documents.ts
  types/
tests/           unit + e2e
```

## Coordinate System (common bug source)

- PDF user space: points, **origin bottom-left**.
- Canvas/DOM: pixels, **origin top-left**.
- Store coordinates in PDF points; convert to screen only at the render boundary using a single helper (page height, zoom, `devicePixelRatio`, page rotation, CropBox offset).
- Position clamping: `10 ≤ X ≤ pageWidth − 40`, `10 ≤ Y ≤ pageHeight − 20` (points).
- When touching geometry code, add or update a unit test.

## Typography Rules

- Font size comes from vertical matrix scale (`√(c²+d²)` / `|d|`) and `item.height`. Do **not** use horizontal scale for size.
- Strip subset prefixes (`ABCDEF+Times` becomes `Times`).
- Put `fontObj.loadedName` first in the CSS font stack for preview.
- Export maps to PDF Standard 14 fonts unless a font is explicitly embedded. Surface a warning when preview and export fonts differ.
- Colors are sampled from rendered pixels (`pdf-color-extractor.ts`); keep sampling off the main render path where possible.

## Code Conventions

- TypeScript strict; no `any` without a comment explaining why.
- Functional components and hooks; keep components presentational and put logic in `lib/` or the store.
- Pure functions for all geometry, extraction and operation-reducer logic so they are unit-testable.
- Keep files focused; split when a file exceeds roughly 300 lines.
- Tailwind utilities for styling; no inline style objects except for dynamic geometry.
- Accessible by default: labels on icon buttons, visible focus states, keyboard support.
- Prefer small, reviewable changes. Do not refactor unrelated code in a feature change.

## Keyboard Shortcuts (must keep working)

`Ctrl/Cmd+Z` undo, `Ctrl+Y` / `Ctrl+Shift+Z` redo, `Ctrl+S` open Export, `Enter` commit edit, `Shift+Enter` newline, `Esc` cancel.

## Testing Expectations

- Unit: matrix to font-size math, coordinate transforms, clamping, font-name resolution, operation apply/undo/redo.
- Integration: extraction on the three sample PDFs plus edge cases (rotated pages, subset fonts, encrypted file).
- Visual: compare preview canvas against the exported PDF rasterized with PDF.js.
- E2E (Playwright): upload, edit text, move, replace image, undo/redo, export.
- Bug fixes need a regression test.

## Known Limitations (do not silently "fix" by changing scope)

- Whiteout hides text visually but does **not** remove it from the PDF; it is not secure redaction.
- Edits are per text run; surrounding paragraph text does not reflow.
- Non-Latin scripts need embedded Unicode fonts (not covered by Standard 14).
- Whiteout assumes a white background unless background sampling is implemented.

## Working Agreements

- Check `PRD.md` requirement IDs (e.g. `MV-3`, `EX-2`) when implementing; reference them in commits and PRs.
- If a requirement is ambiguous or conflicts with this file, ask before guessing.
- Do not add dependencies without a short justification; prefer the stack above.
- Never commit sample PDFs containing real personal data.
