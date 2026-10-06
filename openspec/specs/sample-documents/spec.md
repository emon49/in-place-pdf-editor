# sample-documents Specification

## Purpose

Provides built-in sample PDFs, generated on the user's device, so users can try the editor and tests can exercise edge cases without uploading files.

## Requirements

### Requirement: Three built-in samples
The system SHALL offer three samples from a "Load sample" control: Academic Research Paper, Invoice, and Technical Spec. Each SHALL be generated on the user's device when selected and opened like an uploaded file.

#### Scenario: Load the invoice sample
- **WHEN** the user chooses "Load sample" then "Invoice"
- **THEN** the Invoice sample opens at page 1 without any network request

### Requirement: Samples cover editor edge cases
Across the three samples the system SHALL include at least: a page with multiple text styles (serif, sans, mono; regular and bold), a region with a tinted (non-white) background behind text, an embedded raster image, a page with `/Rotate 90`, a page whose CropBox differs from its MediaBox, and a document with more than one page.

#### Scenario: Rotated page present
- **WHEN** the Technical Spec sample is opened and the user navigates to its rotated page
- **THEN** the page is displayed in landscape orientation, consistent with `/Rotate 90`

#### Scenario: Tinted region present
- **WHEN** the Invoice sample is opened
- **THEN** its table header row shows text on a non-white background

### Requirement: Deterministic sample output
Generating the same sample twice SHALL produce byte-identical PDFs, so tests can rely on fixed content and positions.

#### Scenario: Repeat generation
- **WHEN** the Academic Research Paper sample is generated twice
- **THEN** both outputs are byte-identical

### Requirement: No personal data in samples
Sample content SHALL be fictional and contain no real personal data.

#### Scenario: Invoice parties are fictional
- **WHEN** the Invoice sample is opened
- **THEN** company names, addresses and amounts are clearly fictional placeholders (for example "Example Co.")

### Requirement: Samples cover text extraction edge cases
Across the three samples the system SHALL also include: a page using a font embedded as a subset, a text run rotated relative to its page, a line of text drawn as several fragments with no space characters between them, a row whose cells sit on one baseline separated by wide gaps, and text drawn in a colour other than black.

#### Scenario: Embedded subset font present
- **WHEN** the Academic Research Paper sample is opened
- **THEN** at least one of its Text Lines uses a font the document embeds as a subset, rather than a standard font reference

#### Scenario: Rotated text run present
- **WHEN** the Technical Spec sample is opened
- **THEN** one of its pages carries a text run rotated relative to the page, which is reported as a locked object

#### Scenario: Fragmented line present
- **WHEN** the Academic Research Paper sample is opened
- **THEN** one of its lines is drawn as several fragments without space characters, and is reported as a single Text Line with its words separated by spaces

#### Scenario: Wide-gap row present
- **WHEN** the Invoice sample is opened
- **THEN** its item rows place each cell on one baseline with gaps far wider than the font size, and each cell is reported as a separate Text Line

#### Scenario: Coloured text present
- **WHEN** the Invoice sample is opened
- **THEN** at least one Text Line is drawn in a colour other than black
