# Spec Delta

## Purpose

Resolves one Resolved Font per edited or added Text Line by walking the Font Resolution Chain — embedded original, Font Catalog, consented Google Fonts, metric-compatible substitute, Liberation fallback — and encodes characters for original-font reuse.

## ADDED Requirements

### Requirement: Font Resolution Chain order
For each edited or added Text Line, the system SHALL resolve one Resolved Font by walking the chain in order: (1) Embedded Original Font, (2) exact family from the Font Catalog or consented Google Fonts, (3) metric-compatible substitute, (4) Liberation fallback by Font Class. The first font that can draw every character and is licence-permitted SHALL win.

#### Scenario: Original font covers the edit
- **WHEN** the user changes "100" to "200" in a line whose embedded font covers digits
- **THEN** the Resolved Font is tier 1 (the embedded original)

#### Scenario: Original font lacks a character
- **WHEN** the user adds "é" to a line whose embedded subset does not include "é"
- **THEN** the chain falls to the next tier that covers "é" and all other characters in the line

#### Scenario: Restricted fsType prevents tier 1
- **WHEN** the embedded font's fsType is Restricted (0x0002)
- **THEN** tier 1 is skipped and the chain continues from tier 2

### Requirement: Whole line, one face
If the Embedded Original Font lacks any typed character, the whole line SHALL move to the next font in the chain that covers all characters. Fonts SHALL never be mixed within a single line.

#### Scenario: One missing character moves the whole line
- **WHEN** the user types "café" and the original font lacks "é"
- **THEN** the entire word "café" renders in the next chain font, not a mix of original and substitute

### Requirement: Tier explanation in the UI
The system SHALL show which font was resolved and why. When the Resolved Font is not the original, the explanation SHALL name the tier and the reason.

#### Scenario: Non-original font explanation
- **WHEN** the resolved font is Carlito (tier 3, substitute for Calibri)
- **THEN** the UI shows something like "Original font lacks 'é' → using Carlito"

#### Scenario: Original font explanation
- **WHEN** the resolved font is the embedded original
- **THEN** the UI shows "Original font"

### Requirement: Font Catalog with lazy loading
The system SHALL ship a manifest of curated open-licence font families self-hosted on the application's own site. Font files SHALL be loaded lazily only when a document needs them and cached by the service worker for offline reuse.

#### Scenario: Catalog font loaded on demand
- **WHEN** a document uses Roboto and the user edits a line
- **THEN** Roboto is fetched from the self-hosted catalog (not Google Fonts), cached, and used for the edit

#### Scenario: Cached font used offline
- **WHEN** Roboto was previously cached and the user is offline
- **THEN** Roboto is used from the cache without a network request

### Requirement: Google Fonts consent download
The system SHALL carry an offline index of Google Fonts family names. When a match outside the catalog is found, the system SHALL prompt the user with the family name and offer Download, Not now, and Always allow. Downloaded fonts SHALL be cached on the device. The download SHALL be skipped when offline or declined.

#### Scenario: Consent prompt for Google Font
- **WHEN** the document uses "Lora" (not in the catalog) and the user edits a line
- **THEN** a prompt says "This document uses 'Lora'. Download from Google Fonts? Only the font name is sent."

#### Scenario: Declined download continues the chain
- **WHEN** the user declines the Google Fonts download
- **THEN** the chain continues to tier 3 or 4 without making a network request

#### Scenario: Always allow skips future prompts
- **WHEN** the user chooses "Always allow"
- **THEN** future Google Fonts downloads proceed without prompting

### Requirement: Metric-compatible substitutes
The system SHALL maintain a table mapping common commercial font families to open metric-compatible substitutes. When the original family matches an entry and the substitute covers all characters, that substitute SHALL be used.

#### Scenario: Arial resolved to Liberation Sans
- **WHEN** the document uses Arial (not embedded) and the user edits a line
- **THEN** Liberation Sans is used as the metric-compatible substitute

### Requirement: Liberation fallback always available
Liberation Sans, Serif and Mono in regular, bold, italic and bold-italic SHALL always be available offline, chosen by Font Class. They define the guaranteed Glyph Coverage (Latin, Latin Extended, Greek, Cyrillic).

#### Scenario: Unknown font falls to Liberation
- **WHEN** the document uses an uncommon font with no catalog match and no substitute
- **THEN** the matching Liberation family (by Font Class) is used

### Requirement: Original-font encoding for tier 1
When the Resolved Font is the Embedded Original (tier 1), the system SHALL encode characters using the font's own encoding — reverse ToUnicode/CMap mapping for simple and composite fonts — to write character codes that reference the existing font resource without re-embedding.

#### Scenario: Tier 1 uses original encoding
- **WHEN** a TEXT_REPLACE uses the embedded original font
- **THEN** the character codes are in the font's own encoding, not Unicode, and the existing font resource is referenced

#### Scenario: Tiers 2–4 use Unicode encoding
- **WHEN** a TEXT_REPLACE uses a catalog or fallback font
- **THEN** the font is embedded via fontkit with Unicode encoding

### Requirement: Preview and export use the same Resolved Font
The Resolved Font SHALL be computed once in the resolution module. Both the viewer preview and the export SHALL use the same result: tier 1 via the PDF.js-loaded face and the existing font resource; tiers 2–4 via @font-face and fontkit from the same bytes.

#### Scenario: Font consistency across preview and export
- **WHEN** a line is edited and resolved to Carlito
- **THEN** both the on-screen preview and the exported PDF use Carlito with identical metrics

### Requirement: All metrics preserved regardless of tier
Regardless of which tier the Resolved Font comes from, the system SHALL preserve the original line's font size, horizontal scaling, character spacing, word spacing, line height, text rise, rendering mode and color.

#### Scenario: Substitute preserves size and spacing
- **WHEN** a line at 14 pt with 110% horizontal scaling is resolved to a substitute
- **THEN** the substitute renders at 14 pt with 110% horizontal scaling

### Requirement: User font family override
The user SHALL be able to override the resolved font family via the UI. The choices SHALL include the Original Font (when tier 1 is eligible), any matched family, Font Catalog families, and Liberation. Overriding SHALL create a TEXT_STYLE_CHANGE operation.

#### Scenario: Overriding to a catalog font
- **WHEN** the user selects "Inter" from the font family selector
- **THEN** a TEXT_STYLE_CHANGE is created and the line renders in Inter
