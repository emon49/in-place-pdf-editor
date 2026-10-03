# object-selection Specification

## Purpose

Lets the user point at a single object on the page — showing what is editable, what is selected, and what cannot be edited and why.

## Requirements

### Requirement: Clickable boxes over every Text Line
The system SHALL draw a box over every Text Line of the active page, above the rendered page and below any editor surface. Clicking a box SHALL select that Text Line.

#### Scenario: Clicking text selects it
- **WHEN** the user clicks the heading of the active page
- **THEN** that heading's Text Line becomes the selected object

#### Scenario: Clicking empty space clears the selection
- **WHEN** a Text Line is selected and the user clicks an empty part of the page
- **THEN** nothing is selected

### Requirement: Boxes stay aligned with the page
Boxes SHALL align with the glyphs they cover at every supported zoom level, on rotated pages and on pages whose CropBox is offset, using the same geometry as the rendered page.

#### Scenario: Zoom keeps boxes aligned
- **WHEN** the user zooms from 100% to 250%
- **THEN** each box still covers its line, and its size on screen scales with the page

#### Scenario: Rotated page keeps boxes aligned
- **WHEN** the active page has `/Rotate 90`
- **THEN** boxes appear over the text in its displayed landscape orientation

### Requirement: Hover and selection states
A box SHALL show a hover state when the pointer is over it, and the selected object SHALL show a persistent selection ring with corner indicators, distinct from the hover state.

#### Scenario: Hover feedback
- **WHEN** the pointer moves over a Text Line
- **THEN** that line's box shows a hover state and the pointer indicates it can be acted on

#### Scenario: Only one object is selected
- **WHEN** a Text Line is selected and the user clicks a different Text Line
- **THEN** the first stops showing the selection ring and the second shows it

### Requirement: Locked objects explain themselves
A locked Text Line SHALL be visibly distinct from an editable one, SHALL still be selectable, and SHALL show an explanation of why it cannot be edited.

#### Scenario: Rotated watermark
- **WHEN** the user hovers a Text Line locked because it is rotated
- **THEN** an explanation says rotated or skewed text cannot be edited in this version

#### Scenario: Locked objects can still be inspected
- **WHEN** the user clicks a locked Text Line
- **THEN** it becomes the selected object and is marked as locked

### Requirement: Keyboard selection
The user SHALL be able to select objects from the keyboard: moving to the next or previous object in reading order, and clearing the selection, without using a pointer. The selected object SHALL be scrolled into view when selected this way.

#### Scenario: Stepping through objects
- **WHEN** the page viewer has focus and the user presses Tab or the next-object key
- **THEN** the first Text Line in reading order is selected, and pressing it again selects the second

#### Scenario: Escape clears the selection
- **WHEN** an object is selected and the user presses Escape
- **THEN** nothing is selected

#### Scenario: Selection off screen is revealed
- **WHEN** keyboard selection moves to an object outside the visible area
- **THEN** the viewer scrolls so that object is visible

### Requirement: Selection is announced
The selected object SHALL be exposed to assistive technology with its text content and, when locked, the reason it cannot be edited.

#### Scenario: Screen reader announcement
- **WHEN** a Text Line reading "Total amount due" is selected
- **THEN** assistive technology announces the selected object including that text

### Requirement: Selection resets with the page and document
Changing page or opening another document SHALL clear the selection, so the selected object always belongs to what is on screen.

#### Scenario: Page change clears selection
- **WHEN** an object on page 1 is selected and the user goes to page 2
- **THEN** nothing is selected

### Requirement: Mask warning on the selected object
When the selected Text Line's background is non-uniform, the system SHALL warn that hiding or moving it may leave a visible mark.

#### Scenario: Text over an image
- **WHEN** the user selects a Text Line drawn over a photograph
- **THEN** a warning says a mask behind it may be visible
