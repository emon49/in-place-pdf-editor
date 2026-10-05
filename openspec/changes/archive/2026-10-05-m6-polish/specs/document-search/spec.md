# Spec Delta

## Purpose

Lets the user find text in the document in real time and step through highlighted matches page by page.

## ADDED Requirements

### Requirement: Real-time search with highlighted matches
The system SHALL highlight all Text Lines matching the search query in real time as the user types. Matching SHALL be case-insensitive substring search. Matches SHALL be visible as colored overlays on the page (VW-4).

#### Scenario: Matches appear while typing
- **WHEN** the user types "invoice" in the search bar
- **THEN** all Text Lines containing "invoice" (case-insensitive) are highlighted on the active page

#### Scenario: Empty query clears highlights
- **WHEN** the user clears the search input
- **THEN** all match highlights are removed

### Requirement: Next and previous match navigation
The system SHALL provide Next and Previous controls that move through matches in document order (page by page, then reading order within a page). Navigating to a match on a different page SHALL switch to that page (VW-4).

#### Scenario: Next steps through matches
- **WHEN** a query matches three Text Lines and the user presses Next twice
- **THEN** the second and third matches are focused in order

#### Scenario: Navigation wraps around
- **WHEN** the last match is focused and the user presses Next
- **THEN** focus returns to the first match

#### Scenario: Cross-page navigation
- **WHEN** the next match is on a different page
- **THEN** the viewer switches to that page and the match is highlighted
