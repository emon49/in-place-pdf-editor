# Design

## Context

M0 left a rendering shell: `PDFViewer` draws one page into a canvas and already accepts `children` for overlay layers, `coordinates.ts` converts between Page Space, Display Coordinates and Screen Space for every rotation and CropBox, and `document-registry.ts` holds the PDF.js proxy plus the untouched original bytes outside the Zustand store. See proposal.md (Why) for motivation and the six spec deltas for required behaviour.

Four facts were established by probing PDF.js 6 and pdf-lib during planning; they drive most decisions below.

1. `commonObjs.get(fontName)` throws `Requesting object that isn't resolved yet` after `getTextContent()` alone. Font objects are only populated by `getOperatorList()` (or a render).
2. PDF.js reports a **substituted** font as if it were the document's own: for a non-embedded Helvetica it returned `missingFile: false` and, with `fontExtraProperties`, 122 KB of its own Liberation data. PDF.js therefore cannot answer "does this document embed this font", which ADR-0007 tier 1 depends on.
3. A subset font program contains only `head, hhea, loca, maxp, cvt, prep, glyf, hmtx, fpgm` — no `name`, `cmap`, `OS/2` or `post`. `@pdf-lib/fontkit` throws on `postscriptName`, `characterSet` and `hasGlyphForCodePoint` for such a font.
4. The same subset carried a complete `ToUnicode` CMap (15 entries for 15 glyphs), and `pdf-lib` decoded the compressed `FontFile2` stream without trouble. `PDFDocument.load` of a 5 MB, 10-page file took 13 ms.

## Goals / Non-Goals

**Goals:**
- One read model per page that every later milestone consumes unchanged: `PageModel = { lines: TextLine[], … }`.
- Font facts complete enough that M2's Font Resolution Chain needs no new extraction.
- Extraction and sampling that never block rendering, selection or navigation.
- Pure, unit-testable functions for merging, normalization, metrics and sampling maths.

**Non-Goals:**
- Any write path: no operations, no masks, no patches, no editing.
- Choosing a font for edited text (the chain itself is M2); M1 only gathers inputs.
- Image objects (M4) and the Properties Panel (M3).
- A full text-layout engine: M1 reads what the document draws, it does not re-lay it out.

## Decisions

### D1. Extraction pipeline: operator list first, then text content
Per page, in order: `getOperatorList()` → `getTextContent({ disableNormalization: true })` → merge → enrich. The operator list is not optional: it both resolves the `commonObjs` font entries (finding 1) and carries the fill colours and text-state parameters that `getTextContent` omits. `disableNormalization: true` keeps the document's own characters, including ligatures — verified to be the difference between `"ﬁle"` and `"file"`, and required because M2 writes this text back.

### D2. Two sources of font truth, with the document as the authority
| Fact | Source | Why |
|---|---|---|
| `loadedName` (preview `@font-face` in M2), ascent, descent, font matrix, Type 3, vertical | PDF.js `commonObjs` font object | Only PDF.js has these |
| Raw font name, BaseFont, subtype | PDF font dictionary (pdf-lib) | Authoritative, no substitution |
| Truly embedded?, program bytes and type | `FontDescriptor` `FontFile`/`FontFile2`/`FontFile3` | Finding 2: PDF.js lies here |
| Serif, fixed-pitch, italic angle, weight, ForceBold | `FontDescriptor` `Flags`, `ItalicAngle`, `FontWeight` | Robust where the name is opaque |
| Encoding (simple name or CID) | Font dict `Encoding`, `DescendantFonts` | Needed by M2 to write codes |
| `fsType` | `OS/2` table of the embedded program | Licence gate for ADR-0007 tier 1 |
| Character coverage | `ToUnicode` CMap, reversed | Finding 3 and 4 |

The registry gains a lazily created pdf-lib handle over the same original bytes (`PDFDocument.load(bytes.slice(), { updateMetadata: false })`), created on first extraction and released with the document. 13 ms on a 5 MB file (finding 4) makes this affordable, and M5 needs the same handle for export.

### D3. Coverage comes from ToUnicode, not the font's cmap
Reversing the `ToUnicode` CMap gives Unicode → code for exactly the characters the document already uses — which is what a subset can draw (finding 3). Order of preference:
1. `ToUnicode` reversed (any embedded font, simple or composite).
2. The program's own `cmap`, when present (full, non-subset embedded fonts).
3. The standard encoding's glyph set (`WinAnsiEncoding`, `StandardEncoding`) for non-embedded simple fonts.
4. Unknown — reported as such, never guessed.

This is also the honest answer for ADR-0007: reusing a document's own font mostly works for characters already on the page, which is the common case for fixing a typo or a number.

### D4. A small internal sfnt reader instead of fontkit
We need two things from a font program: the `OS/2` `fsType` (a `uint16` at offset 8 of that table) and, occasionally, a `cmap`. Parsing the 12-byte sfnt header plus the table directory is about 60 lines. fontkit throws on exactly the subset fonts this feature exists to handle (finding 3), weighs several hundred KB, and would need lazy loading and error shielding anyway. A missing `OS/2` table means "no restriction stated", which the spec already defines as permitting editing. fontkit remains the right tool in M5, where fonts are **embedded**, not read.

### D5. Correlating text items with content-stream state
`getTextContent` and `getOperatorList` are two independent walks of the same stream, and neither indexes into the other. A state walker over the operator list maintains the graphics stack (`save`/`restore`), the text state (`setFont`, `setCharSpacing`, `setWordSpacing`, `setHScale`, `setTextRise`, `setTextRenderingMode`), the fill colour (`setFillRGBColor` — verified to arrive as a CSS hex string such as `#cc1a1a` — plus `setFillGray`, `setFillCMYKColor`, and `setFillColorN` for patterns) and the text matrix at each show operation. It emits a `StyledSpan` per show operation carrying that state and its start point in Page Space.

Each text item is then matched to a span by start point (rounded to 0.01 pt) and font name, falling back to the nearest span within half an em that uses the same font, falling back to the most recent span in stream order. An item that matches nothing is marked colour-unresolved, which routes it to the pixel-sampling fallback the spec requires. This correlation is the least certain part of M1, so it gets its own validation task against every sample and fixture.

Advance accumulation inside a show operation is deliberately not modelled: only the state at the start of each show operation is needed, never the position of each glyph, which `getTextContent` already provides.

### D6. Merging in Display space, with Page-space output
Fragments are grouped by baseline in **Display Coordinates**, so a `/Rotate 90` page merges along the visual line rather than the Page-space one, then sorted by display x. Two neighbours merge when: baselines differ by less than 0.2 × font size; font name, size (within 0.01), colour, rendering mode and horizontal scaling are equal; and the gap is at most 0.25 × font size. A space is inserted when the gap is at least 0.08 × font size and neither side already has whitespace. Geometry is converted back to Page Space for storage, as `CLAUDE.md` requires. The merge is a pure function over a `Fragment[]`, so every threshold is unit-testable without PDF.js.

Reading order falls out of the same display-space sort: group into visual rows by baseline, order rows top-to-bottom, order within a row left-to-right.

### D7. Locked detection
A fragment is locked when its text matrix, **after removing the page rotation**, has a non-zero skew (`b` or `c` beyond 1e-6) — this distinguishes a watermark rotated on the page from ordinary text on a rotated page, which the spec requires — or when the font is Type 3 or vertical. Locked fragments never merge with others, and carry a reason code that the UI maps to wording.

### D8. Object identity
`objectId = "<pageIndex>:<sequence>"` where sequence is the index in reading order. Rejected alternatives: a hash of the text (duplicate lines collide; editing in M2 would change identity), and a random id (not stable across re-extraction, breaking the spec's identity requirement). Because the read model is derived from the immutable original, reading order is deterministic, and M2's operations reference these ids without ambiguity.

### D9. Background sampling from a dedicated page raster
Sampling reads a ring 2–4 pt wide outside each line's box. It uses its own off-screen render of the page at scale 1, not the viewer's canvas, so that results do not change with zoom, no second sample is needed after a zoom, and the viewer's render path is untouched. One extra page render is the cost. The sampler runs after the visible page has rendered, in an idle callback, and reports results by updating the page model; the spec explicitly allows lines to be usable with their background still pending.

Uniformity: the ring's pixels are quantised into buckets; a ring whose dominant bucket holds less than 90% of samples is non-uniform. Both the dominant colour and the ratio are stored, so M2 can decide about masks and the UI can warn now.

### D10. Overlay rendering
One absolutely positioned container inside the existing `PDFViewer` `children` slot, holding one `<button>` per Text Line positioned with `pageRectToDisplay` × zoom. Buttons, not divs, so keyboard operation, focus and screen-reader announcement come from the platform rather than from hand-written ARIA. Pointer-events are off on the container and on for the boxes, so clicks on empty page space still reach the viewer and clear the selection. At the top zoom a page can hold a few thousand boxes; if profiling shows this is slow, the fallback is to render only boxes intersecting the scrolled viewport, which the component's props already allow.

### D11. State
The store gains two slices: `pageModel` (status per `(documentId, pageIndex)`: `idle | extracting | ready | failed`, plus the lines) and `selection` (`objectId | null`). Extracted models are cached in a module-level map beside the document registry rather than in the store, because they contain large arrays and non-serialisable byte buffers; the store holds ids and status only, matching the M0 decision that keeps PDF.js handles out of it.

### D12. Samples gain the new cases
`academic-paper` embeds a subset font (Liberation Sans from `pdfjs-dist/standard_fonts`, OFL, already in the tree) via `@pdf-lib/fontkit`, and draws one line as several fragments with no spaces by positioning words individually. `tech-spec` gains a rotated watermark. `invoice` already has wide-gap rows and coloured text; its existing tinted header covers the non-uniform-background case only partly, so a line is drawn over the embedded image as well. Determinism must hold, so subsetting must produce identical bytes across runs — verified by the existing byte-equality test.

This makes `@pdf-lib/fontkit` a **dev-time** dependency of the sample generator. The sample generator already runs in the browser, so it ships in the lazy sample chunk; its weight is noted as a trade-off below.

## Risks / Trade-offs

- [Item-to-span correlation (D5) mismatches on unusual producers, giving wrong colours] → Position matching is exact for the common case; failures degrade to pixel sampling, which the spec allows. A dedicated task validates every sample and fixture, and the fallback path is tested by forcing a mismatch.
- [`@pdf-lib/fontkit` enters the bundle through the sample generator (D12), roughly 300 KB] → It lands in the lazily loaded samples chunk, not the initial load, and M5 needs it anyway. If the size is unacceptable, the alternative is to commit one pre-subset font file as bytes, as the sample logo already is.
- [Thresholds in D6 are tuned against generated samples, not real-world PDFs] → They are isolated pure constants with unit tests per threshold; a task validates them against the sample suite, and they can be tuned without touching call sites.
- [pdf-lib and PDF.js each hold a parse of the same document] → Measured at 13 ms and lazily created; released with the document. Memory is the real cost on very large files, so creation is deferred to first extraction rather than document open.
- [The extra page render for sampling (D9) costs time on large pages] → It runs at scale 1 in an idle callback after the visible render, and its results are not needed for any M1 interaction.
- [A page with thousands of Text Lines makes the overlay and list heavy] → The list virtualises above a threshold; the overlay has a viewport-culling fallback (D10). A task measures the worst sample.

## Migration Plan

Additive: no existing requirement changes, no stored data exists yet, and no public interface is replaced. `PDFViewer` gains children it already accepts. If the overlay or sidebar must be withdrawn, removing them leaves M0 behaviour intact, which an existing E2E run proves.

## Open Questions

- Whether the 0.25 em merge gap and the 0.08 em space gap need per-document tuning. They are deliberately single constants for now; real-world PDFs in M6's QA pass will tell. This changes no spec: the behaviour described stays the same, only the numbers could move.
