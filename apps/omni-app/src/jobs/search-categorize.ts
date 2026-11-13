// The `search-categorize` job (PRD omni-loop-7 s3, spec "Each logged question gets a category and a group, in the
// background"): a schedule of the ledger (./schedule.ts), every 15 minutes, 3 tries. A run takes at most
// MAX_SEARCHES searches that have no group yet (`search_knowledge` calls with a question) and, for each:
//
//   embed     the question, 8 a call through the `embed` function as `knowledge-embed` does (./embed.ts)
//   group     joins the product's nearest group within SIMILARITY cosine, else starts one (../search-categorize/group.ts);
//             no model call, so the next question of the run sees the group this one started
//   category  asks galaxy's `search-category` decision (../search-categorize/galaxy.ts) and keeps its answer; the
//             category stays empty when galaxy answers null (the decision off, no Jev key), fails or answers an
//             answer the column refuses; the group stays set and the run goes on
//
// A search with a group is never taken again, so a second run of a slot groups nothing twice. An `embed` that
// fails throws: the worker reads it as a retry, and what was grouped stays. The payload holds the slot only, never
// a token and never a question (L-GDPR-2), and no question is logged, not in a failure either.
import { EMBED_BATCH, EMBED_MODEL } from 'omni-loop/kit/lib/knowledge/embed-contract.ts';
import type { Embedder } from '../knowledge-embed/embedder.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { Categorizer } from '../search-categorize/galaxy.ts';
import { place, SIMILARITY } from '../search-categorize/group.ts';
import type { SearchStore, Ungrouped } from '../search-categorize/store.ts';
import type { JobHandler, JobResult } from './worker.ts';

export const SEARCH_CATEGORIZE_KIND = 'search-categorize';

/** The most searches one run takes (spec: at most 200 a run). */
export const MAX_SEARCHES = 200;
/** The longest category the log keeps (`mcp_search_log_category_check`). */
const CATEGORY_MAX = 80;
/** How long one run works before it asks to run again: well inside the worker's 240 seconds. */
const BUDGET_MS = 150_000;
/** How long a run that ran out of time waits before the next. */
const AGAIN_MS = 60_000;

/** Puts the search in its group, starting one when none is near: whether it started one. */
async function groupSearch(store: SearchStore, search: Ungrouped, vector: readonly number[], threshold: number): Promise<boolean> {
  const placement = place(await store.nearest(search.productId, EMBED_MODEL, vector), threshold);
  if (placement.kind === 'join') {
    await store.join(search.id, placement.groupId);
    return false;
  }
  const groupId = await store.addGroup({ productId: search.productId, workspaceId: search.workspaceId, firstSearchId: search.id, question: search.question, model: EMBED_MODEL, vector });
  await store.join(search.id, groupId);
  return true;
}

/** Galaxy's category for the search, or null when it kept none, failed or answered what the column refuses. */
async function categoryOf(categorize: Categorizer, search: Ungrouped): Promise<string | null> {
  const category = await categorize({ workspaceId: search.workspaceId, productId: search.productId, question: search.question }).catch(() => null);
  return category !== null && category.length >= 1 && category.length <= CATEGORY_MAX ? category : null;
}

/** The handler of the `search-categorize` kind: `store` is the log's database, `embed` the model, `categorize` galaxy. */
export function searchCategorizeHandler({
  store,
  embed,
  categorize,
  threshold = SIMILARITY,
  limit = MAX_SEARCHES,
  clock = Date.now,
  budgetMs = BUDGET_MS,
  log = noteTo('search-categorize'),
}: {
  store: SearchStore;
  embed: Embedder;
  categorize: Categorizer;
  threshold?: number;
  limit?: number;
  clock?: () => number;
  budgetMs?: number;
  log?: (line: string) => void;
}): JobHandler {
  return async (): Promise<JobResult> => {
    const searches = await store.ungrouped(limit);
    if (searches.length === 0) return { outcome: 'done' };

    const start = clock();
    let grouped = 0;
    let started = 0;
    let categorized = 0;
    for (let at = 0; at < searches.length; at += EMBED_BATCH) {
      if (clock() - start >= budgetMs) {
        log(`search categorize: ${String(grouped)} of ${String(searches.length)} searches grouped, out of time: again in a minute`);
        return { outcome: 'later', at: new Date(clock() + AGAIN_MS), progress: { grouped } };
      }
      const batch = searches.slice(at, at + EMBED_BATCH);
      const vectors = await embed(batch.map((search) => search.question));
      for (const [i, search] of batch.entries()) {
        if (await groupSearch(store, search, vectors[i] ?? [], threshold)) started += 1;
        grouped += 1;
        const category = await categoryOf(categorize, search);
        if (category !== null) {
          await store.setCategory(search.id, category);
          categorized += 1;
        }
      }
    }
    log(`search categorize: ${String(grouped)} searches grouped (${String(started)} new groups), ${String(categorized)} categorized`);
    return { outcome: 'done' };
  };
}
