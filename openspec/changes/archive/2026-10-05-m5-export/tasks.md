# Tasks

## 1. Export Worker scaffolding

- [x] 1.1 Create `src/lib/pdf-exporter.ts`: define the Worker entry point (`export-worker.ts`) and the main-thread `export()` function that sends the payload and returns a `Promise<Uint8Array>` with progress callbacks. Verify: `npm run typecheck` passes; import from the main app does not crash.
- [x] 1.2 Wire the Vite worker import (`new Worker(new URL('./export-worker.ts', import.meta.url), { type: 'module' })`) and configure Vite to bundle it as a separate chunk. Verify: `npm run build` succeeds; the export worker chunk appears in the build output.

## 2. Core export logic

- [x] 2.1 Implement `coverOriginalPosition(page, bbox, maskColor)` helper in `pdf-exporter.ts` using `page.drawRectangle`. Verify: unit test draws a rectangle and the output PDF contains the correct color operator.
- [x] 2.2 Implement TEXT_REPLACE export: for each active TEXT_REPLACE, call `coverOriginalPosition` at Position A, then draw the replacement text at Position B using the Resolved Font tier. Verify: round-trip test — export a TEXT_REPLACE, rasterize with PDF.js, and confirm the new text appears at the correct position.
- [x] 2.3 Implement TEXT_STYLE_CHANGE export: apply overridden style fields (font family, size, color, bold, italic) when drawing the text Patch. Verify: test — style override changes color in the exported PDF.
- [x] 2.4 Implement OBJECT_MOVE export: mask Position A, redraw the object (text or image) at Position B. Verify: unit test confirms mask and redrawn content at correct positions.
- [x] 2.5 Implement OBJECT_DELETE export: mask Position A only; no content drawn at Position B. Verify: unit test confirms only the mask rectangle is drawn.
- [x] 2.6 Implement OBJECT_RESIZE export for images: draw the image at the resized bounding box from `fitImageRect`. Verify: export a resized image and confirm its bounding box in the output PDF.
- [x] 2.7 Implement IMAGE_REPLACE export: fetch the blob from IndexedDB by blobKey, embed via `embedPng`/`embedJpg`, apply fit-mode layout from `image-replacement-engine.ts`, mask Position A, draw at Position B. Verify: E2E or unit test — exported PDF contains the new image at the correct position.
- [x] 2.8 Implement REVERT handling: skip any operation whose id is in an active REVERT's `targetOpIds`. Verify: unit test — a REVERT targeting a TEXT_REPLACE causes the exporter to skip it.

## 3. Font tier handling

- [x] 3.1 Implement tier-1 export: look up the original font resource by `pdfFontRef`, use `font-encoder.ts` to convert the Unicode string to original-encoding bytes, write a raw text operator. Verify: integration test — export a TEXT_REPLACE with a tier-1 font and re-extract with PDF.js; the extracted text matches the edited string.
- [x] 3.2 Implement tiers 2–4 export: embed the font file via `@pdf-lib/fontkit` (subset to used glyphs per line), register with `pdf-lib`, and draw text using standard Unicode. Verify: integration test — export a TEXT_REPLACE with Liberation Sans; the exported PDF contains an embedded font subset.
- [x] 3.3 Apply the same text layout geometry (font size, Tz, Tc, Tw, Ts, rendering mode, line height, wrap positions) from `text-layout.ts` in both viewer and exporter. Verify: visual-regression test comparing Patch canvas pixel positions to exported PDF rasterized positions within 1 pt.

## 4. Shared text layout geometry verification

- [x] 4.1 Add a visual-regression test in `tests/` that: applies a TEXT_REPLACE that wraps onto two lines → captures the Patch layer canvas → exports → rasterizes the exported page with PDF.js → compares the two images with a pixel-diff threshold. Verify: test passes.

## 5. Export modal UI

- [x] 5.1 Create `src/components/ExportModal.tsx`: text input for file name (pre-filled with source filename), Download button, close control. Open from the Header's Export PDF button. Verify: `npm run typecheck` passes; modal renders when opened.
- [x] 5.2 Wire the Download button to call `export()`, show a progress indicator during the Worker run, and trigger a Blob URL download on completion. Revoke the object URL after the `<a>` click. Verify: clicking Download in a test produces a non-empty Blob.
- [x] 5.3 Show estimated file size (from the resulting `Uint8Array.byteLength`) in the modal after the export completes. Verify: size label renders with a non-zero value in an integration test.
- [x] 5.4 Add `Ctrl+S` / `Cmd+S` shortcut to open the Export modal in `keyboard.ts`. Guard against double-open. Verify: keyboard test — Ctrl+S dispatches the open-export-modal action.

## 6. Integration and regression

- [x] 6.1 Add an E2E test: load a sample PDF → edit text → export → download → re-open the downloaded file in the same app and confirm the edited text is present. Verify: `npm run test:e2e` passes.
- [x] 6.2 Add an E2E test: load a sample PDF → move a text line → export → confirm no network requests were made (intercept). Verify: `npm run test:e2e` passes.
- [x] 6.3 Run `npm run typecheck && npm run lint && npm run test` and confirm all pass with no regressions.
