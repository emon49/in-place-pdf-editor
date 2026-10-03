# Tasks

## 1. OBJECT_MOVE operation type

- [ ] 1.1 Add `ObjectMoveOp` type to `src/types/operations.ts` with fields `objectId: string`, `from: Point`, `to: Point` in Page Space, and add it to the `EditOperation` union. Verify: `npm run typecheck` passes.
- [ ] 1.2 Add `OBJECT_MOVE` case to the reducer in `src/lib/operation-reducer.ts`: apply moves in log order (latest active OBJECT_MOVE for an objectId wins). Verify: unit test in `tests/unit/operation-reducer.test.ts` covers undo of a move returning the object to `from`.
- [ ] 1.3 Add `moveObject(objectId: string, to: Point)` action to `editorStore.ts` that reads the current preview position as `from`, constructs an `ObjectMoveOp`, and calls `pushOperation`. Verify: action is callable from a test and produces one operation in the log.

## 2. Safe Area clamping for moves

- [ ] 2.1 Export `clampToSafeArea` from `src/lib/text-geometry.ts` if not already re-exported from `coordinates.ts`, and write a unit test covering all four page edges and all rotation angles (0°, 90°, 180°, 270°). Verify: `npm run test` passes.
- [ ] 2.2 Apply `clampToSafeArea` inside `moveObject` so both drag commits and numeric-input commits are clamped before the operation is created. Verify: unit test asserts clamped position when `to` is outside the Safe Area.

## 3. Drag interaction on Text Lines

- [ ] 3.1 Add `onPointerDown` handler to the selection box in `TextOverlay.tsx` that initiates a drag: record `dragStart` in component state (pointer position in Page Space), set `pointer-events: none` on the page canvas to allow pointer capture, and change the cursor to `grabbing`. Verify: manual test — selecting a line and pressing the pointer shows grabbing cursor.
- [ ] 3.2 Add `onPointerMove` handler that updates a `dragDelta` state (transient, not in the store) and renders a preview offset on the selection box. Verify: dragging moves the visual box without creating operations.
- [ ] 3.3 Add `onPointerUp` handler that calls `store.moveObject(id, clampedTo)` if the pointer moved more than 2 px (deadband), otherwise treats it as a click. Release pointer capture. Verify: unit/integration test — pointerdown + move + pointerup produces exactly one OBJECT_MOVE in the log.
- [ ] 3.4 Add `data-testid="move-badge"` Move badge element to the selection box for the selected object (hidden when nothing is selected). Verify: Playwright test confirms the badge is visible on selection.

## 4. Arrow-key nudging

- [ ] 4.1 Add a `nudgeObject(direction: 'up'|'down'|'left'|'right', large: boolean)` action to `editorStore.ts` (or a dedicated `useNudge` hook) that accumulates a running delta and debounces the commit (≈ 80 ms) into one `OBJECT_MOVE`. Verify: unit test — calling `nudgeObject` ten times rapidly produces one OBJECT_MOVE covering the total displacement.
- [ ] 4.2 Wire arrow-key handling in the page viewer keyboard handler (`src/lib/keyboard.ts` or `PDFViewer.tsx`): when an object is selected and the inline editor is closed, arrow keys call `nudgeObject`; Shift multiplies by 10. Verify: Playwright test — selecting a line and pressing Right arrow three times produces a single OBJECT_MOVE of 3 pt.

## 5. Properties Panel — scaffolding and position inputs

- [ ] 5.1 Create `src/components/PropertiesPanel.tsx`: render when `selection !== null`; subscribe to the selected `PreviewLine` from the store. Add to the main layout beside `PDFViewer`. Verify: `npm run typecheck` passes; panel renders (even if empty) when a line is selected.
- [ ] 5.2 Add X/Y numeric inputs (Display Coordinates, top-left origin) to `PropertiesPanel`. On blur or Enter, convert to Page Space via `coordinates.ts` and call `moveObject`. Clamp to Safe Area before committing. Verify: unit test — entering X=72 and committing produces an OBJECT_MOVE with the correct Page Space coordinates for a non-rotated page and for a 90°-rotated page.
- [ ] 5.3 Add unit tests for the Display ↔ Page Space round-trip at all four rotation angles (0°, 90°, 180°, 270°) to `tests/unit/coordinates.test.ts`. Verify: tests pass.

## 6. Properties Panel — style overrides

- [ ] 6.1 Embed the existing `StyleControls` component in `PropertiesPanel`, passing the selected line's current `TextStyle`. On `onChange`, dispatch a `TEXT_STYLE_CHANGE` operation via `pushOperation`. Verify: changing color in the panel appends one `TEXT_STYLE_CHANGE` to the log.
- [ ] 6.2 Guard against no-op dispatches: only call `pushOperation` when at least one field differs from the current style. Verify: unit test — calling `onChange` with the same style object produces no new operation.
- [ ] 6.3 Add accessible labels to all `PropertiesPanel` inputs (aria-label or associated `<label>`). Verify: `npm run lint` passes (jsx-a11y rules).

## 7. Properties Panel — Resolved Font display and warnings

- [ ] 7.1 Show the Resolved Font tier and reason in `PropertiesPanel`. Read the `ResolvedFont` from the preview line (already computed by `font-resolver.ts`). When tier > 1, display the reason string. Verify: rendering a line whose Resolved Font is Liberation shows "Liberation …" in the panel.
- [ ] 7.2 Show the mask-may-be-visible warning in `PropertiesPanel` when the selected line's `maskColor` indicates a non-uniform background (use the existing `uniformBackground` flag from the page model if present). Verify: a line over an image shows the warning.
- [ ] 7.3 Forward overlap and undrawable-character warnings from `InlineTextEditor` state to `PropertiesPanel` (or read from the store if these flags are already there). Verify: `npm run typecheck` passes; warnings area renders without errors.

## 8. Integration and regression

- [ ] 8.1 Add an E2E test in `tests/e2e/` that: opens a sample PDF → selects a Text Line → drags it → verifies one OBJECT_MOVE in the log → undoes → verifies the line is back at the original position. Verify: `npm run test:e2e` passes.
- [ ] 8.2 Add an E2E test that: selects a Text Line → changes color in Properties Panel → verifies one TEXT_STYLE_CHANGE in the log. Verify: `npm run test:e2e` passes.
- [ ] 8.3 Run `npm run typecheck && npm run lint && npm run test` and confirm all pass with no new errors. Fix any regressions introduced by this change.
