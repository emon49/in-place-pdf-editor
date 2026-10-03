# Tasks

## 1. Sample and fixture coverage (UP-2)

- [x] 1.1 Embed a subset font in the Academic Research Paper sample (Liberation Sans from `pdfjs-dist/standard_fonts` via `@pdf-lib/fontkit`, loaded in the lazy samples chunk); verify an integration test finds a page font whose descriptor carries a `FontFile2` and whose program omits the `name` table
- [x] 1.2 Draw one Academic Research Paper line as several fragments positioned word by word with no space characters; verify a test asserts the raw text content returns more than one fragment for that baseline
- [x] 1.3 Add a rotated watermark text run to the Technical Spec sample and a line over the Invoice's embedded image; verify tests assert a non-zero skew in the watermark's text matrix and that the image line's box overlaps the image's bounds
- [x] 1.4 Re-run the determinism and no-personal-data checks after the sample changes; verify `npm run test` still shows byte-identical output for all three samples and the fictional-content assertions pass

## 2. Page model plumbing

- [x] 2.1 Add a lazily created pdf-lib handle for the open document to the document registry, over a copy of the original bytes, released with the document; verify a unit test shows the handle is created only on first request, reused on the second, and that releasing the document releases it
- [x] 2.2 Add the page-model cache keyed by document id and page index with `idle | extracting | ready | failed` status, plus the `selection` store slice; verify unit tests cover caching, status transitions, and that replacing the document clears both cache and selection
- [x] 2.3 Wire extraction to run when a page becomes active, not before; verify a unit test with a stubbed extractor shows a 100-page document extracts only page 1, and that returning to page 1 does not extract it again

## 3. Text Lines: fragments, merging, order, identity

- [ ] 3.1 Implement fragment reading (`getOperatorList()` then `getTextContent({ disableNormalization: true })`) producing `Fragment[]` with text, text matrix, width, font name and page geometry; verify an integration test on the Invoice sample returns fragments with the expected matrices, and that a ligature survives unnormalised
- [ ] 3.2 Implement the pure merge function in display space (baseline tolerance 0.2 em, equal font/size/colour/render mode/scaling, gap at most 0.25 em); verify unit tests over synthetic fragments cover the sentence-in-three-fragments, table-cell and style-change scenarios from the spec
- [ ] 3.3 Implement space restoration (insert one space at a gap of at least 0.08 em unless whitespace is already present); verify unit tests cover the "Hello world" and kerned "AV" scenarios, including fragments that already end with a space
- [ ] 3.4 Implement Text Line geometry (baseline origin, glyph bounding box from ascent and descent, stored in Page Space with non-negative width and height); verify unit tests on a 12 pt line at (72, 700) and a property test that boxes never have negative extents
- [ ] 3.5 Implement locked detection (skew after removing page rotation, vertical writing, Type 3) with reason codes, and ensure locked fragments never merge; verify unit tests distinguish a rotated run on an unrotated page from horizontal text on a `/Rotate 90` page
- [ ] 3.6 Implement display-space reading order and `"<pageIndex>:<sequence>"` identity; verify unit tests cover ordering on a rotated page and an integration test shows identifiers are unchanged when a page is extracted twice
- [ ] 3.7 Contain extraction failures per page (status `failed`, page still rendered, other pages unaffected); verify a unit test with a throwing extractor asserts the status and that the next page extracts normally

## 4. Font detection (TY-1, TY-2, TY-4, TY-5, TY-7)

- [ ] 4.1 Implement font size from the vertical matrix scale, horizontal scaling, and line height from ascent and descent; verify unit tests include the compressed-matrix case (horizontal 6, vertical 12 reports 12 pt)
- [ ] 4.2 Implement family normalization (subset prefix, PostScript and style suffixes) and Font Class with weight and italic, preferring descriptor flags and falling back to name heuristics; verify unit tests cover `BWODTG+Times-Bold`, `TimesNewRomanPSMT`, `LiberationSans-Bold-2000`, a fixed-pitch descriptor and a descriptor-less bold name
- [ ] 4.3 Implement the font-dictionary reader over the pdf-lib handle (BaseFont, subtype, descriptor flags, italic angle, weight, encoding, simple versus composite, decoded `FontFile`/`FontFile2`/`FontFile3` bytes); verify an integration test reports the subset sample font as embedded and the Standard 14 sample font as not embedded
- [ ] 4.4 Implement the sfnt table reader for `OS/2` `fsType` and, when present, `cmap`; verify unit tests cover an installable flag, a preview-and-print flag, and a subset program with no `OS/2` table reported as permitting editing
- [ ] 4.5 Implement character coverage in the order ToUnicode, program `cmap`, standard encoding, unknown; verify an integration test shows the subset sample's coverage holds exactly the characters it draws and excludes one it does not
- [ ] 4.6 Make unreadable font facts degrade to unknown without losing family, size or style; verify a unit test with a truncated font program still reports the family and marks coverage and licence unknown

## 5. Colour detection (TY-3)

- [ ] 5.1 Implement the operator-list state walker producing `StyledSpan`s (graphics stack, text state, fill colour across grey, RGB, CMYK and pattern operators); verify unit tests over synthetic operator lists cover save/restore nesting and colour persisting across several show operations
- [ ] 5.2 Implement span-to-item correlation (exact start point and font, then nearest within half an em, then most recent in stream order) marking unmatched items colour-unresolved; verify an integration test correlates every text item in all three samples and a unit test forces a mismatch to confirm it is marked unresolved
- [ ] 5.3 Implement the pixel-sampling fallback for unresolved colours, marking the result sampled rather than exact; verify unit tests show exact colours are never sampled and that a forced-unresolved line yields a sampled colour
- [ ] 5.4 Report the resolved colour, character spacing, word spacing, rise and rendering mode on each Text Line; verify an integration test asserts the Invoice's coloured line reports its colour and that a line with no spacing operators reports the documented defaults

## 6. Background sampling (ADR-0004, VW-9)

- [ ] 6.1 Implement the dedicated scale-1 off-screen page render used for sampling; verify a unit test shows it is created once per page and is independent of the viewer's zoom
- [ ] 6.2 Implement ring sampling with a dominant colour and a uniformity ratio (non-uniform below 90% in the dominant bucket); verify unit tests over synthetic pixel data cover a flat fill, a tinted header and a photographic ring
- [ ] 6.3 Schedule sampling after the visible render in an idle callback, updating the page model without a re-render and leaving lines usable while pending; verify a test asserts lines are selectable before sampling completes and that no page re-render is triggered when results arrive

## 7. Selection overlay (VW-2, VW-3, VW-8, VW-9)

- [ ] 7.1 Implement `TextOverlay` inside the existing viewer children slot, one button per Text Line positioned through `coordinates.ts`, with pointer-events off on the container; verify component tests assert box positions at 100% and 250% zoom and on a `/Rotate 90` page
- [ ] 7.2 Implement hover and selection states with the selection ring and corner indicators, single selection, and clearing on click of empty space; verify component tests cover selecting, replacing a selection and clearing
- [ ] 7.3 Implement locked styling, the explanatory tooltip and selectable-but-locked behaviour; verify a component test asserts the rotated-text wording and that a locked line can still be selected
- [ ] 7.4 Implement keyboard selection (next and previous in reading order, Escape to clear, scroll into view) and the accessible name carrying the line's text and locked reason; verify component tests for stepping, Escape, and the announced name, and that `npm run lint` passes the accessibility rules
- [ ] 7.5 Clear the selection on page change and document change, and show the "mask may be visible" warning for a non-uniform background; verify component tests for both

## 8. Sidebar and Text Objects tab (PRD §7.2)

- [ ] 8.1 Implement the collapsible `Sidebar` shell with tab semantics, shown only when a document is open, hiding tabs that have no content; verify component tests cover collapse and reopen, keyboard tab navigation and the no-document case
- [ ] 8.2 Implement the Text Objects tab listing lines in reading order with text, family, size and colour swatch, locked markers, the empty-page message and the detection-in-progress state; verify component tests for each of those states
- [ ] 8.3 Wire two-way selection between list and overlay, scrolling the selected row into view, and virtualise the list above a threshold; verify component tests for both directions and a test with a thousand synthetic lines asserting only a bounded number of rows render
- [ ] 8.4 Confirm the viewer's fit modes still work at the narrower width and when the sidebar collapses; verify a component test asserts fit-to-width recomputes zoom when the sidebar is collapsed

## 9. End-to-end verification

- [ ] 9.1 E2E: open each sample, click text on the page and confirm the box, selection ring and matching sidebar row; verify Playwright tests pass against the production build
- [ ] 9.2 E2E: confirm boxes stay aligned after zooming and on the rotated page, and that the rotated watermark is locked with its explanation; verify tests pass and attach a screenshot of the overlay on the rotated page
- [ ] 9.3 E2E: keyboard-only selection (step through objects, Escape, scroll into view) and the sidebar tab; verify tests pass with no pointer interaction
- [ ] 9.4 Measure extraction and sampling on the 10-page 5 MB fixture and the heaviest sample; verify the first page stays within the 2 s budget from the page-viewer spec, report extraction time, and confirm controls respond while extraction runs
- [ ] 9.5 Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run test:e2e`; verify all pass and update `CLAUDE.md` only if the delivered module layout differs from what it documents
