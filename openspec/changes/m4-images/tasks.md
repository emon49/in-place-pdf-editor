# Tasks

## 1. Operations types and reducer

- [ ] 1.1 Add `ImageReplaceOp` (`type: 'IMAGE_REPLACE'`, objectId, blobKey, fit) and `ObjectResizeOp` (`type: 'OBJECT_RESIZE'`, objectId, from: Box, to: Box) to `src/types/operations.ts` and the `EditOperation` union. Verify: `npm run typecheck` passes.
- [ ] 1.2 Add `IMAGE_REPLACE` and `OBJECT_RESIZE` cases to `src/lib/operation-reducer.ts`: IMAGE_REPLACE updates the image's blobKey and fit mode; OBJECT_RESIZE updates the bounding box; undo is the reverse in both cases. Verify: unit tests for both ops (apply → correct preview state, undo → original state).

## 2. Image extraction

- [ ] 2.1 Create `src/lib/pdf-image-extractor.ts`: scan `getOperatorList()` for `paintImageXObject` and `paintInlineImageXObject`, resolve each to a bounding box in Page Space (applying the CTM), and return an array of `ImageObject`. Flag unsupported color-space images as locked. Verify: integration test on a sample PDF with at least one image returns the correct count and bounding boxes within 1 pt.
- [ ] 2.2 Add `ImageObject` type to `src/types/page-model.ts` (id, bbox in Page Space, locked, maskColor). Integrate `pdf-image-extractor.ts` into `build-page-model.ts` so `PageModel` includes an `images` array. Verify: `npm run typecheck` passes; integration test confirms images appear in the model.

## 3. Image replacement engine

- [ ] 3.1 Create `src/lib/image-replacement-engine.ts`: implement `fitImageRect(originalBox: Box, imageSize: Size, fit: FitMode): Box` (pure function) for contain/cover/fill. Verify: unit tests for all three fit modes with various aspect ratios.
- [ ] 3.2 Add blob storage to `image-replacement-engine.ts`: `storeBlob(file: File): Promise<string>` writes the raw bytes (PNG after WebP conversion) to IndexedDB under a UUID and returns the `blobKey`. Implement WebP-to-PNG conversion via OffscreenCanvas. Verify: unit/integration test round-trips a small PNG through IndexedDB and retrieves identical bytes.
- [ ] 3.3 Add `replaceImage(objectId: string, file: File, fit: FitMode)` and `resizeImage(objectId: string, to: Box)` actions to `editorStore.ts`. These call `storeBlob` and `pushOperation` respectively. Verify: calling `replaceImage` in a test produces one IMAGE_REPLACE in the log with the correct blobKey and fit mode.

## 4. Layer 3 interactive overlay

- [ ] 4.1 Create `src/components/ImageLayer.tsx`: absolutely positioned over the page canvas, same coordinate space as `TextOverlay.tsx`. Renders one interactive box per Image Object, with selection ring and corner handles when selected. Verify: `npm run typecheck` passes; component renders without errors.
- [ ] 4.2 Wire image selection into the store's `selection` slot (replaces text selection and vice versa). Clicking an ImageLayer box calls `store.select(imageId)`. Verify: unit test — clicking an image clears text selection; clicking text clears image selection.
- [ ] 4.3 Implement drag-to-move for Image Objects in `ImageLayer.tsx` following the same pattern as Text Line drag in M3 (pointerdown → drag preview → pointerup → `moveObject`). Apply Safe Area clamping. Verify: `npm run test` passes; drag produces one OBJECT_MOVE.
- [ ] 4.4 Implement corner-handle resize in `ImageLayer.tsx`: `pointerdown` on a handle records the original box; `pointermove` updates a transient preview; `pointerup` calls `store.resizeImage(id, clampedBox)`. Shift constrains aspect ratio. Verify: unit test — corner drag with Shift produces OBJECT_RESIZE with proportional dimensions.
- [ ] 4.5 Add a replacement control (upload button or drop zone overlay) to the selected image box in `ImageLayer.tsx`. On file selection, call `store.replaceImage(id, file, fit)`. Verify: E2E or unit test — uploading a JPEG via the control produces one IMAGE_REPLACE in the log.

## 5. Delete selected image

- [ ] 5.1 Extend the keyboard handler (`keyboard.ts` or `PDFViewer.tsx`) to call `store.deleteObject(imageId)` when `Delete`/`Backspace` is pressed with an Image Object selected and the editor closed. Verify: pressing Delete on a selected image appends OBJECT_DELETE and the image disappears.

## 6. Images tab in Sidebar

- [ ] 6.1 Create `src/components/ImagesTab.tsx`: lists each Image Object on the active page with its current status (original, replaced, moved, deleted) derived from the preview state. Update `Sidebar.tsx` to include this tab when images exist on the active page. Verify: `npm run typecheck` passes; tab renders the correct row count in a unit test.
- [ ] 6.2 Add accessible row labels and status badges to `ImagesTab.tsx`. Verify: `npm run lint` passes (jsx-a11y rules).

## 7. Properties Panel — image controls

- [ ] 7.1 Extend `PropertiesPanel.tsx` to show X/Y/W/H inputs when an Image Object is selected. Committing X/Y calls `moveObject`; committing W/H calls `resizeImage`. Apply Safe Area clamping. Verify: unit test — entering a new W value produces OBJECT_RESIZE with the correct bounding box.
- [ ] 7.2 Show the fit mode selector and a replace button in the Properties Panel for selected Image Objects. Verify: `npm run typecheck` passes; controls render without errors.

## 8. Integration and regression

- [ ] 8.1 Add an E2E test: open a sample PDF with an image → select the image → drag it → verify one OBJECT_MOVE → undo → image back at original position. Verify: `npm run test:e2e` passes.
- [ ] 8.2 Add an E2E test: select an image → upload a replacement → verify IMAGE_REPLACE in log → check the new image appears. Verify: `npm run test:e2e` passes.
- [ ] 8.3 Add an E2E test: select an image → press Delete → verify OBJECT_DELETE and the Mask appears. Verify: `npm run test:e2e` passes.
- [ ] 8.4 Run `npm run typecheck && npm run lint && npm run test` and confirm all pass with no regressions.
