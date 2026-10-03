# coordinate-mapping Specification

## Purpose

Defines the single, exact conversion between Page Space (stored geometry), Display Coordinates (what users see and type) and Screen Space (pixels), plus the placement limits every editing feature relies on.

## Requirements

### Requirement: Page Space is the stored coordinate system
All stored geometry SHALL be in Page Space: PDF user-space points with the origin at the bottom-left, as defined by the page's content. Conversion to any other space SHALL happen only through this capability.

#### Scenario: Unrotated, uncropped page
- **WHEN** a 612×792 pt page with MediaBox = CropBox = [0 0 612 792] and `/Rotate 0` contains a point at Page Space (100, 700)
- **THEN** its Display Coordinates are (100, 92)

### Requirement: Display Coordinates
Display Coordinates SHALL be in points with the origin at the top-left corner of the visible page (the CropBox) as displayed after rotation. X grows rightward and Y grows downward. The displayed page size is the CropBox size, with width and height swapped for `/Rotate` 90 and 270.

#### Scenario: CropBox offset
- **WHEN** a page has CropBox [36 36 576 756] and `/Rotate 0`
- **THEN** Page Space (36, 756) maps to Display (0, 0) and the displayed size is 540×720 pt

#### Scenario: Rotate 90
- **WHEN** a page has CropBox [0 0 612 792] and `/Rotate 90`
- **THEN** the displayed size is 792×612 pt, Page Space (0, 0) maps to Display (0, 0), and Page Space (100, 700) maps to Display (700, 100)

#### Scenario: Rotate 180
- **WHEN** a page has CropBox [0 0 612 792] and `/Rotate 180`
- **THEN** Page Space (100, 700) maps to Display (512, 700)

#### Scenario: Rotate 270
- **WHEN** a page has CropBox [0 0 612 792] and `/Rotate 270`
- **THEN** the displayed size is 792×612 pt and Page Space (100, 700) maps to Display (92, 512)

#### Scenario: Non-normalized rotation
- **WHEN** a page declares `/Rotate -90` or `/Rotate 450`
- **THEN** it is treated as `/Rotate 270` and `/Rotate 90` respectively

### Requirement: Screen Space
Screen Space SHALL be CSS pixels relative to the top-left of the page element, equal to Display Coordinates × zoom. Canvas backing pixels SHALL equal Screen Space × the effective render scale (normally `devicePixelRatio`).

#### Scenario: Zoomed point
- **WHEN** zoom is 150% and a point is at Display (100, 92)
- **THEN** it is at Screen (150, 138) CSS pixels, and at canvas pixel (300, 276) when `devicePixelRatio` is 2

### Requirement: Lossless round trips
Converting a point or rectangle from any space to another and back SHALL return the original within 1e-6 points, for every rotation, CropBox and zoom in the supported range.

#### Scenario: Round trip under rotation and zoom
- **WHEN** any Page Space point on a page with `/Rotate 270`, a CropBox offset and zoom 37% is converted to Screen Space and back
- **THEN** the result equals the original within 1e-6 points

### Requirement: Rectangle conversion
Converting a rectangle SHALL yield the axis-aligned rectangle covering the converted corners, with non-negative width and height, in the target space's own orientation.

#### Scenario: Rectangle on a rotated page
- **WHEN** the Page Space rectangle x=100, y=600, width=200, height=50 is converted to Display Coordinates on a [0 0 612 792] page with `/Rotate 90`
- **THEN** the result is x=600, y=100, width=50, height=200

### Requirement: Safe Area clamping
Placing an object SHALL keep its entire bounding box inside the Safe Area: the displayed page inset by 10 pt on every side (MV-4). Clamping works in Display Coordinates and moves the box as little as possible. A box larger than the Safe Area on an axis SHALL be pinned to the Safe Area's top or left edge on that axis.

#### Scenario: Box past the left edge
- **WHEN** a 100×20 pt box is placed at Display x = −5, y = 300 on a 612×792 pt page
- **THEN** it is clamped to x = 10, y = 300

#### Scenario: Box past the bottom-right corner
- **WHEN** a 100×20 pt box is placed at Display x = 600, y = 790 on a 612×792 pt page
- **THEN** it is clamped to x = 502, y = 762

#### Scenario: Box wider than the Safe Area
- **WHEN** a 600×20 pt box is placed at Display x = 50 on a 612 pt wide page
- **THEN** it is placed at x = 10

### Requirement: Wrap Margin
The Wrap Margin SHALL be the displayed page width minus 40 pt, measured from the displayed page's left edge, so it follows the page's rotation.

#### Scenario: Wrap Margin on a rotated page
- **WHEN** the page is [0 0 612 792] with `/Rotate 90`
- **THEN** the Wrap Margin is at Display x = 752
