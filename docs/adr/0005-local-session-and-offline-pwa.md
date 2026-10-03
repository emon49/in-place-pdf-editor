# ADR-0005: Local session autosave and an offline PWA

- **Status:** Accepted (2026-10-03). Amended by ADR-0007 (optional Google Fonts download).
- **Requirements:** ST-6, NFR Privacy, NFR Deployment

## Context

The product promise is "your documents never leave your device". Losing all edits on refresh is a common frustration, and the app should keep working without a network.

## Decision

- The **Session** (Original Document bytes + Operation Log + undo cursor) is autosaved to IndexedDB after each operation (debounced). On load, if a session exists, offer "Restore previous session?" with Restore and Discard options. One session is kept at a time.
- A visible "Discard session" control clears local data. The UI notes that edits are stored in this browser on this device.
- Deploy as a static site with a service worker that precaches the app shell, the PDF.js worker and the Liberation fallback fonts, so it works offline after the first visit. Font Catalog and substitute fonts are self-hosted and cached when first used.
- Ship a strict Content-Security-Policy (`connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com`, no third-party scripts) so the no-upload promise is enforced by the browser, and verify it in E2E.
- **Amendment (ADR-0007):** the only allowed third-party requests are Google Fonts downloads. They happen only after the user consents (per family, or "always" in local settings) and carry only a font family name, never document data. Downloaded fonts are cached on the device. E2E asserts that no request is made without consent.

## Consequences

- Refreshing no longer loses work.
- Document data persists on the device until discarded, which matters on shared computers, so it is surfaced in the UI.
- Large PDFs consume IndexedDB quota; if a write fails, warn the user and continue without autosave.
