# PDF In-Place Editor

A 100% client-side, non-destructive WYSIWYG PDF editor that runs entirely in the browser. Click any text or image in a rendered PDF, edit it in place, and export a new PDF with the layout preserved — no uploads, no accounts, no server.

## Features

- **In-place text editing** — click any text to select it, double-click to edit; font, size, color and spacing are preserved
- **Move & resize** — drag text and images to reposition them; resize images with handles
- **Add & delete** — insert new text objects or remove existing ones
- **Image replacement** — swap embedded images while keeping their geometry
- **Non-destructive edits** — changes are stored as an operation log; the original PDF is never mutated
- **Undo / redo** — full history with per-item revert from the History sidebar
- **Document search** — real-time case-insensitive search with highlighted matches and next/previous navigation
- **Page thumbnails** — scrollable thumbnail strip for quick page navigation
- **Color palette presets** — colors extracted from the document surface as one-click swatches
- **Keyboard shortcuts** — full keyboard support with an in-app shortcuts reference modal
- **Offline support** — works without a network connection after the first visit (PWA)
- **Privacy first** — documents never leave your device; the only optional network request is a consented Google Fonts download

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 + Lucide Icons |
| PDF rendering | `pdfjs-dist` (legacy build) |
| PDF export | `pdf-lib` + `@pdf-lib/fontkit` |
| State | Zustand |
| Build | Vite 8 |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |
| Linting | ESLint (flat config) + `eslint-plugin-jsx-a11y` |
| Offline / PWA | `vite-plugin-pwa` |
| Local persistence | IndexedDB (autosave) |

## Prerequisites

- **Node.js 20 or later**
- npm (bundled with Node.js)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/emon49/in-place-pdf-editor.git
cd in-place-pdf-editor
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The app hot-reloads on file changes.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Type-check then produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally (used by E2E tests) |
| `npm run typecheck` | Run `tsc --noEmit` without emitting files |
| `npm run lint` | Run ESLint across the whole project |
| `npm run test` | Run all unit tests with Vitest |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Build then run Playwright E2E tests |
| `npm run fixtures` | Regenerate test PDF fixtures (requires `qpdf`) |

## Running Tests

### Unit tests

```bash
npm run test
```

Tests live in `tests/unit/`. They run in a jsdom environment via Vitest.

### End-to-end tests

```bash
npm run test:e2e
```

Playwright builds the app, serves it via `vite preview` (with the real Content-Security-Policy and service worker), then runs tests in `tests/e2e/` against Chromium, Firefox, and WebKit.

To run only the cross-browser smoke suite:

```bash
npx playwright test --project=smoke-firefox --project=smoke-webkit
```

### Type-check and lint

```bash
npm run typecheck && npm run lint
```

## Project Structure

```
src/
  components/       React components (PDFViewer, TextOverlay, Sidebar, Header, …)
  store/            Zustand stores (editorStore, useEditor, usePageModel)
  lib/              Pure logic: coordinate helpers, extractors, renderers, exporters
  types/            Shared TypeScript types (PageModel, TextLine, EditOperation, …)
tests/
  unit/             Vitest unit tests (components, lib, store)
  integration/      Node-side PDF.js extraction tests
  e2e/              Playwright end-to-end tests
  fixtures/         Sample PDFs used by tests
docs/
  PRD.md            Product requirements
  adr/              Architecture Decision Records (ADR-0002 – ADR-0007)
  featurelist.md    Original complete feature specification
csp.ts              Single Content-Security-Policy source (headers + meta tag)
openspec/           OpenSpec planning artifacts (specs, changes, archive)
```

## Architecture Overview

The editor stacks five layers over a single page coordinate space:

| Layer | Responsibility |
|---|---|
| 0 — PDF.js canvas | High-DPI background render (offloaded to a Web Worker) |
| 1 — Patches & masks | Whiteout original position; render edit at new position |
| 2 — Text boxes | Interactive selection and move handles for text lines |
| 3 — Image boxes | Interactive selection, move and resize handles for images |
| 4 — Inline editor | Floating `<textarea>` for text editing |

**Key design decisions:**

- **Non-destructive** — edits are `EditOperation` records (`TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `OBJECT_MOVE`, `OBJECT_DELETE`, `IMAGE_REPLACE`, `REVERT`, …) in an append-only log; the original PDF bytes are never mutated.
- **Merged Text Line** — the editable unit is a line merged from raw PDF.js glyph runs (ADR-0002), not individual glyphs.
- **Dual-location masking** — a moved or edited object masks its original position with a sampled background color and renders at its new position (ADR-0004).
- **Font Resolution Chain** — edited text uses the embedded original font when possible, falling back through self-hosted open fonts, metric-compatible substitutes and Liberation (ADR-0007).
- **Single coordinate helper** — PDF user space (origin bottom-left, points) is converted to screen pixels only at the render boundary via `src/lib/coordinates.ts`.
- **Client-side only** — no backend; the only optional third-party request is a consented Google Fonts download carrying only a font family name (ADR-0005, ADR-0007).

See `docs/adr/` for the full decision log and `docs/PRD.md` for detailed requirements.

## Known Limitations

- Whiteout hides text visually but does not remove it from the PDF stream; it is not secure redaction.
- Edits are per Text Line; surrounding paragraph text does not reflow.
- Commercial fonts that are not embedded export as metric-compatible substitutes.
- Scripts beyond Latin, Latin Extended, Greek and Cyrillic are not supported (no RTL or complex shaping).
- Encrypted / password-protected PDFs are blocked (ADR-0006).
- Single-object selection only; no multi-select.
- Mobile browsers are not a target for v1.

## Contributing

1. Fork the repository and create a feature branch.
2. Run `npm run typecheck && npm run lint && npm run test` before opening a pull request.
3. Reference requirement IDs from `docs/PRD.md` (e.g. `MV-3`, `EX-2`) in commits and PR descriptions.
4. Do not add dependencies without a short justification; prefer the existing stack.
5. Do not commit sample PDFs containing real personal data.

## License

This project is private. All rights reserved.
