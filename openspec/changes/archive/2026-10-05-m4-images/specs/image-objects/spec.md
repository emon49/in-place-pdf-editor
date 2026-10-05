# Spec Delta

## Purpose

Detects Image Objects in the document, provides an interactive Layer 3 overlay with selection borders and handles, and lists image status in the Images sidebar tab.

## ADDED Requirements

### Requirement: Image detection from operator lists
The system SHALL scan PDF.js operator lists for `paintImageXObject` and `paintInlineImageXObject` operators to identify Image Objects, computing each image's bounding box and position in Page Space (IM-1).

#### Scenario: Images detected on load
- **WHEN** a page with two embedded images is opened
- **THEN** the system identifies two Image Objects with correct bounding boxes

#### Scenario: No false positives on text-only pages
- **WHEN** a page contains only text
- **THEN** no Image Objects are detected

### Requirement: Layer 3 interactive overlay
The system SHALL render a Layer 3 overlay above Layer 2 (text selection) and below Layer 4 (inline editor). The overlay SHALL show selection borders, move/resize corner handles and a replacement control on each Image Object. Handles SHALL scale with the current zoom (VW-5).

#### Scenario: Handles visible on selection
- **WHEN** the user selects an Image Object
- **THEN** selection borders and corner resize handles are visible around the image

#### Scenario: Handles scale with zoom
- **WHEN** the user zooms from 100% to 200%
- **THEN** the handles remain visually aligned with the image corners

### Requirement: Image Objects are selectable
Clicking an Image Object's Layer 3 surface SHALL select that image, replacing any existing selection. Clicking empty space SHALL clear the selection (ST-8).

#### Scenario: Click selects an image
- **WHEN** the user clicks an embedded image
- **THEN** that Image Object becomes the selected object and shows its selection ring

#### Scenario: Selecting an image clears text selection
- **WHEN** a Text Line is selected and the user clicks an image
- **THEN** the text selection clears and the image becomes selected

### Requirement: Images tab in the Sidebar
The Sidebar SHALL include an Images tab that lists every Image Object on the active page with its status: original, replaced, moved or deleted. The list SHALL update when operations are undone or redone.

#### Scenario: Images tab lists page images
- **WHEN** the active page has three images
- **THEN** the Images tab shows three rows, each with the image's status

#### Scenario: Status reflects operations
- **WHEN** the user replaces one image and deletes another
- **THEN** the Images tab shows one row as "replaced" and one as "deleted"
