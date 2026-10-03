# ADR-0001: Bundled metric-compatible fonts for all edited text

- **Status:** Accepted (2026-10-03)
- **Requirements:** TY-5, TY-6, TY-8, EX-6

## Context

pdf-lib can only draw Standard 14 fonts unless a font is embedded. Fonts embedded in the source PDF are usually subsets, so they lack glyphs the user may type, and their licences may forbid re-embedding. The original spec previewed edited text with the PDF's own font (`loadedName`) but exported with Standard 14, so preview and export would diverge.

## Decision

- Ship three OFL-licensed families with the app: **Liberation Sans**, **Liberation Serif**, **Liberation Mono** (metric-compatible with Arial/Helvetica, Times, Courier), each in Regular, Bold, Italic, Bold-Italic.
- Every Patch (edited, moved, styled or added text) renders with a Bundled Font in **both** preview (`@font-face` from the same files) and export (`@pdf-lib/fontkit`, subset on embed).
- The Original Font is detected (subset prefix stripped), classified into a Font Class (sans/serif/mono) plus bold/italic, and shown to the user. `loadedName` is used for detection and display only, not for rendering Patches.
- Unedited text is never re-rendered; it stays in the PDF.js canvas and the exported page content.
- When the Original Font is not one of the metric-compatible originals (e.g. Garamond → Liberation Serif), show an "Exported as Serif" note in the Properties Panel.

## Consequences

- Preview equals export for edited text, which is the core WYSIWYG promise.
- Edited text may look slightly different from surrounding original text when the source uses a non-standard family. This is accepted and made visible.
- Adds the `@pdf-lib/fontkit` dependency and ~1–2 MB of font assets (cached by the PWA service worker).
- Glyph Coverage is defined by these fonts (Latin, Latin Extended, Greek, Cyrillic); see PRD TY-11.
