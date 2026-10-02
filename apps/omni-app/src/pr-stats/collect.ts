// The collection behind the Engineering board (PRD 612): every tracked repository of every workspace
// with an installation of the app, read from GitHub and written to the store.
//
//   step "list-repositories"                  the tracked repositories and their installations
//   steps "collect <workspace>/<repo> <n>"    one repository, at most `BATCH` pull requests a step
//
// A repository's first collection backfills `BACKFILL_DAYS` days; each after it reads only the pull
// requests updated after its cursor (`collected_until`), oldest update first, so the cursor only moves
// past what was written. A failure (no access, a rate limit, a GitHub error) is caught inside that
// repository's step and recorded on its row (`collect_error`), with the cursor at what was written;
// the next run retries it from there, and the other repositories are collected all the same.
// Upserts keyed on the pull request and the reviewer make a second run write the same rows.
//
// The installation's GitHub budget is shared with the outbox check (bug 638): every read goes through
// GraphQL, and once a budget would drop under half, the run ends for every repository of that
// installation, each cursor at what was written and no error recorded; the next run carries on.
import { type Budget, BudgetLow, type GraphqlOctokit, type ListedPull, affords, pullsUpdatedAfter, readPullRecords } from './github.ts';
import { FailureSchema } from './schema.ts';
import type { PrStatsStore, TrackedRepository } from './supabase-store.ts';
import type { OctokitFor } from '../octokit-for.ts';

export const BACKFILL_DAYS = 90;
/**
 * Pull requests read and written in one step at most: one GraphQL query reads them all, and one step is
 * one call of a Vercel function, so a step stays well inside its time limit.
 */
export const BATCH = 50;
/** Steps one repository takes at most in one run; a longer backfill carries on at the next run. */
const MAX_BATCHES = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The part of an Inngest step the collector runs: one memoized, retried unit, its output as JSON. */
export type CollectStep = { run: <T>(id: string, fn: () => T | Promise<T>) => Promise<T> };

/** What a run did: repositories by how their collection ended, and pull requests saved. */
export type CollectSummary = { repositories: number; saved: number } & Record<Outcome, number>;

type Outcome = 'collected' | 'failed' | 'unfinished' | 'paused';

/** What one batch did, and where the repository's cursor and its installation's budget stand. */
type BatchOut = { saved: number; cursor: string; more: boolean; paused?: true; error?: string; budget: Budget };

type RepositoryRun = {
  store: PrStatsStore;
  octokitFor: OctokitFor<GraphqlOctokit>;
  step: CollectStep;
  repository: TrackedRepository;
  budgets: Map<number, Budget>;
  backfillFrom: string;
  nowIso: string;
};

/** Every tracked repository collected, a step per batch; `now` is the run's clock, in ms. */
export async function collectAll({ store, octokitFor, step, now }: {
  store: PrStatsStore;
  octokitFor: OctokitFor<GraphqlOctokit>;
  step: CollectStep;
  now: number;
}): Promise<CollectSummary> {
  const nowIso = new Date(now).toISOString();
  const backfillFrom = new Date(now - BACKFILL_DAYS * DAY_MS).toISOString();
  const repositories = await step.run('list-repositories', () => store.trackedRepositories());

  const summary: CollectSummary = { repositories: repositories.length, collected: 0, failed: 0, unfinished: 0, paused: 0, saved: 0 };
  /** Each installation's budget, as its last query answered it; `{}` until its first. */
  const budgets = new Map<number, Budget>();
  for (const repository of repositories) {
    const { outcome, saved } = await collectRepository({ store, octokitFor, step, repository, budgets, backfillFrom, nowIso });
    summary[outcome] += 1;
    summary.saved += saved;
  }
  return summary;
}

/**
 * One repository, a step per batch, until it is collected, fails, reaches `MAX_BATCHES` or its
 * installation's budget is down to half; a budget already there reads nothing.
 * @returns {Promise<{ outcome: 'collected' | 'failed' | 'unfinished' | 'paused', saved: number }>}
 */
async function collectRepository({ store, octokitFor, step, repository, budgets, backfillFrom, nowIso }: RepositoryRun): Promise<{ outcome: Outcome; saved: number }> {
  const { installationId, workspaceId, fullName } = repository;
  let saved = 0;
  let cursor = repository.collectedUntil ?? backfillFrom;
  for (let n = 1; ; n += 1) {
    const budget = budgets.get(installationId) ?? {};
    if (!affords(budget)) return { outcome: 'paused', saved };
    const out = await step.run(`collect ${workspaceId}/${fullName} ${n}`, () =>
      collectBatch({ store, octokitFor, repository, cursor, nowIso, budget }),
    );
    saved += out.saved;
    cursor = out.cursor;
    budgets.set(installationId, out.budget);
    const outcome = outcomeOf(out, n);
    if (outcome) return { outcome, saved };
  }
}

/** How a repository's collection ends after its `n`th batch, or nothing when it goes on. */
function outcomeOf(out: BatchOut, n: number): Outcome | null {
  if (out.paused) return 'paused';
  if (out.error) return 'failed';
  if (!out.more) return 'collected';
  return n === MAX_BATCHES ? 'unfinished' : null;
}

/** One step of one repository: at most one batch of pull requests, then its row updated. */
async function collectBatch({ store, octokitFor, repository, cursor, nowIso, budget: before }: Omit<RepositoryRun, 'step' | 'budgets' | 'backfillFrom'> & { cursor: string; budget: Budget }): Promise<BatchOut> {
  const { workspaceId, fullName, installationId } = repository;
  const [owner, repo] = fullName.split('/');
  let reached = cursor;
  let saved = 0;
  const budget = { ...before };
  try {
    const octokit = await octokitFor(installationId);
    const listed = await pullsUpdatedAfter(octokit, budget, { owner, repo, since: cursor });
    const taken = batchOf(listed);
    const records = await readPullRecords(octokit, budget, { workspaceId, fullName, numbers: taken.map((item) => item.number) });
    const byNumber = new Map(records.map((record) => [record.row.number, record]));
    for (const [index, item] of taken.entries()) {
      const record = byNumber.get(item.number);
      if (record) {
        await store.savePull(record.row, record.reviews);
        saved += 1;
      }
      // The cursor never stops between two pull requests updated at the same instant: the next read
      // starts strictly after it.
      if (taken[index + 1]?.updatedAt !== item.updatedAt) reached = item.updatedAt;
    }
    const more = listed.length > taken.length;
    await store.updateRepository(
      workspaceId,
      fullName,
      more ? { collected_until: reached } : { collected_at: nowIso, collected_until: reached, collect_error: null },
    );
    return { saved, cursor: reached, more, budget };
  } catch (error) {
    if (error instanceof BudgetLow) {
      await store.updateRepository(workspaceId, fullName, { collected_until: reached });
      return { saved, cursor: reached, more: false, paused: true, budget };
    }
    const reason = describe(error);
    await store.updateRepository(workspaceId, fullName, { collected_until: reached, collect_error: reason });
    return { saved, cursor: reached, more: false, error: reason, budget };
  }
}

/** The first `BATCH` pull requests, and every one after them updated at the same instant as the last. */
function batchOf(listed: ListedPull[]): ListedPull[] {
  let end = Math.min(BATCH, listed.length);
  while (end < listed.length && listed[end]?.updatedAt === listed[end - 1]?.updatedAt) end += 1;
  return listed.slice(0, end);
}

/** What a failed GitHub call says: GraphQL's first error, or the HTTP status and the first line. */
function describe(error: unknown): string {
  const failure = FailureSchema.safeParse(error);
  const { errors, message: said, status } = failure.success ? failure.data : {};
  const graphqlError = errors?.[0];
  if (graphqlError?.message) return [graphqlError.type, graphqlError.message].filter(Boolean).join(': ');
  const message = String(said ?? error ?? 'unknown error').split('\n')[0] ?? '';
  return status ? `HTTP ${status}: ${message}` : message;
}
