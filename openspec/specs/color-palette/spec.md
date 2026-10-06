# color-palette Specification

## Purpose

Extracts the colors used in the document and surfaces them as one-click presets in the color picker, so users can match their edits to the document's existing palette.

## Requirements

### Requirement: Document palette extraction
The system SHALL extract the set of unique fill colors used by Text Lines on the active document (from operator-list data already collected during the read phase) and expose them as a palette (TY-10).

#### Scenario: Palette reflects document colors
- **WHEN** a document uses three distinct text colors (black, dark blue, red)
- **THEN** the extracted palette contains those three colors

#### Scenario: Near-duplicate colors are deduplicated
- **WHEN** two text lines use colors that differ by fewer than 5 on each RGB channel
- **THEN** the palette contains only one representative color for them

### Requirement: Palette presets in the color picker
The color picker in the Properties Panel SHALL show the document palette as a row of swatches. Clicking a swatch SHALL apply that color and create a `TEXT_STYLE_CHANGE` (TY-9, TY-10).

#### Scenario: Swatch applies the color
- **WHEN** the user clicks a palette swatch
- **THEN** a TEXT_STYLE_CHANGE is appended with the swatch color and the text updates immediately
