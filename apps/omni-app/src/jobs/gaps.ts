// The comparison (PRD 2676 s4, spec "What adds a job"), once an hour: GitHub does not send a failed webhook again, so
// for each repository a product holds and the App is installed on it reads
//
//   the config            at the head of the default branch: what a pack holds (../knowledge-pack/paths.ts)
//   the latest commit     on the default branch that touched the knowledge folder or the config
//
// and compares that commit with the repository's newest pack. No pack, or an older one, adds a pack job for the
// commit (`packJob`, with no pull request: the job goes straight to reading the paths); the same pack, or a newer
// one, adds none. A repository the App is not installed on, or one whose config is missing or does not parse, is
// left alone and named. A job already held for the commit is not added twice: the ledger keys it by repository and
// commit. This also makes the first pack of a repository that never had one.
//
// Every read of an installation is its budgeted client at `background` priority (PRD 902). The first refusal for a
// low budget stops the whole comparison, the repositories left for the next hour. A repository GitHub otherwise
// refuses is logged and the others go on. Nothing is written on GitHub; the lookup of the installation is the
// App's own call.
//
// A retro owed at the switch (PRD omni-loop-4 s3, spec "What is owed at the switch"): then, unless the pack's rule
// stopped, for each repository of each installation of the App (the App's own call lists them) it reads one page of
// the pull requests closed into the default branch, the latest updated first, and adds a `retro` job, `owed`, for
// each feature PR (its head matching `branches.feature` of the config at the default branch) merged in the last
// `THRESHOLDS.afterMergeDays` days. The config is read only when one merged in that window. The ledger keys the job
// as `/api/github` does, so a retro already added, done or waiting for its day 14, is never added twice; the job
// itself publishes nothing again when its retro PR or verdict comment exists (../retro/retro.ts). The same budget
// stops it; a repository GitHub otherwise refuses is counted and logged, and the others go on.
//
// A main watch owed at the switch (PRD omni-loop-4 s4, spec "What is owed at the switch"): last, unless a rule before
// it stopped, each PRD's own lane still `watching` in `prd_main_watch` inside its seven days gets a `main-watch` job
// (`mainWatchJob`), the pull request that merged at its commit found on GitHub as the installation. The ledger keys it
// as `/api/github` does, so a watch with a job, live or finished, is never added twice; the job opens its lanes again,
// which leaves their rows as they are, and carries on from the store. The same budget stops it.
import { GithubDeferred, GithubPaused } from '@omni/github';
import { z } from 'zod';
import { CONFIG_FILE } from 'omni-loop/kit/lib/config.ts';
import type { Connection } from '../approved-check/record.ts';
import type { RequestOctokit } from '../knowledge-harvest/github.ts';
import { configAt } from '../knowledge-pack/github.ts';
import { packPaths } from '../knowledge-pack/paths.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { THRESHOLDS } from '../retro/rules.ts';
import { topicOf } from '../retro/qualify.ts';
import { mainWatchJob } from '../main-watch/main-watch.ts';
import { retroJob } from '../retro/retro.ts';
import { noteTo } from '../run-log/run-log.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { Ledger } from './ledger.ts';
import { packJob } from './pack.ts';

/** A repository a product holds, with its newest pack's commit and date: `null` when it has none. */
export type HeldRepository = { repository: string; pack: { sha: string; committedAt: string } | null };

/** A PRD's own lane of the main watch, still `watching`: its repository and PRD, the merge it watches and its seven days. */
export type WatchingLane = { repository: string; mergeSha: string; mergedAt: string; watchUntil: string };

/** What the comparison reads of the database. `watching` is absent from a store that holds no main watch (a test's). */
export type GapsStore = { held: () => Promise<HeldRepository[]>; watching?: () => Promise<WatchingLane[]> };

/** What the comparison did: the repositories read, the jobs added, and what it left alone, by why. */
export type GapsSummary = {
  read: number;
  added: number;
  /** A repository the App is not installed on, or whose config says there is nothing to pack. */
  skipped: number;
  /** A repository GitHub refused for another reason: logged, never named here. */
  failed: number;
  /** GitHub's budget was low: the comparison stopped there. */
  stopped: boolean;
  /**
   * The retro's rule (PRD omni-loop-4 s3): the repositories it read, the owed `retro` jobs it added, and the
   * repositories (or the App's list of installations) GitHub refused. Absent when the pack's rule stopped first.
   */
  retros?: RetrosSummary;
  /** The main watch's rule (PRD omni-loop-4 s4): the lanes it read, the owed `main-watch` jobs it added, and those GitHub refused. */
  watches?: RetrosSummary;
};

/** What the retro's rule did. */
type RetrosSummary = { read: number; added: number; failed: number };

const WatchingRowSchema = z.object({ repository: z.string().min(1), lane: z.string().min(1), merge_sha: z.string().min(1), merged_at: z.string().min(1), watch_until: z.string().min(1) });
const HeldRowSchema = z.object({ repository: z.string().min(1) });
const PackRowSchema = z.object({ repository: z.string().min(1), sha: z.string().min(1), committed_at: z.string().min(1) });

/** The store, as the service role on `connection`. */
export function gapsStore(connection: Connection): GapsStore {
  const db = serviceDb(connection);
  return {
    held: async () => {
      const held = rowsOf(HeldRowSchema, await db.from('product_repositories').select('repository'));
      const packs = rowsOf(PackRowSchema, await db.from('knowledge_packs').select('repository, sha, committed_at').eq('newest', true));
      const newest = new Map<string, { sha: string; committedAt: string }>();
      for (const row of packs) {
        const known = newest.get(row.repository);
        if (!known || Date.parse(row.committed_at) > Date.parse(known.committedAt)) newest.set(row.repository, { sha: row.sha, committedAt: row.committed_at });
      }
      return [...new Set(held.map((row) => row.repository.toLowerCase()))].sort().map((repository) => ({ repository, pack: newest.get(repository) ?? null }));
    },
    watching: async () =>
      rowsOf(WatchingRowSchema, await db.from('prd_main_watch').select('repository, lane, merge_sha, merged_at, watch_until').eq('status', 'watching'))
        .filter((row) => row.lane === row.repository)
        .map((row) => ({ repository: row.repository, mergeSha: row.merge_sha, mergedAt: row.merged_at, watchUntil: row.watch_until })),
  };
}

const InstallationSchema = z.looseObject({ id: z.number().int().positive() });
const RepositorySchema = z.looseObject({ default_branch: z.string().min(1) });
const CommitsSchema = z.array(z.looseObject({ sha: z.string().regex(/^[0-9a-f]{40}$/), commit: z.looseObject({ committer: z.looseObject({ date: z.string().min(1) }).nullish() }) }));

const INSTALLATION = 'GET /repos/{owner}/{repo}/installation';

/** The status GitHub refused with, when `error` carries one. */
const statusOf = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
};

/** Whether GitHub's budget refused the call, however deep Octokit wrapped it. */
function budgetRefused(error: unknown): boolean {
  for (let cause = error, depth = 0; cause instanceof Error && depth < 4; cause = cause.cause, depth += 1) {
    if (cause instanceof GithubDeferred || cause instanceof GithubPaused) return true;
  }
  return false;
}

/** The latest commit on `branch` that touched any of `paths`, with its date; null when none did. */
async function latestCommit(octokit: RequestOctokit, { owner, repo, branch, paths }: { owner: string; repo: string; branch: string; paths: string[] }): Promise<{ sha: string; committedAt: string } | null> {
  let latest: { sha: string; committedAt: string } | null = null;
  for (const path of paths) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits', { owner, repo, sha: branch, path, per_page: 1 });
    const [commit] = CommitsSchema.parse(data);
    const committedAt = commit?.commit.committer?.date;
    if (commit && committedAt && (!latest || Date.parse(committedAt) > Date.parse(latest.committedAt))) latest = { sha: commit.sha, committedAt };
  }
  return latest;
}

/** The installation of the App on `owner/repo`; null when the App is not installed there. */
async function installationOf(appOctokit: () => Promise<RequestOctokit> | RequestOctokit, owner: string, repo: string): Promise<number | null> {
  try {
    const { data } = await (await appOctokit()).request(INSTALLATION, { owner, repo });
    return InstallationSchema.parse(data).id;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

type Outcome = 'added' | 'same' | 'skipped';

/**
 * Compares each held repository's newest pack with its latest knowledge commit and adds a job where the pack is
 * missing or older. `appOctokit` is the App's own client (the installation lookup), `octokitFor` an installation's.
 */
export async function compareGaps({
  store,
  ledger,
  appOctokit,
  octokitFor,
  now = Date.now,
  log = noteTo('jobs'),
}: {
  store: GapsStore;
  ledger: Pick<Ledger, 'add'>;
  appOctokit: () => Promise<RequestOctokit> | RequestOctokit;
  octokitFor: OctokitFor<RequestOctokit>;
  /** The clock the retro's window is read on. */
  now?: () => number;
  log?: (line: string) => void;
}): Promise<GapsSummary> {
  const summary: GapsSummary = { read: 0, added: 0, skipped: 0, failed: 0, stopped: false };
  for (const held of await store.held()) {
    try {
      const outcome = await compareOne(held, { ledger, appOctokit, octokitFor, log });
      summary.read += 1;
      if (outcome === 'added') summary.added += 1;
      else if (outcome === 'skipped') summary.skipped += 1;
    } catch (error) {
      if (budgetRefused(error)) return stoppedBy(summary, log);
      summary.failed += 1;
      log(`the comparison could not read ${held.repository}: ${firstLine(error)}`);
    }
  }
  summary.retros = { read: 0, added: 0, failed: 0 };
  try {
    await addOwedRetros(summary.retros, { ledger, appOctokit, octokitFor, now, log });
  } catch (error) {
    if (!budgetRefused(error)) throw error;
    return stoppedBy(summary, log);
  }
  summary.watches = { read: 0, added: 0, failed: 0 };
  try {
    await addOwedWatches(summary.watches, { store, ledger, appOctokit, octokitFor, now, log });
  } catch (error) {
    if (!budgetRefused(error)) throw error;
    return stoppedBy(summary, log);
  }
  return summary;
}

/** The summary of a comparison GitHub's budget stopped, said in the log. */
function stoppedBy(summary: GapsSummary, log: (line: string) => void): GapsSummary {
  log('the comparison stopped: GitHub\'s budget is low, the rest waits for the next hour');
  return { ...summary, stopped: true };
}

/** An error's first line. */
const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';

const InstallationsSchema = z.array(z.looseObject({ id: z.number().int().positive() }));
const InstalledSchema = z.looseObject({
  repositories: z.array(z.looseObject({ name: z.string().min(1), owner: z.looseObject({ login: z.string().min(1) }), default_branch: z.string().min(1) })),
});
const ClosedPullsSchema = z.array(
  z.looseObject({
    number: PrNumberSchema,
    merged_at: z.string().nullish(),
    merge_commit_sha: z.string().nullish(),
    head: z.looseObject({ ref: z.string() }),
  }),
);

const PER_PAGE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Every item of a paginated list, `page(n)` giving one page's items, 30 pages at most. */
async function everyPage<T>(page: (n: number) => Promise<readonly T[]>): Promise<T[]> {
  const all: T[] = [];
  for (let n = 1; n <= 30; n += 1) {
    const items = await page(n);
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
}

/**
 * The retro's rule: an owed `retro` job for each feature PR merged in the window, in each repository of each
 * installation of the App. A refusal for a low budget is thrown to the caller; any other is counted in `summary`.
 */
async function addOwedRetros(
  summary: RetrosSummary,
  { ledger, appOctokit, octokitFor, now, log }: { ledger: Pick<Ledger, 'add'>; appOctokit: () => Promise<RequestOctokit> | RequestOctokit; octokitFor: OctokitFor<RequestOctokit>; now: () => number; log: (line: string) => void },
): Promise<void> {
  let installations: number[];
  try {
    const app = await appOctokit();
    installations = (await everyPage(async (page) => InstallationsSchema.parse((await app.request('GET /app/installations', { per_page: PER_PAGE, page })).data))).map(({ id }) => id);
  } catch (error) {
    if (budgetRefused(error)) throw error;
    summary.failed += 1;
    log(`the comparison could not list the App's installations for the retros owed: ${firstLine(error)}`);
    return;
  }
  for (const installationId of installations) {
    const octokit = await octokitFor(installationId);
    const repositories = await everyPage(async (page) => InstalledSchema.parse((await octokit.request('GET /installation/repositories', { per_page: PER_PAGE, page })).data).repositories);
    for (const { name: repo, owner: { login: owner }, default_branch: branch } of repositories) {
      try {
        summary.added += await owedIn(octokit, { installationId, owner, repo, branch, since: now() - THRESHOLDS.afterMergeDays * DAY_MS, ledger, log });
        summary.read += 1;
      } catch (error) {
        if (budgetRefused(error)) throw error;
        summary.failed += 1;
        log(`the comparison could not read the retros owed in ${owner}/${repo}: ${firstLine(error)}`);
      }
    }
  }
}

/** The owed `retro` jobs added in one repository: its feature PRs merged into `branch` since `since`. */
async function owedIn(
  octokit: RequestOctokit,
  { installationId, owner, repo, branch, since, ledger, log }: { installationId: number; owner: string; repo: string; branch: string; since: number; ledger: Pick<Ledger, 'add'>; log: (line: string) => void },
): Promise<number> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', { owner, repo, state: 'closed', base: branch, sort: 'updated', direction: 'desc', per_page: PER_PAGE, page: 1 });
  const merged = ClosedPullsSchema.parse(data).filter((pull) => pull.merge_commit_sha && pull.merged_at && Date.parse(pull.merged_at) >= since);
  if (merged.length === 0) return 0;
  const read = await configAt(octokit, { owner, repo, sha: branch });
  if ('none' in read) {
    log(`the comparison leaves the retros of ${owner}/${repo} alone: ${read.none}`);
    return 0;
  }
  let added = 0;
  for (const pull of merged.filter(({ head }) => topicOf(head.ref, read.config.branches.feature) !== null)) {
    const job = retroJob({ installationId, owner, repo, prNumber: pull.number, mergeSha: pull.merge_commit_sha ?? '', mergedAt: pull.merged_at ?? null, owed: true });
    if (await ledger.add(job)) added += 1;
  }
  return added;
}

async function compareOne(
  { repository, pack }: HeldRepository,
  { ledger, appOctokit, octokitFor, log }: { ledger: Pick<Ledger, 'add'>; appOctokit: () => Promise<RequestOctokit> | RequestOctokit; octokitFor: OctokitFor<RequestOctokit>; log: (line: string) => void },
): Promise<Outcome> {
  const [owner = '', repo = ''] = repository.split('/');
  const installationId = await installationOf(appOctokit, owner, repo);
  if (installationId === null) return 'skipped';
  const octokit = await octokitFor(installationId);
  const { data } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo });
  const branch = RepositorySchema.parse(data).default_branch;
  const read = await configAt(octokit, { owner, repo, sha: branch });
  if ('none' in read) {
    log(`the comparison leaves ${repository} alone: ${read.none}`);
    return 'skipped';
  }
  const paths = packPaths(read.config);
  const latest = await latestCommit(octokit, { owner, repo, branch, paths: [...paths.folders, CONFIG_FILE] });
  if (!latest) return 'same';
  if (pack && (pack.sha === latest.sha || Date.parse(pack.committedAt) >= Date.parse(latest.committedAt))) return 'same';
  const added = await ledger.add(packJob({ installationId, owner, repo, sha: latest.sha, committedAt: latest.committedAt }));
  return added ? 'added' : 'same';
}

const PullsOfCommitSchema = z.array(z.looseObject({ number: PrNumberSchema, merged_at: z.string().nullish(), merge_commit_sha: z.string().nullish() }));

/**
 * The main watch's rule: an owed `main-watch` job for each PRD's own lane still `watching` inside its seven days. A
 * refusal for a low budget is thrown to the caller; any other is counted in `summary`.
 */
async function addOwedWatches(
  summary: RetrosSummary,
  { store, ledger, appOctokit, octokitFor, now, log }: { store: GapsStore; ledger: Pick<Ledger, 'add'>; appOctokit: () => Promise<RequestOctokit> | RequestOctokit; octokitFor: OctokitFor<RequestOctokit>; now: () => number; log: (line: string) => void },
): Promise<void> {
  const lanes = (await store.watching?.()) ?? [];
  for (const watching of lanes.filter(({ watchUntil }) => Date.parse(watchUntil) > now())) {
    try {
      summary.added += await owedWatch(watching, { ledger, appOctokit, octokitFor });
      summary.read += 1;
    } catch (error) {
      if (budgetRefused(error)) throw error;
      summary.failed += 1;
      log(`the comparison could not read the main watch owed in ${watching.repository}: ${firstLine(error)}`);
    }
  }
}

/** The owed `main-watch` job of one lane: 1 when added, 0 when the App is not installed, no merged pull request holds the commit, or the ledger holds the job. */
async function owedWatch(
  { repository, mergeSha, mergedAt }: WatchingLane,
  { ledger, appOctokit, octokitFor }: { ledger: Pick<Ledger, 'add'>; appOctokit: () => Promise<RequestOctokit> | RequestOctokit; octokitFor: OctokitFor<RequestOctokit> },
): Promise<number> {
  const [owner = '', repo = ''] = repository.split('/');
  const installationId = await installationOf(appOctokit, owner, repo);
  if (installationId === null) return 0;
  const octokit = await octokitFor(installationId);
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', { owner, repo, commit_sha: mergeSha });
  const pull = PullsOfCommitSchema.parse(data).find((one) => one.merged_at && one.merge_commit_sha === mergeSha);
  if (!pull) return 0;
  return (await ledger.add(mainWatchJob({ installationId, owner, repo, prNumber: pull.number, mergeSha, mergedAt }))) ? 1 : 0;
}
