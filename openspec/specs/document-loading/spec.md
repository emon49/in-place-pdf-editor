# document-loading Specification

## Purpose

Lets users open a PDF from their own device and gives clear, actionable feedback when a file cannot be opened.

## Requirements

### Requirement: Open a PDF with the file picker
The system SHALL let the user choose a `.pdf` file from their device through a labelled, keyboard-operable "Open PDF" control, and open it in the viewer at page 1.

#### Scenario: Valid PDF opened
- **WHEN** the user selects a valid, unencrypted PDF with the file picker
- **THEN** the document opens, page 1 is shown and the page indicator reads `1 / N`, where N is the document's page count

### Requirement: Open a PDF by drag and drop
The system SHALL accept a single PDF dropped onto the dropzone or the viewer area, and show a visible drop target while a file is dragged over it.

#### Scenario: PDF dropped
- **WHEN** the user drags a valid PDF over the window and drops it
- **THEN** a drop highlight is shown during the drag and the document opens at page 1

#### Scenario: More than one file dropped
- **WHEN** the user drops two or more files at once
- **THEN** nothing is opened and the message "Drop one PDF at a time" is shown

### Requirement: Reject non-PDF files
The system SHALL identify PDFs by content (the `%PDF-` header), not only by file extension, and refuse anything else with a clear message.

#### Scenario: Image renamed to .pdf
- **WHEN** the user opens a PNG file named `scan.pdf`
- **THEN** the file is not opened and the message says the file is not a PDF

#### Scenario: Unsupported file dropped
- **WHEN** the user drops a `.docx` file
- **THEN** the file is not opened and the message says only PDF files are supported

### Requirement: Corrupt PDF error
If a file has a PDF header but cannot be parsed, the system SHALL show an error saying the file appears damaged and keep the previously open document (if any) unchanged.

#### Scenario: Truncated PDF
- **WHEN** the user opens a PDF whose bytes are truncated so it cannot be parsed
- **THEN** an error "This PDF appears to be damaged and could not be opened" is shown and any previously open document is still displayed

### Requirement: Encrypted PDFs are blocked
The system SHALL detect password-protected or encrypted PDFs (including those with only an owner password) and refuse to open them, explaining that protection must be removed in another tool first (UP-3, ADR-0006). It SHALL NOT prompt for a password.

#### Scenario: User-password PDF
- **WHEN** the user opens a PDF that requires a password to view
- **THEN** no password prompt appears, the document is not opened, and the message explains the file is password-protected and must be unlocked before editing

#### Scenario: Owner-password-only PDF
- **WHEN** the user opens a PDF that has an encryption dictionary but no user password
- **THEN** the document is not opened and the same encrypted-file explanation is shown

### Requirement: Large file warning
The system SHALL open files larger than 50 MB or with more than 100 pages, but show a non-blocking notice that performance may be reduced.

#### Scenario: 120-page document
- **WHEN** the user opens a valid 120-page PDF
- **THEN** the document opens and a dismissible notice about reduced performance is shown

### Requirement: Opening replaces the current document
Opening a new document SHALL replace the currently open one, reset to page 1 and keep the current zoom mode.

#### Scenario: Second document opened
- **WHEN** a document is open at page 4 in fit-to-width mode and the user opens another PDF
- **THEN** the new document shows page 1 in fit-to-width mode

### Requirement: Loading feedback
While a document is being read and its first page rendered, the system SHALL show a loading indicator and keep the controls responsive.

#### Scenario: Loading indicator
- **WHEN** the user opens a 40 MB PDF
- **THEN** a loading indicator is visible until the first page is rendered
