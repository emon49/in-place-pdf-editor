import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { multiplyMatrix, transformRect, type Matrix, type Rect } from './coordinates';
import type { ImageObject } from '../types/page-model';

export interface ImageSourcePage {
  getOperatorList(): Promise<{ fnArray: ArrayLike<number>; argsArray: ArrayLike<unknown> }>;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const num = (v: unknown, fallback = 0): number =>
  (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function matrixArg(args: ArrayLike<unknown>): Matrix {
  const source =
    args.length === 1 && typeof args[0] === 'object' && args[0] !== null
      ? (args[0] as ArrayLike<unknown>)
      : args;
  return Array.from({ length: 6 }, (_, k) => num(source[k])) as unknown as Matrix;
}

/**
 * Scans a PDF.js operator list for paintImageXObject and paintInlineImageXObject
 * operators and returns an ImageObject for each, with its bounding box in Page Space (IM-1).
 *
 * The unit square [0,0,1,1] in image space is mapped through the current CTM to
 * produce the axis-aligned bounding box. Mask images are flagged as locked.
 */
export async function extractImages(
  page: ImageSourcePage,
  pageIndex: number,
): Promise<ImageObject[]> {
  const list = await page.getOperatorList();
  const { fnArray, argsArray } = list;

  let ctm: Matrix = IDENTITY;
  const stack: Matrix[] = [];
  const images: ImageObject[] = [];
  let seq = 0;

  for (let i = 0; i < (fnArray as number[]).length; i++) {
    const op = (fnArray as number[])[i];
    const args = ((argsArray as unknown[])[i] ?? []) as ArrayLike<unknown>;

    switch (op) {
      case OPS.save:
        stack.push(ctm);
        break;

      case OPS.restore:
        ctm = stack.pop() ?? ctm;
        break;

      case OPS.transform:
        ctm = multiplyMatrix(ctm, matrixArg(args));
        break;

      case OPS.paintFormXObjectBegin: {
        stack.push(ctm);
        if (args[0] && typeof args[0] === 'object') {
          ctm = multiplyMatrix(ctm, matrixArg(args));
        }
        break;
      }

      case OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? ctm;
        break;

      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject: {
        // The CTM at this point maps image space [0,1]² to Page Space.
        const bbox = bboxFromCTM(ctm);
        if (bbox.width > 0 && bbox.height > 0) {
          images.push({
            id: `img:${pageIndex}:${seq++}`,
            pageIndex,
            bbox,
            locked: false,
            maskColor: null,
          });
        }
        break;
      }

      case OPS.paintImageMaskXObject:
      case OPS.paintImageMaskXObjectGroup: {
        // Mask images: locked because they use a 1-bit image space.
        const bbox = bboxFromCTM(ctm);
        if (bbox.width > 0 && bbox.height > 0) {
          images.push({
            id: `img:${pageIndex}:${seq++}`,
            pageIndex,
            bbox,
            locked: true,
            maskColor: null,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return images;
}

/** The image unit square [0,0]→[1,1] mapped through the CTM gives the bbox in Page Space. */
function bboxFromCTM(ctm: Matrix): Rect {
  return transformRect(ctm, { x: 0, y: 0, width: 1, height: 1 });
}
