# Proposal

## Why

The repository has requirements (`docs/PRD.md`), a glossary and ADRs, but no application yet. Every later milestone (M1 read model, M2 edit core, M3 move/style, M4 images, M5 export) needs the same base. That base is a running client-side app that can open a PDF, render it crisply, navigate and zoom, and convert reliably between Page Space and screen pixels on rotated or cropped pages. Coordinate handling is the most common bug source in this kind of editor, so it must be settled and tested before any overlay is built on top of it.

## What Changes

- Scaffold the project: Vite + React + TypeScript (strict), Tailwind, Lucide, Zustand, ESLint, Vitest, Playwright, with the `npm` scripts listed in `CLAUDE.md`.
- **App shell (PWA):** static build with a service worker that precaches the app shell and the PDF.js worker. Strict Content-Security-Policy with no third-party scripts. `connect-src` stays `'self'` in M0; the Google Fonts allowance from the ADR-0005 amendment is added later, with the font work.
- **Document loading (UP-1, UP-3):** file picker and drag-and-drop dropzone for `.pdf`. Invalid or corrupt files show an error, and encrypted or password-protected files are blocked with an explanation (ADR-0006).
- **Sample documents (UP-2):** three built-in samples (Academic Research Paper, Invoice, Technical Spec) generated in the browser with `pdf-lib`. Between them they include a tinted-background region, a rotated page, a non-zero CropBox and an embedded image. No sample PDF files are committed.
- **Page rendering (VW-1):** render the active page with PDF.js into a canvas sized for `devicePixelRatio`, with the PDF.js worker running off the main thread.
- **Navigation and zoom (ST-4):** page switcher (`< n / N >`), zoom 25%–400%, preset buttons, fit-to-width, fit-to-page, and keyboard access.
- **Coordinate mapping (UP-4):** one pure module that converts between Page Space, Display Coordinates (top-left points) and Screen Space. It handles `/Rotate` 0/90/180/270, CropBox offsets, zoom and `devicePixelRatio`, and includes the Safe Area clamp (10 pt inset) and the Wrap Margin. Unit tests are exhaustive.
- Out of scope for M0: text extraction, overlays, editing, the Operation Log, session autosave (ST-6), fonts and export.

## Capabilities

### New Capabilities
- `app-shell`: The installable, offline-capable static application shell and its privacy guarantees: precaching, offline behaviour, Content-Security-Policy, and no document data on the network.
- `document-loading`: Opening a PDF from the user's device: file picker, drag-and-drop, validation, and the error paths for corrupt and encrypted files.
- `sample-documents`: Built-in, programmatically generated sample PDFs that exercise the editor's edge cases without uploading anything.
- `page-viewer`: Rendering the active page crisply and navigating the document: page switching, zoom range, presets, fit modes.
- `coordinate-mapping`: Conversion between Page Space, Display Coordinates and Screen Space, including rotation, CropBox, zoom and pixel ratio, plus the Safe Area clamp and the Wrap Margin.

### Modified Capabilities
- None (there are no existing specs).

## Impact

- **New code:** `package.json`, Vite/TS/Tailwind/ESLint/Vitest/Playwright configs, `index.html`, `src/` (app shell, `components/Header`, `components/PDFUploader`, `components/PDFViewer`, `store/editorStore.ts`, `lib/coordinates.ts`, `lib/pdf-loader.ts`, `lib/sample-documents.ts`), `public/` (manifest, icons), service worker, `tests/`.
- **Dependencies (runtime):** `react`, `react-dom`, `pdfjs-dist`, `pdf-lib`, `zustand`, `lucide-react`. **Dev:** `vite`, `typescript`, `tailwindcss`, `eslint`, `vitest`, `@playwright/test`, and a PWA/service-worker plugin. `@pdf-lib/fontkit` is not added until the font work.
- **Systems:** static hosting with response headers for the CSP. A `<meta>` CSP fallback is used where the host cannot set headers.
- **Docs:** none of the ADRs change. Requirement IDs covered: UP-1, UP-2, UP-3, UP-4, VW-1, ST-4, and the Privacy/Offline/Performance NFRs (first-page portion).
