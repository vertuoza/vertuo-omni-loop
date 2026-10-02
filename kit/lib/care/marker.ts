// PRD 790: the hidden marker every PR care reply ends with, `<!-- omni-care: <verdict> -->`. The marker
// is how the next round and the PRD page know a review thread was handled, and how: the verdicts live
// on GitHub, in the replies, and nowhere else.

/** The three verdicts a review thread gets, in the order the spec names them. */
export const CARE_VERDICTS = Object.freeze(['fixed', 'pushed-back', 'asked'] as const);

/** One of {@link CARE_VERDICTS}. */
export type CareVerdict = (typeof CARE_VERDICTS)[number];

const KNOWN_VERDICTS: readonly unknown[] = CARE_VERDICTS;
const isVerdict = (value: unknown): value is CareVerdict => KNOWN_VERDICTS.includes(value);

const MARKER_RE = /<!-- omni-care: ([\w-]+) -->/g;
const TRAILING_MARKER_RE = /\s*<!-- omni-care: [\w-]+ -->\s*$/;

/** The marker for `verdict`. */
export function careMarker(verdict: string): string {
  if (!isVerdict(verdict)) {
    throw new Error(`unknown PR care verdict "${verdict}": one of ${CARE_VERDICTS.join(', ')}`);
  }
  return `<!-- omni-care: ${verdict} -->`;
}

/** A reply's body: `text`, trimmed, then a blank line and the marker. A marker `text` already ends
 * with is dropped first, so a body never carries two. */
export function careReplyBody(text: string | null | undefined, verdict: string): string {
  const marker = careMarker(verdict);
  const plain = (text ?? '').replace(TRAILING_MARKER_RE, '').trim();
  if (!plain) throw new Error('a PR care reply cannot be empty');
  return `${plain}\n\n${marker}`;
}

/** The verdict a comment's body carries (its last marker), or `null`: no marker, or one naming no
 * known verdict, reads as unhandled. */
export function readCareVerdict(body: string | null | undefined): CareVerdict | null {
  const found = [...(body ?? '').matchAll(MARKER_RE)];
  const last = found.at(-1)?.[1];
  return isVerdict(last) ? last : null;
}
