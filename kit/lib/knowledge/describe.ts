/**
 * Prints one entry of the knowledge folder and every entry that serves it.
 *
 * "The rules a principle produced" is never written by hand: two copies of a link drift. It is
 * derived here, from the `Serves:` lines `registers.mjs` reads, every time it is asked. For a rule
 * or an invariant, the print also names the principle it serves. A contract (PRD 1796) prints its
 * `Points to:` line, the files that enforce it, just before its `Source:`.
 */
// Ported from nimbus-brain@c4a210122:scripts/knowledge.mjs — changes in kit/porting/knowledge--describe.md.
import { servedBy, type KnowledgeEntry } from './registers.ts';

/** The entry fields printed as lines, each with its label. */
const LINES: [keyof KnowledgeEntry & ('why' | 'decided' | 'kindLine' | 'serves' | 'source' | 'enforcedBy' | 'stated' | 'keptId'), string][] = [
  ['why', 'Why'],
  ['decided', 'Decided'],
  ['kindLine', 'Kind'],
  ['serves', 'Serves'],
  ['source', 'Source'],
  ['enforcedBy', 'Enforced by'],
  ['stated', 'Stated'],
  ['keptId', 'Kept id'],
];

function oneLine(entry: KnowledgeEntry): string {
  return `  ${entry.id} (${entry.kind ?? 'unknown kind'}, ${entry.file}) — ${entry.statement}`;
}

/** The entry's field lines, each `<label>: <value>`; a contract's `Points to:` comes just before `Source:`. */
function fieldLines(entry: KnowledgeEntry): string[] {
  const out: string[] = [];
  for (const [key, label] of LINES) {
    if (key === 'source' && entry.pointsTo) out.push(`Points to: ${entry.pointsTo.join(', ')}`);
    if (entry[key]) out.push(`${label}: ${entry[key]}`);
  }
  return out;
}

/** Who proposed the entry and when, or nothing for an entry a person stated. */
function proposedLines({ proposed }: KnowledgeEntry): string[] {
  if (!proposed) return [];
  const who = proposed.by === null ? 'proposed (its "Proposed:" line is malformed)' : `proposed by ${proposed.by} on ${proposed.on}`;
  return ['', `${who} — not a law until a person removes its "Proposed:" line`];
}

/** The text printed for `id`, or `null` when nothing claims it; `knowledge` is what `readKnowledge` returned. */
export function describeEntry(knowledge: { entries: readonly KnowledgeEntry[] }, id: string): string | null {
  const entry = knowledge.entries.find((candidate) => candidate.id === id);
  if (!entry) return null;

  const out = [
    `${entry.id} — a ${entry.kind ?? 'entry'} in ${entry.file}`,
    '',
    entry.statement,
    '',
    ...fieldLines(entry),
    ...proposedLines(entry),
  ];

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
