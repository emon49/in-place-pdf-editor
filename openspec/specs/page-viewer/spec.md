# page-viewer Specification

## Purpose

Renders the active page of the open document crisply and lets the user move between pages and change magnification.

## Requirements

### Requirement: Crisp high-DPI rendering
The system SHALL render the active page so that one canvas pixel corresponds to one physical device pixel (canvas backing size = CSS size × `devicePixelRatio`), and re-render when zoom or `devicePixelRatio` changes (VW-1).

#### Scenario: Retina display
- **WHEN** a US Letter page (612×792 pt) is shown at 100% zoom on a display with `devicePixelRatio` 2
- **THEN** the page occupies 612×792 CSS pixels and its canvas backing store is 1224×1584 pixels

#### Scenario: Moving to a different display
- **WHEN** the window moves to a display with a different `devicePixelRatio`
- **THEN** the page is re-rendered at the new ratio

### Requirement: Canvas size limit
The system SHALL keep any page canvas at or below 16,777,216 backing pixels. If crisp rendering would exceed that, it SHALL render at the largest resolution within the limit while keeping the same CSS size.

#### Scenario: High zoom on high-DPI display
- **WHEN** a US Letter page is shown at 400% with `devicePixelRatio` 2 (which would need 4896×6336 pixels)
- **THEN** the page still occupies 2448×3168 CSS pixels and its canvas backing store has no more than 16,777,216 pixels

### Requirement: Responsive rendering
Rendering SHALL NOT block user input. When the page or zoom changes before a render finishes, the stale render SHALL be cancelled and only the latest state displayed.

#### Scenario: Rapid page changes
- **WHEN** the user presses "next page" five times quickly
- **THEN** the viewer ends on the fifth page after the starting one and never shows an earlier page after the latest one

### Requirement: First page performance
For a 10-page, 5 MB PDF on a mid-range laptop, the first page SHALL be visible within 2 seconds of the file being selected.

#### Scenario: Benchmark document
- **WHEN** the reference 10-page, 5 MB test PDF is opened
- **THEN** page 1 is rendered within 2 seconds

### Requirement: Page navigation
The system SHALL show the current page and total (`< n / N >`) with previous/next buttons, a page-number input, and keyboard shortcuts PageDown/PageUp (next/previous) and Home/End (first/last) when focus is not in a text input. Navigation SHALL stop at the first and last pages.

#### Scenario: Next page
- **WHEN** page 1 of 8 is shown and the user clicks "next page"
- **THEN** page 2 is shown and the indicator reads `2 / 8`

#### Scenario: Boundaries
- **WHEN** page 8 of 8 is shown
- **THEN** the "next page" button is disabled and PageDown does nothing

#### Scenario: Jump to page
- **WHEN** the user types `5` in the page input and presses Enter
- **THEN** page 5 is shown

#### Scenario: Invalid page number
- **WHEN** the user types `12` in the page input of an 8-page document and presses Enter
- **THEN** the input reverts to the current page number and the page does not change

### Requirement: Zoom range and presets
The system SHALL support zoom from 25% to 400% inclusive. It SHALL provide `−` and `+` buttons that step through the presets 25, 50, 75, 100, 125, 150, 200, 300 and 400%, a "100%" button, and Ctrl/Cmd + `=` / `-` / `0` shortcuts while the viewer has focus.

#### Scenario: Zoom in
- **WHEN** zoom is 100% and the user clicks `+`
- **THEN** zoom becomes 125%

#### Scenario: Zoom from a non-preset value
- **WHEN** zoom is 110% (from fit-to-width) and the user clicks `+`
- **THEN** zoom becomes 125%, the next preset above

#### Scenario: Upper bound
- **WHEN** zoom is 400%
- **THEN** the `+` button is disabled and Ctrl/Cmd + `=` does nothing

### Requirement: Fit modes
The system SHALL provide fit-to-width and fit-to-page. A selected fit mode SHALL stay active, recomputing zoom when the viewer is resized or the page changes, until the user picks an explicit zoom. Computed zoom SHALL be clamped to 25%–400%.

#### Scenario: Fit to width follows resize
- **WHEN** fit-to-width is active and the viewer becomes narrower
- **THEN** the zoom decreases so the displayed page width still matches the viewer width (minus padding)

#### Scenario: Fit to page on a rotated page
- **WHEN** fit-to-page is active and the user navigates from a portrait page to a page with `/Rotate 90`
- **THEN** zoom is recomputed so the whole landscape page fits in the viewer

#### Scenario: Explicit zoom leaves fit mode
- **WHEN** fit-to-width is active and the user clicks `+`
- **THEN** fit-to-width is no longer active and zoom becomes the next preset

### Requirement: Accessible controls
All viewer controls SHALL be keyboard-operable with visible focus, and icon-only buttons SHALL have accessible labels (e.g. "Next page", "Zoom in").

#### Scenario: Keyboard-only navigation
- **WHEN** a keyboard user tabs through the header
- **THEN** each control receives visible focus and is announced with its label
