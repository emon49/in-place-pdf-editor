# Tasks

## 1. Project scaffold and toolchain

- [ ] 1.1 Initialise Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) with the `src/components`, `src/store`, `src/lib`, `src/types`, `tests/unit`, `tests/integration`, `tests/e2e` layout from `CLAUDE.md`; verify `npm run dev` serves a placeholder page
- [ ] 1.2 Add Tailwind v4 (`@tailwindcss/vite`) and `lucide-react`; verify a Tailwind utility and a Lucide icon render on the placeholder page
- [ ] 1.3 Add an ESLint flat config (`typescript-eslint` strict, `react-hooks`, `jsx-a11y`) and Prettier-compatible formatting; verify `npm run lint` passes on the scaffold
- [ ] 1.4 Add Vitest (node environment for `tests/unit` and `tests/integration`) and Playwright (Chromium via the preinstalled browser, running against `vite preview`); verify `npm run test` and `npm run test:e2e` each run one trivial passing test
- [ ] 1.5 Add `typecheck`, `build`, `test`, `test:e2e` and `lint` scripts exactly as listed in `CLAUDE.md`, pin `pdfjs-dist` and `pdf-lib` to exact versions, add `zustand`; verify `npm run typecheck && npm run build` succeeds

## 2. Coordinate mapping (UP-4, MV-4 helper, Wrap Margin)

- [ ] 2.1 Implement `src/lib/coordinates.ts` (`PageGeometry`, rotation normalisation, Page↔Display point/rect maps, `displaySize`) per design D7; verify unit tests cover every Display Coordinates and Rectangle scenario in `specs/coordinate-mapping/spec.md` (rotate 0/90/180/270, CropBox offset, −90/450 normalisation)
- [ ] 2.2 Add Display↔Screen (zoom) and Screen→Canvas (render scale) maps; verify the "Zoomed point" scenario test passes
- [ ] 2.3 Add property-based round-trip tests (random points/rects, rotations, crop offsets, zoom 25–400%); verify all round trips are within 1e-6 pt
- [ ] 2.4 Implement `clampToSafeArea` and `wrapMarginX`; verify unit tests for the left-edge, bottom-right, wider-than-Safe-Area and rotated Wrap Margin scenarios pass

## 3. Document loading pipeline (UP-1, UP-3)

- [ ] 3.1 Create `tests/fixtures/` with fictional one-page PDFs: valid, truncated, PNG renamed to `.pdf`, user-password (AES-256 and RC4), and owner-password-only (all produced with `qpdf`), plus a README recording how each was generated; verify the files exist and contain no personal data
- [ ] 3.2 Implement `src/lib/pdf-loader.ts` with header sniffing (`%PDF-` within the first 1024 bytes), `LoadError` union and a single user-message map; verify unit tests for not-pdf, unsupported-type and multiple-files classification
- [ ] 3.3 Configure PDF.js (same-origin module worker, self-hosted `cmaps/`, `standard_fonts/`, `wasm/` copied at build, `isEvalSupported: false`) per design D2; verify the build output contains those assets and an integration test opens the valid fixture
- [ ] 3.4 Implement open with a byte copy for PDF.js, `onPassword` → `encrypted`, `getPermissions()` gate before render, and parse failure → `damaged`; verify integration tests classify every fixture correctly and that `originalBytes` is unchanged after open
- [ ] 3.5 Implement the document registry (PDFDocumentProxy + `originalBytes` keyed by document id, destroyed on replace) and the `editorStore` document/loading/error/notice state (design D6); verify unit tests show a failed load leaves the previous document in place and a successful load resets to page 1 while keeping fit mode
- [ ] 3.6 Add the large-document notice (>50 MB or >100 pages, plus `/UserUnit` ≠ 1); verify a unit test with a stubbed 120-page document sets the dismissible notice

## 4. Sample documents (UP-2)

- [ ] 4.1 Implement `src/lib/sample-documents.ts` (lazy-imported) generating Academic Research Paper (multi-page, two columns, serif/sans/mono, bold), Invoice (tinted header row, embedded PNG logo, fictional parties) and Technical Spec (`/Rotate 90` page, CropBox ≠ MediaBox page) with fixed metadata; verify integration tests assert page counts, a page with `rotate === 90`, a page whose view differs from its MediaBox, and an image operator on the Invoice page
- [ ] 4.2 Add a determinism test that generates each sample twice; verify outputs are byte-identical
- [ ] 4.3 Add an integration test comparing `coordinates.ts` with PDF.js `viewport.convertToViewportPoint` at scale 1 on every sample page; verify agreement within 1e-6 pt

## 5. Page viewer, navigation and zoom (VW-1, ST-4)

- [ ] 5.1 Implement `src/lib/zoom.ts` (presets, `nextPreset`/`prevPreset`, `clampZoom`, `fitWidth`, `fitPage`); verify unit tests including 100→125, 110→125, bounds at 25/400 and fit-to-page for a rotated page
- [ ] 5.2 Implement `PDFViewer` rendering the active page with render scale = `min(dpr, √(16 777 216 / cssArea))`, offscreen double-buffering, cancellation of stale `RenderTask`s and request-id tagging; verify a component test asserts canvas backing sizes for the 100%/dpr 2 and 400%/dpr 2 scenarios
- [ ] 5.3 Add `devicePixelRatio` change re-render (`matchMedia`) and a `ResizeObserver` that recomputes zoom only while a fit mode is active; verify component tests for "fit to width follows resize" and "explicit zoom leaves fit mode"
- [ ] 5.4 Implement `Header` with Open PDF, Load sample menu, `< n / N >` switcher with page input, `−`/`100%`/`+`, fit-to-width and fit-to-page buttons, all with accessible labels and visible focus; verify `npm run lint` (jsx-a11y) passes and a component test checks labels and disabled states at boundaries
- [ ] 5.5 Add keyboard shortcuts (PageUp/PageDown, Home/End, Ctrl/Cmd + `=`/`-`/`0`) ignored while focus is in a text input; verify unit tests of the key handler
- [ ] 5.6 Implement `PDFUploader` dropzone (empty state and whole-viewer drop target with highlight), wired to the loader and showing errors from the message map; verify a component test for drop highlight and the "Drop one PDF at a time" message

## 6. App shell: PWA and CSP (privacy and offline NFRs)

- [ ] 6.1 Create `csp.ts` (single policy per design D3) and wire it into `vite preview` headers, a generated `dist/_headers`, and an `index.html` meta fallback without `frame-ancestors`; verify a unit test that all three are derived from the same constant and `npm run build` emits `_headers`
- [ ] 6.2 Add `vite-plugin-pwa` (`generateSW`, `registerType: 'prompt'`) precaching app chunks, PDF.js worker, cmaps, standard fonts, wasm, icons and the samples chunk, plus a web app manifest; verify the built service worker's precache manifest lists those assets
- [ ] 6.3 Implement the non-blocking "Reload to update" notice; verify a component test that it appears on the `needRefresh` signal and reloads only on click

## 7. End-to-end verification

- [ ] 7.1 E2E: open the valid fixture via file chooser and via drop, open each sample, and confirm the corrupt/non-PDF/encrypted/multiple-file messages; verify all Playwright tests pass against `vite preview`
- [ ] 7.2 E2E: page navigation (buttons, input, PageDown at last page), zoom presets, fit-to-page across the Technical Spec rotated page; verify tests pass and a screenshot shows the rotated page in landscape
- [ ] 7.3 E2E privacy: record all requests while opening a fixture, navigating and zooming; verify every request is same-origin and none occurs after load except cached assets, and that a scripted `fetch` to a third-party origin is blocked by CSP
- [ ] 7.4 E2E offline: load once, `context.setOffline(true)`, reload, open a local PDF and a sample; verify both render
- [ ] 7.5 E2E performance: generate the 10-page, 5 MB fixture in test setup and measure time from file selection to first-page render; verify it is under 2 s on CI hardware (report the measured value)
- [ ] 7.6 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run test:e2e`; verify all pass, and update `CLAUDE.md` Commands/Structure only if the actual layout differs from it
