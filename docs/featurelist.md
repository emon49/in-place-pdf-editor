# PDF In-Place Editor - Complete Feature List & Architecture Specification

## 🏗️ High-Level System Architecture

The application is an **in-place, non-destructive WYSIWYG PDF editor** running 100% client-side in the browser. Unlike traditional converters that transform PDFs into HTML or DOCX (which disrupts layouts and flow), this editor uses a **4-Layer Composition Architecture**:

```
┌────────────────────────────────────────────────────────┐
│ Layer 4: WYSIWYG Active Editor (Inline Textarea Modal) │
├────────────────────────────────────────────────────────┤
│ Layer 3: Interactive Images Layer (Handles & Uploads)  │
├────────────────────────────────────────────────────────┤
│ Layer 2: Interactive Text Detection & Selection Box    │
├────────────────────────────────────────────────────────┤
│ Layer 1: In-Place Patches & Dual-Whiteout Masks        │
├────────────────────────────────────────────────────────┤
│ Layer 0: High-DPI PDF.js Background Canvas             │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Feature Breakdown & Subsystems

---

### 1. 📄 Multi-Layered PDF Viewer Engine (`PDFViewer.tsx`)
* **Layer 0: High-DPI Vector Canvas**
  * Renders the original PDF vector pages at full crisp resolution using PDF.js and `window.devicePixelRatio` scaling.
* **Layer 1: Whiteout Mask & Replaced Text Patches**
  * Automatically calculates bounding rectangles for any edited or moved text.
  * Emits whiteout rectangles over the original text to erase the background PDF text cleanly.
  * Renders replacement text in-place with exact font size, line height, letter spacing, and colors.
* **Layer 2: Interactive Text Detection Layer**
  * Generates clickable bounding boxes over every detected word/line in the PDF.
  * Displays active selection rings, corner resize indicators, and hover states.
  * Search query highlights in real-time.
* **Layer 3: Interactive Images Layer**
  * Displays selection borders and replacement controls over embedded bitmap images.
* **Layer 4: WYSIWYG Inline Editor (`InlineTextEditor.tsx`)**
  * Double-clicking any text opens an inline textarea directly over the text.
  * Auto-expands as you type with multi-line support (`Shift + Enter` for newlines, `Enter` to commit, `Esc` to cancel).

---

### 2. ✋ Drag-and-Drop Repositioning & Dual-Location Whiteout
* **Visual Move Handle & Border Dragging:**
  * Selected text boxes display an interactive `Move` badge. Users can drag either the handle or the box border.
  * Real-time cursor states (`grab` $\rightarrow$ `grabbing`) with elevation shadows while dragging.
* **Dual-Location Whiteout Guarantee:**
  * **Original Position ($A$):** Remains masked with a clean white rectangle so the old printed text never bleeds through.
  * **New Position ($B$):** The text floats and renders at the new coordinates with full styling.
* **Page Boundary Clamping:** Clamps objects within $10\text{pt} \le X \le (\text{pageWidth} - 40\text{pt})$ and $10\text{pt} \le Y \le (\text{pageHeight} - 20\text{pt})$.
* **Precision Numeric Controls:** Real-time $X$ and $Y$ coordinate inputs in the Properties Panel for pixel-perfect positioning.

---

### 3. 🔬 Typography & Font Extraction Engine (`pdf-text-extractor.ts`, `font-resolver.ts`, `font-style-extractor.ts`)
* **Transformation Matrix Parsing:**
  * Extracts font size via vertical matrix scaling ($\sqrt{c^2 + d^2}$ / $|d|$) and `item.height` (avoiding compressed horizontal scale errors).
  * Calculates horizontal scaling percentage ($T_z$) from non-square matrices.
* **Pixel-Level Canvas Color Sampling (`pdf-color-extractor.ts`):**
  * Samples rendered pixels from an offscreen canvas at the text coordinates to detect the exact foreground color (RGB/HEX) and contrast against page backgrounds.
* **Font Family Resolution & High X-Height Fallbacks:**
  * Strips subset prefixes (e.g., `BWODTG+Times` $\rightarrow$ `Times`).
  * Maps and preserves distinct digital serif families (*Georgia, Charter, Iowan Old Style, Cambria, Garamond, Merriweather, Palatino*) and sans-serif families (*Inter, Roboto, Helvetica, Arial*).
  * Injects PDF.js embedded `@font-face` names (`fontObj.loadedName`) at the front of the CSS font stack.
* **Tracking & Metric Calculations:**
  * Calculates letter-spacing (`charSpacingPDF`) and line-height ratios from PDF advances.
  * Maps families to PDF Standard 14 Fonts (*Helvetica, Times-Roman, Courier, and their Bold/Italic variants*) for `pdf-lib` export.

---

### 4. 🖼️ Image Extraction & Replacement Subsystem (`pdf-image-extractor.ts`, `image-replacement-engine.ts`)
* **PDF Operator List Inspection:**
  * Scans PDF.js operator lists (`paintImageXObject`, `paintInlineImageXObject`) to detect image dimensions, coordinates, and positions.
* **In-Browser Image Replacement:**
  * Allows replacing any PDF image via file upload or drag-and-drop (`JPEG`, `PNG`, `WebP`).
  * Supports fit modes: `contain`, `cover`, and `fill`.
* **Export Image Insertion:**
  * Re-encodes and embeds images using `pdf-lib` (`embedPng`, `embedJpg`) and draws them at the exact bounding box.

---

### 5. 🗃️ State Management & Undo / Redo Engine (`editorStore.ts`, `pdf-objects.ts`)
* **Non-Destructive Operation Stack:**
  * Tracks an array of `EditOperation` objects:
    * `TEXT_REPLACE`
    * `TEXT_STYLE_CHANGE`
    * `OBJECT_MOVE`
    * `IMAGE_REPLACE`
* **Computed Derived State:**
  * `previewDocument` is dynamically computed by applying operations over the immutable original `documentState`.
* **Full Undo / Redo History:**
  * `undo()` and `redo()` with keyboard shortcuts (`Ctrl+Z`, `Cmd+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`).
* **Document Navigation & Zoom:**
  * Page switching, zoom scale controls ($25\%$ to $400\%$, fit-to-width, fit-to-page).

---

### 6. 📤 PDF Export Engine (`pdf-exporter.ts`, `text-replacement-engine.ts`)
* **Pure Client-Side PDF Generation (`pdf-lib`):**
  * Loads original PDF bytes and immutably modifies pages.
* **Dual-Whiteout on Export:**
  * If an object was moved, erases the original location with a white rectangle, then renders text at the new $(X, Y)$ location.
* **Multi-Line Text Flow & Word-Wrapping:**
  * Wraps text automatically if line width exceeds page margins.
* **Direct Browser Download:**
  * Generates an object URL blob and triggers download with custom file naming.

---

## 🖥️ UI Components & Tooling Breakdown

### A. Navigation & Toolbar (`Header.tsx`)
* File upload button & built-in sample loader.
* Undo / Redo buttons with dynamic disabled states and edit count badge (`X edits applied`).
* Page switcher (`< 1 / 8 >`).
* Zoom slider and preset buttons (`100%`, `+`, `-`).
* Full document search bar with match navigation.
* Export PDF button and Keyboard shortcuts modal button.

### B. Left Sidebar Inspector (`Sidebar.tsx`)
* **Thumbnails Tab:** Page previews with active page highlight.
* **Text Objects Tab:** Searchable, scrollable list of all text blocks extracted from the active page.
* **Images Tab:** List of all extracted bitmap images with replacement status.
* **History Tab:** Itemized changelog of all applied edits with timestamps and instant revert buttons.

### C. Right Properties Panel (`PropertiesPanel.tsx`)
* **"Preserving Original Style" Card:** Displays detected font family, weight, point size, and sampled color badge.
* **Text Editor Box:** Multi-line textarea with "Revert to Original" button.
* **Position Controls:** Numeric inputs for $X$ and $Y$ coordinates in points.
* **Font & Color Overrides:**
  * Font family selector.
  * Font size stepper/input.
  * Bold and Italic toggle buttons.
  * Color picker with auto-extracted document palette presets.
* **Advanced Metadata Accordion:** Displays raw PDF font resource name, subset prefix, encoding, and horizontal scaling.

### D. Uploader & Sample Templates (`PDFUploader.tsx`, `sample-documents.ts`)
* Drag-and-drop dropzone for uploading local `.pdf` files.
* Programmatically built sample PDFs (*Academic Research Paper, Invoice, Technical Spec*) generated via `pdf-lib` for instant testing without uploading files.

### E. Modals (`ExportModal.tsx`, `ShortcutsModal.tsx`)
* **Export Modal:** File name customization, download progress, file size estimation.
* **Shortcuts Modal:** Reference sheet for keyboard controls (`Ctrl+Z`, `Ctrl+S`, `Escape`, `Enter`, `Shift+Enter`).

---

## 🛠️ Recommended Tech Stack for Rebuilding

| Layer | Recommended Library | Purpose |
| :--- | :--- | :--- |
| **Framework** | React 18 / 19 + TypeScript | UI & Component Architecture |
| **Styling** | Tailwind CSS + Lucide Icons | Responsive UI, toolbars, and icons |
| **PDF Rendering** | `pdfjs-dist` (PDF.js) | Vector canvas rendering & text/font extraction |
| **PDF Modification** | `pdf-lib` | Binary PDF parsing, whiteout masks, font embedding, & export |
| **State Management** | React Hooks / Zustand | Operation stack & undo/redo tracking |
