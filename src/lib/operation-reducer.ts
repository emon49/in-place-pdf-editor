import type { ImageObject, TextLine } from '../types/page-model';
import { resolveFontSync } from './font-resolver';
import type {
  EditOperation,
  ImageReplaceOp,
  ObjectMoveOp,
  ObjectResizeOp,
  PreviewImage,
  PreviewLine,
  TextStyle,
} from '../types/operations';

/** Build a TextStyle from a TextLine's current properties. */
export function styleFromLine(line: TextLine): TextStyle {
  return {
    fontClass: line.fontClass,
    bold: line.bold,
    italic: line.italic,
    fontFamilyOverride: null,
    size: line.fontSize,
    color: line.color.hex,
    charSpacing: line.charSpacing,
    wordSpacing: line.wordSpacing,
    lineHeight: line.lineHeight,
    hScale: line.hScale,
    rise: line.rise,
    renderMode: line.renderMode,
  };
}

/**
 * Pure reducer: apply ops[0..cursor) to the given TextLine array and return
 * PreviewLine[]. Operations past the cursor are ignored.
 *
 * REVERT semantics: a REVERT op carrying `targetOpIds` marks those operation
 * ids as inactive. A REVERT that targets another REVERT re-activates the
 * original REVERT's targets (REVERT-of-REVERT). The cancelled set is built
 * with cascade logic so that cancelling a REVERT also un-cancels what that
 * REVERT had cancelled.
 */
export function applyOperations(
  lines: readonly TextLine[],
  ops: readonly EditOperation[],
  cursor: number,
): PreviewLine[] {
  const active = ops.slice(0, cursor);

  // Index ops by id for cascade lookups.
  const opById = new Map<string, EditOperation>(active.map((o) => [o.id, o]));

  // Build the set of cancelled op ids with cascade.
  // When a REVERT op is itself cancelled, its own cancellations are undone.
  const cancelled = new Set<string>();

  function cancelOp(id: string): void {
    if (cancelled.has(id)) return;
    cancelled.add(id);
    // If the newly-cancelled op was a REVERT, un-cancel what it had cancelled.
    const target = opById.get(id);
    if (target?.type === 'REVERT') {
      for (const tid of target.targetOpIds) {
        cancelled.delete(tid);
      }
    }
  }

  for (const op of active) {
    if (op.type === 'REVERT' && !cancelled.has(op.id)) {
      for (const tid of op.targetOpIds) {
        cancelOp(tid);
      }
    }
  }

  // Apply operations to existing lines.
  const previewMap = new Map<string, PreviewLine>(
    lines.map((line) => [
      line.id,
      {
        ...line,
        currentText: line.text,
        currentStyle: styleFromLine(line),
        currentBox: line.box,
        deleted: false,
        patchLayout: null,
        resolvedFont: null,
      },
    ]),
  );

  // Track added lines in insertion order.
  const addedLines: PreviewLine[] = [];

  for (const op of active) {
    if (cancelled.has(op.id)) continue;

    switch (op.type) {
      case 'TEXT_REPLACE': {
        const pl = previewMap.get(op.objectId);
        if (pl) {
          previewMap.set(op.objectId, {
            ...pl,
            currentText: op.newText,
            // patchLayout will be computed by the caller with text-layout.ts
            patchLayout: pl.patchLayout,
          });
        }
        break;
      }

      case 'TEXT_STYLE_CHANGE': {
        const pl = previewMap.get(op.objectId);
        if (pl) {
          previewMap.set(op.objectId, {
            ...pl,
            currentStyle: { ...pl.currentStyle, ...op.style },
          });
        }
        break;
      }

      case 'OBJECT_MOVE': {
        const pl = previewMap.get((op as ObjectMoveOp).objectId);
        if (pl) {
          const o = op as ObjectMoveOp;
          previewMap.set(o.objectId, {
            ...pl,
            currentBox: { ...pl.currentBox, x: o.to.x, y: o.to.y },
          });
        }
        break;
      }

      case 'OBJECT_DELETE': {
        const pl = previewMap.get(op.objectId);
        if (pl) {
          previewMap.set(op.objectId, { ...pl, deleted: true });
        }
        break;
      }

      case 'TEXT_ADD': {
        // Check if this objectId was already added by a prior TEXT_ADD.
        const existing = addedLines.findIndex((l) => l.id === op.objectId);
        if (existing !== -1) break; // idempotent if already added
        const addedPreview: PreviewLine = {
          id: op.objectId,
          pageIndex: op.pageIndex,
          text: op.text,
          origin: op.at,
          // `at` is the first baseline; the box is the first row's glyph box (width set by the preview).
          box: addedBox(op.at, op.style.size),
          currentBox: addedBox(op.at, op.style.size),
          // matrix, fontRef, family, subsetPrefix, fontClass, bold, italic come from style
          matrix: [1, 0, 0, 1, op.at.x, op.at.y],
          fontRef: '',
          family: op.style.fontFamilyOverride ?? '',
          subsetPrefix: null,
          fontClass: op.style.fontClass,
          bold: op.style.bold,
          italic: op.style.italic,
          fontSize: op.style.size,
          hScale: op.style.hScale,
          charSpacing: op.style.charSpacing,
          wordSpacing: op.style.wordSpacing,
          rise: op.style.rise,
          renderMode: op.style.renderMode,
          lineHeight: op.style.lineHeight,
          color: { hex: op.style.color, source: 'exact' },
          background: { status: 'pending' },
          lockReason: null,
          font: {
            rawName: op.style.fontFamilyOverride ?? '',
            subtype: null,
            embedding: null,
            licence: null,
            encoding: null,
            coverage: null,
          },
          currentText: op.text,
          currentStyle: op.style,
          deleted: false,
          patchLayout: null,
          resolvedFont: null,
        };
        addedLines.push(addedPreview);
        break;
      }

      case 'IMAGE_REPLACE':
      case 'OBJECT_RESIZE':
        // Handled by applyImageOperations — ignore in text reducer.
        break;

      case 'REVERT':
        // Already handled above during the revoked-ids pass.
        break;
    }
  }

  // Combine: existing lines (in original order) + added lines.
  const result: PreviewLine[] = [];
  for (const line of lines) {
    const preview = previewMap.get(line.id);
    if (preview) result.push(withResolvedFont(preview, false));
  }
  for (const added of addedLines) {
    // If a TEXT_ADD was reverted, exclude the added line.
    if (!added.deleted) result.push(withResolvedFont(added, true));
  }

  return result;
}

/** First-row glyph box of added text whose first baseline is `at`. */
export function addedBox(at: { x: number; y: number }, size: number): { x: number; y: number; width: number; height: number } {
  return { x: at.x, y: at.y - size * 0.25, width: 0, height: size * 1.05 };
}

/** Attach the Resolved Font to a line whose text is drawn as a patch (edited, moved or added). */
export function withResolvedFont(line: PreviewLine, added: boolean): PreviewLine {
  const moved = line.currentBox.x !== line.box.x || line.currentBox.y !== line.box.y;
  if (line.deleted || (!added && !moved && line.currentText === line.text)) return line;
  return {
    ...line,
    resolvedFont: resolveFontSync(
      { ...line, fontFamilyOverride: line.currentStyle.fontFamilyOverride },
      line.currentText,
    ),
  };
}

/**
 * Pure reducer: apply ops[0..cursor) to the given ImageObject array and return
 * PreviewImage[]. Handles OBJECT_MOVE, OBJECT_DELETE, IMAGE_REPLACE, OBJECT_RESIZE.
 */
export function applyImageOperations(
  images: readonly ImageObject[],
  ops: readonly EditOperation[],
  cursor: number,
): PreviewImage[] {
  const active = ops.slice(0, cursor);

  // Build cancelled set (same REVERT cascade logic as applyOperations).
  const opById = new Map<string, EditOperation>(active.map((o) => [o.id, o]));
  const cancelled = new Set<string>();

  function cancelOp(id: string): void {
    if (cancelled.has(id)) return;
    cancelled.add(id);
    const target = opById.get(id);
    if (target?.type === 'REVERT') {
      for (const tid of target.targetOpIds) {
        cancelled.delete(tid);
      }
    }
  }

  for (const op of active) {
    if (op.type === 'REVERT' && !cancelled.has(op.id)) {
      for (const tid of op.targetOpIds) {
        cancelOp(tid);
      }
    }
  }

  const previewMap = new Map<string, PreviewImage>(
    images.map((img) => [
      img.id,
      {
        ...img,
        currentBox: img.bbox,
        deleted: false,
        blobKey: null,
        fit: null,
      },
    ]),
  );

  for (const op of active) {
    if (cancelled.has(op.id)) continue;

    switch (op.type) {
      case 'OBJECT_MOVE': {
        const pi = previewMap.get((op as ObjectMoveOp).objectId);
        if (pi) {
          const o = op as ObjectMoveOp;
          previewMap.set(o.objectId, {
            ...pi,
            currentBox: { ...pi.currentBox, x: o.to.x, y: o.to.y },
          });
        }
        break;
      }

      case 'OBJECT_DELETE': {
        const pi = previewMap.get(op.objectId);
        if (pi) {
          previewMap.set(op.objectId, { ...pi, deleted: true });
        }
        break;
      }

      case 'IMAGE_REPLACE': {
        const pi = previewMap.get((op as ImageReplaceOp).objectId);
        if (pi) {
          const o = op as ImageReplaceOp;
          previewMap.set(o.objectId, {
            ...pi,
            blobKey: o.blobKey,
            fit: o.fit,
          });
        }
        break;
      }

      case 'OBJECT_RESIZE': {
        const pi = previewMap.get((op as ObjectResizeOp).objectId);
        if (pi) {
          const o = op as ObjectResizeOp;
          previewMap.set(o.objectId, {
            ...pi,
            currentBox: o.to,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return Array.from(previewMap.values());
}
