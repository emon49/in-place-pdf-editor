# Spec Delta

## Purpose

Turns a PDF page's raw text fragments into the editor's editable units — Text Lines with stable identity, geometry and reading order — so every later feature points at the same objects.

## ADDED Requirements

### Requirement: Text Lines are the editable unit
The system SHALL merge the text fragments a page reports into Text Lines and expose only Text Lines to the rest of the editor. Two adjacent fragments SHALL merge when they share a baseline, font, size, colour and rendering mode, and the horizontal gap between them is at most 0.25 × font size.

#### Scenario: A sentence split into fragments becomes one object
- **WHEN** a page draws "Total amount due" as three separate fragments on one baseline in the same style
- **THEN** the page reports exactly one Text Line whose text is "Total amount due"

#### Scenario: Table cells stay separate
- **WHEN** an invoice row places "Design consultation (hours)", "6", "$85.00" and "$510.00" on one baseline with gaps far wider than their font size
- **THEN** the page reports four Text Lines, one per cell

#### Scenario: A style change splits a line
- **WHEN** a line reads "Total: $510.00" with "Total:" in bold and the amount in regular, at the same size and baseline
- **THEN** the page reports two Text Lines, split at the weight change

### Requirement: Missing spaces are restored
Many PDFs position words without emitting space characters. When merging two fragments whose gap is at least 0.08 × font size, the system SHALL insert a single space between them, unless either side already ends or starts with whitespace.

#### Scenario: Word gap without a space character
- **WHEN** a page draws "Hello" and "world" as two fragments with a one-space gap and no space character
- **THEN** the merged Text Line reads "Hello world"

#### Scenario: Kerned fragments are joined without a space
- **WHEN** a page draws "A" and "V" as two fragments with a kerning gap below 0.08 × font size
- **THEN** the merged Text Line reads "AV"

### Requirement: Original characters are preserved
Extracted text SHALL be the document's own characters, without normalization substitutions, so that text can be shown, edited and written back unchanged.

#### Scenario: Ligature is not expanded
- **WHEN** a page contains the single ligature character "ﬁ" in "ﬁle"
- **THEN** the Text Line contains the ligature character, not the two letters "f" and "i"

### Requirement: Text Line geometry in Page Space
Every Text Line SHALL carry, in Page Space: a baseline origin, a bounding box covering the drawn glyphs including ascender and descender, and the text matrix it was drawn with. The bounding box SHALL have non-negative width and height.

#### Scenario: Bounding box covers the glyphs
- **WHEN** a 12 pt line is drawn at Page Space (72, 700) with a width of 142 pt
- **THEN** its bounding box starts at x = 72, spans about 142 pt horizontally, and its vertical extent covers the font's ascent and descent around the baseline at y = 700

### Requirement: Reading order
Text Lines SHALL be ordered top to bottom, then left to right as the page is displayed, so lists and keyboard navigation follow what the reader sees, including on rotated pages.

#### Scenario: Rotated page reading order
- **WHEN** the active page has `/Rotate 90` and its displayed layout puts a heading above a table
- **THEN** the heading's Text Line comes before the table's Text Lines

### Requirement: Locked Objects
The system SHALL extract, but mark as locked, any text it cannot edit in v1: text whose matrix is rotated or skewed relative to the page, text in vertical writing mode, and text drawn with a Type 3 font. Each locked Text Line SHALL carry a machine-readable reason.

#### Scenario: Rotated text run is locked
- **WHEN** a page draws a watermark at 30 degrees on an unrotated page
- **THEN** that Text Line is present and marked locked with the reason "rotated or skewed text"

#### Scenario: Text on a rotated page is not locked
- **WHEN** a page has `/Rotate 90` and its text is horizontal in the displayed orientation
- **THEN** those Text Lines are not locked

### Requirement: Stable object identity
Each Text Line SHALL have an identifier that is stable for the same document and page across repeated extraction, so selection and later edits survive re-extraction and page revisits.

#### Scenario: Re-extracting a page keeps identifiers
- **WHEN** a page is extracted, the user navigates away and returns, and the page is extracted again
- **THEN** each Text Line has the same identifier as before

### Requirement: Extraction is per page and does not block the UI
The system SHALL extract a page's Text Lines only when that page becomes active, cache the result for the open document, and keep the interface responsive while extraction runs. Extraction results SHALL be discarded when the document is replaced.

#### Scenario: Only the active page is extracted
- **WHEN** a 100-page document is opened and the user stays on page 1
- **THEN** only page 1 has been extracted

#### Scenario: Revisiting a page reuses the cache
- **WHEN** the user moves from page 1 to page 2 and back to page 1
- **THEN** page 1 is not extracted a second time

#### Scenario: Controls stay usable during extraction
- **WHEN** a text-heavy page is being extracted
- **THEN** zoom and page controls still respond, and the page remains visible

### Requirement: Extraction failure is contained
If extraction fails for a page, the system SHALL keep the page rendered and readable, report that text could not be detected on it, and leave other pages unaffected.

#### Scenario: A page whose text cannot be extracted
- **WHEN** extraction throws for the active page
- **THEN** the page still renders, a message says text could not be detected on this page, and navigating to another page extracts normally
