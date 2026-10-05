# Design

## Context

After M4, the app can edit text, move objects, replace and resize images, all held in memory. None of this reaches a file. `pdf-exporter.ts` does not exist. The text layout module (`text-layout.ts`) and font resolver (`font-resolver.ts`) do exist from M2. `coordinates.ts` converts between Page Space and screen. `image-replacement-engine.ts` provides fit-mode layout from M4. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** Produce a valid, downloadable PDF matching the preview; cover all M2–M4 operation types; share geometry with the viewer; tier 1 reference, tiers 2–4 fontkit embed.

**Non-Goals:** Page-level operations (add/remove pages); form fields, annotations, digital signatures; real redaction (masks are visual only); progress at sub-operation granularity.

## Decisions

### D1: pdf-exporter runs in a Web Worker

PDF serialization is CPU-intensive and blocks the UI for large files. The exporter runs in a dedicated Web Worker. The main thread sends the original bytes, the serialized Operation Log, the resolved font files, and the image blobs; the Worker sends back the output bytes and progress updates. Alternative: run on main thread — rejected because it freezes the UI for files > ~5 MB.

### D2: Tier-1 encoding — reverse the ToUnicode/CMap map already built in M2

`font-encoder.ts` already builds a Unicode → original-glyph-code map during the read phase. The exporter uses this map to convert the edited Unicode string to the bytes the original font resource expects, then writes a raw `Tj`/`TJ` operator. No re-embedding needed. Unknown characters are blocked at commit time (TE-9), so by export time the string is guaranteed drawable.

### D3: Masks are drawn as `pdf-lib` rectangles filled with the sampled color

Each mask is a `page.drawRectangle` call with `color: rgb(r, g, b)` from the stored `maskColor` string. They are drawn before the corresponding Patch or replacement image, so they appear behind the new content. `coverOriginalPosition` is called for every active MOVE, EDIT, STYLE_CHANGE, and DELETE operation.

### D4: Shared geometry via text-layout.ts output object

`text-layout.ts` returns a `TextLayout` object containing positioned `LayoutLine[]`. The exporter calls `text-layout.ts` with the same inputs as the viewer and iterates `LayoutLine[]` to place each `pdf-lib` text operator. The viewer already uses `LayoutLine[]` for the Patch layer. This is the "shared geometry" contract from EX-3.

### D5: ExportModal triggers the Worker, shows progress via postMessage

The modal opens a Worker, posts a `{type:'start'}` message with the payload, and listens for `{type:'progress', pct}` and `{type:'done', bytes}` messages. On `done`, it constructs a Blob URL and programmatically clicks a hidden `<a download>` element, then revokes the URL. The Worker is terminated after completion.

## Risks / Trade-offs

- [Risk] Tier-1 encoding fails for CID/Identity-H fonts → the drawability check in M2 blocks those characters at commit time; if they reach the exporter, fall back to tier 2 and log a warning rather than producing a corrupt PDF.
- [Risk] Very large image blobs inflate the Worker message payload → transfer the bytes as `Transferable` (`ArrayBuffer`) so no copy occurs; the main thread and Worker share ownership.
- [Risk] Fidelity gap between preview and export on unusual fonts → covered by the visual-regression test suite; failures become bug reports, not silently accepted.

## Migration Plan

Additive: no stored data changes. The Worker is lazy-loaded on first export.

## Open Questions

None.
