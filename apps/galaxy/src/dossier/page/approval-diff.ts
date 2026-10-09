// The diff of one pinned file (PRD 1322 s7), shown above Approve once an approval was voided or drifted:
// the lines removed and added since the approved version, two unchanged lines around each change, and
// `…` where unchanged lines were left out. Lines both texts open and end with are set aside first; the
// rest is matched by longest common subsequence, unless it is too large to match on a page render, when
// the old lines read removed and the new ones added.

export type DiffLine = { sign: '+' | '-' | ' ' | '…'; text: string };

/** The most cells the line matcher fills: past it, the middle reads removed then added. */
const MAX_CELLS = 1_000_000;
const CONTEXT = 2;

const kept = (text: string): DiffLine => ({ sign: ' ', text });
const removed = (text: string): DiffLine => ({ sign: '-', text });
const added = (text: string): DiffLine => ({ sign: '+', text });

/** The length of the longest common subsequence of `a` from i and `b` from j, for every i and j. */
function commonFrom(a: readonly string[], b: readonly string[]): (i: number, j: number) => number {
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  const at = (i: number, j: number) => table[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  return at;
}

/** Whether matching `a` and `b` line by line is pointless (one is empty) or too costly for a page render. */
const unmatchable = (a: readonly string[], b: readonly string[]) => !a.length || !b.length || a.length * b.length > MAX_CELLS;

/** The next step of the walk: keep a line both have, else drop the side that loses less common ground. */
function stepOf(left: string, right: string, withoutLeft: number, withoutRight: number): '+' | '-' | ' ' {
  if (left === right) return ' ';
  return withoutLeft >= withoutRight ? '-' : '+';
}

/** The middle of two texts, matched line by line: kept, removed and added lines in order. */
function matched(a: readonly string[], b: readonly string[]): DiffLine[] {
  if (unmatchable(a, b)) return [...a.map(removed), ...b.map(added)];
  const common = commonFrom(a, b);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const left = a[i] ?? '';
    const right = b[j] ?? '';
    const sign = stepOf(left, right, common(i + 1, j), common(i, j + 1));
    out.push({ sign, text: sign === '+' ? right : left });
    if (sign !== '+') i += 1;
    if (sign !== '-') j += 1;
  }
  return [...out, ...a.slice(i).map(removed), ...b.slice(j).map(added)];
}

/** `all` with only the lines within two of a change, each run of lines left out marked `…`. */
function withContext(all: readonly DiffLine[]): DiffLine[] {
  const changed = all.flatMap((line, at) => (line.sign === ' ' ? [] : [at]));
  const near = (at: number) => changed.some((c) => Math.abs(c - at) <= CONTEXT);
  const out: DiffLine[] = [];
  all.forEach((line, at) => {
    if (near(at)) out.push(line);
    else if (out[out.length - 1]?.sign !== '…') out.push({ sign: '…', text: '' });
  });
  return out;
}

/** How many lines `a` and `b` open with alike, and then how many they end with alike. */
function sharedEnds(a: readonly string[], b: readonly string[]): { head: number; tail: number } {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
  return { head, tail };
}

/** The changed lines of `before` → `after`, with their context; empty when nothing changed. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const { head, tail } = sharedEnds(a, b);
  if (head === a.length && head === b.length) return [];
  return withContext([
    ...a.slice(0, head).map(kept),
    ...matched(a.slice(head, a.length - tail), b.slice(head, b.length - tail)),
    ...a.slice(a.length - tail).map(kept),
  ]);
}
