# Tasks

## 1. Operation Log types and reducer

- [x] 1.1 Define `EditOperation` union type (`TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `TEXT_ADD`, `OBJECT_DELETE`, `REVERT`) and `OperationLog` interface (`ops`, `cursor`) in `src/types/operations.ts`; define `TextStyle` and `ResolvedFont` types alongside them. Verify: `npm run typecheck` passes (ST-1)
- [x] 1.2 Define `PreviewLine` type extending `TextLine` with `currentText`, `currentStyle`, `deleted`, `patchLayout` and `resolvedFont` fields in `src/types/operations.ts`. Verify: typecheck passes (D2)
- [x] 1.3 Implement `applyOperations(lines, ops, cursor)` pure reducer in `src/lib/operation-reducer.ts`: apply TEXT_REPLACE, TEXT_STYLE_CHANGE, TEXT_ADD, OBJECT_DELETE, skip operations targeted by active REVERTs, return `PreviewLine[]`. Verify: unit tests cover each operation type, REVERT of single and multiple targets, REVERT-of-REVERT, cursor truncation, no-op on empty log, deterministic output (ST-2, ADR-0003)
- [x] 1.4 Implement `createOperation(type, payload)` helper that generates a unique id and timestamp. Verify: unit test confirms unique ids and monotonic timestamps

## 2. Store integration — Operation Log, undo/redo

- [x] 2.1 Add Operation Log state (`ops`, `cursor`) and actions (`pushOperation`, `undo`, `redo`) to `editorStore.ts` (D1). Clear log on document change. Verify: unit tests — push increments cursor, undo moves cursor back, redo moves forward, new edit after undo discards redo tail, undo at 0 is no-op, document change clears log (ST-3)
- [x] 2.2 Add derived `previewLines(pageIndex)` selector that calls the reducer with the current page's `TextLine[]` and the active ops. Verify: unit test — selector returns PreviewLine[] reflecting operations (ST-2)
- [x] 2.3 Wire `Ctrl/Cmd+Z` to undo, `Ctrl+Y` and `Ctrl+Shift+Z` to redo in the global keyboard handler (`App.tsx` / `keyboard.ts`). Verify: unit test on keyboard handler; manual test confirms shortcuts work in the browser (ST-3)

## 3. Font encoder and drawability

- [x] 3.1 Implement `font-encoder.ts` — `encodeText(text, fontFacts): number[] | null` — reverse ToUnicode for simple fonts (WinAnsi, Standard) and composite fonts (Identity-H). Return null when encoding is unsupported or any character is unmappable (D5, TY-8). Verify: unit tests — WinAnsi round-trip, Identity-H code-point passthrough, subset font with partial coverage returns null for missing chars, unknown encoding returns null
- [x] 3.2 Implement `checkDrawability(text, fontFacts, coverage): { drawable: boolean; firstUndrawable?: string }` in `font-encoder.ts`. Verify: unit tests — all-drawable returns true, first undrawable character identified, empty string returns true (TE-9)

## 4. Font Resolution Chain

- [x] 4.1 Create `src/lib/font-catalog.ts` with the catalog manifest (initial families: Liberation, Roboto, Open Sans, Noto Sans/Serif, Inter, Lato, Montserrat, Source Sans/Serif, PT Sans/Serif, Fira Sans/Mono) and the substitute table (Arial→Liberation Sans, Helvetica→Liberation Sans, Times→Liberation Serif, Courier→Liberation Mono, Calibri→Carlito, Cambria→Caladea, Georgia→Gelasio, etc.). Verify: unit test — lookup by normalized family returns the catalog entry or substitute (TY-6)
- [x] 4.2 Create `src/lib/font-fetcher.ts` — `fetchCatalogFont(entry)`, `fetchGoogleFont(family, consent)`, consent state management (per-family, always-allow), device caching via Cache Storage. Verify: unit tests with mocked fetch — catalog font loads and caches, Google Font prompts on first use, "always allow" skips prompt, offline skips download (TY-13)
- [x] 4.3 Implement `resolveFont(line, newText, consent): Promise<ResolvedFont>` in `font-resolver.ts` walking tiers 1→4 (D4). Tier 1: check `licence.editable` + `coverage` + `encodeText` success. Tiers 2–3: catalog/Google lookup + substitute table. Tier 4: Liberation by fontClass. Verify: unit tests — tier 1 selected when eligible, tier 1 skipped on restricted fsType, tier 1 skipped on missing coverage, tier 2 selected for catalog match, tier 3 for substitute, tier 4 as final fallback, whole-line-one-face enforcement (TY-6, TY-14, ADR-0007)
- [x] 4.4 Implement `@font-face` registration helper in `font-fetcher.ts` — registers a loaded font file and returns the CSS family name for preview use. Verify: integration test — after registration, `document.fonts.check()` returns true for the family

## 5. Text layout

- [x] 5.1 Implement `layoutText(text, style, originBox, pageWidth, advanceFn): LayoutResult` in `src/lib/text-layout.ts` — computes character advances, breaks lines at Wrap Margin (`pageWidth − 40 pt`), returns an array of `{ text, x, y, width }` positioned lines stacking downward at `style.lineHeight` (D3, TE-6). Verify: unit tests — single line no wrap, wrap at margin, multi-wrap, empty text, exact-width-no-wrap boundary
- [x] 5.2 Implement overlap detection: `detectOverlap(patchLayout, allLines): boolean` — returns true when any laid-out patch line intersects another TextLine's box. Verify: unit tests — no overlap returns false, overlapping returns true, deleted lines are excluded from comparison

## 6. Inline text editor

- [x] 6.1 Implement `InlineTextEditor.tsx` — a `<textarea>` positioned over the Text Line using `pageRectToDisplay × zoom`, styled with the Resolved Font's CSS family, font size, letter-spacing, line-height and color. Auto-expands vertically. Props: `line`, `zoom`, `pageGeometry`, `onCommit`, `onCancel` (D6, TE-1, TE-2). Verify: unit tests — renders at correct position, auto-expands on input, shows text matching line content
- [x] 6.2 Wire commit/cancel: `Enter` calls `onCommit(text)`, `Shift+Enter` inserts newline, `Esc` calls `onCancel()`, click-outside commits (TE-3). Verify: unit tests — Enter commits, Shift+Enter does not commit, Esc cancels, blur commits
- [x] 6.3 Integrate drawability check: on each text change (debounced 200ms), run `resolveFont`; if resolution fails, show inline warning naming the undrawable character and disable commit (D10, TE-9). Verify: unit test — warning shown for undrawable char, warning cleared when char removed, commit disabled while warning active
- [x] 6.4 Add `addTextMode` boolean to store and an "Add text" button in the Header. When active, background clicks open the editor at the clicked position with style from the nearest TextLine above (or Liberation Sans 12 pt black). Mode resets on commit/cancel (D6, TE-8). Verify: unit tests — mode toggles, click position converted to Page Space, fallback style used when no line above

## 7. Text editing operations

- [x] 7.1 Wire TEXT_REPLACE: on inline editor commit, if text differs from original, push a TEXT_REPLACE. No operation if unchanged (TE-4). Verify: unit test — changed text creates op, unchanged text creates no op, op payload matches
- [x] 7.2 Wire OBJECT_DELETE: `Delete`/`Backspace` on a selected (non-editing) Text Line pushes OBJECT_DELETE. When inline editor is open, keys act normally (TE-7). Verify: unit test — delete with selection creates op, delete inside editor does not
- [x] 7.3 Wire TEXT_ADD: on add-text editor commit, push TEXT_ADD with the text, clicked position (Page Space) and inferred style (TE-8). Verify: unit test — op created with correct position and style
- [x] 7.4 Wire double-click on TextOverlay to open the inline editor (object-selection spec). Locked lines do not open. Selection clears on commit. Verify: unit test — double-click opens editor, locked line ignores double-click, commit clears selection

## 8. Patches and Masks

- [ ] 8.1 Implement `MaskLayer.tsx` — for each operation that masks an original position (TEXT_REPLACE, OBJECT_DELETE on existing lines), render an absolutely positioned div with `background-color` from `line.background.color` (or white if pending) at the original box position (D7, VW-7). Verify: unit tests — mask rendered for edited line, mask rendered for deleted line, no mask for added text, correct position and color
- [ ] 8.2 Implement `PatchLayer.tsx` — for each active TEXT_REPLACE or TEXT_ADD, render the text at the line's position using the Resolved Font's CSS family, matching size/spacing/color. Multi-line patches from overflow use flexbox column (D7, VW-6). Verify: unit tests — patch shows new text, multi-line patch renders two lines, patch uses Resolved Font family
- [ ] 8.3 Integrate MaskLayer and PatchLayer into the PDFViewer's overlay stack: Masks in Layer 1 below Patches, both below Layer 2 (TextOverlay) and Layer 4 (editor). Verify: visual integration test — mask covers original, patch shows over mask, selection ring shows over patch
- [ ] 8.4 Patches and Masks update on undo/redo — when the cursor changes, the preview lines update and the layers reflect the current state. Verify: unit test — undo removes patch and mask, redo restores them
- [ ] 8.5 Show overflow overlap hint when a Patch intersects another object's box. Verify: unit test — hint appears when patch overlaps, hint absent when no overlap (TE-6)

## 9. Style overrides

- [ ] 9.1 Wire TEXT_STYLE_CHANGE operation: the reducer merges `Partial<TextStyle>` onto the line's base style. Resolved Font recomputes when family changes (D11, TY-9). Verify: unit tests — size override applies, family override triggers re-resolution, multiple style changes each produce separate operations
- [ ] 9.2 Add minimal style controls in the Header or near the editor: font family selector (Original Font when eligible, catalog families, Liberation), size stepper, bold/italic toggles, color picker. Each change pushes a TEXT_STYLE_CHANGE (TY-9). Verify: unit test — selecting a font creates a style-change op, size stepper creates an op
- [ ] 9.3 Show tier explanation: display the Resolved Font name and tier reason (e.g. "Original font" or "Original font lacks 'é' → using Carlito") near the editor or in the text objects tab (TY-12). Verify: unit test — explanation reflects the correct tier and reason

## 10. History tab

- [ ] 10.1 Implement `HistoryTab.tsx` in the Sidebar — lists operations from `ops[0..cursor)` in reverse chronological order with operation-type icon, human-readable summary, relative timestamp, and a revert button. Reverted entries are dimmed with a "Reverted" badge (D9, ST-7). Verify: unit tests — entries listed newest-first, revert button appends REVERT, reverted entry shows badge, empty state message when no ops
- [ ] 10.2 Two-way selection: clicking a History entry selects the affected object on the page; selecting an object highlights its History entries. Verify: unit test — click entry selects object, select object highlights entries
- [ ] 10.3 "Revert to Original" action: available on selected objects that have been edited, appends a REVERT targeting all effective ops on that object (TE-5). Verify: unit test — revert-to-original restores the line, unavailable on unedited lines
- [ ] 10.4 Edit count badge in the Header showing "N edits applied" based on `cursor`. Updates on edit/undo/redo (ST-5). Verify: unit test — badge shows correct count, undo decrements

## 11. Session persistence

- [ ] 11.1 Implement `session-store.ts` — IndexedDB wrapper: `saveSession(data)`, `loadSession()`, `clearSession()`. Schema: object store `sessions`, key `current`, value includes originalBytes, fileName, ops, cursor, savedAt (D8, ST-6). Verify: integration test — save then load round-trips, clear removes data, operations survive page reload simulation
- [ ] 11.2 Wire debounced autosave: after each operation (debounced 1s), call `saveSession`. Save original bytes only on first open; subsequent saves write only the log. `beforeunload` flushes pending (ST-6). Verify: integration test — autosave fires after debounce, only log updated on subsequent saves
- [ ] 11.3 Restore prompt on reload: if a session exists, show "Restore previous session?" with Restore and Discard. Restore reopens the document and replays the log (ST-6). Verify: integration test — restore shows edits, discard clears and starts fresh
- [ ] 11.4 "Discard session" control in the UI and session indicator ("Saved on this device"). Quota-exceeded warning when write fails (ADR-0005). Verify: unit test — discard button clears IndexedDB, indicator visible after save, quota error shows warning

## 12. Integration and E2E

- [ ] 12.1 E2E test: upload a sample PDF, double-click a Text Line, edit text, press Enter, verify the Patch appears and the Mask covers the original. Undo with Ctrl+Z, verify original reappears (TE-1, TE-4, ST-3)
- [ ] 12.2 E2E test: select a Text Line, press Delete, verify it disappears and a Mask covers its position. Undo, verify it reappears (TE-7)
- [ ] 12.3 E2E test: activate add-text tool, click empty space, type text, commit, verify a new Patch appears at the clicked position (TE-8)
- [ ] 12.4 E2E test: make several edits, open History tab, verify entries listed, click revert on one, verify the text reverts and a REVERT entry appears (ST-7)
- [ ] 12.5 E2E test: edit text, reload the page, choose Restore, verify edits are present. Choose Discard on another reload, verify fresh start (ST-6)
- [ ] 12.6 E2E test: type a character no font can draw (e.g. a rare CJK character), verify commit is blocked with a warning naming the character (TE-9)
- [ ] 12.7 E2E test: edit text that overflows, verify it wraps at the Wrap Margin and an overlap hint appears if it intersects another line (TE-6)
- [ ] 12.8 Run `npm run typecheck`, `npm run lint`, `npm run test` and verify all pass with no regressions
