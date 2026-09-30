import type { ClaimKind } from '../model';

// The quote check of a draft (PRD 774, spec step 3). The model answers candidates, each with a quote
// from the source it read; a candidate is kept only when that quote appears, word for word, in the
// source's text. Whitespace (line breaks included) and case are the only differences allowed. A quote
// longer than a receipt holds (300 characters, claim_receipts.quote) is dropped too. Pure.

/** One claim the model found in one source: its kind, its value and the words that say it. */
export interface Candidate {
  kind: ClaimKind;
  value: string;
  quote: string;
}

/** The most characters a receipt's quote holds. */
export const MAX_QUOTE = 300;

const plain = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/** Whether `quote` appears in `text`, whitespace and case aside. */
export function quoted(text: string, quote: string): boolean {
  const q = plain(quote);
  return q.length > 0 && plain(text).includes(q);
}

/** The candidates whose quote is in `text` and fits a receipt; every other one is dropped. */
export function verified(text: string, candidates: readonly Candidate[]): Candidate[] {
  return candidates.filter((c) => c.quote.trim().length <= MAX_QUOTE && quoted(text, c.quote));
}
