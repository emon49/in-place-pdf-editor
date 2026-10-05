# Spec Delta

## Purpose

Provides an accessible reference modal listing all keyboard shortcuts, reachable from a toolbar button or the keyboard.

## ADDED Requirements

### Requirement: Keyboard shortcuts modal
The system SHALL provide a modal that lists all keyboard shortcuts in the application. The modal SHALL be openable via a toolbar button and via `Ctrl+?` (and `Cmd+?` on macOS). It SHALL be closable with `Esc` or a close button.

#### Scenario: Toolbar button opens the modal
- **WHEN** the user clicks the keyboard shortcuts button in the Header
- **THEN** the Shortcuts modal opens and lists all shortcuts

#### Scenario: Keyboard shortcut opens the modal
- **WHEN** the user presses Ctrl+?
- **THEN** the Shortcuts modal opens

#### Scenario: Esc closes the modal
- **WHEN** the Shortcuts modal is open and the user presses Esc
- **THEN** the modal closes

### Requirement: Shortcuts modal is keyboard-operable
The modal SHALL trap focus while open and return focus to the previously focused element when closed. The close button SHALL be reachable by Tab.

#### Scenario: Focus is trapped in the modal
- **WHEN** the Shortcuts modal is open and the user presses Tab
- **THEN** focus cycles only within the modal, never leaving it
