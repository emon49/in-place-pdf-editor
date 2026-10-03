# Product Requirements Document: PDF In-Place Editor

| | |
|---|---|
| **Status** | Draft v0.1 |
| **Date** | 2026-10-03 |
| **Source** | `featurelist.md` (Complete Feature List & Architecture Specification) |
| **Type** | 100% client-side web application (no backend) |

---

## 1. Overview

A browser-based, **in-place, non-destructive WYSIWYG PDF editor**. Users open a PDF, click directly on existing text or images, edit them where they sit, and export a new PDF that preserves the original layout. Unlike converters that turn a PDF into HTML or DOCX (and break layout and flow), this editor leaves the original PDF intact and layers edits on top of it. Everything runs in the browser; documents never leave the user's device.

## 2. Problem Statement

Editing a PDF today usually means one of:

- Paying for desktop software (Acrobat Pro and similar).
- Converting to Word/HTML, editing, and converting back, which breaks layout, fonts and pagination.
- Uploading sensitive documents to a third-party server.

Users need a quick, private way to fix a typo, change a number, move a line, or swap an image in a PDF without leaving the browser or destroying the layout.

## 3. Goals and Non-Goals

### Goals
1. Edit existing text in place, preserving font size, line height, letter spacing and color as closely as possible.
2. Move text blocks and replace images with immediate visual feedback.
3. Provide undo/redo and an itemized, revertible edit history.
4. Export a valid PDF that matches the on-screen preview.
5. Run fully client-side: no uploads, no accounts, no server.
6. Be usable without documentation (familiar toolbar, sidebar, properties panel).

### Non-Goals (v1) 
- Editing PDF content streams at the operator level (true text reflow inside the original stream).
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
│ Layer 1: In-Place Patches & Dual-Whiteout Masks        │
├────────────────────────────────────────────────────────┤
│ Layer 0: High-DPI PDF.js Background Canvas             │
└────────────────────────────────────────────────────────┘
```

### Core principles
- **Non-destructive:** the original document state is immutable; edits are an ordered list of operations.
- **Derived preview:** `previewDocument = apply(operations, documentState)`.
- **Single source of truth for geometry:** the same extracted metrics drive preview rendering and export.
- **Client-only:** PDF.js for rendering/extraction, pdf-lib for export.

### Tech stack
| Concern | Choice |
|---|---|
| Framework | React 18/19 + TypeScript |
| Styling | Tailwind CSS + Lucide Icons |
| Rendering and extraction | `pdfjs-dist` |
| Export / modification | `pdf-lib` |
| State | Zustand (or React hooks) |

### Planned modules
`PDFViewer.tsx`, `InlineTextEditor.tsx`, `Header.tsx`, `Sidebar.tsx`, `PropertiesPanel.tsx`, `PDFUploader.tsx`, `ExportModal.tsx`, `ShortcutsModal.tsx`, `editorStore.ts`, `pdf-objects.ts`, `pdf-text-extractor.ts`, `font-resolver.ts`, `font-style-extractor.ts`, `pdf-color-extractor.ts`, `pdf-image-extractor.ts`, `image-replacement-engine.ts`, `text-replacement-engine.ts`, `pdf-exporter.ts`, `sample-documents.ts`.

## 6. Functional Requirements

Priority: **P0** = required for MVP, **P1** = required for v1.0, **P2** = nice to have.

### 6.1 PDF Viewer Engine
| ID | Requirement | Priority |
|---|---|---|
| VW-1 | Render each page to a canvas via PDF.js, scaled by `devicePixelRatio` for crisp output | P0 |
| VW-2 | Overlay clickable bounding boxes for every detected word/line (Layer 2) | P0 |
| VW-3 | Show hover state, active selection ring and corner indicators on text boxes | P0 |
| VW-4 | Highlight search matches in real time | P1 |
| VW-5 | Show selection borders and replacement controls over embedded images (Layer 3) | P0 |
| VW-6 | Render replacement text patches in place with exact font size, line height, letter spacing and color (Layer 1) | P0 |
| VW-7 | Emit whiteout rectangles over original text that was edited or moved | P0 |

### 6.2 Inline Text Editing
| ID | Requirement | Priority |
|---|---|---|
| TE-1 | Double-click text to open an inline textarea positioned over it | P0 |
| TE-2 | Textarea auto-expands while typing; supports multi-line | P0 |
| TE-3 | `Enter` commits, `Shift+Enter` inserts newline, `Esc` cancels | P0 |
| TE-4 | Committing creates a `TEXT_REPLACE` operation; no change if text is unchanged | P0 |
| TE-5 | "Revert to Original" restores the original text for an object | P0 |

### 6.3 Move / Drag-and-Drop
| ID | Requirement | Priority |
|---|---|---|
| MV-1 | Selected text shows a `Move` badge; drag via badge or box border | P0 |
| MV-2 | Cursor changes `grab` to `grabbing`; dragged object shows elevation shadow | P1 |
| MV-3 | **Dual-location whiteout:** original position (A) stays masked; text renders at new position (B) | P0 |
| MV-4 | Clamp position to `10pt ≤ X ≤ pageWidth − 40pt` and `10pt ≤ Y ≤ pageHeight − 20pt` | P0 |
| MV-5 | Numeric X/Y inputs (points) in the Properties Panel for precise placement | P1 |
| MV-6 | Commit creates an `OBJECT_MOVE` operation | P0 |

### 6.4 Typography and Style Extraction
| ID | Requirement | Priority |
|---|---|---|
| TY-1 | Parse the text transform matrix; derive font size from vertical scale (`√(c²+d²)` / `|d|`) and `item.height`, not compressed horizontal scale | P0 |
| TY-2 | Compute horizontal scaling (`Tz`) from non-square matrices | P1 |
| TY-3 | Sample rendered pixels on an offscreen canvas to detect foreground color (RGB/HEX) and contrast against background | P0 |
| TY-4 | Strip font subset prefixes (e.g. `BWODTG+Times` → `Times`) | P0 |
| TY-5 | Map to digital serif families (Georgia, Charter, Iowan Old Style, Cambria, Garamond, Merriweather, Palatino) and sans families (Inter, Roboto, Helvetica, Arial) | P1 |
| TY-6 | Put the PDF.js embedded `@font-face` name (`fontObj.loadedName`) first in the CSS font stack | P0 |
| TY-7 | Compute letter-spacing (`charSpacingPDF`) and line-height ratios from glyph advances | P1 |
| TY-8 | Map families to PDF Standard 14 fonts (Helvetica, Times-Roman, Courier + Bold/Italic) for export | P0 |
| TY-9 | Allow user overrides: font family, size, bold, italic, color (`TEXT_STYLE_CHANGE`) | P0 |
| TY-10 | Extract a document color palette to offer as presets in the color picker | P2 |

### 6.5 Image Extraction and Replacement
| ID | Requirement | Priority |
|---|---|---|
| IM-1 | Scan PDF.js operator lists (`paintImageXObject`, `paintInlineImageXObject`) to detect image bounds and positions | P0 |
| IM-2 | Replace an image by file upload or drag-and-drop (JPEG, PNG, WebP) | P0 |
| IM-3 | Fit modes: `contain`, `cover`, `fill` | P1 |
| IM-4 | Export embeds via `embedPng` / `embedJpg` and draws at the exact bounding box; WebP is re-encoded first | P0 |
| IM-5 | Commit creates an `IMAGE_REPLACE` operation | P0 |

### 6.6 State, Undo/Redo, Navigation
| ID | Requirement | Priority |
|---|---|---|
| ST-1 | Operation stack of `TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `OBJECT_MOVE`, `IMAGE_REPLACE` | P0 |
| ST-2 | `previewDocument` derived from operations over the immutable original | P0 |
| ST-3 | `undo()` / `redo()` with `Ctrl/Cmd+Z`, `Ctrl+Y`, `Ctrl+Shift+Z` | P0 |
| ST-4 | Page switching, zoom 25% to 400%, fit-to-width, fit-to-page | P0 |
| ST-5 | Edit count badge ("X edits applied") | P1 |

### 6.7 Export
| ID | Requirement | Priority |
|---|---|---|
| EX-1 | Load original PDF bytes and apply edits with `pdf-lib`, without mutating the source | P0 |
| EX-2 | Dual whiteout on export: white rectangle at the original location, text drawn at the new position | P0 |
| EX-3 | Word-wrap text exceeding page margins; support multi-line | P1 |
| EX-4 | Download via object URL blob with a custom file name | P0 |
| EX-5 | Export modal: file name, progress indicator, estimated file size | P1 |
| EX-6 | Exported output must visually match the preview (see Section 9) | P0 |

## 7. UI Requirements

### 7.1 Header toolbar
File upload and sample loader; undo/redo with disabled states and edit count; page switcher (`< 1 / 8 >`); zoom slider and presets (`100%`, `+`, `-`); full-document search with next/previous match; Export PDF button; keyboard-shortcuts button.

### 7.2 Left sidebar (tabs)
- **Thumbnails:** page previews, active page highlighted.
- **Text Objects:** searchable, scrollable list of text blocks on the active page.
- **Images:** list of extracted bitmaps with replacement status.
- **History:** itemized changelog with timestamps and a per-item revert button.

### 7.3 Right properties panel
- "Preserving Original Style" card: detected family, weight, point size, sampled color badge.
- Multi-line text editor with "Revert to Original".
- X/Y numeric inputs (points).
- Font family selector, size stepper/input, bold/italic toggles, color picker.
- Advanced metadata accordion: raw PDF font resource name, subset prefix, encoding, horizontal scaling.

### 7.4 Uploader and samples
Drag-and-drop dropzone for `.pdf`; built-in sample PDFs (Academic Research Paper, Invoice, Technical Spec) generated programmatically with `pdf-lib`.

### 7.5 Modals
Export modal and Shortcuts modal (`Ctrl+Z`, `Ctrl+S`, `Escape`, `Enter`, `Shift+Enter`). `Ctrl+S` opens the Export modal, since there is no persistent save.

## 8. Data Model (conceptual)

```ts
type EditOperation =
  | { type: 'TEXT_REPLACE';      id: string; ts: number; pageIndex: number; objectId: string; newText: string }
  | { type: 'TEXT_STYLE_CHANGE'; id: string; ts: number; pageIndex: number; objectId: string; style: Partial<TextStyle> }
  | { type: 'OBJECT_MOVE';       id: string; ts: number; pageIndex: number; objectId: string; from: Point; to: Point }
  | { type: 'IMAGE_REPLACE';     id: string; ts: number; pageIndex: number; imageId: string; blob: Blob; fit: 'contain'|'cover'|'fill' };

interface TextObject {
  id: string; pageIndex: number;
  text: string;
  bbox: { x: number; y: number; width: number; height: number }; // PDF points
  style: { fontFamily: string; loadedName?: string; pdfStdFont: string;
           size: number; bold: boolean; italic: boolean; color: string;
           charSpacing: number; lineHeight: number; hScale: number };
}
```

Coordinates are stored in **PDF user space (points, origin bottom-left)** and converted to screen space only at the rendering boundary.

## 9. Fidelity and Technical Constraints

These are known risks in the design and need explicit decisions:

1. **Preview vs export font mismatch.** Preview can use the PDF's embedded fonts (via `loadedName`), but `pdf-lib` export is limited to Standard 14 fonts (unless custom fonts are embedded). Edited text may therefore look different after export. Mitigation: embed fonts via `@pdf-lib/fontkit` where licensing allows, and/or show a "will export as Helvetica" warning.
2. **Whiteout is not redaction.** White rectangles cover original text visually; the underlying text remains in the content stream and can still be selected, copied or extracted. The product must not be described as secure redaction.
3. **Whiteout on non-white backgrounds.** A white rectangle over a colored or image background is visible. Mitigation: sample the local background color and use it for the mask.
4. **Non-Latin and complex scripts.** Standard 14 fonts only cover a Latin subset (WinAnsi). Other scripts need embedded Unicode fonts and shaping support.
5. **Text-object granularity.** PDF.js returns text runs, not semantic paragraphs. Editing one run in a wrapped paragraph will not reflow neighbors.
6. **Coordinate systems.** PDF origin is bottom-left; canvas is top-left. Page rotation and CropBox offsets must be handled.
7. **Large files.** Rendering and export of very large PDFs must not freeze the UI (consider Web Workers).
8. **Encrypted PDFs.** Password-protected files need a clear error path.

## 10. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Privacy | No network calls with document data; works offline once loaded |
| Performance | First page rendered under 2s for a 10-page, 5 MB PDF on a mid-range laptop; edit interactions under 100 ms |
| Scale | Smooth up to  100 pages / 50 MB |
| Browsers | Latest Chrome, Edge, Firefox, Safari |
| Accessibility | Keyboard-operable toolbar and panels, visible focus, ARIA labels on icon buttons |
| Reliability | Export never mutates the source file; failures show actionable errors |
| Quality | TypeScript strict mode; unit tests for geometry and extraction; E2E for core flows |

## 11. User Flows

1. **Edit text:** Upload or load sample → click text → double-click → edit → `Enter` → see in-place update → Export.
2. **Move text:** Click text → drag by `Move` handle (or type X/Y) → release → both positions masked correctly → Export.
3. **Replace image:** Click image → upload/drag new image → choose fit mode → Export.
4. **Undo mistakes:** `Ctrl+Z`, or revert a single item from the History tab.
5. **Find text:** Open search → type query → step through highlighted matches.

## 12. Release Plan

| Phase | Scope |
|---|---|
| **M0 Foundation** | Project scaffold, PDF.js rendering (VW-1), uploader, sample PDFs, zoom/page navigation |
| **M1 Read model** | Text extraction, font/style/color extraction, text overlay boxes, Text Objects tab |
| **M2 Edit core** | Inline editor, operation stack, preview patches + whiteout, undo/redo, History tab |
| **M3 Move and style** | Dragging with dual whiteout, clamping, Properties Panel overrides |
| **M4 Images** | Image detection, replacement, fit modes |
| **M5 Export** | `pdf-exporter`, text wrapping, image embedding, Export modal |
| **M6 Polish** | Search, shortcuts modal, thumbnails, accessibility, performance, cross-browser QA |

MVP = M0 to M3 + M5 (text edit, move, export).

## 13. Success Metrics

- Export fidelity: at least 95% of sample-suite edits are visually indistinguishable from preview (pixel-diff threshold).
- Task success: a first-time user completes a text edit and export in under 2 minutes.
- Crash-free sessions above 99%.
- Zero document bytes sent over the network (verified in E2E).

## 14. Test Strategy (summary)

- **Unit:** matrix to font size math, coordinate transforms, clamping, font-name resolution, operation reducer (apply/undo/redo).
- **Integration:** extraction on the three sample PDFs plus a corpus (rotated pages, subset fonts, scanned page, encrypted file).
- **Visual regression:** preview canvas vs exported PDF rasterized with PDF.js.
- **E2E (Playwright):** upload, edit, move, replace image, undo/redo, export, keyboard shortcuts.
- **Manual:** cross-browser, high-DPI, zoom extremes, large files.