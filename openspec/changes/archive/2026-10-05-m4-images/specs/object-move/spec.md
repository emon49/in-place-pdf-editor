# Spec Delta

## ADDED Requirements

### Requirement: Image Objects are movable
A selected Image Object SHALL show a Move badge and be draggable by its badge or selection border, following the same drag-initiation, Safe Area clamping and dual-location masking rules as Text Lines. Releasing the drag SHALL commit one `OBJECT_MOVE` (MV-1, MV-3, MV-4, MV-6).

#### Scenario: Dragging an image moves it
- **WHEN** the user drags a selected Image Object to a new position and releases
- **THEN** exactly one OBJECT_MOVE is appended with the new Page Space position

#### Scenario: Image drag respects Safe Area
- **WHEN** the user drags an image toward the page edge
- **THEN** the image stops before its bounding box crosses the 10 pt Safe Area boundary

### Requirement: Image position inputs in the Properties Panel
When an Image Object is selected, the Properties Panel SHALL show X and Y inputs (Display Coordinates, top-left origin) and W and H inputs (points). Committing a position value SHALL create an `OBJECT_MOVE`; committing a size value SHALL create an `OBJECT_RESIZE`. All inputs SHALL be clamped to the Safe Area (MV-5, MV-7).

#### Scenario: X input repositions an image
- **WHEN** the user enters a new X value for a selected image and presses Enter
- **THEN** an OBJECT_MOVE is appended with the correct Page Space position

#### Scenario: W input resizes an image
- **WHEN** the user enters a new width for a selected image and presses Enter
- **THEN** an OBJECT_RESIZE is appended with the new bounding box
