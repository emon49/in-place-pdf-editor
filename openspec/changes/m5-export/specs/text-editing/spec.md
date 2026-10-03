# Spec Delta

## ADDED Requirements

### Requirement: Style overrides are honoured in export
When a `TEXT_STYLE_CHANGE` is active for a Text Line, the exporter SHALL apply the overridden fields (font family, size, color, bold, italic) when drawing that line's Patch, using the Resolved Font that matches the overridden style. The override SHALL not affect lines that have no TEXT_STYLE_CHANGE (TY-8, TY-9).

#### Scenario: Color override appears in export
- **WHEN** the user changes a line's color to red via the Properties Panel and exports
- **THEN** the exported PDF draws that line in red

#### Scenario: Size override appears in export
- **WHEN** the user increases a line's font size and exports
- **THEN** the exported PDF renders the line at the overridden size
