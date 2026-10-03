# Proposal

## Why

After M4, users can edit text, move objects, and replace/resize/delete images. Without export, none of those edits can leave the browser as a valid PDF. M5 closes the MVP loop: it turns the in-memory preview state into a downloadable PDF file that visually matches the preview exactly.

## What Changes

- Create `pdf-exporter.ts`: load the original PDF bytes via `pdf-lib`, apply the active Operation Log (TEXT_REPLACE, TEXT_STYLE_CHANGE, TEXT_ADD, OBJECT_MOVE, OBJECT_RESIZE, OBJECT_DELETE, IMAGE_REPLACE, REVERT) and produce a new PDF.
- Tier 1 font handling: reference the page's existing font resource and write characters in the original encoding (no re-embedding).
- Tiers 2–4 font handling: embed the Resolved Font file via `@pdf-lib/fontkit` (subset on embed).
- Shared text layout: reuse `text-layout.ts` output for wrapping and multi-line positions, so preview and export are geometrically identical.
- Dual-location masking on export: sampled-color rectangle at Position A, content drawn at Position B for every moved, edited or deleted object.
- Image embedding: `embedPng`/`embedJpg` for replaced images; WebP blobs already stored as PNG.
- Export modal: file name input, progress indicator, estimated file size, and download trigger via object URL blob.
- Wire `Ctrl+S` shortcut to open the Export modal.

## Capabilities

### New Capabilities

- `pdf-export`: The core export engine — apply all active operations to the original PDF bytes and emit a valid PDF; text layout shared with preview; font tiers; dual-location masking; image embedding.
- `export-modal`: The Export modal UI — file name, progress, estimated size, download; keyboard shortcut Ctrl+S.

### Modified Capabilities

- `text-editing`: Add that TEXT_STYLE_CHANGE is preserved in export (font, size, color, bold/italic overrides are honoured alongside tier resolution).

## Impact

- `src/lib/pdf-exporter.ts` — new module; depends on `text-layout.ts`, `font-resolver.ts`, `coordinates.ts`, `operation-reducer.ts`, `image-replacement-engine.ts`.
- `src/components/ExportModal.tsx` — new component; progress and download.
- `src/lib/keyboard.ts` — wire `Ctrl+S` to open the Export modal.
- PRD IDs covered: EX-1, EX-2, EX-3, EX-4, EX-5, EX-6, TY-8, IM-5.
