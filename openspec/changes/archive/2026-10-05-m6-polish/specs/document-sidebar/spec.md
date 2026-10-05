# Spec Delta

## ADDED Requirements

### Requirement: Thumbnails tab in the Sidebar
The Sidebar SHALL include a Thumbnails tab that displays scaled page previews for the open document, backed by the `page-thumbnails` capability. Selecting a thumbnail SHALL navigate to that page and highlight its thumbnail (P1).

#### Scenario: Thumbnails tab is available
- **WHEN** a document is open
- **THEN** the Sidebar includes a Thumbnails tab in addition to the Text Objects and History tabs

#### Scenario: Navigating via thumbnail updates the active tab indicator
- **WHEN** the user clicks a thumbnail in the Thumbnails tab
- **THEN** the page viewer shows the selected page and the thumbnail remains highlighted
