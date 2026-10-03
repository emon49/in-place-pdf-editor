# Proposal

## Why

After M3 users can move and style text. M4 adds image support: detecting embedded images and letting users replace, resize, move and delete them. Without this, the app cannot fulfil its goal of in-place editing for all object types before export (MVP = M0–M5).

## What Changes

- Detect Image Objects from PDF.js operator lists (`paintImageXObject`, `paintInlineImageXObject`).
- Render Layer 3 over images with selection borders, move/resize handles and a replacement control.
- Add an Images tab to the Sidebar listing each image with its status (original / replaced / moved / deleted).
- Enable selecting an image by clicking its Layer 3 box; Delete key creates `OBJECT_DELETE` and masks the area.
- Allow image replacement via file upload or drag-and-drop (JPEG, PNG, WebP → re-encode WebP as PNG), with `contain` / `cover` / `fill` fit modes relative to the original bounding box.
- Resize via corner handles (Shift keeps aspect ratio), committed as `OBJECT_RESIZE`.
- Move image objects by drag or numeric input (same Safe Area and dual-location masking rules as text).
- Add `IMAGE_REPLACE` and `OBJECT_RESIZE` to the Operation Log's supported types.
- Extend `patches-and-masks` to cover Image Objects at Position A (sampled-color mask when replaced, moved or deleted).

## Capabilities

### New Capabilities

- `image-objects`: Image extraction from PDF.js operator lists; Layer 3 interactive overlay with handles and replacement controls; Images tab in the Sidebar.
- `image-replacement`: Upload or drop a new image, apply fit modes, commit as `IMAGE_REPLACE`; resize via corner handles as `OBJECT_RESIZE`; delete as `OBJECT_DELETE`.

### Modified Capabilities

- `operation-log`: Add `IMAGE_REPLACE` and `OBJECT_RESIZE` to the list of supported operation types and their required payloads.
- `object-move`: Extend moving to Image Objects (drag, numeric X/Y, arrow-key nudge) in addition to Text Lines.
- `patches-and-masks`: Extend masking to Image Objects — render a Mask at Position A of any replaced, moved or deleted Image Object.

## Impact

- `src/lib/pdf-image-extractor.ts` — new module; scans operator lists and returns image bounds in Page Space.
- `src/lib/image-replacement-engine.ts` — new module; handles blob storage (IndexedDB), fit-mode layout, WebP conversion.
- `src/components/PDFViewer.tsx` / new `ImageLayer.tsx` — Layer 3 component with selection, handles, replacement UI.
- `src/components/Sidebar.tsx` / new `ImagesTab.tsx` — Images tab listing image status.
- `src/store/editorStore.ts` — add `replaceImage`, `resizeImage` actions; extend reducer for `IMAGE_REPLACE`, `OBJECT_RESIZE`.
- `src/types/operations.ts` — add `ImageReplaceOp`, `ObjectResizeOp`.
- `src/lib/operation-reducer.ts` — handle new op types.
- PRD IDs covered: IM-1, IM-2, IM-3, IM-4, IM-6, VW-5, MV-7, MV-8; extends MV-1, MV-3, MV-4, MV-6.
- IM-5 (export) is intentionally deferred to M5.
