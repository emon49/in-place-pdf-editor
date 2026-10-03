# text-editing Specification

## Purpose

Creates TEXT_REPLACE, TEXT_ADD and OBJECT_DELETE operations from editor interactions, wraps overflowing text at the Wrap Margin, detects overlapping patches, and blocks commits when no font can draw a typed character.

## Requirements

### Requirement: Text replace creates an operation
Committing edited text that differs from the original SHALL create a TEXT_REPLACE operation. If the text is unchanged, no operation SHALL be created.

#### Scenario: Changed text produces an operation
- **WHEN** the user changes "Invoice #100" to "Invoice #200" and commits
- **THEN** a TEXT_REPLACE operation is appended with the new text

#### Scenario: Unchanged text produces no operation
- **WHEN** the user opens the editor, makes no changes, and commits
- **THEN** no operation is created and the Operation Log is unchanged

### Requirement: Text delete via keyboard
Pressing `Delete` or `Backspace` when a Text Line is selected (and the inline editor is not open) SHALL create an OBJECT_DELETE operation. The original position SHALL be masked.

#### Scenario: Deleting a selected line
- **WHEN** a Text Line is selected and the user presses Delete
- **THEN** an OBJECT_DELETE is created, the text disappears, and a Mask covers its original position

#### Scenario: Delete with editor open does not delete the line
- **WHEN** the inline editor is open and the user presses Delete
- **THEN** the Delete key acts as a normal text editing key inside the editor

### Requirement: Overflow wrapping at the Wrap Margin
Text wider than the original line SHALL extend rightward and wrap at the Wrap Margin (`pageWidth − 40 pt`). Extra lines SHALL stack downward at the original line height. Neighbouring text SHALL NOT reflow.

#### Scenario: Long replacement wraps
- **WHEN** the user replaces a short line with text wider than the Wrap Margin
- **THEN** the text wraps onto a second line below, at the original line height

#### Scenario: Neighbours are unaffected
- **WHEN** wrapped text extends downward past another Text Line
- **THEN** the other line does not move; it stays at its original position

### Requirement: Overlap detection
When a Patch (edited, added or wrapped text) intersects another Page Object's bounding box, the system SHALL show a hint that text overlaps other content.

#### Scenario: Overlap hint appears
- **WHEN** the user adds enough text that the Patch extends into another line's box
- **THEN** a visual hint warns that text overlaps other content

### Requirement: Drawability check blocks commit
When the user types a character that no font in the Font Resolution Chain can draw, the system SHALL block the commit and show an inline warning identifying the undrawable character.

#### Scenario: Undrawable character warning
- **WHEN** the user types a CJK character and no chain font covers it
- **THEN** the commit button is disabled and a warning identifies the character

#### Scenario: Removing the character re-enables commit
- **WHEN** the user removes the undrawable character
- **THEN** the warning disappears and commit is re-enabled

### Requirement: Text layout is shared
The text layout computation (line breaking at the Wrap Margin, position of each wrapped line) SHALL be performed once and reused by both the preview and the future export, so they render identically.

#### Scenario: Preview and export consistency
- **WHEN** text is edited to wrap across two lines
- **THEN** both the on-screen preview and any future export use the same wrap point and line positions
