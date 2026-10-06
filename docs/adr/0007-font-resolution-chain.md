# ADR-0007: Font Resolution Chain — reuse the original font first

- **Status:** Accepted (2026-10-03). Supersedes ADR-0001. Amends ADR-0005.
- **Requirements:** TY-5, TY-6, TY-8, TY-9, TY-11, TY-12, TY-13, TY-14, TE-9, EX-6

## Context

The product's main purpose is that edited text keeps **every** property of the text that was there before: family, size, height, spacing, scaling, color, weight and style. ADR-0001 kept all metrics but always changed the family to a Liberation font, so most edits looked different from the surrounding text.

Options considered:

- **Download fonts by name (Google Fonts etc.).** Helps only for open families. Many common PDF fonts are commercial (Arial, Helvetica, Times New Roman, Calibri, Cambria, Garamond variants) and only have look-alikes. A runtime download needs the network and reveals the font name, which is a hint about the document.
- **Reuse the font already embedded in the PDF.** This is the exact original. It works when the font contains every character the user typed (embedded fonts are usually subsets) and its licence flags allow editing. Typical typo or number fixes reuse characters already in the document, so this case succeeds often.

## Decision

For each edited or added Text Line, resolve one **Resolved Font** by walking the **Font Resolution Chain** in order and taking the first font that (a) can draw every character of the line's new text and (b) is allowed:

1. **Embedded Original Font.** The font program already in the PDF.
   - Eligible when the font is embedded (or is a non-embedded Standard 14 reference), every character maps to a code the font's encoding/CMap and ToUnicode can produce, and that code has a glyph in the (possibly subset) font program.
   - Licence: read the OS/2 `fsType`. Allowed when it is installable (0) or editable (bit 0x0008). Not allowed when it is only Restricted (0x0002) or Preview & Print (0x0004). A font without an OS/2 table (e.g. Type 1/CFF) is treated as allowed.
   - Type 3 fonts and vertical writing modes are excluded in v1.
   - Export **references the existing font resource** on the page and writes character codes; nothing is re-embedded. Preview uses the font PDF.js already loaded (`fontObj.loadedName`).
2. **Exact family from open fonts.** Match the normalized Original Font family (subset prefix, style suffixes and PostScript suffixes stripped; alias table, e.g. `TimesNewRomanPSMT` → `Times New Roman`) against:
   - a. The **Font Catalog**: a curated manifest of OFL/Apache families **self-hosted on our own site** (e.g. Roboto, Open Sans, Lato, Montserrat, Source Sans/Serif, Noto Sans/Serif, Merriweather, EB Garamond, PT Sans/Serif, Inter, Fira Sans/Mono). Font files are loaded lazily and cached by the service worker. No third-party request.
   - b. **Google Fonts on demand, with consent.** An offline index of Google Fonts family names ships with the app, so the lookup leaks nothing. On a match outside the catalog, prompt: *"This document uses 'Lora'. Download it from Google Fonts? Only the font name is sent."* The options are Download, Not now, and Always allow Google Fonts (stored in local settings). Downloaded files are cached on the device (Cache Storage) for reuse and session restore. Offline or declined → continue the chain.
3. **Metric-compatible substitute.** A self-hosted font with the same character widths as the original (subject to licence review), e.g. Arial/Helvetica → Liberation Sans, Times → Liberation Serif, Courier → Liberation Mono, Calibri → Carlito, Cambria → Caladea, Georgia → Gelasio, Segoe UI → Selawik, Palatino/Book Antiqua → TeX Gyre Pagella, Century Schoolbook → TeX Gyre Schola, Bookman → TeX Gyre Bonum.
4. **Font Class fallback.** Liberation Sans, Serif or Mono, chosen by Font Class plus bold/italic. Always available, offline, and defines the guaranteed Glyph Coverage.

Rules:

- **Whole line, one face.** If the original font lacks any typed character, the whole line moves to the next font in the chain that covers all of it; fonts are never mixed within a line. The Properties Panel explains the result, e.g. *"Original font lacks 'é' → using Carlito"*.
- **Preview equals export.** The Resolved Font is computed once in `font-resolver.ts`. The viewer and `pdf-exporter.ts` both use it: tier 1 via the PDF.js-loaded face and the existing PDF resource; tiers 2–4 via `@font-face` and `@pdf-lib/fontkit` (subset on embed) from the same bytes.
- **Resolution is derived, not stored.** It is recomputed from the operation's text, the Original Font and the fonts available on this device. If a previously downloaded font is missing on restore, fall back down the chain and warn.
- **All other metrics are always preserved** regardless of tier: size (vertical matrix scale), horizontal scaling (`Tz`), character and word spacing (`Tc`/`Tw`), line height, text rise (`Ts`), rendering mode (fill/stroke), and fill color.
- The user can still override the family (TY-9). The choices are the Original Font (when tier 1 is eligible), the matched family, the catalog families, and Liberation.

## Consequences

- Most real-world edits (fixing a typo, a date or an amount) export in the **exact original font**.
- Writing text with the original font's encoding (reverse ToUnicode/CMap lookup, CID fonts, custom encodings) is the hardest engineering piece and needs a corpus-based test suite.
- Glyph checks need the font program parsed client-side (fontkit can read most embedded TrueType/CFF programs; PDF.js exposes the font data).
- Asset size grows (the Font Catalog plus substitutes, roughly 10–20 MB on the server). Only the families a document needs are downloaded and cached, never the whole catalog up front.
- The no-third-party-requests promise gains one exception, which is opt-in and sends only a font family name (see the ADR-0005 amendment).
- Risk: fontkit/pdf-lib handling of WOFF2 from Google Fonts must be verified. If unsupported, convert to TTF client-side before embedding.
