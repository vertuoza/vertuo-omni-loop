// `omni kb index` (PRD 2299): the capped block of the product's knowledge a session starts with, the
// words to use, the laws to respect and the people to build for, each list pointing at the command
// that prints it whole. `indexLines` lays the block out; `readIndex` reads it the way
// `omni constituents` reads: one budget for the whole read, and every outcome an answer, never a throw.
//
// The block is at most `INDEX_CAP_BYTES`. A list that would pass its share is cut at a whole item and
// ends `… <n> more: <its command>`; nothing is cut silently.
import { AskCallError, type Fetch } from '../ask/client.ts';
import { ageOf } from '../constituents/read.ts';
import { KnowledgeStop, productKnowledge, readCachedKnowledge } from './knowledge.ts';
import type { GlossaryTerm, KnowledgePersona, LegalEntry, ProductKnowledge } from './knowledge.ts';

/** The block's size cap, in bytes (3 KB). */
export const INDEX_CAP_BYTES = 3072;
/** The whole read's budget: a session's start never waits longer. */
export const INDEX_BUDGET_MS = 3000;
const CARRY_ON = '— agents carry on';
const SEPARATOR = ' · ';
const INDENT = '       ';

/** What `--json` says of the read. */
export type IndexState = 'ok' | 'none' | 'archived' | 'cached' | 'no-sign-in' | 'unreachable' | 'refused' | 'no-kit';

/** One word of the product: its term and the words it says not to use. */
export type IndexWord = { term: string; avoid: string[] };
/** One Legal entry: its id and whole statement. */
export type IndexLegal = { id: string; statement: string };
/** What was cut from each list, in items. */
export type IndexCut = { words: number; legal: number; personas: number };

/** The read as `--json` prints it: the lists are the items the block prints, the cut what it left out. */
export type IndexBody = {
  state: IndexState;
  product: string | null;
  words: IndexWord[];
  legal: IndexLegal[];
  personas: KnowledgePersona[];
  syncedAt: string | null;
  cut: IndexCut;
};

const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

/** The longest run of `items` that, with its `… n more` ending when it is cut, fits `budget` bytes. */
function fit(items: readonly string[], budget: number, command: string): { text: string; kept: number } {
  for (let kept = items.length; kept > 0; kept -= 1) {
    const text = items.slice(0, kept).join(SEPARATOR);
    const more = items.length - kept;
    const full = more === 0 ? text : `${text}${SEPARATOR}… ${more} more: ${command}`;
    if (bytes(full) <= budget) return { text: full, kept };
  }
  return { text: `… ${items.length} more: ${command}`, kept: 0 };
}

type Section = { label: string; items: string[]; hint: string; command: string };

const wordItem = ({ term, avoid }: GlossaryTerm): string => (avoid.length > 0 ? `${term} (not: ${avoid.join(', ')})` : term);
const legalItem = ({ id, statement }: LegalEntry): string => `${id} ${statement.replace(/\s+/g, ' ').trim()}`;
const personaItem = ({ name, stance }: KnowledgePersona): string => (stance === '' ? name : `${name} (${stance})`);

/**
 * The block for `knowledge` under the heading `synced` ("synced just now", "synced 2 d ago, offline"),
 * at most `cap` bytes, with what each list lost to the cap. A product with none of the three lists
 * has no block: `lines` is empty.
 */
export function indexLines(
  { product, glossary, legal, personas = [] }: ProductKnowledge,
  synced: string,
  cap: number = INDEX_CAP_BYTES,
): { lines: string[]; shown: { words: IndexWord[]; legal: IndexLegal[]; personas: KnowledgePersona[] }; cut: IndexCut } {
  const sections: Section[] = [
    { label: 'Words: ', items: glossary.map(wordItem), hint: 'meanings: omni kb glossary', command: 'omni kb glossary' },
    { label: 'Legal: ', items: legal.map(legalItem), hint: 'sources: omni kb legal', command: 'omni kb legal' },
    { label: 'Personas: ', items: personas.map(personaItem), hint: 'who they are: omni business show', command: 'omni business show' },
  ].filter((section) => section.items.length > 0);
  const kept: number[] = [];
  const lines = [`Knowledge of ${product} (${synced}): words to use, laws to respect, people to build for.`];
  let left = cap - bytes(lines[0] ?? '') - sections.length * 2;
  sections.forEach(({ label, items, hint, command }, i) => {
    const arrow = `${INDENT}→ ${hint}`;
    const share = Math.floor(left / (sections.length - i));
    const body = fit(items, Math.max(0, share - bytes(label) - bytes(arrow)), command);
    const section = [`${label}${body.text}`, arrow];
    left -= section.reduce((total, line) => total + bytes(line), 0);
    lines.push(...section);
    kept.push(body.kept);
  });
  const keptOf = (label: string): number => kept[sections.findIndex((section) => section.label === label)] ?? 0;
  const has = (label: string): boolean => sections.some((section) => section.label === label);
  const words = has('Words: ') ? glossary.slice(0, keptOf('Words: ')) : [];
  const legalShown = has('Legal: ') ? legal.slice(0, keptOf('Legal: ')) : [];
  const personasShown = has('Personas: ') ? personas.slice(0, keptOf('Personas: ')) : [];
  return {
    lines: sections.length === 0 ? [] : lines,
    shown: {
      words: words.map(({ term, avoid }) => ({ term, avoid })),
      legal: legalShown.map(({ id, statement }) => ({ id, statement })),
      personas: personasShown,
    },
    cut: { words: glossary.length - words.length, legal: legal.length - legalShown.length, personas: personas.length - personasShown.length },
  };
}

const NO_CUT: IndexCut = { words: 0, legal: 0, personas: 0 };

/** What `omni kb index` is handed: the repository, where its copy lives, and how to reach its page. */
export type IndexIo = {
  repo: string | null;
  root: string;
  /** The page's business read, or why there is none to make (no page, no sign-in). */
  reach: { fetchBusiness: (signal: AbortSignal) => Promise<unknown> } | { state: IndexState; why: string };
  now: () => Date;
  budgetMs: number;
};

const oneLine = (state: IndexState, why: string): [IndexBody, string[]] => [
  { state, product: null, words: [], legal: [], personas: [], syncedAt: null, cut: NO_CUT },
  [`no product knowledge: ${why} ${CARRY_ON}`],
];

/** The block, or the copy's, for what `read` holds. */
function printed(read: ProductKnowledge, state: IndexState, syncedAt: string, synced: string): [IndexBody, string[]] {
  const { lines, shown, cut } = indexLines(read, synced);
  if (lines.length === 0) return oneLine('none', `${read.product} holds no words, laws or personas yet`);
  return [{ state, product: read.product, ...shown, syncedAt, cut }, lines];
}

/** What a failed read prints: the last copy with its age, or one line saying why. */
function fallback({ root, now }: Pick<IndexIo, 'root' | 'now'>, state: IndexState, why: string): [IndexBody, string[]] {
  const copy = readCachedKnowledge(root);
  if (copy.state !== 'cached') return oneLine(state, why);
  return printed(copy, 'cached', copy.readAt, `synced ${ageOf(copy.readAt, now().getTime())}, ${why}`);
}

/** Why the page could not be read, as a state and a few words. */
function stopped(error: unknown): { state: IndexState; why: string } {
  if (error instanceof KnowledgeStop && error.state === 'refused') return { state: 'refused', why: error.message };
  if (error instanceof AskCallError && error.status === 401) return { state: 'no-sign-in', why: 'the sign-in was refused (omni signin)' };
  return { state: 'unreachable', why: 'offline' };
}

/** The read, within `io.budgetMs`; never throws. */
export async function readIndex(io: IndexIo): Promise<[IndexBody, string[]]> {
  const { repo, root, reach, now, budgetMs } = io;
  if ('state' in reach) return fallback(io, reach.state, reach.why);
  if (!repo) return fallback(io, 'refused', 'no repository slug (repo.slug)');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new KnowledgeStop('unreachable', 'timed out'));
    }, budgetMs);
  });
  try {
    const read = await Promise.race([
      productKnowledge({ repo, root, now, fetchBusiness: () => reach.fetchBusiness(controller.signal) }),
      late,
    ]);
    const syncedAt = now().toISOString();
    return printed(read, read.from === 'copy' ? 'cached' : 'ok', read.from === 'copy' ? read.readAt : syncedAt, read.from === 'copy' ? `synced ${ageOf(read.readAt, now().getTime())}, offline` : 'synced just now');
  } catch (error) {
    if (error instanceof KnowledgeStop && (error.state === 'archived' || error.state === 'none')) return oneLine(error.state, error.message);
    const { state, why } = stopped(error);
    return fallback(io, state, why);
  } finally {
    clearTimeout(timer);
  }
}

/** `fetch` held to one deadline shared by every request of the read, the renewal included. */
export function withDeadline(fetch: Fetch, signal: AbortSignal): Fetch {
  return (url, init) => fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, signal]) : signal });
}
