// The next free id of a register prefix (PRD 3015): one past the highest number any place holds.
// Pure: the places are read elsewhere (`next-id-read.ts`) and handed in as sets of ids.
import { idParts } from './registers.ts';

/** The ids one place holds: `tree`, `base` or `#<pr>`. */
export type IdSet = { where: string; ids: readonly string[] };

/** The next free id, and each place that held the highest number it numbered past. */
export type NextId = { id: string; past: { where: string; id: string }[] };

/** The prefix of an id, its number cut off (`BR-PIPELINE`), or `null` when `id` is no id. */
function prefixOf(id: string): { prefix: string; n: number } | null {
  const parts = idParts(id);
  if (parts === null) return null;
  return { prefix: [parts.type, ...parts.codes].join('-'), n: Number(parts.n) };
}

/**
 * `<prefix>-<n>`, `n` one past the highest number any set holds under `prefix`; the ids of other
 * prefixes count for nothing. `past` names each place that held that highest number. A `prefix`
 * `idParts()` cannot split (once a number is put after it) throws.
 */
export function nextFreeId(prefix: string, sets: readonly IdSet[]): NextId {
  const own = prefixOf(`${prefix}-1`);
  if (own?.prefix !== prefix) throw new Error(`${JSON.stringify(prefix)} is not a register prefix (an id without its number, as BR-PIPELINE or N-PRODUCT)`);
  const held: { where: string; id: string; n: number }[] = [];
  for (const { where, ids } of sets) {
    for (const id of ids) {
      const read = prefixOf(id);
      if (read?.prefix === prefix) held.push({ where, id, n: read.n });
    }
  }
  const highest = Math.max(0, ...held.map(({ n }) => n));
  const seen = new Set<string>();
  const past: NextId['past'] = [];
  for (const { where, id, n } of held) {
    if (n !== highest || seen.has(where)) continue;
    seen.add(where);
    past.push({ where, id });
  }
  return { id: `${prefix}-${highest + 1}`, past };
}
