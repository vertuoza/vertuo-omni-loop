// The `search-eval-promote` job (PRD omni-loop-8 s4, spec "Promotion"): a daily schedule of the ledger (./schedule.ts),
// 3 tries. A run reads the grouped searches of the last WINDOW_DAYS days, picks each product's TOP_GROUPS most-asked
// groups of each category that never joined its eval set (../search-eval/promote.ts), and for each:
//
//   promote  adds the group's first question to the set (`search_eval_question_promote`); null when it joined already
//   judge    asks galaxy's `relevant` for the question's top 10 hits (galaxy's `eval-search`) and the entries agents
//            opened for its group, 20 entries a call, and keeps each verdict that is not null as Jev's answer
//            (`search_eval_answer_jev`), which never overwrites a person's
//
// A null verdict adds no answer: the decision off, no Jev key or Jev silent leaves the question in the set with no
// right answers until a member gives them (BL-JEV-1). A galaxy that cannot be asked for one question leaves that
// question unjudged and the run goes on. A run out of time asks to run again: a group that joined is no longer
// picked. The payload holds the slot only, never a token and never a question, and no question is logged (L-GDPR-2).
import { noteTo } from '../run-log/run-log.ts';
import { RELEVANT_MAX, type EvalSearcher, type Judge } from '../search-eval/galaxy.ts';
import { countGroups, pickGroups, TOP_GROUPS, WINDOW_DAYS, type GroupCount } from '../search-eval/promote.ts';
import type { SearchEvalStore } from '../search-eval/store.ts';
import type { JobHandler, JobResult } from './worker.ts';

export const SEARCH_EVAL_PROMOTE_KIND = 'search-eval-promote';

/** The most hits of a question that are judged. */
const HITS = 10;
/** How long one run works before it asks to run again: well inside the worker's 240 seconds. */
const BUDGET_MS = 150_000;
/** How long a run that ran out of time waits before the next. */
const AGAIN_MS = 60_000;
const DAY_MS = 86_400_000;

type Counters = { promoted: number; judged: number; unjudged: number };

/** Judges the entries of a promoted question and keeps each verdict; how many answers were kept. Throws when galaxy fails. */
async function judge({ store, search, ask, group, questionId }: { store: SearchEvalStore; search: EvalSearcher; ask: Judge; group: GroupCount; questionId: string }): Promise<number | null> {
  const question = await store.questionOf(questionId);
  if (question === null) return null;
  const hits = (await search({ workspaceId: group.workspaceId, productId: group.productId, question })) ?? [];
  const entries = [...new Set([...hits.slice(0, HITS), ...(await store.opened(group.groupId))])];
  let kept = 0;
  for (let at = 0; at < entries.length; at += RELEVANT_MAX) {
    const verdicts = await ask({ workspaceId: group.workspaceId, productId: group.productId, question, entryIds: entries.slice(at, at + RELEVANT_MAX) });
    for (const verdict of verdicts ?? []) {
      if (verdict.relevant === null) continue;
      if (await store.answerJev({ questionId, entryId: verdict.entryId, relevant: verdict.relevant, confidence: verdict.confidence })) kept += 1;
    }
  }
  return kept;
}

/** The handler of the `search-eval-promote` kind: `store` is the database, `search` and `ask` galaxy's two routes. */
export function searchEvalPromoteHandler({
  store,
  search,
  ask,
  top = TOP_GROUPS,
  days = WINDOW_DAYS,
  clock = Date.now,
  budgetMs = BUDGET_MS,
  log = noteTo('search-eval-promote'),
}: {
  store: SearchEvalStore;
  search: EvalSearcher;
  ask: Judge;
  top?: number;
  days?: number;
  clock?: () => number;
  budgetMs?: number;
  log?: (line: string) => void;
}): JobHandler {
  return async (): Promise<JobResult> => {
    const start = clock();
    const since = new Date(start - days * DAY_MS).toISOString();
    const picks = pickGroups(countGroups(await store.searches(since)), await store.joined(), top);
    const counters: Counters = { promoted: 0, judged: 0, unjudged: 0 };
    for (const group of picks) {
      if (clock() - start >= budgetMs) {
        log(`search eval promote: ${String(counters.promoted)} questions promoted, out of time: again in a minute`);
        return { outcome: 'later', at: new Date(clock() + AGAIN_MS), progress: { promoted: counters.promoted } };
      }
      const questionId = await store.promote({ productId: group.productId, groupId: group.groupId, category: group.category });
      if (questionId === null) continue;
      counters.promoted += 1;
      const kept = await judge({ store, search, ask, group, questionId }).catch(() => null);
      if (kept === null) counters.unjudged += 1;
      else counters.judged += kept;
    }
    log(`search eval promote: ${String(picks.length)} groups picked, ${String(counters.promoted)} questions promoted, ${String(counters.judged)} answers kept, ${String(counters.unjudged)} questions left unjudged`);
    return { outcome: 'done' };
  };
}
