# Spec Delta

## Purpose

Lets the user reposition a selected Text Line by dragging, typing coordinates, or nudging with arrow keys, always keeping the object inside the Safe Area and recording the result as one OBJECT_MOVE operation.

## ADDED Requirements

### Requirement: Move badge and drag initiation
A selected editable Text Line SHALL display a Move badge. The user MAY drag the object by the badge or any part of its selection border. The cursor SHALL change to `grab` while hovering over a draggable surface and `grabbing` during an active drag (MV-1, MV-2).

#### Scenario: Move badge is visible on selection
- **WHEN** the user selects an editable Text Line
- **THEN** a Move badge is visible on the selection border

#### Scenario: Cursor changes during drag
- **WHEN** the user presses and holds the mouse button over the selected object's border
- **THEN** the cursor changes to `grabbing` and the object moves with the pointer

### Requirement: Drag commits one OBJECT_MOVE
Releasing the drag SHALL commit one `OBJECT_MOVE` operation containing the objectId, the start position (from), and the end position (to) in Page Space. Intermediate pointer positions during the drag SHALL NOT produce operations (MV-6).

#### Scenario: Single operation per drag
- **WHEN** the user drags a Text Line from one position to another and releases
- **THEN** exactly one OBJECT_MOVE is appended to the Operation Log

#### Scenario: Drag is undoable in one step
- **WHEN** the user drags a Text Line and presses Ctrl+Z
- **THEN** the object returns to where it was before the drag

### Requirement: Safe Area clamping
Throughout dragging and on numeric-input commit, the object's entire bounding box SHALL remain inside the Safe Area: 10 pt inset from every edge of the page (MV-4).

#### Scenario: Drag is blocked at the page edge
- **WHEN** the user drags a Text Line toward the right edge of the page
- **THEN** the object stops before its bounding box crosses the 10 pt Safe Area boundary

#### Scenario: Numeric input is clamped
- **WHEN** the user types an X value that would place the object outside the Safe Area
- **THEN** the stored position is clamped to the nearest in-bounds value

### Requirement: Dual-location masking on move
When an object is at Position B (moved), the system SHALL render a Mask at Position A (the original position) and the Patch at Position B — the same dual-location masking as for edits and deletes (MV-3, ADR-0004).

#### Scenario: Original position is masked after move
- **WHEN** the user moves a Text Line to a new position
- **THEN** a Mask appears at the original position and the text is visible only at the new position

#### Scenario: Undo removes mask and restores position
- **WHEN** the user moves a Text Line and then undoes
- **THEN** the Mask at Position A disappears and the object returns to Position A

### Requirement: Arrow-key nudging
When a Text Line is selected and the inline editor is closed, pressing an arrow key SHALL move the object 1 pt in that direction; holding Shift SHALL move 10 pt. Rapid key-repeat events SHALL be coalesced: the system SHALL commit a single `OBJECT_MOVE` when the key is released (MV-9).

#### Scenario: Single nudge step
- **WHEN** the user presses the right arrow key once while a Text Line is selected
- **THEN** the object moves 1 pt to the right

#### Scenario: Shift multiplies step
- **WHEN** the user presses Shift+Up while a Text Line is selected
- **THEN** the object moves 10 pt upward

#### Scenario: Key-repeat burst produces one operation
- **WHEN** the user holds the right arrow key for several repeat events and then releases
- **THEN** exactly one OBJECT_MOVE is appended covering the total displacement
