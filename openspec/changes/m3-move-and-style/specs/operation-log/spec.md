# Spec Delta

## MODIFIED Requirements

### Requirement: Supported operation types
The Operation Log SHALL accept operations of types: TEXT_REPLACE, TEXT_STYLE_CHANGE, TEXT_ADD, OBJECT_MOVE, OBJECT_DELETE, and REVERT. Each type SHALL carry the payload defined in the data model (§8 of the PRD).

#### Scenario: TEXT_REPLACE payload
- **WHEN** a TEXT_REPLACE is created
- **THEN** it contains the objectId and the newText

#### Scenario: TEXT_ADD payload
- **WHEN** a TEXT_ADD is created
- **THEN** it contains a new objectId, the text, the position in Page Space, and the style

#### Scenario: OBJECT_DELETE payload
- **WHEN** an OBJECT_DELETE is created
- **THEN** it contains the objectId of the deleted object

#### Scenario: OBJECT_MOVE payload
- **WHEN** an OBJECT_MOVE is created
- **THEN** it contains the objectId, the original position (from) in Page Space, and the new position (to) in Page Space
