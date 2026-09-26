/**
 * Prints one entry of the knowledge folder and every entry that serves it.
 *
 * "The rules a principle produced" is never written by hand: two copies of a link drift. It is
 * derived here, from the `Serves:` lines `registers.mjs` reads, every time it is asked. For a rule
 * or an invariant, the print also names the principle it serves.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/knowledge.mjs — changes in kit/porting/knowledge--describe.md.
import { servedBy } from './registers.mjs';

const LINES = [
  ['why', 'Why'],
  ['decided', 'Decided'],
  ['kindLine', 'Kind'],
  ['serves', 'Serves'],
  ['source', 'Source'],
  ['enforcedBy', 'Enforced by'],
  ['stated', 'Stated'],
  ['keptId', 'Kept id'],
];

function oneLine(entry) {
  return `  ${entry.id} (${entry.kind ?? 'unknown kind'}, ${entry.file}) — ${entry.statement}`;
}

/**
 * The text printed for `id`, or `null` when nothing claims it.
 *
 * @param {{ entries: object[] }} knowledge what `readKnowledge` returned
 * @param {string} id
 * @returns {string | null}
 */
export function describeEntry(knowledge, id) {
  const entry = knowledge.entries.find((candidate) => candidate.id === id);
  if (!entry) return null;

  const out = [
    `${entry.id} — a ${entry.kind ?? 'entry'} in ${entry.file}`,
    '',
    entry.statement,
    '',
  ];
  for (const [key, label] of LINES) {
    if (entry[key]) out.push(`${label}: ${entry[key]}`);
  }
  if (entry.proposed) {
    const { by, on } = entry.proposed;
    const who = by === null ? 'proposed (its "Proposed:" line is malformed)' : `proposed by ${by} on ${on}`;
    out.push('', `${who} — not a law until a person removes its "Proposed:" line`);
  }

  if (entry.serves) {
    const served = knowledge.entries.find((candidate) => candidate.id === entry.serves);
    out.push('', 'It serves:', served ? oneLine(served) : `  ${entry.serves} (claimed by nothing)`);
  }

  const serving = servedBy(knowledge.entries, entry.id);
  if (entry.kind === 'principle' || serving.length > 0) {
    out.push('', 'Served by:');
    out.push(
      ...(serving.length > 0 ? serving.map(oneLine) : ['  nothing yet — this principle is a wish']),
    );
  }

  return out.join('\n');
}
