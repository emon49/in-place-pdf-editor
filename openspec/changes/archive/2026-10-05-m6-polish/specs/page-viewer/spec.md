# Spec Delta

## ADDED Requirements

### Requirement: Rendering offloaded to a Web Worker
Page rendering SHALL NOT block the main thread. The PDF.js render task SHALL run in a dedicated Web Worker using an `OffscreenCanvas`, transferring the rendered bitmap to the main thread for display. The UI SHALL remain interactive while rendering is in progress (NFR: Performance, large files).

#### Scenario: UI stays responsive during render
- **WHEN** the user navigates to a complex page that takes over 200 ms to render
- **THEN** the toolbar controls remain interactive and respond to user input during that time

#### Scenario: Render result appears when complete
- **WHEN** the Worker completes rendering
- **THEN** the page canvas updates with the rendered image without a visible jump
