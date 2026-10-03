# Spec Delta

## Purpose

Autosaves the editing session — Original Document bytes, Operation Log and cursor — to IndexedDB, offers a restore prompt on reload, and provides a discard control for clearing local data.

## ADDED Requirements

### Requirement: Autosave to IndexedDB
The system SHALL autosave the Session (Original Document bytes, Operation Log and undo cursor) to IndexedDB after each operation, debounced to avoid excessive writes. One session SHALL be kept at a time.

#### Scenario: Edit triggers autosave
- **WHEN** the user edits text
- **THEN** the session is saved to IndexedDB after a short debounce

#### Scenario: Rapid edits coalesce
- **WHEN** the user makes five edits in quick succession
- **THEN** fewer than five IndexedDB writes occur due to debouncing

### Requirement: Restore prompt on reload
When a saved session exists on page load, the system SHALL offer "Restore previous session?" with Restore and Discard options. Restoring SHALL reload the Original Document and replay the Operation Log to the saved cursor.

#### Scenario: Session restored
- **WHEN** the user reloads and a session exists and chooses Restore
- **THEN** the document opens with all previous edits applied at the saved cursor position

#### Scenario: Session discarded on reload
- **WHEN** the user reloads and chooses Discard
- **THEN** the session data is deleted and the app starts fresh

### Requirement: Discard session control
A visible "Discard session" control SHALL clear all local session data from IndexedDB. The UI SHALL note that edits are stored in this browser on this device.

#### Scenario: Explicit discard
- **WHEN** the user clicks "Discard session"
- **THEN** all session data is removed from IndexedDB and the app resets

### Requirement: Quota error handling
If an IndexedDB write fails (e.g. quota exceeded), the system SHALL warn the user and continue without autosave rather than crashing or losing the in-memory state.

#### Scenario: Quota exceeded warning
- **WHEN** IndexedDB rejects a write due to quota
- **THEN** a warning appears and the user can continue editing, though autosave is disabled

### Requirement: Session indicator
The UI SHALL show a session indicator (e.g. "Saved on this device") when a session is actively being autosaved, so the user knows their edits are persisted locally.

#### Scenario: Indicator visible after first save
- **WHEN** the first autosave completes
- **THEN** a session indicator appears in the UI
