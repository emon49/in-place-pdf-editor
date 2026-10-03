# Spec Delta

## ADDED Requirements

### Requirement: Accessible toolbar and panels
Every toolbar button, sidebar control and Properties Panel input SHALL be keyboard-operable with a visible focus indicator. Icon-only buttons SHALL have an accessible label (aria-label or associated `<label>`). Tab order SHALL follow visual reading order. All interactive elements SHALL meet WCAG 2.1 AA contrast requirements for focus indicators.

#### Scenario: Icon button is labeled
- **WHEN** a screen reader focuses the "Zoom in" button
- **THEN** the screen reader announces "Zoom in" (or equivalent)

#### Scenario: Focus indicator is visible
- **WHEN** the user tabs to any control
- **THEN** a visible focus ring appears around that control

### Requirement: Cross-browser smoke tests
The application SHALL pass a core smoke-test suite on the latest stable versions of Chrome, Edge, Firefox and Safari (desktop). The suite SHALL cover: open a sample PDF, edit text, move an object, export, undo.

#### Scenario: Core flow passes in Firefox
- **WHEN** the Playwright smoke test runs against Firefox
- **THEN** all steps complete without error

#### Scenario: Core flow passes in Safari
- **WHEN** the Playwright smoke test runs against Safari (WebKit)
- **THEN** all steps complete without error
