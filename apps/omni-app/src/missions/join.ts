// A PRD joins its mission's branch (PRD 2896 s4, spec "3. Joining the mission branch"): what the merge gate (./gate.ts) reads of
// a PRD's feature pull request, and the squash-merge once it passes. Through GitHub's REST API only, as the App's installation:
//
//   read    the pull request (its state, draft, base, head and title), every check run and commit status on its head, its
//           reviews (the Reviewer's marker and the commit each is on), and the PRD's open outbox items at its head: the
//           head's `.omni-loop/config.yml` and that PRD's outbox folder only, through ../snapshot/snapshot.ts, parsed by the
//           kit's own outbox reader, never by running anything it fetched. Its other PRDs' items are never fetched
//   merge   `PUT …/pulls/{n}/merge`, squash, its commit titled as the pull request (`<title> (#<n>)`, the repository's
//           squash title), pinned to the head the gate judged: a push since then makes GitHub refuse it. A refusal (not
//           mergeable, the head moved, a conflict) is an answer, never a throw: the PRD waits, and the next run reads again.
//           A base that is the default branch is refused before any request (N-PRODUCT-15)
//
// Throws when GitHub answers out of shape or fails otherwise: the run fails, and the worker retries it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { parseFolderName } from 'omni-loop/kit/lib/layout.ts';
import { openItems } from 'omni-loop/kit/lib/outbox/status.ts';
import { messageOf, statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';
import { readBaseConfig } from '../outbox-check/github.ts';
import { paginate, PER_PAGE } from '../retro/github.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import type { OpenItems, PullRead } from './gate.ts';

/** Where a pull request is: the installation, the repository (`owner/name`), the PRD and its pull request. */
export type PullAt = { installation: number; repo: string; prd: PrdNumber; pr: PrNumber };

/** What a merge did: merged, or why GitHub refused it. */
export type Merged = { ok: true } | { ok: false; why: string };

/** What the supervisor asks of GitHub to join a PRD to its mission's branch. */
export type MissionJoins = {
  read: (at: PullAt) => Promise<PullRead>;
  merge: (at: PullAt & { head: string; title: string; base: string; defaultBranch: string }) => Promise<Merged>;
};

/** `GET /repos/{owner}/{repo}/pulls/{pull_number}`: the fields the gate reads. */
const PullSchema = z.looseObject({
  html_url: z.string(),
  title: z.string(),
  state: z.string(),
  draft: z.boolean().nullish(),
  merged: z.boolean().nullish(),
  merged_at: z.string().nullish(),
  base: z.looseObject({ ref: z.string(), repo: z.looseObject({ default_branch: z.string() }) }),
  head: z.looseObject({ sha: z.string() }),
});

/** One page of `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`. */
const CheckRunsSchema = z.looseObject({
  check_runs: z.array(
    z.looseObject({ id: z.number(), name: z.string(), status: z.string(), conclusion: z.string().nullish(), output: z.looseObject({ title: z.string().nullish() }).nullish() }),
  ),
});

/** `GET /repos/{owner}/{repo}/commits/{ref}/status`: the latest status of each context. */
const StatusSchema = z.looseObject({ statuses: z.array(z.looseObject({ context: z.string(), state: z.string(), description: z.string().nullish() })) });

/** One page of `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`, oldest first. */
const ReviewsSchema = z.array(z.looseObject({ body: z.string().nullish(), commit_id: z.string().nullish() }));

/** What GitHub answers a refused merge with: not mergeable (405), the head moved (409), or a refusal it explains (422). */
const REFUSED = new Set([405, 409, 422]);

/** Thrown when a merge would land on the default branch: the App merges into a mission branch only. */
export class DefaultBranchMergeError extends Error {
  constructor(branch: string) {
    super(`refusing to merge into ${branch}, the default branch: only a person merges there`);
    this.name = 'DefaultBranchMergeError';
  }
}

/** The PRD's open outbox items at `ref`, by rank (null for one that does not parse); why not, when the head holds no config. */
async function openItemsAt(octokit: GitHubClient, { owner, repo, ref, prd }: { owner: string; repo: string; ref: string; prd: PrdNumber }): Promise<OpenItems> {
  const folder = mkdtempSync(join(tmpdir(), 'omni-join-'));
  try {
    const { config, error } = await readBaseConfig(octokit, { owner, repo, baseSha: ref, dest: folder, ignoreUnknownKeys: true });
    if (!config) return { notRead: error ? `its .omni-loop/config.yml cannot be read: ${error.message.split('\n')[0] ?? ''}` : 'its head has no .omni-loop/config.yml' };
    const outbox = createContext(folder, config).layout.dirs.outbox;
    // Only this PRD's folder is fetched: another PRD's file is written empty, its name kept, its blob never asked.
    const ofPrd = (path: string): boolean => parseFolderName(path.slice(outbox.length + 1).split('/')[0] ?? '')?.prd === prd;
    await snapshot(octokit, { owner, repo, ref, paths: [outbox], dest: folder, fetchIf: ofPrd });
    return { ranks: openItems(prd, { ctx: createContext(folder, config) }).map(({ rank }) => rank) };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** The joins of a mission, through `octokitFor(installation)`. */
export function missionJoins({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionJoins {
  return {
    async read({ installation, repo: slug, prd, pr }) {
      const [owner = '', repo = ''] = slug.split('/');
      const octokit = await octokitFor(installation);
      const pull = PullSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: pr })).data);
      const ref = pull.head.sha;
      const runs = await paginate(async (page) =>
        CheckRunsSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { owner, repo, ref, per_page: PER_PAGE, page })).data).check_runs,
      );
      const status = StatusSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', { owner, repo, ref, per_page: PER_PAGE })).data);
      const reviews = await paginate(async (page) => ReviewsSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', { owner, repo, pull_number: pr, per_page: PER_PAGE, page })).data));
      const merged = pull.merged === true || (pull.merged_at ?? null) !== null;
      return {
        number: pr,
        url: pull.html_url,
        title: pull.title,
        state: pull.state,
        draft: pull.draft === true,
        merged,
        base: pull.base.ref,
        defaultBranch: pull.base.repo.default_branch,
        head: ref,
        runs: runs.map((one) => ({ id: one.id, name: one.name, status: one.status, conclusion: one.conclusion ?? null, title: one.output?.title ?? null })),
        statuses: status.statuses.map((one) => ({ context: one.context, state: one.state, description: one.description ?? null })),
        reviews: reviews.map((one) => ({ body: one.body ?? null, commit: one.commit_id ?? null })),
        // A merged or closed pull request merges nothing: its outbox is not read.
        items: merged || pull.state !== 'open' ? { ranks: [] } : await openItemsAt(octokit, { owner, repo, ref, prd }),
      };
    },

    async merge({ installation, repo: slug, pr, head, title, base, defaultBranch }) {
      if (base === defaultBranch) throw new DefaultBranchMergeError(base);
      const [owner = '', repo = ''] = slug.split('/');
      const octokit = await octokitFor(installation);
      try {
        await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', { owner, repo, pull_number: pr, merge_method: 'squash', sha: head, commit_title: `${title} (#${String(pr)})` });
        return { ok: true };
      } catch (error) {
        const status = statusOf(error);
        if (typeof status === 'number' && REFUSED.has(status)) return { ok: false, why: `GitHub refused the merge: ${String(messageOf(error)).split('\n')[0] ?? ''}` };
        throw error;
      }
    },
  };
}
