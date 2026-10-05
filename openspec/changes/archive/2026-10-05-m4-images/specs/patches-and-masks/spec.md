# Spec Delta

## MODIFIED Requirements

### Requirement: Masks cover original positions
When a Text Line or Image Object has been edited, replaced, moved or deleted, the system SHALL render a Mask — a solid rectangle filled with the Sampled Background color — at Position A (the original position) in Layer 1, behind any Patch or replacement image at Position B.

#### Scenario: Edited line is masked
- **WHEN** the user edits a Text Line
- **THEN** a Mask covers the original text so it does not show through

#### Scenario: Deleted line is masked
- **WHEN** the user deletes a Text Line
- **THEN** a Mask covers the deleted text's original area

#### Scenario: Replaced image is masked
- **WHEN** the user replaces an Image Object
- **THEN** a Mask covers the original image's bounding box before the new image is drawn

#### Scenario: Deleted image is masked
- **WHEN** the user deletes an Image Object
- **THEN** a Mask covers the deleted image's original area
