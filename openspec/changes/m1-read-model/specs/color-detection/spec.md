# Spec Delta

## Purpose

Determines the colour a Text Line is drawn in and the colour and uniformity of the page behind it, so edited text can match its surroundings and masks can blend in.

## ADDED Requirements

### Requirement: Fill colour from the content stream
A Text Line's colour SHALL be read from the fill colour in effect in the page's content stream when it was drawn, covering grey, RGB and CMYK colour operators.

#### Scenario: Red text
- **WHEN** a line is drawn after the fill colour is set to RGB (0.8, 0.1, 0.1)
- **THEN** the Text Line's colour is reported as #CC1A1A

#### Scenario: Greyscale text
- **WHEN** a line is drawn after the fill colour is set to grey 0
- **THEN** the Text Line's colour is reported as #000000

#### Scenario: Colour applies until changed
- **WHEN** one fill colour is set and three lines are drawn before it changes
- **THEN** all three Text Lines report that colour

### Requirement: Pixel sampling only as a fallback
When the fill colour cannot be resolved from the content stream — for example a pattern or an unsupported colour space — the system SHALL sample the rendered pixels of the line's glyphs instead, and mark the colour as sampled rather than exact.

#### Scenario: Pattern-filled text
- **WHEN** a line is drawn with a pattern fill
- **THEN** its colour is a sampled approximation and is marked as sampled

#### Scenario: Exact colours are not sampled
- **WHEN** a line's fill colour is a plain RGB value
- **THEN** the colour is marked exact and no pixel sampling is performed for it

### Requirement: Sampled background colour
For each Text Line the system SHALL determine the dominant colour of the rendered page in a ring just outside the line's bounding box, and report it as that line's background colour.

#### Scenario: Text on a tinted table header
- **WHEN** a Text Line sits inside a table header filled with a light blue tint
- **THEN** its background colour is reported as that tint, not white

#### Scenario: Text on a white page
- **WHEN** a Text Line sits on an unfilled area of the page
- **THEN** its background colour is reported as white

### Requirement: Background uniformity
The system SHALL report whether the ring sampled behind a Text Line is uniform. A background that varies beyond a small tolerance — an image, a gradient or a pattern — SHALL be reported as non-uniform while still reporting its dominant colour.

#### Scenario: Text over a photograph
- **WHEN** a Text Line is drawn over a photographic image
- **THEN** its background is reported as non-uniform

#### Scenario: Text over a flat fill
- **WHEN** a Text Line is drawn over a single flat colour
- **THEN** its background is reported as uniform

### Requirement: Sampling stays off the interaction path
Background sampling SHALL run after the page is rendered and SHALL NOT delay page rendering, selection or navigation. Until a line's background has been sampled, the line SHALL be usable and reported with its background pending.

#### Scenario: Sampling does not delay the page
- **WHEN** a text-heavy page is opened
- **THEN** the page renders and can be navigated before background sampling has finished

#### Scenario: Results arrive without a re-render
- **WHEN** background sampling finishes for the active page
- **THEN** the lines' background information becomes available without the page being rendered again
