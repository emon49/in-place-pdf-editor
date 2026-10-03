# Spec Delta

## Purpose

Provides the History tab in the Sidebar, listing operations with timestamps and per-item revert buttons, and the "Revert to Original" action that restores an object to its pre-edit state.

## ADDED Requirements

### Requirement: History tab lists operations
The Sidebar SHALL include a History tab that lists every active Edit Operation in reverse chronological order. Each entry SHALL show the operation type, a human-readable summary, the affected object, and a timestamp.

#### Scenario: Operations appear in the history
- **WHEN** the user edits two lines and deletes a third
- **THEN** the History tab shows three entries, newest first, each with its type and summary

#### Scenario: Empty state
- **WHEN** no edits have been made
- **THEN** the History tab shows an empty state message

### Requirement: Per-item revert button
Each History entry SHALL have a revert button that appends a REVERT operation targeting that entry's operation. The reverted entry SHALL be visually marked as reverted.

#### Scenario: Reverting a single edit
- **WHEN** the user clicks the revert button on a TEXT_REPLACE entry
- **THEN** a REVERT is appended, the text returns to its pre-edit state, and the entry is marked as reverted

#### Scenario: Revert button on a REVERT
- **WHEN** the user clicks the revert button on a REVERT entry
- **THEN** another REVERT is appended that undoes the first revert, restoring the original edit

### Requirement: Revert to Original action
The system SHALL offer a "Revert to Original" action on a selected Page Object that has been edited. It SHALL append a single REVERT targeting all effective operations on that object, restoring it to its Original Document state.

#### Scenario: Full revert on multiply-edited object
- **WHEN** a Text Line has been edited twice and the user chooses "Revert to Original"
- **THEN** one REVERT is appended targeting both edits, and the line shows its original text

#### Scenario: Unedited object has no revert action
- **WHEN** a Text Line has never been edited
- **THEN** no "Revert to Original" action is available

### Requirement: History reflects undo/redo state
The History tab SHALL show only operations up to the current undo cursor. Operations past the cursor (undone) SHALL not appear in the list.

#### Scenario: Undo hides the operation
- **WHEN** the user undoes the last edit
- **THEN** that edit disappears from the History tab

#### Scenario: Redo restores the operation
- **WHEN** the user redoes the undone edit
- **THEN** the edit reappears in the History tab

### Requirement: Edit count badge
The system SHALL display an edit count badge showing the number of active operations (up to the cursor). The badge SHALL update on every edit, undo and redo.

#### Scenario: Badge shows count
- **WHEN** the user has made 3 edits
- **THEN** the badge shows "3 edits applied"

#### Scenario: Undo decrements the badge
- **WHEN** the user undoes one edit from a count of 3
- **THEN** the badge shows "2 edits applied"
