# Design

## Context

M1 delivered the read model: Text Line extraction, font/color detection, selection overlay and the Sidebar's Text Objects tab. The store holds `PageModel` per page with `TextLine` objects. The infrastructure for font identification (`font-resolver.ts`), font dictionary reading (`font-descriptor.ts`, `sfnt.ts`, `to-unicode.ts`), background sampling (`page-sampler.ts`, `page-raster.ts`) and coordinate conversion (`coordinates.ts`) is in place. See proposal.md for motivation.

M2 adds the editing loop on top of this foundation: an Operation Log + reducer that derives preview state, an inline editor, the Font Resolution Chain, visual Patches and Masks, undo/redo, History, and session persistence.

## Goals / Non-Goals

**Goals:**
- Deliver a complete text editing loop: select → edit → commit → see the result → undo/redo → persist.
- Reuse the exact embedded font whenever possible (tier 1) to maximize fidelity.
- Keep preview and export geometry identical by computing text layout once.
- Autosave to IndexedDB so work survives browser reloads.

**Non-Goals:**
- Export (M5) — M2 prepares shared layout and font data but does not write PDFs.
- Image editing (M4) — IMAGE_REPLACE and image move/resize are out of scope.
- OBJECT_MOVE / OBJECT_RESIZE operations (M3) — drag-to-move and resize handles are not implemented here. The Operation Log type union includes them for forward-compatibility but the reducer need not handle them yet.
- Properties Panel (M3) — style overrides are wired through TY-9 operations but the full panel UI (position inputs, advanced metadata) is deferred.
- Search (M6) — no find/replace in this milestone.

## Decisions

### D1: Operation Log as a Zustand slice

**Decision:** Add the Operation Log as a new slice in `editorStore.ts`, alongside the existing document and view state. The log is `{ ops: EditOperation[]; cursor: number }`. The `previewDocument` is a derived selector, not stored state.

**Why over a separate store:** The Operation Log is tightly coupled to document identity (cleared on document change) and to the page model (operations reference `objectId`s from the page model). A single store avoids cross-store synchronization.

**Alternative considered:** A standalone `operationStore.ts`. Rejected because every edit action needs to read the current document and page model, which would require subscribing to the editor store anyway.

### D2: Pure reducer in a separate module

**Decision:** `operation-reducer.ts` exports a pure function `applyOperations(lines: TextLine[], ops: EditOperation[], cursor: number): PreviewLine[]` that produces a derived array of `PreviewLine` objects (TextLine + any edits). The reducer handles REVERT by building a set of reverted operation ids and skipping them.

**Why pure:** Testability — the reducer is the most critical piece of logic and must be unit-testable without any DOM, store or async dependencies.

**PreviewLine extends TextLine:** Adds `currentText`, `currentStyle`, `deleted`, `position` (if moved), `resolvedFont`, `patchLayout` (wrapped lines from text-layout). Components read `PreviewLine` instead of `TextLine` when operations are active.

### D3: Text layout module (`text-layout.ts`)

**Decision:** A pure function `layoutText(text: string, style: TextStyle, originBox: Rect, pageWidth: number): LayoutResult` that computes character advances using the Resolved Font's metrics, breaks at the Wrap Margin (`pageWidth − 40 pt`), and returns an array of positioned lines. Used by both the preview (Patch rendering) and future export.

**Why a separate module:** The PRD requires preview and export to share geometry (EX-3). Computing layout in the Patch component would prevent the exporter from reusing it.

**Character advance source:** For tier 1, advances come from the embedded font program (via sfnt glyph metrics or the Widths array in the font dictionary). For tiers 2–4, advances come from a `<canvas>` `measureText` call using the loaded `@font-face`. Both paths return widths in points at the given font size.

### D4: Font Resolution Chain in `font-resolver.ts`

**Decision:** Extend the existing `font-resolver.ts` (which currently only identifies fonts) with a `resolveFont(line: TextLine, newText: string, consent: ConsentState): Promise<ResolvedFont>` function. The function walks the four tiers in order.

**Tier 1 — Embedded Original Font:**
1. Check `font.licence.editable` (from `FontFacts` already computed in M1).
2. Check coverage: for each character in `newText`, verify the font's `coverage` set includes it (already computed by `font-descriptor.ts` + `to-unicode.ts` + `sfnt.ts`).
3. If both pass, return `{ tier: 1, source: 'original', pdfFontRef, loadedName }`.

**Tier 2 — Font Catalog / Google Fonts:**
1. Normalize the family name (already done by `parseFontName`).
2. Look up in the Font Catalog manifest (`font-catalog.ts`). If found, lazy-load the font file, register via `@font-face`, return tier 2.
3. If not in catalog, check the Google Fonts offline index. If found, check consent. If consented, fetch, cache, register, return tier 2. If declined or offline, continue.

**Tier 3 — Metric-Compatible Substitute:**
Look up in the substitute table (a static map, e.g. `{ 'Arial': 'Liberation Sans', 'Calibri': 'Carlito', ... }`). If the substitute covers all characters, return tier 3.

**Tier 4 — Liberation Fallback:**
Choose by `fontClass` + bold/italic. Always succeeds for guaranteed Glyph Coverage characters; fails only for characters outside Latin/Latin-Ext/Greek/Cyrillic.

**Why extend the existing module:** The identification logic (`parseFontName`, `identifyFont`) is a prerequisite for resolution. Keeping them together avoids import cycles and duplicate normalization.

### D5: Font encoder (`font-encoder.ts`)

**Decision:** A module that reverses the ToUnicode/CMap mapping for tier 1 encoding. Given a Unicode string and a `FontFacts` object, it returns an array of character codes in the font's own encoding. This is needed for export (M5) but the logic is built in M2 because the drawability check (TE-9) needs to verify that every character can be encoded.

**Approach:**
- For simple fonts (WinAnsiEncoding, StandardEncoding): use the existing `standard-encodings.ts` reverse maps.
- For fonts with a ToUnicode CMap: invert the `parseToUnicode` map (already parsed in M1).
- For composite (CID) fonts with Identity-H: the character code is the Unicode code point.
- For CID fonts with custom CMaps: parse the CMap to build a reverse mapping.

### D6: Inline editor as a React component

**Decision:** `InlineTextEditor.tsx` renders a `<textarea>` absolutely positioned over the Text Line using `pageRectToDisplay` × zoom (same coordinate path as `TextOverlay.tsx`). It receives the TextLine and the current zoom, and calls back `onCommit(text)` or `onCancel()`.

**Styling:** The textarea uses CSS `font-family` set to the Resolved Font's loaded name (tier 1) or `@font-face` family (tiers 2–4), with `font-size`, `letter-spacing`, `line-height` and `color` matching the line.

**Add-text mode:** A boolean `addTextMode` in the store. When active, clicking empty space (the background click handler in `PDFViewer.tsx`) opens the editor at the clicked position with a default style inferred from the nearest TextLine above (or Liberation Sans 12 pt black). The mode resets on commit, cancel, or Esc.

### D7: Patches and Masks as DOM layers

**Decision:** Two React components in Layer 1:
- `MaskLayer.tsx`: For each operation that masks an original position, renders an absolutely positioned `<div>` with `background-color` set to the Sampled Background color and dimensions matching the original Text Line's box.
- `PatchLayer.tsx`: For each active edit/add, renders a `<div>` containing the text styled with the Resolved Font. Multi-line patches use flexbox column layout.

**Why DOM over canvas:** DOM elements can use `@font-face` fonts directly, support CSS text rendering with exact metrics, and are easier to maintain and test than a second canvas. The export path (M5) will use pdf-lib drawing, not these DOM elements.

**Ordering:** Masks render first (closer to the background), then Patches. Both are below the selection overlay (Layer 2) and the editor (Layer 4).

### D8: Session store (`session-store.ts`)

**Decision:** A module that wraps raw IndexedDB (no `idb` dependency) to save and load sessions. Schema: one object store `sessions` with a single key `current`. The stored value includes:
- `originalBytes: ArrayBuffer` (the PDF file)
- `fileName: string`
- `ops: SerializedEditOperation[]` (operations with timestamp, id, etc.)
- `cursor: number`
- `savedAt: number`

**Debounce:** Writes are debounced at 1 second after the last operation. A `beforeunload` handler flushes any pending save.

**Quota handling:** If a write fails, set a `saveFailed` flag in the store and show a banner. Do not retry automatically.

### D9: History tab (`HistoryTab.tsx`)

**Decision:** A new tab in the Sidebar, after Text Objects. Lists operations from `ops[0..cursor)` in reverse order. Each row shows an icon for the operation type, a summary (e.g. "Replaced text on line 3"), a relative timestamp, and a revert button. Reverted operations are dimmed with a "Reverted" badge.

**Two-way selection:** Clicking a History entry selects the affected object on the page (same as Text Objects tab). Selecting an object on the page highlights its entries in the History tab.

### D10: Drawability check

**Decision:** Before committing, run `resolveFont(line, newText, consent)`. If resolution fails (no tier covers all characters), identify the first undrawable character, show an inline warning below the textarea ("Character 'X' cannot be drawn by any available font"), and disable the commit action. The check runs on every text change (debounced at 200ms) so feedback is near-instant.

### D11: Style overrides via TEXT_STYLE_CHANGE

**Decision:** A `TEXT_STYLE_CHANGE` operation carries a `Partial<TextStyle>` (family override, size, bold, italic, color). The reducer merges it onto the line's base style. Multiple style changes on the same line are each separate operations (each undoable). The Resolved Font is recomputed when the family changes.

For M2, style overrides are triggered from minimal UI controls in the Header or a compact toolbar near the editor (not the full Properties Panel, which is M3). At minimum: font family selector, size stepper, bold/italic toggles, color picker.

## Risks / Trade-offs

- **[Risk] Original-font encoding is complex.** Reverse ToUnicode mapping for CID fonts with custom CMaps has many edge cases. → Mitigation: Start with WinAnsi and Identity-H (covers most real-world fonts); flag unsupported encodings as "tier 1 ineligible" and fall to tier 2+. Build a corpus-based test suite.
- **[Risk] Font Catalog asset size.** Even lazy-loaded, the catalog could be 10–20 MB on the server. → Mitigation: Ship only the most common families initially (Roboto, Open Sans, Noto, Inter, etc.); add others based on usage.
- **[Risk] Google Fonts WOFF2 format.** fontkit/pdf-lib may not handle WOFF2. → Mitigation: Convert WOFF2 to TTF client-side (using a decompressor) before embedding. Test this path early.
- **[Risk] Session autosave with large PDFs.** A 50 MB PDF saved to IndexedDB on every edit is expensive. → Mitigation: Save the original bytes only once on first open; subsequent saves write only the Operation Log delta. The restore path reassembles.
- **[Trade-off] DOM Patches vs. canvas Patches.** DOM is easier to implement and style but may have sub-pixel rendering differences from PDF.js's canvas. → Accept for M2; the export path (M5) uses pdf-lib, which is authoritative. Visual regression tests will catch discrepancies.
- **[Trade-off] One session at a time.** Simplifies IndexedDB schema but means opening a new document discards the previous session. → Accept for v1; multi-document support is out of scope.

## Open Questions

- **Canvas `measureText` accuracy for character advances:** How well does `measureText` match the embedded font's actual glyph widths for tiers 2–4? If the discrepancy is too large, we may need to read the font program's `hmtx` table directly. Will be answered during implementation by comparing against known-width test strings.
