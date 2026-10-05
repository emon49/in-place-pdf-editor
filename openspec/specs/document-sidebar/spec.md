# document-sidebar Specification

## Purpose

Gives the editor a panel beside the page for inspecting what a document contains, starting with a list of the text found on the active page.

## Requirements

### Requirement: Collapsible sidebar beside the page
The system SHALL show an inspector panel beside the rendered page whenever a document is open, and SHALL let the user collapse and reopen it. The page viewer SHALL keep working at the resulting width, including its fit modes.

#### Scenario: Collapsing gives the page more room
- **WHEN** the user collapses the sidebar while fit-to-width is active
- **THEN** the sidebar is hidden and the page grows to the wider viewer

#### Scenario: Reopening restores the panel
- **WHEN** the user reopens the sidebar
- **THEN** the panel returns with the same tab selected as before

#### Scenario: No document
- **WHEN** no document is open
- **THEN** no sidebar is shown

### Requirement: Tabbed inspector
The sidebar SHALL present its contents as tabs following the standard tab interaction: one tab is selected at a time, tabs are reachable and operable by keyboard, and the selected tab is exposed to assistive technology. Only tabs whose content exists SHALL be shown.

#### Scenario: Keyboard operation
- **WHEN** focus is on the tab list and the user presses the arrow keys
- **THEN** the selection moves between the available tabs

#### Scenario: Unimplemented tabs are absent
- **WHEN** the sidebar is shown in a version with only the Text Objects tab
- **THEN** no other tab is offered

### Requirement: Text Objects tab lists the page's text
The Text Objects tab SHALL list the Text Lines of the active page in reading order, each row showing the line's text, its font family and size, and a swatch of its colour. Locked lines SHALL be marked as locked.

#### Scenario: List reflects the page
- **WHEN** the active page contains eight Text Lines
- **THEN** the tab lists eight rows in reading order

#### Scenario: Row content
- **WHEN** a row shows a line reading "INVOICE" drawn in 20 pt bold Helvetica in near-black
- **THEN** the row shows that text, its family and size, and a swatch of its colour

#### Scenario: Locked row
- **WHEN** a Text Line is locked because it is rotated
- **THEN** its row is marked as locked

#### Scenario: Page with no text
- **WHEN** the active page contains no text
- **THEN** the tab says no text was found on this page

### Requirement: List and page share one selection
Selecting a row SHALL select that object on the page, and selecting an object on the page SHALL highlight its row and scroll it into view.

#### Scenario: Selecting from the list
- **WHEN** the user clicks a row in the Text Objects tab
- **THEN** that Text Line becomes the selected object and its box shows the selection ring

#### Scenario: Selecting on the page
- **WHEN** the user selects a Text Line far down a long page
- **THEN** its row is highlighted in the list and scrolled into view

### Requirement: List follows the active page
The Text Objects tab SHALL always show the active page's text, updating when the user changes page, and SHALL indicate while that page's text is still being detected.

#### Scenario: Changing page
- **WHEN** the user moves from page 1 to page 2
- **THEN** the tab lists page 2's Text Lines

#### Scenario: Detection in progress
- **WHEN** the active page's text has not finished being detected
- **THEN** the tab indicates that detection is in progress rather than showing an empty list

### Requirement: Thumbnails tab in the Sidebar
The Sidebar SHALL include a Thumbnails tab that displays scaled page previews for the open document, backed by the `page-thumbnails` capability. Selecting a thumbnail SHALL navigate to that page and highlight its thumbnail (P1).

#### Scenario: Thumbnails tab is available
- **WHEN** a document is open
- **THEN** the Sidebar includes a Thumbnails tab in addition to the Text Objects and History tabs

#### Scenario: Navigating via thumbnail updates the active tab indicator
- **WHEN** the user clicks a thumbnail in the Thumbnails tab
- **THEN** the page viewer shows the selected page and the thumbnail remains highlighted
