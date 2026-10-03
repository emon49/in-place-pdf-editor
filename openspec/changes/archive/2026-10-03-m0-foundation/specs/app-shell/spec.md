# Spec Delta

## Purpose

Provides the static, offline-capable application shell and enforces the product's privacy promise that document data never leaves the user's device.

## ADDED Requirements

### Requirement: Works offline after first visit
After the app has been loaded once over the network, the system SHALL load and be fully usable for every M0 feature (open a local PDF, load a sample, render, navigate, zoom) with no network connection.

#### Scenario: Reload while offline
- **WHEN** the user has visited the app once, then goes offline and reloads the page
- **THEN** the app shell loads from the device cache and the user can open a local PDF and view its pages

#### Scenario: Samples work offline
- **WHEN** the device is offline and the user loads a built-in sample
- **THEN** the sample opens and renders without any network request

### Requirement: No document data on the network
The system SHALL NOT send any part of a loaded document (bytes, text, metadata, file name or derived data) in any network request.

#### Scenario: Opening and viewing a document makes no outbound document requests
- **WHEN** the user opens a local PDF, switches pages and changes zoom
- **THEN** no network request is made whose URL, headers or body contain document-derived data, and no request goes to any origin other than the app's own

### Requirement: Strict content security policy
The system SHALL be served with a Content-Security-Policy that allows scripts, workers and network connections only from the app's own origin, and no third-party scripts.

#### Scenario: Third-party connection is refused
- **WHEN** code running in the page attempts a network connection to an origin other than the app's own
- **THEN** the browser blocks the request under the policy

### Requirement: Update notification
When a newer version of the app has been downloaded in the background, the system SHALL tell the user and apply it only after the user agrees to reload.

#### Scenario: New version available
- **WHEN** a new app version finishes downloading while the user has a document open
- **THEN** a non-blocking notice offers "Reload to update" and the current view is not interrupted

### Requirement: Installable application
The system SHALL provide a web app manifest with name, icons and standalone display so supporting browsers can install it.

#### Scenario: Install prompt available
- **WHEN** the app is opened in a supporting desktop browser over HTTPS
- **THEN** the browser recognises it as installable
