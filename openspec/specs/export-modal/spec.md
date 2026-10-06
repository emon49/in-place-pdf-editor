# export-modal Specification

## Purpose

Modal dialog that lets the user name the output file, monitors export progress, and triggers the download.

## Requirements

### Requirement: Export modal with file name input
The system SHALL provide an Export modal with a text input pre-filled with the original filename (replacing `.pdf` extension if present). The user may edit the name before downloading (EX-4, EX-5).

#### Scenario: File name is pre-filled
- **WHEN** the user opens the Export modal after loading "invoice.pdf"
- **THEN** the file name input reads "invoice.pdf"

#### Scenario: Custom file name is used
- **WHEN** the user changes the file name to "invoice-edited.pdf" and downloads
- **THEN** the downloaded file is named "invoice-edited.pdf"

### Requirement: Progress indicator and estimated size
The Export modal SHALL show a progress indicator while the export is running and an estimated file size once complete (EX-5).

#### Scenario: Progress shown during export
- **WHEN** the export operation is running
- **THEN** the modal shows a progress indicator

#### Scenario: Estimated size shown after completion
- **WHEN** the export completes
- **THEN** the modal displays the approximate file size before the download starts

### Requirement: Download via object URL blob
The export SHALL deliver the resulting PDF as a download using an object URL blob, not via a server-side response (EX-4). The blob URL SHALL be revoked after use.

#### Scenario: PDF is downloaded client-side
- **WHEN** the user clicks Download
- **THEN** a file download begins in the browser with no network request to any server

### Requirement: Ctrl+S opens the Export modal
`Ctrl+S` (and `Cmd+S` on macOS) SHALL open the Export modal when a document is loaded. When the modal is already open, the shortcut SHALL have no additional effect.

#### Scenario: Keyboard shortcut opens the modal
- **WHEN** a document is loaded and the user presses Ctrl+S
- **THEN** the Export modal opens

#### Scenario: Second press has no effect
- **WHEN** the Export modal is already open and the user presses Ctrl+S again
- **THEN** no second modal opens
