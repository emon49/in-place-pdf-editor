# Design

## Context

M2 delivered the Operation Log (TEXT_REPLACE, TEXT_STYLE_CHANGE, TEXT_ADD, OBJECT_DELETE, REVERT), the inline editor, patches/masks, and undo/redo. The data model already contains `OBJECT_MOVE` in the PRD but the type is absent from `src/types/operations.ts` and the reducer does not handle it. `PropertiesPanel.tsx` does not exist. The coordinate helper (`src/lib/coordinates.ts`) has `clampToSafeArea` and the page-space ↔ display-space conversions. Safe Area clamping exists in `text-geometry.ts`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** Add OBJECT_MOVE type and reducer handling; drag interaction on Text Lines; Properties Panel with position inputs, style controls, Resolved Font display, and warnings; arrow-key nudging coalesced per burst.

**Non-Goals:** Image move/resize (M4); export of moved objects (M5); nudge with other selection types.

## Decisions

### D1: OBJECT_MOVE payload — `from` field stored for undo precision

The `OBJECT_MOVE` op stores `{ objectId, from: Point, to: Point }` in Page Space. Storing `from` explicitly lets the reducer undo without re-reading the original doc's position, which could have drifted due to earlier operations on the same object. Alternative: derive `from` by running the reducer one step — rejected because it adds a second pass and is fragile across revert chains.

### D2: Drag state is transient — not in the Operation Log

During an active drag, pointer-delta is held in local React component state (or a Zustand draft key that is cleared on commit). The store is only touched on `pointerup`. Alternative: persist an in-progress-move operation — rejected because it violates the "one gesture = one operation" spec and breaks undo.

### D3: PropertiesPanel lives beside the page in the right column

`PropertiesPanel.tsx` is a new component rendered next to `PDFViewer` in the main layout. It subscribes to `selection` from the store and dispatches `moveObject` and `styleChange` actions. Alternative: embed it in the Sidebar — rejected because the PRD distinguishes the sidebar (left, object lists) from the properties panel (right, selected-object controls), and the existing sidebar spec does not cover style controls.

### D4: Arrow-key burst coalescing via debounce in the move action

The store's `nudgeObject` action accumulates a running delta and schedules a debounced commit (≈ 80 ms after the last keydown). On commit it writes one `OBJECT_MOVE`. Alternative: coalesce at the reducer level by merging adjacent OBJECT_MOVEs with the same objectId — rejected because it complicates the reducer (which is pure and stateless) and makes undo semantics surprising (two arrow presses could merge into one undo step).

### D5: TEXT_STYLE_CHANGE already in types — Properties Panel just dispatches it

`TextStyleChangeOp` exists in `src/types/operations.ts` but is not yet emitted by any UI path. The Properties Panel will dispatch it directly. No new type is needed.

## Risks / Trade-offs

- [Risk] Drag interaction on top of the existing click-selection overlay may cause event conflicts → each overlay layer must `stopPropagation` for `pointerdown` only when a drag is initiated; clicks fall through to the selection handler.
- [Risk] `from` position in OBJECT_MOVE could differ from where the object appears if multiple OBJECT_MOVEs stack → reducer must apply all active moves in log order; the reducer already does this for TEXT_REPLACE (latest wins), so OBJECT_MOVE follows the same pattern.
- [Risk] Display Coordinates ↔ Page Space round-trip errors on rotated pages → add unit tests for 90/180/270° rotations using the existing coordinate helper.

## Migration Plan

No stored data changes. `OBJECT_MOVE` is a new operation type; documents persisted before M3 have no OBJECT_MOVE ops and continue to work without change. Properties Panel is additive UI.

## Open Questions

None.
