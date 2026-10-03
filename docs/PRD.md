# Product Requirements Document: PDF In-Place Editor

| | |
|---|---|
| **Status** | Draft v0.2 (decisions from requirements review, 2026-10-03) |
| **Date** | 2026-10-03 |
| **Source** | `featurelist.md` (Complete Feature List & Architecture Specification) |
| **Type** | 100% client-side web application (no backend), static site + PWA |
| **Glossary** | `CONTEXT.md` (use these terms in specs and code) |
| **Decisions** | `docs/adr/` (ADR-0001 to ADR-0006) |

---

## 1. Overview

A browser-based, **in-place, non-destructive WYSIWYG PDF editor**. Users open a PDF, click directly on existing text or images, edit, move, add or delete them where they sit, and export a new PDF that preserves the original layout. Unlike converters that turn a PDF into HTML or DOCX (and break layout and flow), this editor leaves the Original Document intact and layers edits on top of it. Everything runs in the browser; documents never leave the user's device.

## 2. Problem Statement

Editing a PDF today usually means one of:

- Paying for desktop software (Acrobat Pro and similar).
- Converting to Word/HTML, editing, and converting back, which breaks layout, fonts and pagination.
- Uploading sensitive documents to a third-party server.

Users need a quick, private way to fix a typo, change a number, add or remove a line, move a block, or swap an image in a PDF without leaving the browser or destroying the layout.

## 3. Goals and Non-Goals

### Goals
1. Edit existing text in place, preserving font size, line height, letter spacing and color as closely as possible.
2. Add and delete text; move text and images; replace, resize and delete images, all with immediate visual feedback.
3. Provide undo/redo and an itemized, revertible edit history.
4. Export a valid PDF whose edited content **matches the preview exactly** (same fonts, same geometry).
5. Run fully client-side: no uploads, no accounts, no server; works offline after first visit.
6. Be usable without documentation (familiar toolbar, sidebar, properties panel).

### Non-Goals (v1)
- Editing PDF content streams at the operator level (true text reflow inside the original stream).
- Paragraph reflow: editing one line never moves neighbouring lines.
- Reusing or re-embedding the PDF's original fonts for edited text (see ADR-0001).
- Editing rotated or skewed text (displayed, but locked).
- Multi-select and batch operations.
- Encrypted or password-protected PDFs (blocked, see ADR-0006).
- Scripts beyond Latin, Latin Extended, Greek and Cyrillic; right-to-left and complex shaping.
- OCR of scanned PDFs.
- Form-field authoring, digital signatures, annotations/comments, redaction.
- Real-time collaboration or cloud storage.
- Mobile-first editing (desktop browsers are the target).
- Page-level operations (add, delete, reorder, merge, split).

## 4. Target Users

| Persona | Need |
|---|---|
| Office/admin worker | Fix a typo or date in an invoice or letter without the original source file |
| Student / researcher | Correct a paper or form, update a figure or image |
| Freelancer / small business | Edit quotes, invoices and contracts quickly and privately |
| Privacy-conscious user | Edit sensitive documents without uploading them |

## 5. System Architecture

The editor composes **five visual layers** over a shared page coordinate space:

```
┌────────────────────────────────────────────────────────┐
│ Layer 4: WYSIWYG Active Editor (Inline Textarea)       │
├────────────────────────────────────────────────────────┤
│ Layer 3: Interactive Images Layer (handles & uploads)  │
├────────────────────────────────────────────────────────┤
│ Layer 2: Interactive Text Detection & Selection Box    │
├────────────────────────────────────────────────────────┤
│ Layer 1: Patches & Masks (sampled-color, dual-location)│
├────────────────────────────────────────────────────────┤
│ Layer 0: High-DPI PDF.js Background Canvas             │
└────────────────────────────────────────────────────────┘
```

### Core principles
- **Non-destructive:** the Original Document is immutable; edits are an append-only Operation Log (ADR-0003).
- **Derived preview:** `previewDocument = apply(operationLog[0..cursor], originalDocument)`, a pure function.
- **Preview equals export:** Patches use the same Bundled Fonts and the same computed geometry in preview and export (ADR-0001).
- **Single source of truth for geometry:** extractor modules compute metrics once; viewer and `pdf-exporter.ts` reuse them.
- **Client-only:** PDF.js for rendering/extraction, pdf-lib + fontkit for export, IndexedDB for the local Session, strict CSP.

### Tech stack
| Concern | Choice |
|---|---|
| Framework | React 18/19 + TypeScript (strict) |
| Styling | Tailwind CSS + Lucide Icons |
| Rendering and extraction | `pdfjs-dist` |
| Export / modification | `pdf-lib` + `@pdf-lib/fontkit` (font embedding) |
| Fonts | Liberation Sans / Serif / Mono (OFL), 4 styles each, bundled |
| State | Zustand |
| Persistence | IndexedDB (local Session autosave) |
| Delivery | Static hosting + service worker (PWA) |
| Tooling | Vite, Vitest, Playwright |

### Planned modules
`PDFViewer.tsx`, `InlineTextEditor.tsx`, `Header.tsx`, `Sidebar.tsx`, `PropertiesPanel.tsx`, `PDFUploader.tsx`, `ExportModal.tsx`, `ShortcutsModal.tsx`, `editorStore.ts`, `pdf-objects.ts`, `pdf-text-extractor.ts` (run → Text Line merging), `font-resolver.ts` (Original Font → Font Class → Bundled Font), `font-style-extractor.ts`, `pdf-color-extractor.ts` (operator-list fill color, background sampling), `pdf-image-extractor.ts`, `image-replacement-engine.ts`, `text-replacement-engine.ts`, `text-layout.ts` (wrapping, shared by preview and export), `coordinates.ts` (single Page ↔ Display ↔ Screen helper), `session-store.ts` (IndexedDB), `pdf-exporter.ts`, `sample-documents.ts`.

## 6. Functional Requirements

Priority: **P0** = required for MVP, **P1** = required for v1.0, **P2** = nice to have.

### 6.1 Document Loading
| ID | Requirement | Priority |
|---|---|---|
| UP-1 | Load a `.pdf` via file picker or drag-and-drop | P0 |
| UP-2 | Built-in sample PDFs (Academic Research Paper, Invoice, Technical Spec) generated with `pdf-lib`; include a tinted-background region, a rotated page and an image so the samples exercise masks, rotation and image ops | P0 |
| UP-3 | Detect encrypted / password-protected files and show a clear, actionable error; do not open them (ADR-0006) | P0 |
| UP-4 | Pages with `/Rotate` 90/180/270 and non-zero CropBox offsets render and edit correctly | P0 |

### 6.2 PDF Viewer Engine
| ID | Requirement | Priority |
|---|---|---|
| VW-1 | Render each page to a canvas via PDF.js, scaled by `devicePixelRatio` for crisp output | P0 |
| VW-2 | Overlay clickable bounding boxes for every Text Line (merged runs, ADR-0002) (Layer 2) | P0 |
| VW-3 | Show hover state, active selection ring and corner indicators on selected objects | P0 |
| VW-4 | Highlight search matches in real time | P1 |
| VW-5 | Show selection borders, move/resize handles and replacement controls over Image Objects (Layer 3) | P0 |
| VW-6 | Render Patches in place using the Bundled Font, with exact size, line height, letter spacing and color (Layer 1) | P0 |
| VW-7 | Render Masks filled with the Sampled Background color at Position A of every edited, moved or deleted object (ADR-0004) | P0 |
| VW-8 | Rotated or skewed Text Runs are shown as Locked Objects (not editable) with an explanatory tooltip | P0 |
| VW-9 | Show a "mask may be visible" warning on objects whose background is non-uniform | P1 |

### 6.3 Text Editing
| ID | Requirement | Priority |
|---|---|---|
| TE-1 | Double-click a Text Line to open an inline textarea positioned over it | P0 |
| TE-2 | Textarea auto-expands while typing; supports multi-line | P0 |
| TE-3 | `Enter` commits, `Shift+Enter` inserts newline, `Esc` cancels | P0 |
| TE-4 | Committing creates a `TEXT_REPLACE` operation; no operation if text is unchanged | P0 |
| TE-5 | "Revert to Original" restores the object's original state (recorded as `REVERT`) | P0 |
| TE-6 | **Overflow:** text wider than the original line extends rightward and wraps at the Wrap Margin (`pageWidth − 40 pt`); extra lines stack downward at the original line height. Neighbours are not reflowed; show a "text overlaps other content" hint when the Patch intersects other objects | P0 |
| TE-7 | **Delete text:** `Delete`/`Backspace` on a selected Text Line (or a toolbar/panel button) creates `OBJECT_DELETE`; the original is masked | P0 |
| TE-8 | **Add text:** an "Add text" tool; clicking empty page space opens the inline editor and commit creates `TEXT_ADD` with default style (Liberation Sans, 12 pt, black) or the last-used style | P0 |
| TE-9 | Block commit and show an inline warning when typed characters are outside Glyph Coverage | P0 |

### 6.4 Move, Resize and Delete
| ID | Requirement | Priority |
|---|---|---|
| MV-1 | Selected objects show a `Move` badge; drag via badge or box border (text and images) | P0 |
| MV-2 | Cursor changes `grab` to `grabbing`; dragged object shows elevation shadow | P1 |
| MV-3 | **Dual-location masking:** Position A stays masked (sampled color); the object renders at Position B | P0 |
| MV-4 | **Clamping:** the object's whole bounding box stays inside the Safe Area (10 pt inset on every side) | P0 |
| MV-5 | Numeric X/Y inputs in the Properties Panel in Display Coordinates (points, origin top-left); stored as Page Space | P1 |
| MV-6 | One drag commits one `OBJECT_MOVE`; numeric inputs commit on blur/Enter | P0 |
| MV-7 | Image resize via corner handles (Shift keeps aspect ratio), committed as one `OBJECT_RESIZE`; clamped to the Safe Area | P0 |
| MV-8 | Delete a selected image (`Delete` key or button) as `OBJECT_DELETE`; original area masked | P0 |
| MV-9 | Arrow keys nudge the selected object by 1 pt (Shift: 10 pt), coalesced into one `OBJECT_MOVE` per key-repeat burst | P1 |

### 6.5 Typography and Style
| ID | Requirement | Priority |
|---|---|---|
| TY-1 | Parse the text matrix; derive font size from vertical scale (`√(c²+d²)` / `|d|`) and `item.height`, not compressed horizontal scale | P0 |
| TY-2 | Compute horizontal scaling (`Tz`) from non-square matrices | P1 |
| TY-3 | Text color from the content-stream fill color (PDF.js operator list); fall back to pixel sampling when unresolved (ADR-0004) | P0 |
| TY-4 | Strip font subset prefixes (e.g. `BWODTG+Times` → `Times`) to get the Original Font | P0 |
| TY-5 | Classify the Original Font into a Font Class (`sans`/`serif`/`mono`) plus bold/italic, using name heuristics and font descriptor flags | P0 |
| TY-6 | Render every Patch with the corresponding Bundled Font in preview (via `@font-face`) **and** export. `fontObj.loadedName` is used only for detection/display (ADR-0001) | P0 |
| TY-7 | Compute letter-spacing (`charSpacing`) and line-height ratios from glyph advances | P1 |
| TY-8 | Export embeds the Bundled Font via `@pdf-lib/fontkit` (subset on embed). Standard 14 fonts are not used for Patches | P0 |
| TY-9 | User overrides: font family (the 3 Bundled families), size, bold, italic, color (`TEXT_STYLE_CHANGE`) | P0 |
| TY-10 | Extract a document color palette to offer as presets in the color picker | P2 |
| TY-11 | Glyph Coverage = Latin, Latin Extended, Greek, Cyrillic (what Liberation fonts provide) | P0 |
| TY-12 | Properties Panel shows "Original: <font> → Exported as <Bundled Font>" whenever they differ | P0 |

### 6.6 Image Extraction and Replacement
| ID | Requirement | Priority |
|---|---|---|
| IM-1 | Scan PDF.js operator lists (`paintImageXObject`, `paintInlineImageXObject`) to detect image bounds and positions | P0 |
| IM-2 | Replace an image by file upload or drag-and-drop (JPEG, PNG, WebP) | P0 |
| IM-3 | Fit modes `contain` (default), `cover`, `fill`, relative to the original bounding box | P0 |
| IM-4 | The original image area is masked before the replacement is drawn, so the old image never shows through letterboxing | P0 |
| IM-5 | Export embeds via `embedPng` / `embedJpg` and draws at the exact box; WebP is re-encoded to PNG first | P0 |
| IM-6 | Commit creates an `IMAGE_REPLACE` operation | P0 |

### 6.7 State, History, Session, Navigation
| ID | Requirement | Priority |
|---|---|---|
| ST-1 | Append-only Operation Log of `TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `TEXT_ADD`, `OBJECT_MOVE`, `OBJECT_RESIZE`, `OBJECT_DELETE`, `IMAGE_REPLACE`, `REVERT` (ADR-0003) | P0 |
| ST-2 | `previewDocument` derived by a pure reducer over the immutable Original Document | P0 |
| ST-3 | `undo()` / `redo()` with `Ctrl/Cmd+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`; one Gesture = one undo step | P0 |
| ST-4 | Page switching, zoom 25% to 400%, fit-to-width, fit-to-page | P0 |
| ST-5 | Edit count badge ("X edits applied") | P1 |
| ST-6 | Autosave the Session to IndexedDB (debounced); on reload offer "Restore previous session?"; a "Discard session" control clears it (ADR-0005) | P0 |
| ST-7 | History tab revert appends a `REVERT` targeting that operation; the revert is itself undoable | P0 |
| ST-8 | Single selection only; selecting another object replaces the selection | P0 |

### 6.8 Export
| ID | Requirement | Priority |
|---|---|---|
| EX-1 | Load the Original Document bytes and apply the Operation Log with `pdf-lib`, without mutating the source | P0 |
| EX-2 | Dual-location masking on export: sampled-color rectangle at Position A, object drawn at Position B | P0 |
| EX-3 | Wrapping and multi-line layout use the same `text-layout.ts` output as the preview | P0 |
| EX-4 | Download via object URL blob with a custom file name | P0 |
| EX-5 | Export modal: file name, progress indicator, estimated file size | P1 |
| EX-6 | Exported output must visually match the preview (see Section 13) | P0 |

## 7. UI Requirements

### 7.1 Header toolbar
File upload and sample loader; "Add text" tool; undo/redo with disabled states and edit count; page switcher (`< 1 / 8 >`); zoom slider and presets (`100%`, `+`, `-`); full-document search with next/previous match; Export PDF button; keyboard-shortcuts button; Session indicator ("Saved on this device") with "Discard session".

### 7.2 Left sidebar (tabs)
- **Thumbnails:** page previews, active page highlighted.
- **Text Objects:** searchable, scrollable list of Text Lines on the active page (Locked Objects marked).
- **Images:** list of Image Objects with status (original / replaced / moved / deleted).
- **History:** itemized changelog with timestamps and a per-item revert button (appends `REVERT`).

### 7.3 Right properties panel
- "Preserving Original Style" card: Original Font, Font Class, weight, point size, color badge, and "Exported as <Bundled Font>" note when they differ.
- Multi-line text editor with "Revert to Original".
- X/Y numeric inputs (points, top-left origin); W/H for images.
- Font family selector (Sans / Serif / Mono), size stepper/input, bold/italic toggles, color picker.
- Image: replace, fit mode, delete.
- Warnings area: outside Glyph Coverage, overlaps other content, mask may be visible.
- Advanced metadata accordion: raw PDF font resource name, subset prefix, encoding, horizontal scaling.

### 7.4 Uploader and samples
Drag-and-drop dropzone for `.pdf`; built-in samples (see UP-2); encrypted-file error state (UP-3); "Restore previous session?" prompt (ST-6).

### 7.5 Modals
Export modal and Shortcuts modal. `Ctrl+S` opens the Export modal, since there is no persistent save to file.

### 7.6 Keyboard
`Ctrl/Cmd+Z` undo, `Ctrl+Y` / `Ctrl+Shift+Z` redo, `Ctrl+S` export, `Enter` commit, `Shift+Enter` newline, `Esc` cancel/deselect, `Delete`/`Backspace` delete selected object (when not editing), arrow keys nudge (MV-9).

## 8. Data Model (conceptual)

```ts
type Op<T extends string, P> = { type: T; id: string; ts: number; pageIndex: number } & P;

type EditOperation =
  | Op<'TEXT_REPLACE',      { objectId: string; newText: string }>
  | Op<'TEXT_STYLE_CHANGE', { objectId: string; style: Partial<TextStyle> }>
  | Op<'TEXT_ADD',          { objectId: string; text: string; at: Point; style: TextStyle }>
  | Op<'OBJECT_MOVE',       { objectId: string; from: Point; to: Point }>
  | Op<'OBJECT_RESIZE',     { objectId: string; from: Box; to: Box }>      // images
  | Op<'OBJECT_DELETE',     { objectId: string }>
  | Op<'IMAGE_REPLACE',     { objectId: string; blobKey: string; fit: 'contain' | 'cover' | 'fill' }>
  | Op<'REVERT',            { targetOpIds: string[] }>;

interface OperationLog { ops: EditOperation[]; cursor: number } // ops[0..cursor) are active

type FontClass = 'sans' | 'serif' | 'mono';

interface TextStyle {
  fontClass: FontClass; bold: boolean; italic: boolean;
  size: number; color: string; charSpacing: number; lineHeight: number; hScale: number;
}

interface TextLine {
  id: string; pageIndex: number; text: string;
  bbox: Box;                       // Page Space (points, origin bottom-left)
  style: TextStyle;
  originalFont: { name: string; subsetPrefix?: string; loadedName?: string; encoding?: string };
  maskColor: string;               // Sampled Background
  locked: boolean;                 // rotated/skewed in v1
}
```

- Coordinates are stored in **Page Space** and converted only at the render/UI boundary by `coordinates.ts` (rotation, CropBox, zoom, `devicePixelRatio`, Display Coordinates).
- Image blobs are stored in IndexedDB keyed by `blobKey` so the Operation Log stays small and serialisable.

## 9. Fidelity Decisions and Remaining Constraints

| # | Topic | Decision |
|---|---|---|
| 1 | Preview vs export fonts | **Resolved (ADR-0001).** Bundled Liberation fonts in both; the difference from the Original Font is shown to the user. |
| 2 | Whiteout is not redaction | **Unchanged.** Masks hide content visually; the original remains in the content stream. Never market as redaction. |
| 3 | Non-white backgrounds | **Resolved (ADR-0004).** Sampled Background color; warn when non-uniform. |
| 4 | Non-Latin scripts | **Scoped.** Latin, Latin Extended, Greek, Cyrillic; other characters blocked on commit (TE-9). |
| 5 | Text granularity | **Resolved (ADR-0002).** Merged Text Line; no reflow; long edits wrap at the Wrap Margin (TE-6). |
| 6 | Coordinate systems | **Resolved.** Page Space storage, one conversion helper, Display Coordinates (top-left) in the UI; rotated pages supported, rotated text locked. |
| 7 | Large files | **Open (engineering).** Rendering, sampling and export must not freeze the UI; use Web Workers where needed. |
| 8 | Encrypted PDFs | **Resolved (ADR-0006).** Blocked with a clear error. |
| 9 | Local data on shared devices | **New.** The Session persists in IndexedDB; surfaced in the UI with a Discard control (ADR-0005). |

## 10. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Privacy | No network calls with document data; strict CSP (`connect-src 'self'`, no third-party scripts); verified in E2E |
| Offline | PWA service worker precaches app shell, PDF.js worker and Bundled Fonts; fully functional offline after first visit |
| Performance | First page rendered under 2 s for a 10-page, 5 MB PDF on a mid-range laptop; edit interactions under 100 ms |
| Scale | Smooth up to 100 pages / 50 MB |
| Browsers | Latest Chrome, Edge, Firefox, Safari (desktop) |
| Accessibility | Keyboard-operable toolbar, panels and object selection; visible focus; ARIA labels on icon buttons |
| Reliability | Export never mutates the source; failures (including IndexedDB quota) show actionable errors |
| Bundle | Bundled Fonts ≈ 1–2 MB, loaded lazily on first edit and cached by the service worker |
| Quality | TypeScript strict mode; unit tests for geometry and extraction; E2E for core flows |

## 11. User Flows

1. **Edit text:** Upload or load sample → click a Text Line → double-click → edit → `Enter` → Patch appears in place (Bundled Font) → Export.
2. **Add text:** Choose "Add text" → click empty space → type → `Enter` → Export.
3. **Delete text or image:** Select → `Delete` → the area is masked in the sampled color.
4. **Move:** Select text or image → drag by `Move` handle (or type X/Y) → release → Position A masked, object at Position B → Export.
5. **Replace or resize an image:** Select image → upload or drag a new image → choose fit mode → optionally resize with handles → Export.
6. **Undo mistakes:** `Ctrl+Z`, or revert a single item from the History tab (appends a revert, itself undoable).
7. **Resume:** Reload the tab → "Restore previous session?" → continue editing.
8. **Find text:** Open search → type query → step through highlighted matches.
9. **Encrypted file:** Upload → clear error explaining the file must be unlocked first.

## 12. Release Plan

| Phase | Scope |
|---|---|
| **M0 Foundation** | Scaffold, PWA shell + CSP, PDF.js rendering (VW-1), coordinate helper incl. rotation/CropBox (UP-4), uploader, encrypted-file error (UP-3), sample PDFs (UP-2), zoom/page navigation |
| **M1 Read model** | Run → Text Line merging, font classification, operator-list color, background sampling, text overlay boxes, Locked Objects, Text Objects tab |
| **M2 Edit core** | Operation Log + reducer + `REVERT`, inline editor, text replace/add/delete, Bundled Font Patches + Masks, overflow wrapping, Glyph Coverage check, undo/redo, History tab, Session autosave |
| **M3 Move and style** | Dragging with dual-location masking, Safe Area clamping, Properties Panel (position, style overrides, font notes) |
| **M4 Images** | Image detection, replace with fit modes, move, resize, delete |
| **M5 Export** | `pdf-exporter` with fontkit embedding, shared text layout, masks, image embedding, Export modal |
| **M6 Polish** | Search, shortcuts modal, thumbnails, nudging, palette presets, accessibility audit, performance (workers), cross-browser QA |

**MVP = M0 to M5** (all text and image edit operations, including add/delete and image move/resize/delete, plus export). M6 completes v1.0.

## 13. Success Metrics

- Export fidelity: at least 95% of sample-suite edits are visually indistinguishable from preview (pixel-diff threshold).
- Task success: a first-time user completes a text edit and export in under 2 minutes.
- Crash-free sessions above 99%.
- Zero document bytes sent over the network (verified in E2E with request interception).
- Session restore succeeds after reload for documents up to 50 MB.

## 14. Test Strategy (summary)

- **Unit:** matrix → font size, run → Text Line merging, Font Class mapping, coordinate transforms (rotation, CropBox, Display Coordinates), Safe Area clamping, wrapping at the Wrap Margin, Glyph Coverage check, operation reducer (apply/undo/redo/`REVERT`), background-color sampling.
- **Integration:** extraction on the three sample PDFs plus a corpus (rotated pages, rotated text, subset fonts, tinted backgrounds, scanned page, encrypted file).
- **Visual regression:** preview canvas vs exported PDF rasterized with PDF.js, for every operation type.
- **E2E (Playwright):** upload, edit, add, delete, move, image replace/resize/delete, undo/redo, history revert, session restore, export, keyboard shortcuts, offline mode, no outbound document requests.
- **Manual:** cross-browser, high-DPI, zoom extremes, large files.

## 15. Decision Log (requirements review, 2026-10-03)

| Question | Decision | Record |
|---|---|---|
| Export font for edited text | Bundled Liberation Sans/Serif/Mono × 4 styles, embedded with fontkit | ADR-0001 |
| Preview font for edited text | Same Bundled Font as export (supersedes `loadedName`-first) | ADR-0001 |
| Editable text unit | Merged Text Line | ADR-0002 |
| History revert semantics | Append `REVERT` op; undoable | ADR-0003 |
| Undo granularity | One Gesture = one operation | ADR-0003 |
| Mask fill | Sampled Background color | ADR-0004 |
| Text color source | Operator list, pixel-sampling fallback | ADR-0004 |
| Persistence | IndexedDB Session autosave + restore prompt | ADR-0005 |
| Deployment | Static site + PWA, strict CSP | ADR-0005 |
| Encrypted PDFs | Blocked with clear error | ADR-0006 |
| Extra operations | Text delete, text add, image move/resize/delete | §6 |
| Scripts | Latin, Latin Extended, Greek, Cyrillic; block others on commit | TY-11, TE-9 |
| Multi-select | No (single selection) | ST-8 |
| Y coordinate in UI | Top-left origin, points | MV-5 |
| Text overflow | Extend, wrap at `pageWidth − 40 pt`, no reflow, overlap hint | TE-6 |
| Clamping | Whole bbox inside 10 pt Safe Area | MV-4 |
| Rotation | Rotated pages supported; rotated text locked | UP-4, VW-8 |
| Image replace default | `contain` in original box, original area masked | IM-3, IM-4 |
| Phasing | All edit operations in MVP (MVP = M0–M5) | §12 |
