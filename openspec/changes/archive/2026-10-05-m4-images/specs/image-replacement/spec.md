# Spec Delta

## Purpose

Lets users replace, resize and delete Image Objects, recording each action as an immutable operation and masking the original area so the old content does not show through.

## ADDED Requirements

### Requirement: Replace image via upload or drop
The user SHALL be able to replace a selected Image Object by uploading a file (JPEG, PNG, WebP) or dropping one onto the image. WebP SHALL be re-encoded to PNG before storage. Committing SHALL create one `IMAGE_REPLACE` operation (IM-2, IM-6).

#### Scenario: File upload replaces the image
- **WHEN** the user selects an Image Object and uploads a JPEG file
- **THEN** an IMAGE_REPLACE is appended and the new image appears in place

#### Scenario: WebP is accepted and converted
- **WHEN** the user uploads a WebP file
- **THEN** the file is stored as PNG and an IMAGE_REPLACE is appended without error

### Requirement: Fit modes for image replacement
The system SHALL support three fit modes relative to the original bounding box: `contain` (scale to fit, preserving aspect ratio, default), `cover` (scale to fill, cropping if needed), and `fill` (stretch to exact box). The selected fit mode SHALL be stored in the `IMAGE_REPLACE` payload (IM-3).

#### Scenario: Contain mode preserves aspect ratio
- **WHEN** a tall image replaces a wide original with fit mode contain
- **THEN** the new image is letterboxed inside the original bounding box, not stretched

#### Scenario: Fill mode stretches to fit
- **WHEN** a square image replaces a wide original with fit mode fill
- **THEN** the new image is stretched to exactly fill the original bounding box

### Requirement: Original image area is masked
Before the replacement is drawn, the system SHALL render a Mask over the original bounding box using the Sampled Background color, so the original image never shows through letterboxing (IM-4).

#### Scenario: Mask hides original during contain
- **WHEN** a replacement image in contain mode leaves letterbox margins
- **THEN** the letterbox area shows the sampled background color, not the original image

### Requirement: Resize via corner handles
The user SHALL be able to resize a selected Image Object by dragging any of its four corner handles. Holding Shift SHALL keep the aspect ratio. Releasing SHALL commit one `OBJECT_RESIZE` operation with the original and new bounding boxes. The result SHALL be clamped to the Safe Area (MV-7).

#### Scenario: Corner drag resizes the image
- **WHEN** the user drags the bottom-right corner handle of a selected image
- **THEN** the image resizes and an OBJECT_RESIZE is appended on release

#### Scenario: Shift keeps aspect ratio
- **WHEN** the user drags a corner with Shift held
- **THEN** the width and height scale proportionally

#### Scenario: Resize is clamped to Safe Area
- **WHEN** the user drags a corner past the Safe Area boundary
- **THEN** the resize stops at the Safe Area edge

### Requirement: Delete selected image
Pressing `Delete` or `Backspace` when an Image Object is selected and the inline editor is not open SHALL create an `OBJECT_DELETE` operation. The original image area SHALL be masked (MV-8).

#### Scenario: Delete key removes the image
- **WHEN** an Image Object is selected and the user presses Delete
- **THEN** an OBJECT_DELETE is appended, the image disappears, and a Mask covers its original area

#### Scenario: Undo restores the image
- **WHEN** an image is deleted and the user presses Ctrl+Z
- **THEN** the OBJECT_DELETE is undone and the image reappears
