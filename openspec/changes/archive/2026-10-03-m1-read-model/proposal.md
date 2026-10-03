# Proposal

## Why

M0 renders pages but the app has no idea what is *on* them. Every editing milestone needs the same read model first: the editable unit (the merged Text Line, ADR-0002), what font and colour it uses, what sits behind it, and a way to point at it. M1 builds that model and makes it visible and selectable, without changing a single byte of the document.

Doing the font work completely here matters: M2's Font Resolution Chain (ADR-0007) can only reuse a document's own font if it knows whether the font is *really* embedded, whether its licence allows editing, how it encodes characters, and which characters it can draw. A probe during planning confirmed PDF.js alone cannot answer the first question — it silently substitutes its own font files for non-embedded Standard 14 fonts and then reports them as present — so M1 reads the PDF's own font dictionary as well.

## What Changes

- **Text Lines (ADR-0002).** Extract the text of the active page and merge PDF.js fragments into Text Lines: same baseline, same font, size, colour and rendering mode, and separated by less than about a quarter of the font size. Fragments further apart stay separate objects, so an invoice row stays four editable cells rather than one string. Each line carries its bounding box in Page Space, its baseline, and reading order.
- **Locked Objects.** Rotated or skewed runs, vertical writing and Type 3 fonts are extracted and shown, but marked locked with the reason (VW-8).
- **Font detection.** For every Text Line: normalized family (subset prefix and PostScript/style suffixes stripped), Font Class (`sans`/`serif`/`mono`), weight and italic, size from the vertical matrix scale (TY-1), horizontal scaling, character and word spacing, text rise and line height. Plus the facts M2 needs: whether the document truly embeds the font program, the program's bytes and type, its `fsType` licence flag, its encoding (simple or CID), and the set of characters it can draw.
- **Colour detection.** Fill colour read from the content stream's operator list, with pixel sampling only as a fallback (TY-3, ADR-0004).
- **Background sampling.** The dominant colour of a ring just outside each Text Line, plus whether that ring is uniform. Non-uniform backgrounds get a "mask may be visible" warning in the UI (VW-9).
- **Selection overlay (Layer 2).** Clickable boxes over every Text Line, aligned at any zoom and page rotation, with hover and selection states (VW-2, VW-3), keyboard selection, and a tooltip explaining why a locked object cannot be edited.
- **Left sidebar with a Text Objects tab.** A collapsible sidebar shell, carrying one tab in M1: a scrollable list of the active page's Text Lines showing text, font, size and colour. Selection is shared with the overlay in both directions. M2 and M4 add tabs without redoing the layout.
- **Samples gain an embedded subset font, a rotated text run and a multi-fragment line**, so extraction, locking and merging have real cases to test. (Out of scope: search within the tab, which is M6.)
- Out of scope for M1: the Operation Log, any editing, masks, patches, the Font Resolution Chain itself, the Properties Panel (M3) and image extraction (M4). Nothing here mutates the document.

## Capabilities

### New Capabilities
- `text-extraction`: Turning a PDF page's raw text fragments into the editor's Text Lines — merging, geometry, reading order, locked objects, and how extraction is scheduled and cached.
- `font-detection`: Identifying the font a Text Line uses — normalized family, class, weight and style, metrics, and the embedding, licence, encoding and character-coverage facts later milestones need to reuse or substitute it.
- `color-detection`: Determining a Text Line's fill colour and the colour and uniformity of the background behind it.
- `object-selection`: Pointing at a page object — the on-page overlay boxes, hover and selection states, keyboard selection, and the locked-object explanation.
- `document-sidebar`: The collapsible left inspector beside the page, and the Text Objects tab listing what was found on the active page.

### Modified Capabilities
- `sample-documents`: the edge cases the built-in samples must cover now also include an embedded subset font, a rotated text run and a line split into several fragments.

## Impact

- **New code:** `src/lib/pdf-text-extractor.ts` (fragment merging), `src/lib/text-geometry.ts`, `src/lib/font-style-extractor.ts` (matrix → size, spacing, scaling), `src/lib/font-resolver.ts` (family normalization and class — the chain itself is M2), `src/lib/font-descriptor.ts` (PDF font dictionary via pdf-lib: embedding, `fsType`, encoding, coverage), `src/lib/pdf-color-extractor.ts` (operator-list fill colour and background sampling), `src/lib/page-model.ts` (per-page cache), `src/components/TextOverlay.tsx`, `src/components/Sidebar.tsx`, `src/components/TextObjectsTab.tsx`, plus store slices for the page model and selection.
- **Changed code:** the document registry gains a lazily-loaded pdf-lib handle on the same original bytes, used to read font dictionaries (measured at 13 ms for a 5 MB, 10-page document, and needed again for export in M5); `src/App.tsx` gains the sidebar and mounts the overlay inside the existing `PDFViewer` children slot; `src/lib/samples/*` gain the new edge cases.
- **Dependencies:** none. A probe showed `@pdf-lib/fontkit` throws on the subset fonts this feature must handle, because subsetters strip the `name`, `cmap` and `OS/2` tables; a small internal reader for the two table facts we need is both smaller and more robust. fontkit is still expected in M5, where fonts are embedded rather than read.
- **Unchanged:** `page-viewer`, `document-loading`, `app-shell` and `coordinate-mapping` keep their current requirements; the overlay reuses `coordinates.ts` rather than duplicating geometry.
- **Requirement IDs covered:** VW-2, VW-3, VW-8, VW-9, TY-1, TY-2, TY-3, TY-4, TY-5, TY-7, TY-11 (coverage data), TY-15 (detection half), UP-2 (extended samples), and the Text Objects tab from PRD §7.2.
