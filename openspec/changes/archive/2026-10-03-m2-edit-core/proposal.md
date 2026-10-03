# Proposal

## Why

M1 built the read model — users can see every Text Line, its font, color and background, and select objects. But nothing is editable yet. M2 delivers the core editing loop: click text, edit it in place, see the change instantly with the correct font and masking, undo mistakes, and persist the session across reloads. This is the milestone that turns a viewer into an editor.

## What Changes

- **Operation Log and reducer** (ST-1, ST-2): append-only log of `TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `TEXT_ADD`, `OBJECT_DELETE`, `REVERT` operations with a cursor-based undo/redo model (ADR-0003). A pure reducer derives `previewDocument` from the immutable original.
- **Inline text editor** (TE-1 – TE-3): double-click a Text Line to open a positioned `<textarea>` (Layer 4); `Enter` commits, `Shift+Enter` inserts a newline, `Esc` cancels.
- **Text replace** (TE-4): committing edited text creates a `TEXT_REPLACE` operation; no-op if text is unchanged.
- **Text delete** (TE-7): `Delete`/`Backspace` on a selected Text Line creates `OBJECT_DELETE`; original position is masked.
- **Text add** (TE-8): an "Add text" tool; clicking empty page space opens the inline editor, commit creates `TEXT_ADD` with style inferred from the nearest line above or a Liberation Sans 12 pt default.
- **Drawability check** (TE-9): block commit and show an inline warning when no font in the chain can draw a typed character.
- **Overflow wrapping** (TE-6): text wider than the original line extends rightward and wraps at the Wrap Margin (`pageWidth − 40 pt`); extra lines stack downward at the original line height. Show a hint when the Patch intersects other objects.
- **Font Resolution Chain** (TY-6, TY-8, ADR-0007): for each edited/added line, resolve one Resolved Font: (1) Embedded Original Font if it covers every character and `fsType` allows editing; (2) exact family from the self-hosted Font Catalog or consented Google Fonts; (3) metric-compatible substitute; (4) Liberation fallback. Same font in preview and export.
- **Font encoding for original-font reuse** (TY-8 tier 1): reverse ToUnicode/CMap mapping to write character codes in the original font's own encoding, referencing the existing font resource without re-embedding.
- **Font Catalog and substitute table** (TY-6 tiers 2–3): a curated manifest of self-hosted open fonts (OFL/Apache) with lazy loading and SW caching; a table of metric-compatible substitutes for common commercial fonts.
- **Google Fonts consent download** (TY-13): an offline name index, per-family consent prompt, download + device cache, skipped offline.
- **User style overrides** (TY-9): font family, size, bold, italic, color via `TEXT_STYLE_CHANGE`; Properties Panel shows choices and explains the Resolved Font tier (TY-12).
- **Patches and Masks** (VW-6, VW-7, MV-3): render edited/added/deleted text at Position B with the Resolved Font, and a sampled-color Mask at Position A (ADR-0004). Both layers use DOM elements in Layer 1.
- **Undo/redo** (ST-3): `Ctrl/Cmd+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`; one Gesture = one operation; cursor-based.
- **History tab** (ST-7): itemized changelog in the Sidebar with timestamps and per-item revert (appends `REVERT`).
- **Session autosave** (ST-6): debounced IndexedDB autosave of Original Document bytes + Operation Log + cursor; restore prompt on reload; "Discard session" control (ADR-0005).
- **Revert to Original** (TE-5): restores a Page Object to its original state by appending a `REVERT` targeting all effective operations on that object.

## Capabilities

### New Capabilities
- `operation-log`: The append-only log of Edit Operations, cursor-based undo/redo, the pure reducer that derives preview state, and the REVERT mechanic for history reversal.
- `inline-text-editor`: The positioned textarea that opens over a Text Line for editing, its commit/cancel lifecycle, and the add-text tool for placing new text.
- `text-editing`: Creating TEXT_REPLACE, TEXT_ADD and OBJECT_DELETE operations from editor interactions, overflow wrapping at the Wrap Margin, overlap detection, and the drawability check.
- `font-resolution`: The Font Resolution Chain (ADR-0007): resolving one Resolved Font per edited line from embedded originals, the Font Catalog, consented Google Fonts, metric-compatible substitutes and Liberation fallback. Includes original-font encoding, glyph coverage checks, and the tier explanation UI.
- `patches-and-masks`: Rendering Patches (edited/added text at Position B) and Masks (sampled-color rectangles at Position A) in the viewer, using the Resolved Font and matching geometry.
- `edit-history`: The History tab listing operations with timestamps, per-item revert buttons, and the "Revert to Original" action.
- `session-persistence`: IndexedDB autosave of Original Document + Operation Log, restore prompt on reload, discard control, and quota error handling.

### Modified Capabilities
- `object-selection`: Adding double-click to enter editing mode, Delete/Backspace to delete the selected object, and deselection when an edit commits.

## Impact

- **New modules**: `operation-log.ts`, `operation-reducer.ts`, `text-layout.ts` (wrapping, shared by preview and future export), `font-catalog.ts`, `font-encoder.ts` (Unicode → original-font codes), `font-fetcher.ts` (Google Fonts consent download), `session-store.ts` (IndexedDB), `InlineTextEditor.tsx`, `HistoryTab.tsx`, `PatchLayer.tsx`, `MaskLayer.tsx`.
- **Modified modules**: `editorStore.ts` (Operation Log state, undo/redo actions, edit actions), `font-resolver.ts` (adds the resolution chain on top of the existing identification), `Sidebar.tsx` (History tab), `TextOverlay.tsx` (double-click handler, delete handler), `App.tsx` (keyboard shortcuts for undo/redo/delete, add-text tool toggle), `Header.tsx` (undo/redo buttons, add-text tool, edit count badge).
- **New dependencies**: none beyond the existing stack; `idb` (IndexedDB wrapper) is a candidate but raw IndexedDB may suffice.
- **Types**: new `EditOperation`, `OperationLog`, `TextStyle`, `ResolvedFont` types; extend the store interface.
- **Test surface**: operation reducer unit tests, font resolution chain unit tests (coverage, `fsType`, offline, consent), text layout (wrapping) tests, session store integration tests, E2E for edit/add/delete/undo/redo/history-revert/session-restore.
