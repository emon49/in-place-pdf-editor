import type { TextLine } from '../types/page-model';
import type {
  EditOperation,
  ObjectMoveOp,
  PreviewLine,
  TextStyle,
} from '../types/operations';

/** Build a TextStyle from a TextLine's current properties. */
function styleFromLine(line: TextLine): TextStyle {
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
          box: { x: op.at.x, y: op.at.y, width: 0, height: 0 },
          currentBox: { x: op.at.x, y: op.at.y, width: 0, height: 0 },
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

      case 'REVERT':
        // Already handled above during the revoked-ids pass.
        break;
    }
  }

  // Combine: existing lines (in original order) + added lines.
  const result: PreviewLine[] = [];
  for (const line of lines) {
    const preview = previewMap.get(line.id);
    if (preview) result.push(preview);
  }
  for (const added of addedLines) {
    // If a TEXT_ADD was reverted, exclude the added line.
    if (!added.deleted) result.push(added);
  }

  return result;
}
