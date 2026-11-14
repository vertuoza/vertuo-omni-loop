// The `search-eval-run` job (PRD omni-loop-8 s4, spec "The runs"): runs a product's eval set and keeps the run. Two
// ways to add it, one handler:
//
//   daily   a schedule of the ledger (./schedule.ts), 3 tries, payload `{slot}`: every product with a question in its
//           set runs, slot the day's start; trigger `daily`
//   embed   `searchEvalRunJob()`, which a `knowledge-embed` job that stored new vectors adds for each product of the
//           workspace whose pack it embedded (./embed.ts), payload `{productId, slot}`, slot the pack's commit;
//           trigger `embed`
//
// A run searches each question that has a right answer through galaxy's `eval-search` (the product's search as an
// agent makes it, top 10, never logged), scores the outcomes with the kit's scoring (kit/lib/knowledge/search-eval.ts,
// the one `pnpm eval:search` uses) and keeps one run: its measures `{overall, categories, misses, skipped}` and, per
// question, `{questionId, category, ranks, first}`: the ranks of its right answers found in the top 10 and the 5 ids
// that came first. A product that holds a run of the trigger and slot is not searched again, so a second run of a
// slot keeps no second run and a run out of time carries on where it stopped. A search that fails leaves its
// product unrecorded (a half-measured run would skew the measures) and the job throws once the other products ran,
// so the worker retries it. The payload holds no token and no question, and no question is logged (L-GDPR-2).
import { z } from 'zod';
import { scoreSearches, type SearchOutcome } from 'omni-loop/kit/lib/knowledge/search-eval.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { EvalSearcher } from '../search-eval/galaxy.ts';
import type { EvalQuestion, SearchEvalStore } from '../search-eval/store.ts';
import type { NewJob } from './ledger.ts';
import type { JobHandler, JobResult } from './worker.ts';

export const SEARCH_EVAL_RUN_KIND = 'search-eval-run';

/** How long one run works before it asks to run again: well inside the worker's 240 seconds. */
const BUDGET_MS = 150_000;
/** How long a run that ran out of time waits before the next. */
const AGAIN_MS = 60_000;
/** How many questions are searched at once. */
const PARALLEL = 4;
/** The category a question with none is scored under. */
const NO_CATEGORY = 'other';
/** The ids that came first, kept with each question. */
const FIRST = 5;

const PayloadSchema = z.object({ slot: z.string().min(1).max(80), productId: z.string().min(1).optional() });

/** The job that runs `productId`'s set after a pack's commit `slot` stored new vectors: keyed by both, once. */
export function searchEvalRunJob({ productId, slot }: { productId: string; slot: string }): NewJob {
  return { kind: SEARCH_EVAL_RUN_KIND, key: `${productId}@${slot}`, subject: productId, payload: { productId, slot }, lane: SEARCH_EVAL_RUN_KIND, maxTries: 3 };
}

/** The 1-based ranks of the right answers found in the ranked ids, best first. */
function ranksOf(ranked: readonly string[], right: readonly string[]): number[] {
  return right.map((id) => ranked.indexOf(id) + 1).filter((rank) => rank > 0).sort((a, b) => a - b);
}

/** Searches each question that has a right answer; null when a search failed or galaxy could not be asked. */
async function outcomesOf(search: EvalSearcher, questions: readonly EvalQuestion[]): Promise<SearchOutcome[] | null> {
  const outcomes: SearchOutcome[] = [];
  for (let at = 0; at < questions.length; at += PARALLEL) {
    const batch = await Promise.all(
      questions.slice(at, at + PARALLEL).map(async (q): Promise<SearchOutcome | null> => {
        const category = q.category ?? NO_CATEGORY;
        if (q.right.length === 0) return { id: q.id, category, ranked: [], right: [] };
        const ranked = await search({ workspaceId: q.workspaceId, productId: q.productId, question: q.question }).catch(() => null);
        return ranked === null ? null : { id: q.id, category, ranked, right: q.right };
      }),
    );
    for (const outcome of batch) {
      if (outcome === null) return null;
      outcomes.push(outcome);
    }
  }
  return outcomes;
}

/** Runs one product's set and keeps the run: `kept`, `empty` (no question with a right answer, or a repeat) or `failed` (a search failed). */
async function runProduct({ store, search, productId, trigger, slot }: { store: SearchEvalStore; search: EvalSearcher; productId: string; trigger: 'daily' | 'embed'; slot: string }): Promise<'kept' | 'empty' | 'failed'> {
  const outcomes = await outcomesOf(search, await store.questions(productId));
  if (outcomes === null) return 'failed';
  const scores = scoreSearches(outcomes);
  if (scores.overall.questions === 0) return 'empty';
  const kept = await store.record({
    productId,
    trigger,
    slot,
    measures: {
      overall: scores.overall,
      categories: Object.fromEntries(scores.byCategory.map(({ category, measures }) => [category, measures])),
      misses: scores.misses,
      skipped: scores.skipped,
    },
    questions: outcomes
      .filter((outcome) => outcome.right.length > 0)
      .map((outcome) => ({ questionId: outcome.id ?? null, category: outcome.category, ranks: ranksOf(outcome.ranked, outcome.right), first: outcome.ranked.slice(0, FIRST) })),
  });
  return kept === null ? 'empty' : 'kept';
}

/** The handler of the `search-eval-run` kind: `store` is the database, `search` galaxy's eval-search route. */
export function searchEvalRunHandler({
  store,
  search,
  clock = Date.now,
  budgetMs = BUDGET_MS,
  log = noteTo('search-eval-run'),
}: {
  store: SearchEvalStore;
  search: EvalSearcher;
  clock?: () => number;
  budgetMs?: number;
  log?: (line: string) => void;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    const { slot, productId } = payloadOf(job.payload);
    const trigger = productId === undefined ? 'daily' : 'embed';
    const products = productId === undefined ? await store.evalProducts() : [productId];

    const start = clock();
    let recorded = 0;
    let failed = 0;
    for (const id of products) {
      if (clock() - start >= budgetMs) {
        log(`search eval run: ${String(recorded)} of ${String(products.length)} products run, out of time: again in a minute`);
        return { outcome: 'later', at: new Date(clock() + AGAIN_MS), progress: { recorded } };
      }
      if (await store.recorded(id, trigger, slot)) continue;
      const ended = await runProduct({ store, search, productId: id, trigger, slot });
      if (ended === 'failed') failed += 1;
      else if (ended === 'kept') recorded += 1;
    }
    log(`search eval run: ${trigger} ${slot.slice(0, 10)}: ${String(recorded)} runs kept in ${String(products.length)} products, ${String(failed)} not run`);
    if (failed > 0) throw new Error(`search eval run: a search failed in ${String(failed)} of ${String(products.length)} products`);
    return { outcome: 'done' };
  };
}

/** The job's payload, or the error naming its first malformed field. */
function payloadOf(raw: unknown): z.infer<typeof PayloadSchema> {
  const parsed = PayloadSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new Error(`The search eval run job is malformed: ${issue?.path.join('.') || '(payload)'}: ${issue?.message ?? parsed.error.message}`);
}
