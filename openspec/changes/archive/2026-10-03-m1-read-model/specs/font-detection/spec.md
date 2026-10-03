# Spec Delta

## Purpose

Identifies the font each Text Line is drawn with, and establishes whether that font can later be reused for edited text — its embedding, licence, encoding and character coverage.

## ADDED Requirements

### Requirement: Font size from the vertical matrix scale
Font size SHALL be derived from the vertical scale of the text matrix (`√(c² + d²)`, or `|d|` when the matrix is unskewed), never from the horizontal scale, so that horizontally compressed text reports its true size.

#### Scenario: Compressed text reports its true size
- **WHEN** a line is drawn with a text matrix whose horizontal scale is 6 and whose vertical scale is 12
- **THEN** its font size is 12 pt, not 6 pt

#### Scenario: Plain text
- **WHEN** a line is drawn with the matrix [11, 0, 0, 11, 72, 670]
- **THEN** its font size is 11 pt

### Requirement: Normalized font family
The system SHALL report a normalized family name for each Text Line: subset prefixes, PostScript suffixes and style suffixes removed.

#### Scenario: Classic subset prefix
- **WHEN** a Text Line uses the font named "BWODTG+Times-Bold"
- **THEN** its family is reported as "Times" and its subset prefix as "BWODTG"

#### Scenario: PostScript suffix
- **WHEN** a Text Line uses the font named "TimesNewRomanPSMT"
- **THEN** its family is reported as "Times New Roman"

#### Scenario: Numeric subset suffix
- **WHEN** a Text Line uses the font named "LiberationSans-Bold-2000"
- **THEN** its family is reported as "Liberation Sans"

### Requirement: Font class, weight and style
Each Text Line SHALL report a Font Class of `sans`, `serif` or `mono`, plus whether it is bold and whether it is italic. These SHALL be derived from the font's descriptor flags, italic angle and weight where the document provides them, and from the font name otherwise.

#### Scenario: Serif flag from the descriptor
- **WHEN** a Text Line's font descriptor sets the serif flag and an italic angle of −12
- **THEN** its class is `serif` and it is reported as italic

#### Scenario: Weight from the name when the descriptor is silent
- **WHEN** a Text Line uses "Helvetica-Bold" and its font dictionary carries no descriptor
- **THEN** it is reported as bold with class `sans`

#### Scenario: Monospaced font
- **WHEN** a Text Line uses a font whose descriptor sets the fixed-pitch flag
- **THEN** its class is `mono`

### Requirement: Spacing and scaling metrics
Each Text Line SHALL report the horizontal scaling, character spacing, word spacing, text rise and rendering mode it was drawn with, and a line height derived from the font's ascent and descent, so that preview and export can reproduce its appearance.

#### Scenario: Letter-spaced heading
- **WHEN** a heading is drawn with a character spacing of 1.5 pt and horizontal scaling of 90%
- **THEN** the Text Line reports a character spacing of 1.5 pt and a horizontal scaling of 90%

#### Scenario: Defaults when the document sets nothing
- **WHEN** a line is drawn without setting spacing, scaling, rise or rendering mode
- **THEN** the Text Line reports character spacing 0, word spacing 0, horizontal scaling 100%, rise 0 and the fill rendering mode

### Requirement: Embedding is read from the document, not the renderer
Whether a font is embedded SHALL be determined from the document's own font dictionary. A font the renderer substitutes locally SHALL NOT be reported as embedded.

#### Scenario: Non-embedded standard font
- **WHEN** a Text Line uses Helvetica with no font program in the document, and the renderer draws it with a locally supplied substitute
- **THEN** the Text Line reports that the font is not embedded, and that it is a standard font reference

#### Scenario: Embedded subset
- **WHEN** a Text Line uses a font whose descriptor carries an embedded TrueType program
- **THEN** the Text Line reports that the font is embedded, with the program's type and size

### Requirement: Licence flag of embedded fonts
For an embedded font program, the system SHALL report the font's `fsType` embedding permission, and whether that permission allows editable embedding. A font program without that information SHALL be reported as permitting editing.

#### Scenario: Installable font
- **WHEN** an embedded font program declares `fsType` 0
- **THEN** editing is reported as permitted

#### Scenario: Preview and print only
- **WHEN** an embedded font program declares the preview-and-print restriction
- **THEN** editing is reported as not permitted, with the restriction named

### Requirement: Encoding and character coverage
Each Text Line SHALL report how its font encodes characters — simple with a named encoding, or composite with a CID encoding — and the set of characters that font can draw, derived from the document's character mapping and the embedded program.

#### Scenario: Simple font with a named encoding
- **WHEN** a Text Line uses a Type 1 font with WinAnsi encoding
- **THEN** it reports a simple encoding named "WinAnsiEncoding"

#### Scenario: Composite font
- **WHEN** a Text Line uses a Type 0 font with Identity-H encoding and a CID descendant
- **THEN** it reports a composite encoding named "Identity-H"

#### Scenario: Subset coverage
- **WHEN** a Text Line uses a subset font whose program contains only the glyphs for the characters used in the document
- **THEN** the reported coverage contains those characters and does not contain characters the subset omits

### Requirement: Unreadable font facts degrade safely
When a font program cannot be parsed or its facts cannot be determined, the system SHALL still report the Text Line with the family, class, style and size it could determine, and mark the missing facts as unknown rather than guessing.

#### Scenario: Damaged embedded program
- **WHEN** a Text Line's embedded font program cannot be parsed
- **THEN** the Text Line is still reported with its family, size and style, and its coverage and licence flag are marked unknown
