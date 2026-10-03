# ADR-0003: Append-only Operation Log with REVERT operations

- **Status:** Accepted (2026-10-03)
- **Requirements:** ST-1, ST-2, ST-3, TE-5, History tab

## Context

The History tab lets users revert any past item, not only the latest one. Removing an old operation from the stack would break the linear redo stack and could leave later operations on the same object meaningless.

## Decision

- Edits are stored in an append-only **Operation Log** with an undo cursor. Undo/redo move the cursor; making a new edit after undo discards the redo tail (standard behaviour).
- Reverting a History item appends a `REVERT { targetOpId }` operation. Applying the log skips any operation that is targeted by a later, active REVERT. The REVERT itself is undoable.
- "Revert to Original" appends a REVERT that targets all of that object's effective operations.
- One **Gesture** creates exactly one operation. Live drags and in-progress input are transient UI state; numeric inputs commit on blur or Enter.
- The reducer `apply(log, cursor, original) → previewDocument` is a pure function.

## Consequences

- History is auditable and never loses information; every action, including a revert, is undoable.
- Applying the log is O(n) per recompute; memoise per page if it becomes slow.
- The log is plain serialisable data, which enables session autosave (ADR-0005).
