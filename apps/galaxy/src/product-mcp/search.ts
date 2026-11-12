// The search of a product's knowledge (PRD 2707 s3, decision 7): words, with no model, so it is free and
// gives the same answer every time. Pure.
//
// - The query is split into words, each compared without case and without accents, as a part of a word.
// - Each word scores by the best place it is found: the id, then the title, then the body. An entry missing
//   a word is left out. The best first; a tie is broken by id.
// - With no query, every entry matching the filters, in id order.
// - At most HIT_CAP hits; `total` says how many matched.
// - The snippet is the body's first sentence that holds a word (its first sentence with no query), cut at
//   200 characters.
import { HIT_CAP, type KnowledgeEntry, type KnowledgeHit, type KnowledgeKind } from './product-mcp.contract';

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

/** The hits of `query` among `entries`, the best first, and how many there are. */
export function searchKnowledge(entries: readonly KnowledgeEntry[], query: KnowledgeQuery): { hits: KnowledgeHit[]; total: number } {
  const words = wordsOf(query.query);
  const kept = entries.filter((entry) => matchesFilters(entry, query));
  const ranked = words.length === 0
    ? [...kept].sort(byId)
    : kept.map((entry) => ({ entry, score: scoreOf(entry, words) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || byId(a.entry, b.entry))
      .map(({ entry }) => entry);
  return { hits: ranked.slice(0, HIT_CAP).map((entry) => hitOf(entry, words)), total: ranked.length };
}
