# Spec Delta

## ADDED Requirements

### Requirement: Double-click enters editing mode
Double-clicking an editable (not locked) selected Text Line SHALL open the inline text editor on that line. Double-clicking a locked Text Line SHALL have no editing effect.

#### Scenario: Double-click on editable line
- **WHEN** the user double-clicks an editable Text Line
- **THEN** the inline text editor opens over that line

#### Scenario: Double-click on locked line
- **WHEN** the user double-clicks a locked Text Line
- **THEN** no editor opens; the line stays selected with its lock state

### Requirement: Delete key deletes the selected object
Pressing `Delete` or `Backspace` when a Text Line is selected and the inline editor is not open SHALL delete the selected object by creating an OBJECT_DELETE operation. When the inline editor is open, the keys SHALL act normally within the editor.

#### Scenario: Delete with selection only
- **WHEN** a Text Line is selected (editor closed) and the user presses Delete
- **THEN** an OBJECT_DELETE is created and the selection is cleared

#### Scenario: Delete inside the editor
- **WHEN** the inline editor is open and the user presses Delete
- **THEN** the character after the cursor is deleted within the editor, not the whole line

### Requirement: Selection clears on edit commit
When the inline editor commits an edit, the selection SHALL be cleared so the user sees the result without the selection ring obscuring the Patch.

#### Scenario: Commit clears selection
- **WHEN** the user commits an edit by pressing Enter
- **THEN** the inline editor closes and no object is selected
