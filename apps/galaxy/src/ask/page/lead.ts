// The message Claude wrote before asking (PRD 752): the round's `lead`, shown once above its
// questions under "Claude wrote before asking". A round without one shows no block. A lead longer
// than about LEAD_FOLD_LINES lines is folded behind "Show all" (decision 7).
import type { RoundRow } from './view';

/** More lines than this, and the lead is folded. */
export const LEAD_FOLD_LINES = 12;

/** How many characters a line of the block holds, about, before it wraps. */
const LINE_WIDTH = 80;

/** The lead to show, or null for a round with none (an older kit, an unreadable transcript). */
export function leadOf(round: Pick<RoundRow, 'lead'>): string | null {
  const text = round.lead?.trim();
  return text ? text : null;
}

/** Whether the lead runs past LEAD_FOLD_LINES lines, a long line counting as the lines it wraps into. */
export function leadFolds(text: string): boolean {
  const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / LINE_WIDTH)), 0);
  return lines > LEAD_FOLD_LINES;
}
