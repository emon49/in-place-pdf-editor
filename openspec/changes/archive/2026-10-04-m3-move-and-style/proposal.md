# Proposal

## Why

M2 delivered the core text editing loop — users can read, edit, delete and add text with undo/redo. The missing piece before export is the ability to **move** objects and **adjust typography styles** from the Properties Panel. Without these, users cannot reposition text they've added or adjust font/color overrides, making the editor far less practical.

## What Changes

- Add drag-to-move for Text Lines with a Move badge, grab/grabbing cursor and elevation shadow.
- Commit each drag as one `OBJECT_MOVE` operation; numeric X/Y inputs also commit as one operation.
- Apply Safe Area clamping (whole bounding box inside a 10 pt inset on every side) throughout dragging.
- Arrow-key nudging (1 pt; Shift → 10 pt) coalesced per key-repeat burst into one `OBJECT_MOVE`.
- Dual-location masking at the new position: Position A stays masked, object renders at Position B.
- Introduce the Properties Panel (right sidebar) with:
  - X/Y numeric inputs (Display Coordinates, points, top-left origin).
  - Font-family selector, size stepper, bold/italic toggles, color picker → commit as `TEXT_STYLE_CHANGE`.
  - Resolved Font display: tier name and reason when not the original (TY-12).
  - Warnings area (mask-may-be-visible, overlaps, undrawable character).
- Add `OBJECT_MOVE` to the supported operation types in the Operation Log.
- Add `TEXT_STYLE_CHANGE` emission path from the Properties Panel inputs.

## Capabilities

### New Capabilities

- `object-move`: Moving selected Text Line objects by drag or numeric input, Safe Area clamping, arrow-key nudging, dual-location masking; commits as `OBJECT_MOVE`.
- `properties-panel`: Right-side panel showing position inputs, style controls (font family/size/weight/color), Resolved Font info and warnings for the selected object.

### Modified Capabilities

- `operation-log`: Add `OBJECT_MOVE` (and later `OBJECT_RESIZE`) to the list of supported operation types and their required payloads.
- `text-editing`: Add `TEXT_STYLE_CHANGE` as a created operation type (from Properties Panel overrides) alongside the existing TEXT_REPLACE / TEXT_ADD / OBJECT_DELETE paths.

## Impact

- `src/components/PDFViewer.tsx` / `TextOverlay.tsx` — pointer-events for drag initiation and safe-area clamping.
- `src/components/PropertiesPanel.tsx` — new component; connects to store for style-change dispatch.
- `src/store/editorStore.ts` — add `moveObject`, `styleChange` actions; extend reducer for `OBJECT_MOVE` and `TEXT_STYLE_CHANGE`.
- `src/lib/coordinates.ts` — `pageToDisplay` / `displayToPage` already exists; verify round-trips at all rotations.
- `src/lib/text-geometry.ts` — export safe-area clamping helper.
- PRD IDs covered: MV-1, MV-2, MV-3, MV-4, MV-5, MV-6, MV-9 (P1), TY-9, TY-12, TY-15 (P1).
