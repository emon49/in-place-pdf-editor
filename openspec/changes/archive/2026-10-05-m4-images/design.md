# Design

## Context

M3 delivered OBJECT_MOVE for Text Lines and the Properties Panel. `src/types/operations.ts` has no `ImageReplaceOp` or `ObjectResizeOp` yet; neither exists in the reducer. PDF.js exposes images via the operator list (same `getOperatorList()` API used for text color in M1). `pdf-image-extractor.ts` and `image-replacement-engine.ts` do not exist. The store has no image-related actions. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** Image extraction from PDF.js; Layer 3 interactive overlay; IMAGE_REPLACE with fit modes; OBJECT_RESIZE; OBJECT_DELETE for images; Images tab in Sidebar.

**Non-Goals:** Export of image operations (M5); image crop or color adjustment; SVG or vector graphics.

## Decisions

### D1: Image blobs stored in IndexedDB keyed by blobKey, not in the Operation Log

`IMAGE_REPLACE` stores a `blobKey` (UUID), not the raw bytes. The actual file goes into IndexedDB alongside the session. This keeps the Operation Log small and serialisable (matches PRD §8). The replacement engine manages blob lifecycle (put on replace, remove on session discard). When session autosave replays in M6, blobs must already be in IndexedDB; the autosave module (M2) must store them together with the ops.

### D2: Fit-mode layout computed by image-replacement-engine.ts, reused at export

The destination rectangle (within the original bounding box) for `contain`/`cover`/`fill` is computed once in `image-replacement-engine.ts` and cached. The viewer Layer 3 and the M5 exporter both call the same function, mirroring the text-layout shared-geometry principle.

### D3: WebP converted to PNG client-side before storage

WebP has no native PDF support. The browser's `createImageBitmap` + an `OffscreenCanvas` draw converts the WebP to a PNG `Blob` synchronously before the `blobKey` is written. No external library needed. This conversion happens in `image-replacement-engine.ts`.

### D4: Layer 3 is a separate React component (ImageLayer.tsx)

Layer 3 is positioned absolutely over the page canvas, same as `TextOverlay.tsx`. Keeping it separate avoids piling more complexity into an already complex component and mirrors the layered architecture. Image selection shares the same `selection` store slot as text (one selected object at a time, ST-8).

### D5: OBJECT_RESIZE stores from/to as Box in Page Space

Same pattern as OBJECT_MOVE (from/to). `Box = { x, y, width, height }` in Page Space. Storing `from` explicitly enables undo without re-deriving the original size from the document.

## Risks / Trade-offs

- [Risk] Large images could make IndexedDB writes slow → IndexedDB operations should happen off the critical user-gesture path; write the blob asynchronously and optimistically update the store, then handle failure with a toast.
- [Risk] WebP to PNG re-encoding discards HDR metadata and may inflate file size → acceptable; PNG is the safe default and users are warned about potential size increase in the Export modal (M5).
- [Risk] PDF.js `paintInlineImageXObject` gives raw image bytes; decoding them to `ImageData` is non-trivial for CMYK or exotic color spaces → start with RGB/grayscale; flag unsupported color-space images as locked (non-replaceable) in the Images tab with an explanation.

## Migration Plan

No stored data changes. IMAGE_REPLACE and OBJECT_RESIZE are new types; existing sessions have none and continue to work without change. ImageLayer is additive UI.

## Open Questions

None.
