# operation-log Specification

## Purpose

Maintains the append-only log of Edit Operations, derives the preview state through a pure reducer, and provides cursor-based undo/redo and the REVERT mechanic for history reversal.

## Requirements

### Requirement: Append-only Operation Log
The system SHALL maintain an ordered, append-only Operation Log of Edit Operations. Each operation SHALL be immutable and contain a unique id, a timestamp, a page index and a type-specific payload. The log SHALL never delete or mutate existing entries.

#### Scenario: Operations accumulate
- **WHEN** the user edits text, then deletes another line, then adds text
- **THEN** the Operation Log contains three operations in order, each with a distinct id and timestamp

#### Scenario: Log is serialisable
- **WHEN** the Operation Log is serialised to JSON
- **THEN** it round-trips without data loss, including all operation payloads

### Requirement: Pure reducer derives preview state
The system SHALL derive the Preview Document by applying a pure function over the Operation Log (up to the cursor) and the immutable Original Document. The preview state SHALL never be stored; it SHALL always be recomputed from the log.

#### Scenario: Preview reflects the log
- **WHEN** a TEXT_REPLACE changes "Invoice #100" to "Invoice #200"
- **THEN** the Preview Document shows "Invoice #200" for that Text Line while the Original Document is unchanged

#### Scenario: Reducer is deterministic
- **WHEN** the same log and cursor are applied to the same original
- **THEN** the preview state is identical each time

### Requirement: Cursor-based undo and redo
The system SHALL support undo and redo by moving a cursor over the Operation Log. Undo SHALL move the cursor back one step; redo SHALL move it forward. Making a new edit after undo SHALL discard the redo tail. The keyboard shortcuts `Ctrl/Cmd+Z` (undo), `Ctrl+Y` and `Ctrl+Shift+Z` (redo) SHALL work.

#### Scenario: Undo reverses the last edit
- **WHEN** the user edits text and presses Ctrl+Z
- **THEN** the preview reverts to the state before the edit, and redo is available

#### Scenario: New edit after undo discards redo tail
- **WHEN** the user undoes two operations and then makes a new edit
- **THEN** the two undone operations are no longer redoable

#### Scenario: Undo at the start is a no-op
- **WHEN** the cursor is at position 0 and the user presses Ctrl+Z
- **THEN** nothing changes and the action is silently ignored

### Requirement: One Gesture equals one operation
Each complete user action — one drag, one editor commit, one input committed on blur or Enter — SHALL produce exactly one Edit Operation. Intermediate states such as live drags or partial input SHALL be transient UI state, never operations.

#### Scenario: Single undo step per commit
- **WHEN** the user types several characters and commits
- **THEN** one TEXT_REPLACE operation is created, and one Ctrl+Z undoes the entire edit

### Requirement: REVERT operation cancels a target
The system SHALL support a REVERT operation that targets one or more earlier operations by their ids. When the log is applied, any operation targeted by a later active REVERT SHALL be skipped. A REVERT is itself an operation in the log and is undoable.

#### Scenario: Reverting a single edit
- **WHEN** the user reverts a TEXT_REPLACE from the History tab
- **THEN** a REVERT operation is appended, the reverted text returns to its original, and Ctrl+Z undoes the revert

#### Scenario: Revert to Original
- **WHEN** the user chooses "Revert to Original" on a Text Line that has been edited and moved
- **THEN** a REVERT targeting all effective operations on that object is appended, and the line returns to its original text and position

### Requirement: Supported operation types
The Operation Log SHALL accept operations of types: TEXT_REPLACE, TEXT_STYLE_CHANGE, TEXT_ADD, OBJECT_DELETE, and REVERT. Each type SHALL carry the payload defined in the data model (§8 of the PRD).

#### Scenario: TEXT_REPLACE payload
- **WHEN** a TEXT_REPLACE is created
- **THEN** it contains the objectId and the newText

#### Scenario: TEXT_ADD payload
- **WHEN** a TEXT_ADD is created
- **THEN** it contains a new objectId, the text, the position in Page Space, and the style

#### Scenario: OBJECT_DELETE payload
- **WHEN** an OBJECT_DELETE is created
- **THEN** it contains the objectId of the deleted object
