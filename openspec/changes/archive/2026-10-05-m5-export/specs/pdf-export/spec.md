# Spec Delta

## Purpose

Applies the active Operation Log to the Original Document bytes and produces a downloadable PDF whose visual appearance matches the preview exactly.

## ADDED Requirements

### Requirement: Export does not mutate the source
The exporter SHALL load the Original Document bytes into `pdf-lib` without modifying the in-memory copy held by the editor. The exported PDF SHALL be emitted as a new `Uint8Array` (EX-1).

#### Scenario: Source is unchanged after export
- **WHEN** the user exports the document
- **THEN** the editor's Original Document bytes are identical before and after the export

### Requirement: Dual-location masking on export
For every active OBJECT_MOVE, TEXT_REPLACE, TEXT_STYLE_CHANGE, OBJECT_DELETE, and IMAGE_REPLACE, the exporter SHALL draw a sampled-color rectangle at Position A before drawing the content at Position B (EX-2, ADR-0004).

#### Scenario: Moved text is masked at Position A on export
- **WHEN** the user moves a Text Line and exports
- **THEN** the exported PDF has a colored rectangle at the original position and the text only at the new position

#### Scenario: Deleted image is masked on export
- **WHEN** the user deletes an Image Object and exports
- **THEN** the exported PDF has a mask rectangle where the image was; no image content remains

### Requirement: Shared text layout geometry
The exporter SHALL use the same `text-layout.ts` output as the viewer for line breaking, wrap positions, and multi-line layout. The exported text positions SHALL match the preview positions within 1 pt (EX-3, EX-6).

#### Scenario: Wrapped text aligns in preview and export
- **WHEN** edited text wraps onto two lines in the preview
- **THEN** the export places those two lines at the same wrap points

### Requirement: Font tier 1 — original font resource reuse
When the Resolved Font is tier 1, the exporter SHALL reference the page's existing font resource by its PDF name and write character codes in the original font's encoding. No font data SHALL be re-embedded (TY-8).

#### Scenario: Tier-1 text uses the original resource
- **WHEN** the Resolved Font is tier 1 and the user edits a line
- **THEN** the exported PDF references the original font dictionary for that text operator

### Requirement: Font tiers 2–4 — fontkit embedding
When the Resolved Font is tier 2, 3 or 4, the exporter SHALL embed the font file via `@pdf-lib/fontkit`, subsetting to the glyphs used in each line (TY-8).

#### Scenario: Tier-4 text is embedded
- **WHEN** the Resolved Font is Liberation Sans
- **THEN** the exported PDF contains an embedded subset of Liberation Sans

### Requirement: Image embedding
Replaced images (IMAGE_REPLACE) SHALL be embedded via `embedPng` or `embedJpg`. WebP blobs are already stored as PNG (from M4) and SHALL be embedded as PNG. Images SHALL be drawn at the exact bounding box determined by the fit-mode layout (IM-5).

#### Scenario: Replaced image is present in the export
- **WHEN** the user replaces an image and exports
- **THEN** the exported PDF contains the new image at the same position and size as the preview

### Requirement: Export fidelity verified
At least 95% of a defined sample-suite of edits SHALL produce visual output indistinguishable from the preview when compared with a pixel-diff tool (EX-6).

#### Scenario: Visual match on sample suite
- **WHEN** the sample suite of edits is exported and rasterized with PDF.js
- **THEN** at least 95% of comparisons pass the pixel-diff threshold
