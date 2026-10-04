# properties-panel Specification

## Purpose

Right-side panel that shows position and style information for the selected object, lets the user apply overrides, and surfaces Resolved Font details and warnings.

## Requirements

### Requirement: Panel is visible when an object is selected
When a document is open and an object is selected, the Properties Panel SHALL be visible beside the page viewer. When nothing is selected, the panel SHALL show a placeholder or be collapsed (MV-5, TY-9).

#### Scenario: Panel opens on selection
- **WHEN** the user selects a Text Line
- **THEN** the Properties Panel shows controls populated with that line's current values

#### Scenario: Panel is empty without selection
- **WHEN** no object is selected
- **THEN** the Properties Panel shows no object-specific controls

### Requirement: Numeric position inputs
The Properties Panel SHALL show X and Y inputs in Display Coordinates (points, top-left origin). Committing a value (blur or Enter) SHALL create an `OBJECT_MOVE` operation with the new position converted to Page Space. Values SHALL be clamped to the Safe Area before storage (MV-5).

#### Scenario: X input moves the object
- **WHEN** the user changes the X input to 72 and presses Enter
- **THEN** an OBJECT_MOVE is appended and the object renders at the new horizontal position

#### Scenario: Y input is in top-left Display Coordinates
- **WHEN** the selected object is at the top of the page
- **THEN** its Y input reads a small positive number (near 0), not a large one

### Requirement: Style override controls
The Properties Panel SHALL expose font-family selector (Original, matched family, Font Catalog families, Liberation), size stepper/input, bold/italic toggles, and color picker. Committing any change SHALL create a `TEXT_STYLE_CHANGE` operation (TY-9).

#### Scenario: Color picker change creates operation
- **WHEN** the user opens the color picker and selects a new color
- **THEN** a TEXT_STYLE_CHANGE is appended with the new color value

#### Scenario: Size change creates operation
- **WHEN** the user steps the size input from 12 to 14 and blurs
- **THEN** a TEXT_STYLE_CHANGE is appended with size 14

#### Scenario: Bold toggle creates operation
- **WHEN** the user clicks the Bold toggle for a non-bold line
- **THEN** a TEXT_STYLE_CHANGE is appended with bold set to true

### Requirement: Resolved Font display
The Properties Panel SHALL show the Original Font name, the Resolved Font name, and the resolution tier. When the Resolved Font is not the original, the panel SHALL explain why (TY-12).

#### Scenario: Original font used
- **WHEN** the selected line uses its own embedded font
- **THEN** the panel shows "Original font" with no warning

#### Scenario: Fallback font explained
- **WHEN** the Resolved Font is Carlito because the original lacks a typed character
- **THEN** the panel shows "Carlito (substitute)" and the reason "Original font lacks '<char>'"

### Requirement: Warnings area
The Properties Panel SHALL surface warnings relevant to the selected object: mask-may-be-visible (non-uniform background), text-overlaps-other-content (Patch intersects another object's box), and character-not-drawable (blocked commit) (VW-9, TE-6, TE-9).

#### Scenario: Non-uniform background warning
- **WHEN** the selected Text Line sits over an image or gradient
- **THEN** the warnings area shows a mask-visibility warning

#### Scenario: No warnings by default
- **WHEN** a Text Line on a plain white background is selected with no overlap
- **THEN** the warnings area is empty
