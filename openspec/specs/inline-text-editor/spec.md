# inline-text-editor Specification

## Purpose

Provides the inline textarea that opens over a Text Line for in-place editing, its commit/cancel lifecycle, and the add-text tool for placing new text on empty space.

## Requirements

### Requirement: Double-click opens the inline editor
Double-clicking an editable (not locked) Text Line SHALL open a textarea positioned over that line, pre-filled with the line's current text and styled to match its font, size and color. The textarea SHALL receive focus immediately.

#### Scenario: Opening the editor on existing text
- **WHEN** the user double-clicks a Text Line reading "Total: $500"
- **THEN** a textarea appears over that line containing "Total: $500", visually matching the line's appearance

#### Scenario: Locked lines do not open the editor
- **WHEN** the user double-clicks a locked Text Line
- **THEN** no editor opens and the line remains selected with its lock explanation visible

### Requirement: Commit and cancel controls
Pressing `Enter` SHALL commit the edit. Pressing `Shift+Enter` SHALL insert a newline without committing. Pressing `Esc` SHALL cancel the edit and discard changes. Clicking outside the editor SHALL commit.

#### Scenario: Enter commits
- **WHEN** the editor is open and the user changes text and presses Enter
- **THEN** the edit is committed and the editor closes

#### Scenario: Shift+Enter inserts a newline
- **WHEN** the editor is open and the user presses Shift+Enter
- **THEN** a newline is inserted in the text and the editor remains open

#### Scenario: Escape cancels
- **WHEN** the editor is open and the user presses Escape
- **THEN** the editor closes and the text reverts to what it was before editing

### Requirement: Textarea auto-expands
The textarea SHALL expand vertically as the user types to accommodate multi-line content. It SHALL not clip or truncate entered text.

#### Scenario: Growing with content
- **WHEN** the user types enough text to exceed the original line height
- **THEN** the textarea grows downward to show all content without scrolling

### Requirement: Add-text tool
An "Add text" tool SHALL let the user click an empty area of the page to place new text. Clicking SHALL open the inline editor at the clicked position. The new text SHALL use the style of the nearest Text Line above the click point, or Liberation Sans 12 pt black if none exists.

#### Scenario: Adding text on an empty area
- **WHEN** the user activates the add-text tool and clicks below the last line on a page
- **THEN** the inline editor opens at the clicked position with the style of the nearest line above

#### Scenario: Fallback style when no line is above
- **WHEN** the user activates the add-text tool and clicks above all existing text
- **THEN** the inline editor opens with Liberation Sans, 12 pt, black

#### Scenario: Committing added text
- **WHEN** the user types "New note" in the add-text editor and presses Enter
- **THEN** a TEXT_ADD operation is created with the entered text, position and style

### Requirement: Editor positioned in page coordinates
The inline editor SHALL be positioned using Page Space coordinates converted to Screen Space, so it remains aligned with the underlying text at every zoom level and on rotated pages.

#### Scenario: Zoom does not misalign the editor
- **WHEN** the user opens the editor at 150% zoom
- **THEN** the textarea aligns precisely with the Text Line it is editing
