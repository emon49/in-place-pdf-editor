import type { LockReason, TextLine } from '../types/page-model';

/** User-facing explanation of why a Text Line cannot be edited in v1 (VW-8). */
export const LOCK_MESSAGES: Readonly<Record<LockReason, string>> = {
  'rotated-or-skewed': 'Rotated or skewed text cannot be edited in this version.',
  'vertical-writing': 'Vertical text cannot be edited in this version.',
  'type3-font': 'Text drawn with a Type 3 font cannot be edited in this version.',
};

export const MASK_WARNING =
  'The background behind this text is not a flat colour, so hiding or moving it may leave a visible mark.';

/** Accessible name of a Text Line: its text, plus why it is locked when it is. */
export function lineLabel(line: Pick<TextLine, 'text' | 'lockReason'>): string {
  return line.lockReason ? `${line.text} (locked: ${LOCK_MESSAGES[line.lockReason]})` : line.text;
}

export function hasNonUniformBackground(line: Pick<TextLine, 'background'>): boolean {
  return line.background.status === 'ready' && !line.background.uniform;
}
