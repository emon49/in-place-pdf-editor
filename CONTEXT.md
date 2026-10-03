# Domain Glossary

Shared language for the PDF In-Place Editor. Use these terms in code, specs (OpenSpec), PRs and UI copy. When a term changes, update it here first. Decisions behind the terms live in `docs/adr/`.

## Documents and objects

| Term | Meaning |
|---|---|
| **Original Document** | The PDF bytes as loaded. Immutable; never modified, only read. |
| **Text Run** | A raw text item as returned by PDF.js `getTextContent()`. An extraction input, never shown to users as an editable unit. |
| **Text Line** | The editable text unit: adjacent Text Runs on the same baseline with matching font, size and color, merged into one object. See ADR-0002. |
| **Image Object** | A bitmap drawn on a page (`paintImageXObject` / `paintInlineImageXObject`) with its bounding box. |
| **Added Text** | A Text Line created by the user on empty space (`TEXT_ADD`). Has no original position and needs no Mask. |
| **Page Object** | Any selectable object: a Text Line, an Added Text or an Image Object. Identified by a stable `objectId`. |
| **Locked Object** | A Page Object shown but not editable in v1 (e.g. rotated or skewed text). Displays a tooltip explaining why. |

## Edits and history

| Term | Meaning |
|---|---|
| **Edit Operation** | An immutable record of one user intent: `TEXT_REPLACE`, `TEXT_STYLE_CHANGE`, `TEXT_ADD`, `OBJECT_MOVE`, `OBJECT_RESIZE`, `OBJECT_DELETE`, `IMAGE_REPLACE`, `REVERT`. |
| **Operation Log** | The append-only, ordered list of Edit Operations. The single source of truth for edits; undo/redo moves a cursor over it. See ADR-0003. |
| **Gesture** | One complete user action that produces exactly one Edit Operation (one drag, one editor commit, one input committed on blur/Enter). Intermediate states (live drag) are transient UI state, not operations. |
| **Revert** | A `REVERT` operation appended to the log that cancels a specific earlier operation. Reverting never deletes history and can itself be undone. |
| **Revert to Original** | Restores a Page Object to its Original Document state; recorded as a `REVERT` of all that object's effective operations. |
| **Preview Document** | Derived state: `apply(Operation Log up to cursor, Original Document)`. Never stored, always recomputed. |
| **Session** | The Original Document bytes plus the Operation Log, autosaved to IndexedDB on the user's device. See ADR-0005. |

## Rendering and export

| Term | Meaning |
|---|---|
| **Mask** | A solid rectangle that hides an object's original appearance. Filled with the **Sampled Background** color, not always white. Previously called "whiteout". Not redaction. See ADR-0004. |
| **Sampled Background** | The dominant color of rendered pixels in a ring just outside an object's box, used as the Mask fill. |
| **Position A / Position B** | A = where an object originally was (masked). B = where it now renders. "Dual-location masking" means both are handled in preview and export. |
| **Patch** | The re-rendered appearance of an edited, moved or added object at Position B (Layer 1). |
| **Bundled Font** | One of the open-licence fonts shipped with the app (Liberation Sans, Liberation Serif, Liberation Mono × Regular/Bold/Italic/Bold-Italic). Used for every Patch in both preview and export. See ADR-0001. |
| **Font Class** | `sans` / `serif` / `mono`: the category an Original Font is mapped to in order to choose a Bundled Font. |
| **Original Font** | The font name detected in the PDF (subset prefix stripped). Shown to the user for information; not used to render Patches. |
| **Glyph Coverage** | The set of characters the Bundled Fonts can draw (Latin, Latin Extended, Greek, Cyrillic). Characters outside it block commit with an inline warning. |
| **Fit Mode** | How a replacement image fills its box: `contain` (default), `cover`, `fill`. |

## Coordinates

| Term | Meaning |
|---|---|
| **Page Space** | PDF user space: points, origin bottom-left. All stored geometry uses this. |
| **Display Coordinates** | What users see and type in the Properties Panel: points, origin **top-left** of the (rotated) page as displayed. |
| **Screen Space** | CSS/canvas pixels after zoom, `devicePixelRatio`, rotation and CropBox offset. Only computed at the render boundary by a single helper. |
| **Safe Area** | The page inset by 10 pt on every side. A Page Object's whole bounding box is clamped to stay inside it. |
| **Wrap Margin** | `pageWidth − 40 pt` (in display orientation). Text that would cross it wraps onto a new line below. |
