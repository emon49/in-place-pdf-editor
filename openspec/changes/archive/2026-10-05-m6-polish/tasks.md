# Tasks

## 1. Document search

- [x] 1.1 Add `searchQuery: string`, `searchMatches: { pageIndex: number; lineId: string }[]`, and `searchMatchIndex: number` to `EditorState` in `editorStore.ts`. Add `setSearchQuery` action that derives matches from the active page models. Verify: `npm run typecheck` passes.
- [x] 1.2 Render search-match highlight overlays in `TextOverlay.tsx` (or a dedicated `SearchHighlightLayer.tsx`): semi-transparent colored boxes for each match on the active page, with the current match visually distinguished. Verify: unit test confirms the correct number of highlight boxes appear for a given query.
- [x] 1.3 Add Next/Previous match controls to the Header search bar. Navigation wraps around and switches pages when the next match is off the current page. Verify: integration test steps through matches in a two-page sample document and confirms page switches.
- [x] 1.4 Clearing the search query removes all highlights. Verify: unit test.

## 2. Page thumbnails

- [x] 2.1 Create a thumbnail render Worker pool in `src/lib/page-raster.ts` (or a new `thumbnail-renderer.ts`): 2 Workers, each accepting `{ docId, pageIndex, width }` and returning an `ImageBitmap` at the requested width via `OffscreenCanvas`. Verify: unit test renders a thumbnail and receives a non-null `ImageBitmap`.
- [x] 2.2 Create `src/components/ThumbnailsTab.tsx`: renders a scrollable list of thumbnails using `IntersectionObserver` to enqueue lazy renders. Highlights the active page. Clicking a thumbnail calls `store.goToPage(index)`. Verify: component renders without errors; clicking a thumbnail dispatches the page-navigation action.
- [x] 2.3 Add the Thumbnails tab to `Sidebar.tsx` (after Text Objects, before History). Verify: the tab is present and navigates when a document is open.

## 3. Shortcuts modal

- [x] 3.1 Create `src/components/ShortcutsModal.tsx`: lists all keyboard shortcuts grouped by category (File, Edit, Navigation, View). Modal traps focus with `aria-modal="true"` and returns focus on close. Verify: `npm run lint` passes; focus-trap behavior works in a unit test.
- [x] 3.2 Wire the shortcuts modal to the Header toolbar button and to the `Ctrl+?` / `Cmd+?` keyboard shortcut in `keyboard.ts`. Verify: pressing Ctrl+? opens the modal.

## 4. Color palette presets

- [x] 4.1 Add `extractPalette(lines: TextLine[]): CssHex[]` to `pdf-color-extractor.ts`: collect unique fill colors, deduplicate by rounding each channel to the nearest 5 (or fewer than 16 distinct colors after deduplication). Verify: unit test confirms deduplication with 2 nearly-identical colors producing 1 palette entry.
- [x] 4.2 Store the extracted palette in `PageModel` (a new optional `palette` field). Populate it during `buildPageModel` in `build-page-model.ts`. Verify: `npm run typecheck` passes; palette is non-empty for a sample PDF with colored text.
- [x] 4.3 Show palette swatches in the `StyleControls` / `PropertiesPanel` color picker. Clicking a swatch calls `onChange({ color: swatchColor })`. Verify: unit test — clicking a swatch dispatches TEXT_STYLE_CHANGE with the correct color.

## 5. Web Worker render offload

- [x] 5.1 Refactor `src/lib/page-raster.ts` to accept an `OffscreenCanvas` (transferred from the main thread) and run the PDF.js render task on it. Extract a Worker entry point `render-worker.ts`. Verify: `npm run build` succeeds; the Worker chunk is emitted.
- [x] 5.2 Update `PDFViewer.tsx` to transfer a canvas to the Worker via `transferControlToOffscreen`, post a render request, and receive the rendered `ImageBitmap` (or display the canvas directly via the Worker). The UI SHALL remain interactive during render. Verify: E2E test confirms the page renders correctly after the refactor; toolbar controls respond during render.

## 6. Accessibility audit and fixes

- [x] 6.1 Audit every icon-only button in the app for an `aria-label`. Fix any missing label found by `npm run lint` (jsx-a11y) or manual tabbing. Verify: `npm run lint` reports zero jsx-a11y warnings.
- [x] 6.2 Verify visible focus rings on all interactive elements in the app. Add `focus-visible:ring` Tailwind classes where missing. Verify: manual keyboard walkthrough passes; no element loses its focus indicator.
- [x] 6.3 Verify that the Sidebar tabs, Properties Panel inputs, and modal dialogs meet WCAG 2.1 AA color contrast for focus indicators. Fix any failures. Verify: manual audit passes.

## 7. Cross-browser smoke tests

- [x] 7.1 Add a Playwright project config for Firefox and WebKit (Safari) in `playwright.config.ts` under a `smoke` suite. Verify: `npm run test:e2e` runs on Chromium; `npx playwright test --project=smoke` does not crash the runner.
- [x] 7.2 Write a `smoke.spec.ts` E2E test covering: open a sample PDF → edit text → move a line → export → undo. Run on Chromium, Firefox and WebKit. Verify: all three pass.

## 8. Integration and regression

- [x] 8.1 Run the full test suite after all tasks: `npm run typecheck && npm run lint && npm run test && npm run test:e2e`. Verify: all pass with no regressions from M6 changes.
