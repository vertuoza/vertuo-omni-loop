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
import { GithubDeferred, GithubPaused } from '@omni/github';
import { z } from 'zod';
import { CONFIG_FILE } from 'omni-loop/kit/lib/config.ts';
import type { Connection } from '../approved-check/record.ts';
import type { RequestOctokit } from '../knowledge-harvest/github.ts';
import { configAt } from '../knowledge-pack/github.ts';
import { packPaths } from '../knowledge-pack/paths.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { Ledger } from './ledger.ts';
import { packJob } from './pack.ts';

/** A repository a product holds, with its newest pack's commit and date: `null` when it has none. */
export type HeldRepository = { repository: string; pack: { sha: string; committedAt: string } | null };

/** What the comparison reads of the database. */
export type GapsStore = { held: () => Promise<HeldRepository[]> };

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
};

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
  log = noteTo('jobs'),
}: {
  store: GapsStore;
  ledger: Pick<Ledger, 'add'>;
  appOctokit: () => Promise<RequestOctokit> | RequestOctokit;
  octokitFor: OctokitFor<RequestOctokit>;
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
      if (budgetRefused(error)) {
        summary.stopped = true;
        log('the comparison stopped: GitHub\'s budget is low, the rest waits for the next hour');
        break;
      }
      summary.failed += 1;
      log(`the comparison could not read ${held.repository}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''}`);
    }
  }
  return summary;
}

async function compareOne(
  { repository, pack }: HeldRepository,
  { ledger, appOctokit, octokitFor, log }: { ledger: Pick<Ledger, 'add'>; appOctokit: () => Promise<RequestOctokit> | RequestOctokit; octokitFor: OctokitFor<RequestOctokit>; log: (line: string) => void },
): Promise<Outcome> {
  const [owner = '', repo = ''] = repository.split('/');
  let installationId: number;
  try {
    const { data } = await (await appOctokit()).request(INSTALLATION, { owner, repo });
    installationId = InstallationSchema.parse(data).id;
  } catch (error) {
    if (statusOf(error) === 404) return 'skipped';
    throw error;
  }
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
