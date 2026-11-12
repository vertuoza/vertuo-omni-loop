// The meaning search of a product's knowledge (PRD 2728 s5): the query's vector, the entries' nearest, and the
// word search whenever they cannot answer.
//
// - With no word in the query, the listing, as the word search gives it, with no mode.
// - With no model here (meaning null), the word search, with `mode: "words"`.
// - Each entry is named by the sha256 of its embedText() (the text its vector was made from, with no
//   `Owner:` line), as the `knowledge-embed` job names it.
// - Within one budget (2 seconds): the query is embedded, and the product's own rows with no vector yet (a
//   Legal entry added since the last job) are embedded and kept, at most 64. That second part failing, or not
//   done in time, only leaves those rows to rank by words.
// - Then knowledge_nearest() ranks the entries' vectors, and rankByMeaning() orders the hits.
// - The query's embedding failing or passing the budget, the database refusing, or no vector at all: the
//   word search's answer with `mode: "words"`, never an error. Each fallback is one log line, with no text of
//   the query or the knowledge.
import { embedText } from 'omni-loop/kit/lib/knowledge/entries.ts';
import type { KnowledgeHit, SearchMode } from './product-mcp.contract';
import type { KnowledgeEntry } from 'omni-loop/kit/lib/knowledge/entries.ts';
import type { KnowledgeVectorsRepository } from './product-mcp.repository';
import { EMBED_BATCH, EMBED_MODEL, type Embedder } from './embed/client';
import { filtered, hasWords, rankByMeaning, searchKnowledge, type KnowledgeQuery } from './search';

/** How long a search waits on the model, in milliseconds. */
export const MEANING_BUDGET_MS = 2000;

/** What the meaning search needs: the model, the workspace's vectors, and its budget. */
export type Meaning = {
  embedder: Embedder;
  vectors: Pick<KnowledgeVectorsRepository, 'missing' | 'put' | 'nearest'>;
  budgetMs?: number;
};

type Answer = { hits: KnowledgeHit[]; total: number; mode?: SearchMode };

/** The lower-case hex sha256 of the text's UTF-8 bytes. */
async function sha256(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Rejects once `signal` aborts, whatever `work` does. */
function within<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return Promise.race([work, new Promise<never>((_, reject) => {
    const stop = () => { reject(new Error('the model took longer than the budget')); };
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop, { once: true });
  })]);
}

/** The hits of `query` among `entries` of the workspace `workspace`, by meaning when the vectors answer. */
export async function searchByMeaning(
  entries: readonly KnowledgeEntry[],
  query: KnowledgeQuery,
  workspace: string,
  meaning: Meaning | null,
  log: (message: string) => void,
): Promise<Answer> {
  if (!hasWords(query.query)) return searchKnowledge(entries, query);
  if (meaning === null) return { ...searchKnowledge(entries, query), mode: 'words' };
  const { embedder, vectors, budgetMs = MEANING_BUDGET_MS } = meaning;
  const kept = filtered(entries, query);
  const hashes = new Map(await Promise.all(kept.map(async (entry) => [entry, await sha256(embedText(entry))] as const)));
  const hashOf = (entry: KnowledgeEntry): string => hashes.get(entry) ?? '';
  const distinct = [...new Set(hashes.values())];
  if (distinct.length === 0) return { ...searchKnowledge(entries, query), mode: 'words' };

  const deadline = new AbortController();
  const timer = setTimeout(() => { deadline.abort(); }, budgetMs);
  try {
    // The product's own rows (no file: Legal entries, terms, Never lines) the job has not embedded yet.
    const fill = async (): Promise<void> => {
      const own = new Map(kept.filter((entry) => entry.file === null).map((entry) => [hashOf(entry), entry] as const));
      if (own.size === 0) return;
      const missing = (await vectors.missing(workspace, EMBED_MODEL, [...own.keys()])).slice(0, EMBED_BATCH);
      if (missing.length === 0) return;
      const made = await embedder(missing.map((hash) => embedText(own.get(hash) ?? { title: '', body: '' })), deadline.signal);
      await vectors.put(workspace, EMBED_MODEL, missing.map((hash, at) => ({ sha256: hash, vector: made[at] ?? [] })));
    };
    const filled = within(fill(), deadline.signal).catch((error: unknown) => { log(`product mcp: product rows not embedded: ${messageOf(error)}`); });
    const [[vector]] = await Promise.all([within(embedder([query.query ?? ''], deadline.signal), deadline.signal), filled]);
    if (vector === undefined) throw new Error('embed answered no vector');
    const nearest = await vectors.nearest(workspace, EMBED_MODEL, distinct, vector, distinct.length);
    return rankByMeaning(entries, query, { hashOf, nearest });
  } catch (error) {
    log(`product mcp: searched by words: ${messageOf(error)}`);
    return { ...searchKnowledge(entries, query), mode: 'words' };
  } finally {
    clearTimeout(timer);
  }
}
