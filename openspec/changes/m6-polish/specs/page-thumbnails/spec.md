# Spec Delta

## Purpose

Shows scaled page previews in the Thumbnails sidebar tab so the user can see and navigate the document at a glance.

## ADDED Requirements

### Requirement: Thumbnail strip in the Sidebar
The Sidebar SHALL include a Thumbnails tab that shows a scaled preview of each page. The active page SHALL be visually highlighted. Clicking a thumbnail SHALL navigate to that page.

#### Scenario: Thumbnail list shows all pages
- **WHEN** a 5-page document is open and the user opens the Thumbnails tab
- **THEN** five thumbnails are displayed in order

#### Scenario: Active page is highlighted
- **WHEN** the user is on page 3
- **THEN** the third thumbnail is visually marked as active

#### Scenario: Clicking a thumbnail navigates
- **WHEN** the user clicks the fifth thumbnail
- **THEN** the viewer shows page 5

### Requirement: Thumbnails load lazily
Thumbnails SHALL be rendered lazily as they scroll into view in the Thumbnails tab, to avoid blocking the main thread or rendering all pages up front. Each thumbnail SHALL show a placeholder while rendering.

#### Scenario: Off-screen thumbnails show placeholders
- **WHEN** a 20-page document is open and only the first 5 thumbnails are visible
- **THEN** only those 5 are rendered; the others show placeholders

#### Scenario: Scrolling triggers render
- **WHEN** the user scrolls the Thumbnails tab to reveal thumbnails 6–10
- **THEN** those thumbnails begin rendering
