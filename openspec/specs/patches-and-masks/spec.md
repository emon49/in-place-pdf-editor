# patches-and-masks Specification

## Purpose

Renders Patches (the re-drawn appearance of edited, added or moved text at Position B) and Masks (sampled-color rectangles at Position A) in the viewer, using the Resolved Font and matching the original geometry.

## Requirements

### Requirement: Patches render edited text with the Resolved Font
When a Text Line has been edited, the system SHALL render a Patch at the line's position (or Position B if moved) using the Resolved Font at the original size, line height, spacing and color. The Patch SHALL appear in Layer 1, above the background canvas and below the selection overlay.

#### Scenario: Edited text appears in place
- **WHEN** the user changes "Invoice #100" to "Invoice #200"
- **THEN** a Patch shows "Invoice #200" in the Resolved Font at the same size and position

#### Scenario: Patch uses the correct font tier
- **WHEN** the Resolved Font is Carlito (tier 3)
- **THEN** the Patch renders in Carlito, not the original font

### Requirement: Masks cover original positions
When a Text Line has been edited, moved or deleted, the system SHALL render a Mask — a solid rectangle filled with the Sampled Background color — at Position A (the original position) in Layer 1, behind any Patch at Position B.

#### Scenario: Edited line is masked
- **WHEN** the user edits a Text Line
- **THEN** a Mask covers the original text so it does not show through

#### Scenario: Deleted line is masked
- **WHEN** the user deletes a Text Line
- **THEN** a Mask covers the deleted text's original area

### Requirement: Added text has no mask
An Added Text (TEXT_ADD) has no original position, so it SHALL have a Patch but no Mask.

#### Scenario: New text has no mask
- **WHEN** the user adds text via the add-text tool
- **THEN** a Patch appears at the placed position and no Mask is drawn

### Requirement: Patch geometry matches text layout
The Patch SHALL use the same geometry as the text layout module: font size, line height, character spacing, horizontal scaling and wrap positions. Multi-line patches (from overflow wrapping) SHALL stack lines downward at the original line height.

#### Scenario: Wrapped patch matches layout
- **WHEN** edited text wraps onto two lines
- **THEN** the Patch renders both lines at the wrap points computed by the text layout module

### Requirement: Mask color from sampling
The Mask fill color SHALL be the Sampled Background color for that line, as determined by the color detection system. Until sampling completes, the Mask SHALL use white as a provisional fill.

#### Scenario: Tinted background mask
- **WHEN** a Text Line sits on a light-blue table header
- **THEN** the Mask uses the sampled light-blue color, blending with the background

### Requirement: Patches and masks update with undo/redo
When undo or redo changes the active set of operations, Patches and Masks SHALL update to reflect the current preview state. Undoing an edit SHALL remove its Patch and Mask.

#### Scenario: Undo removes patch and mask
- **WHEN** the user edits a line and then undoes
- **THEN** the Patch and Mask disappear and the original text is visible again
