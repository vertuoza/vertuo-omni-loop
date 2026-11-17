// An id new on this branch that the base gave to another entry (PRD 3015): two branches numbered a
// new rule the same, and the second to merge must renumber. Pure: the places are read elsewhere
// (`id-clash-read.ts`) and handed in. The base is read as it is now, what the branch will meet when it
// merges; the merge base only says which ids are new here, so an entry the branch amended keeps its id.
import { nextFreeId, type IdSet } from './next-id.ts';
import { idParts } from './registers.ts';

/** An entry as the comparison reads it: its id, its statement and the file it sits in. */
export type Stated = { id: string; statement: string; file: string };

/** An id new on this branch that the base holds with other words, and the id to renumber it to. */
export type IdClash = { file: string; id: string; theirs: string; next: string };

/** How long a quote of the base's statement runs. */
const QUOTE_CHARS = 80;

const words = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * The id after every number any set holds under `id`'s prefix; a core id (`N3`) numbers past the core
 * ids. An id of no known shape, which `omni check knowledge` refuses on its own, gets no number.
 */
function nextLike(id: string, sets: readonly IdSet[]): string {
  const parts = idParts(id);
  if (parts === null) return 'a free id';
  if (parts.type !== 'CORE') return nextFreeId([parts.type, ...parts.codes].join('-'), sets).id;
  const numbers = sets.flatMap(({ ids }) => ids).flatMap((held) => (/^N(\d+)$/.exec(held) ? [Number(held.slice(1))] : []));
  return `N${String(Math.max(0, ...numbers) + 1)}`;
}

/**
 * Each id of `tree` that `now` (the base as it is now) holds with other words, and that `then` (the
 * ids at the merge base) does not hold: new on this branch, taken on the base. `then` is read once,
 * and only when some id differs. Two clashes of one prefix are given two different ids.
 */
export function idClashes({ tree, now, then }: { tree: readonly Stated[]; now: readonly Stated[]; then: () => readonly string[] }): IdClash[] {
  const theirs = new Map(now.map((entry) => [entry.id, entry.statement]));
  const seen = new Set<string>();
  const differing = tree.filter((entry) => {
    const statement = theirs.get(entry.id);
    if (statement === undefined || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return words(statement) !== words(entry.statement);
  });
  if (differing.length === 0) return [];
  const before = new Set(then());
  const given: string[] = [];
  const sets = (): IdSet[] => [
    { where: 'tree', ids: [...tree.map(({ id }) => id), ...given] },
    { where: 'base', ids: now.map(({ id }) => id) },
  ];
  const clashes: IdClash[] = [];
  for (const entry of differing) {
    if (before.has(entry.id)) continue;
    const next = nextLike(entry.id, sets());
    given.push(next);
    clashes.push({ file: entry.file, id: entry.id, theirs: theirs.get(entry.id) ?? '', next });
  }
  return clashes;
}

/** The violation `omni check knowledge` prints for a clash against `base`. */
export function clashLine({ file, id, theirs, next }: IdClash, base: string): string {
  const said = words(theirs);
  const quote = said.length > QUOTE_CHARS ? `${said.slice(0, QUOTE_CHARS)}…` : said;
  return (
    `${file}: ${id} is taken on ${base} by another entry ("${quote}").\n` +
    `    Renumber this one to ${next}, and its ledger's Became: line with it.`
  );
}
