# Design

## Context

This is a greenfield repository: it contains only docs (`docs/PRD.md`, `CONTEXT.md`, `docs/adr/`), `CLAUDE.md` and OpenSpec config, with no `package.json` and no source. See proposal.md (Why) for motivation and the five spec deltas for the required behaviour. Constraints that shape the approach:

- 100% client-side; no document data on the network, enforced by CSP (ADR-0005).
- Later milestones need the **original PDF bytes unchanged** (pdf-lib export in M5, original-font reuse in ADR-0007) and **one geometry module** shared by preview and export.
- Encrypted PDFs are blocked, including owner-password-only files (ADR-0006).

## Goals / Non-Goals

**Goals:**
- A toolchain and folder layout that later milestones extend without restructuring (`src/components`, `src/store`, `src/lib`, `tests/`, as in `CLAUDE.md`).
- A pure, PDF.js-independent `coordinates.ts` that the M5 exporter can import without the viewer.
- A single document-loading pipeline that sniffs, validates, detects encryption and then opens the file.
- A CSP and offline setup that is identical in local preview, E2E and production.

**Non-Goals:**
- Text/image extraction, overlay layers 1–4, the Operation Log, session autosave (ST-6), font handling. Their seams are named below but not built.
- Thumbnails and continuous-scroll view (single active page only, as the PRD's `< n / N >` switcher implies).
- `/UserUnit` support beyond 1.0 (see Risks).

## Decisions

### D1. Toolchain: Vite + React 19 + TypeScript strict + Tailwind v4
Vite gives fast dev builds, native Web Worker and `new URL(..., import.meta.url)` asset handling for the PDF.js worker, and a first-class PWA plugin. React 19 is used because nothing here depends on 18-only libraries. Tailwind v4 is set up via `@tailwindcss/vite`. Lint uses an ESLint flat config with `typescript-eslint` (strict), `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y` (the accessibility rules in `CLAUDE.md`). Node ≥ 20.
*Alternatives:* Next.js (server-oriented, adds nothing for a static client app); CRA (unmaintained).

### D2. PDF.js configured for a strict CSP and offline use
- The worker is loaded from our own origin (`pdfjs-dist/build/pdf.worker.min.mjs` via `new URL(..., import.meta.url)`) as a module worker.
- `cMapUrl`, `standardFontDataUrl` and `wasmUrl` point to copies of `pdfjs-dist`'s `cmaps/`, `standard_fonts/` and `wasm/` served from our origin, and are precached. Without them, CJK/CID documents and non-embedded Standard 14 fonts would fail offline or try to reach a CDN.
- `isEvalSupported: false` keeps PDF.js from needing `'unsafe-eval'`.
*Alternative:* load the worker from a CDN. Rejected because it breaks CSP and offline use.

### D3. CSP defined once, delivered three ways
One `csp.ts` (build-time constant) produces the policy:
`default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' blob: data:; font-src 'self' data:; style-src 'self'; style-src-attr 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`.
- **Production headers:** a generated `_headers` file (Netlify/Cloudflare Pages format).
- **Fallback:** a `<meta http-equiv>` tag for hosts that cannot set headers. It omits `frame-ancestors`, which meta tags ignore.
- **Local `vite preview` and Playwright:** `preview.headers` in the Vite config, so E2E exercises the real policy.

`style-src-attr 'unsafe-inline'` is needed for dynamic geometry styles (canvas and overlay sizes), the one inline-style use `CLAUDE.md` allows. `'wasm-unsafe-eval'` is needed for PDF.js's WASM image decoders. The Google Fonts hosts (ADR-0005 amendment) are added in the font milestone, not here.
*Alternative:* a hand-maintained policy in each place. Rejected because the copies drift.

### D4. PWA via `vite-plugin-pwa` (Workbox `generateSW`, `registerType: 'prompt'`)
Precache the app shell, the JS/CSS chunks, the PDF.js worker, cmaps, standard fonts, wasm and icons. `'prompt'` lets us show "Reload to update" instead of swapping versions under an open document (app-shell spec). The sample generator chunk is precached too, so samples work offline.
*Alternative:* a hand-written service worker. Rejected as more code with the same result.

### D5. Loading pipeline: sniff → open in PDF.js → encryption gate → render
`lib/pdf-loader.ts` exposes `loadPdf(file | bytes, name): Promise<Result<LoadedDocument, LoadError>>`:
1. Reject if more than one file is dropped, or if the type is clearly not PDF and `%PDF-` is not found within the first 1024 bytes (the PDF spec allows leading junk).
2. Keep `originalBytes` as an immutable `Uint8Array`, and give PDF.js a **copy**, because `getDocument({ data })` transfers and detaches the buffer to the worker. M5 export and ADR-0007 need the untouched original.
3. `getDocument` with `onPassword` → resolve `encrypted` immediately and destroy the task. This covers user-password files with no prompt.
4. After open, `pdfDocument.getPermissions()` returning non-null means the file has an `/Encrypt` dictionary, which covers owner-password-only files. Destroy and resolve `encrypted` **before** any page is rendered, so a blocked file never flashes on screen.
5. Parse failures (`InvalidPDFException`, unexpected errors) → `damaged`. The previous document stays open, because the store swaps documents only on success.

`LoadError` is a closed union (`multiple-files | unsupported-type | not-pdf | damaged | encrypted`), and all user-facing messages live in one map.
*Alternative for step 4:* parse with pdf-lib and check `isEncrypted`. Rejected for M0 because it means a second full parse on the main thread. `getPermissions()` is cheap and comes from the same parse.

### D6. State shape and non-serialisable handles
The Zustand `editorStore` holds serialisable state only: `document: { id, name, byteLength, pageCount } | null`, `view: { pageIndex, zoom, fitMode: 'width' | 'page' | null }`, `loading`, `notice`, `error`. The `PDFDocumentProxy` and `originalBytes` live in a module-level registry keyed by `document.id`, so the store stays serialisable and M2 can add the Operation Log and IndexedDB session next to it. Page geometry (`view` box, `rotate`) is read per page from PDF.js and cached by page index.

### D7. `coordinates.ts`: pure affine maps, independent of PDF.js
Input is `PageGeometry { box: [x0, y0, x1, y1]; rotate: 0 | 90 | 180 | 270 }`, with `box` taken from PDF.js `page.view` (the CropBox already intersected with the MediaBox) and `rotate` normalised from any multiple of 90. The module builds a 2×3 matrix Page→Display for each rotation and derives every other map by inversion and composition:
- `pageToDisplay` / `displayToPage` (points and rects), `displaySize`
- `displayToScreen` / `screenToDisplay` (zoom), and `screenToCanvas` (render scale)
- `clampToSafeArea(rect, displaySize)` and `wrapMarginX(displaySize)`, both in Display Coordinates

Rects convert by mapping their corners and taking the axis-aligned bounds. The module is unit-tested against every scenario in the coordinate-mapping spec, plus property tests (random points, rotations, crop offsets and zooms; round trip within 1e-6). An integration test checks that it agrees with PDF.js `viewport.convertToViewportPoint` on the sample pages.
*Alternative:* use the PDF.js `PageViewport` everywhere. Rejected because it ties the exporter to PDF.js and has no notion of Display Coordinates or the Safe Area.

### D8. Rendering: one active page, cancellable, double-buffered, capped
`PDFViewer` renders only the active page:
- Each render computes CSS size = display size × zoom, and render scale = `min(devicePixelRatio, sqrt(16_777_216 / (cssW × cssH)))`.
- It draws into a fresh offscreen canvas and swaps it in when done. This avoids flicker, and the old page stays visible meanwhile.
- A new page or zoom cancels the in-flight `RenderTask`, and results are tagged with a request id so stale completions are dropped.
- A `matchMedia('(resolution: Xdppx)')` listener triggers re-render when `devicePixelRatio` changes.
- A `ResizeObserver` on the viewer recomputes zoom only while a fit mode is active.

### D9. Zoom logic is pure
`lib/zoom.ts` holds `PRESETS`, `nextPreset(z)`, `prevPreset(z)`, `clampZoom`, `fitWidth(containerW, displayW, padding)` and `fitPage(...)`. They are unit-tested, including stepping from non-preset values (110% → 125%).

### D10. Samples generated with pdf-lib, lazy-loaded, deterministic
`lib/sample-documents.ts` is dynamically imported only when "Load sample" is used, so pdf-lib stays out of the initial bundle.
- **Fonts:** samples use pdf-lib Standard 14 fonts (Times, Helvetica, Courier, regular and bold). That is enough for M0 rendering, and it gives a non-embedded Standard 14 test case for ADR-0007 tier 1. Embedded subset fonts are added to the samples in M1.
- **Image:** a tiny procedurally drawn PNG is stored as a byte constant (not a PDF).
- **Determinism:** fixed `CreationDate`, `ModDate`, `Producer` and `Creator`, and no random IDs. A unit test asserts byte equality across two generations.
- **Contents:** the Invoice has a tinted header row and a logo image; the Technical Spec has a `/Rotate 90` page and a page with a CropBox inset (`setCropBox`); the Academic Paper is multi-page with two columns.

### D11. Test fixtures and test layers
- **Unit (Vitest, node):** `coordinates`, `zoom`, header sniffing, error mapping, sample determinism.
- **Integration (Vitest, node, `pdfjs-dist/legacy`):**
  - Samples open with the expected `rotate`/`view`.
  - `pdf-loader` classifies the fixtures correctly: valid, truncated, PNG-renamed, user-password and owner-password-only.
  - `coordinates` agrees with `PageViewport`.
- **Fixtures:** encrypted fixtures are produced once with `qpdf --encrypt` from a fictional one-page PDF and committed under `tests/fixtures/` with a README stating their provenance. The 10-page, 5 MB performance fixture is generated by a test-setup script, not committed.
- **E2E (Playwright, against `vite preview` with real CSP headers):**
  - File chooser, drop, multiple-file drop, samples, page and zoom controls, fit modes on a rotated page.
  - Offline reload via `context.setOffline(true)` after the first visit.
  - A request log asserting that every request is same-origin and none happens after a document is opened, apart from cached app assets.
  - The update prompt.
  - First-page timing on the 5 MB fixture.

## Risks / Trade-offs

- [PDF.js `getPermissions()` might not flag some unusual encryption setups] → The fixture matrix covers user-password, owner-only and AES and RC4 variants. Detection is wrapped in one function so the fallback (pdf-lib `isEncrypted` in a worker) can be added without touching callers.
- [Copying bytes doubles memory for large files: 50 MB becomes 100 MB] → Acceptable at the 50 MB scale target. The registry releases both on document replace (`pdfDocument.destroy()`).
- [`/UserUnit` ≠ 1 pages would be mis-scaled] → Rare. Detect it and show the large-file style notice ("unusual page units") for now; tracked for M1.
- [CSP breaks a PDF.js feature (e.g. a WASM decoder or inline styles in a future PDF.js version)] → E2E runs under the real policy. PDF.js is pinned to an exact version and upgrades are checked against the sample corpus.
- [Byte-determinism of pdf-lib output could change across pdf-lib versions] → The test compares two generations from the same version, not a stored hash. pdf-lib is pinned.
- [Service-worker caching can serve stale builds] → `registerType: 'prompt'` plus hashed asset names. The SW never caches user documents, because only build assets are precached.
- [Single-page view feels limited compared with continuous scroll] → Matches the PRD for v1. The viewer component takes the page index as a prop, so a continuous mode can be layered on later.

## Migration Plan

Greenfield: there is nothing to migrate.
- **Deploy:** run `npm run build` and publish `dist/` to a static host that honours `_headers` (Netlify or Cloudflare Pages). On GitHub Pages the meta-tag CSP fallback applies.
- **Rollback:** redeploy the previous `dist/`. Clients pick it up through the update prompt.

## Open Questions

- Which static host to use. This affects only the deploy step and header delivery, and the CSP is already produced for both header and meta delivery.
