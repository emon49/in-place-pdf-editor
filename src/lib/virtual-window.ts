/** Fixed-row-height windowing for long lists (design: the Text Objects list virtualises above a threshold). */

export interface WindowInput {
  readonly count: number;
  readonly rowHeight: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
  /** Extra rows rendered above and below the visible ones. */
  readonly overscan?: number;
}

export interface WindowRange {
  /** First rendered row (inclusive). */
  readonly start: number;
  /** One past the last rendered row. */
  readonly end: number;
  readonly offsetTop: number;
  readonly totalHeight: number;
}

export function visibleRange({ count, rowHeight, scrollTop, viewportHeight, overscan = 6 }: WindowInput): WindowRange {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const last = Math.ceil((Math.max(0, scrollTop) + viewportHeight) / rowHeight);
  const start = Math.max(0, Math.min(count, first - overscan));
  const end = Math.max(start, Math.min(count, last + overscan));
  return { start, end, offsetTop: start * rowHeight, totalHeight: count * rowHeight };
}

/** The scrollTop that brings row `index` fully into view, or the current one when it already is. */
export function scrollTopToReveal(index: number, rowHeight: number, scrollTop: number, viewportHeight: number): number {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return scrollTop;
}
