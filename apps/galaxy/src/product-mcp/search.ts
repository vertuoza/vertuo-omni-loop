// The search of a product's knowledge (PRD 2707 s3, decision 7; PRD 2728 s5). Pure.
//
// By words (searchKnowledge), with no model, so it is free and gives the same answer every time:
//
// - The query is split into words, each compared without case and without accents, as a part of a word.
// - Each word scores by the best place it is found: the id, then the title, then the body. An entry missing
//   a word is left out. The best first; a tie is broken by id.
// - With no query, every entry matching the filters, in id order.
// - At most HIT_CAP hits; `total` says how many matched.
// - The snippet is the body's first sentence that holds a word (its first sentence with no query), cut at
//   200 characters.
//
// By meaning (rankByMeaning), once knowledge_nearest() has ranked the entries' vectors against the query's:
// 1. exact matches: an entry whose id, or a term whose word, equals the query (case and accents ignored);
// 2. the entries holding a vector, nearest first;
// 3. the entries holding none yet (a pack minutes old), by their word match, as the word search ranks them.
// With no vector at all among the entries, the answer is the word search's, with `mode: "words"`.
import { HIT_CAP, type KnowledgeHit, type KnowledgeKind, type SearchMode } from './product-mcp.contract';
import type { KnowledgeEntry } from 'omni-loop/kit/lib/knowledge/entries.ts';

export type KnowledgeQuery = { query?: string | undefined; kind?: KnowledgeKind | undefined; domain?: string | undefined; repo?: string | undefined };

const SNIPPET_MAX = 200;
const IN_ID = 10_000;
const IN_TITLE = 100;
const IN_BODY = 1;

/** The text folded for comparing: lower case, accents taken off. */
const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The query's words, folded. */
const wordsOf = (query: string | undefined): string[] => fold(query ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Whether the entry's domain is `domain`, any domain when none is asked. */
const inDomain = (entry: KnowledgeEntry, domain: string | undefined): boolean => !domain || fold(entry.domain ?? '') === fold(domain);

/** Whether the entry is of `repo`, named as owner/name or by its short name; any when none is asked. */
function inRepo(entry: KnowledgeEntry, repo: string | undefined): boolean {
  if (!repo) return true;
  const full = fold(entry.repo ?? '');
  return full !== '' && [full, full.slice(full.indexOf('/') + 1)].includes(fold(repo));
}

const matchesFilters = (entry: KnowledgeEntry, { kind, domain, repo }: KnowledgeQuery): boolean =>
  (kind === undefined || entry.kind === kind) && inDomain(entry, domain) && inRepo(entry, repo);

/** The entry's score for the words, 0 when one is missing. */
function scoreOf(entry: KnowledgeEntry, words: readonly string[]): number {
  const id = fold(entry.id), title = fold(entry.title), body = fold(entry.body);
  let score = 0;
  for (const word of words) {
    const best = id.includes(word) ? IN_ID : title.includes(word) ? IN_TITLE : body.includes(word) ? IN_BODY : 0;
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

const cut = (text: string): string => (text.length <= SNIPPET_MAX ? text : `${text.slice(0, SNIPPET_MAX - 1)}…`);

function snippetOf(body: string, words: readonly string[]): string {
  const sentences = body.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const holding = words.length === 0 ? undefined : sentences.find((s) => words.some((word) => fold(s).includes(word)));
  return cut(holding ?? sentences[0] ?? '');
}

const hitOf = (entry: KnowledgeEntry, words: readonly string[]): KnowledgeHit => ({
  id: entry.id, kind: entry.kind, title: entry.title, repo: entry.repo, domain: entry.domain, snippet: snippetOf(entry.body, words),
});

/** The entries holding every word, the best first. */
const byWords = (entries: readonly KnowledgeEntry[], words: readonly string[]): KnowledgeEntry[] =>
  entries.map((entry) => ({ entry, score: scoreOf(entry, words) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || byId(a.entry, b.entry))
    .map(({ entry }) => entry);

/** The entries `query` filters to, in their order. */
export const filtered = (entries: readonly KnowledgeEntry[], query: KnowledgeQuery): KnowledgeEntry[] =>
  entries.filter((entry) => matchesFilters(entry, query));

/** Whether `query` holds a word to search for. */
export const hasWords = (query: string | undefined): boolean => wordsOf(query).length > 0;

type Answer = { hits: KnowledgeHit[]; total: number };

const answerOf = (ranked: readonly KnowledgeEntry[], words: readonly string[]): Answer =>
  ({ hits: ranked.slice(0, HIT_CAP).map((entry) => hitOf(entry, words)), total: ranked.length });

/** The hits of `query` among `entries` by words, the best first, and how many there are. */
export function searchKnowledge(entries: readonly KnowledgeEntry[], query: KnowledgeQuery): Answer {
  const words = wordsOf(query.query);
  const kept = filtered(entries, query);
  return answerOf(words.length === 0 ? [...kept].sort(byId) : byWords(kept, words), words);
}

/** What knowledge_nearest() said of the entries: each one's hash, and the hashes holding a vector, nearest first. */
export type Nearness = { hashOf: (entry: KnowledgeEntry) => string; nearest: readonly string[] };

/** Whether the entry is named exactly by `query`: its id, or a term's word. */
function isExact(entry: KnowledgeEntry, query: string): boolean {
  const asked = fold(query.trim());
  return fold(entry.id) === asked || (entry.kind === 'term' && fold(entry.title) === asked);
}

/**
 * The hits of `query` among `entries` by meaning: exact matches, then the nearest, then the entries with no
 * vector by words; `mode: "words"` and the word search's answer when no entry holds a vector. A query with no
 * word answers the listing, with no mode.
 */
export function rankByMeaning(entries: readonly KnowledgeEntry[], query: KnowledgeQuery, { hashOf, nearest }: Nearness): Answer & { mode?: SearchMode } {
  const words = wordsOf(query.query);
  if (words.length === 0) return searchKnowledge(entries, query);
  const kept = filtered(entries, query);
  const place = new Map(nearest.map((hash, at) => [hash, at] as const));
  const placeOf = (entry: KnowledgeEntry): number | undefined => place.get(hashOf(entry));
  if (!kept.some((entry) => placeOf(entry) !== undefined)) return { ...searchKnowledge(entries, query), mode: 'words' };
  const exact = kept.filter((entry) => isExact(entry, query.query ?? '')).sort(byId);
  const rest = kept.filter((entry) => !exact.includes(entry));
  const near = rest.flatMap((entry) => {
    const at = placeOf(entry);
    return at === undefined ? [] : [{ entry, at }];
  }).sort((a, b) => a.at - b.at || byId(a.entry, b.entry)).map(({ entry }) => entry);
  const unembedded = byWords(rest.filter((entry) => placeOf(entry) === undefined), words);
  return { ...answerOf([...exact, ...near, ...unembedded], words), mode: 'meaning' };
}
