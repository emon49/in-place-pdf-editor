# Spec Delta

## ADDED Requirements

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
