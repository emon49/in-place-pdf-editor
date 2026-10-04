# Spec Delta

## ADDED Requirements

### Requirement: Style override creates a TEXT_STYLE_CHANGE operation
Committing a style override from the Properties Panel (font family, size, bold, italic, or color) SHALL create a `TEXT_STYLE_CHANGE` operation containing the objectId and a partial TextStyle with only the changed fields. If no field differs from the current style, no operation SHALL be created (TY-9).

#### Scenario: Color override produces an operation
- **WHEN** the user selects a Text Line and changes its color in the Properties Panel
- **THEN** a TEXT_STYLE_CHANGE is appended with the objectId and the new color

#### Scenario: Unchanged style produces no operation
- **WHEN** the user opens the Properties Panel and submits without changing any field
- **THEN** no TEXT_STYLE_CHANGE is appended and the Operation Log is unchanged

#### Scenario: Style change is undoable
- **WHEN** the user changes the font size and presses Ctrl+Z
- **THEN** the operation is undone and the text reverts to its previous size
