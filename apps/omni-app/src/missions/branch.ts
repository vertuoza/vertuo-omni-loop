// The mission branch the App cuts (PRD 2896, spec "2. The mission branch"): above `with-you`, a mission builds its PRDs on
// `branches.mission`, cut once from the repository's default branch. Through GitHub's REST API only, as the App's installation:
//
//   prepare   reads the repository: when it does not allow rebase merges (`allow_rebase_merge`, which a person alone can turn on),
//             nothing is cut and the answer names the setting; otherwise the branch is read, and cut from the default branch's head
//             when it does not exist yet (../git-write/git-write.ts's `branchHead`, which never writes the default branch).
//             A branch that exists is left as it is: the mission branch holds one commit per PRD, and this run never moves it.
//   per repo  a mission whose scope holds product PRDs (PRD omni-loop-21 s7) cuts its branch in every repository the scope touches:
//             the mission's own for a repository PRD, and each target a product PRD's plan names
//
// Throws when GitHub refuses or answers out of shape: the run fails, and the worker retries it.
import { z } from 'zod';
import { isProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { parsePlanRepositories } from 'omni-loop/kit/lib/inbox/territory.ts';
import { branchHead, refuseDefault } from '../git-write/git-write.ts';
import { RefSchema, statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';
import type { MissionPrd } from './store.prd.ts';

/** What the supervisor asks of GitHub: the branch ready, or why it cannot be. */
export type MissionBranches = {
  prepare: (where: { installation: number; repo: string; branch: string }) => Promise<Prepared>;
};

export type Prepared = { ok: true; cut: boolean } | { ok: false; why: string };

/** `GET /repos/{owner}/{repo}`: the default branch and whether rebase merges are allowed (read with push access). */
const RepoSchema = z.looseObject({ default_branch: z.string(), allow_rebase_merge: z.boolean().optional() });

/** What a mission waits on when its repository does not allow rebase merges: the setting's name, never a guess. */
export const rebaseWhy = (repo: string): string =>
  `${repo} does not allow rebase merges: turn on "Allow rebase merging" in its settings, so the mission branch can land on the default branch; nothing was cut`;

/** What a mission waits on when GitHub does not find a repository its scope names (bug #3271): never a silent retry. */
const notFoundWhy = (repo: string): string => `${repo} is not found on GitHub, or the app is not installed on it: nothing was cut`;

/** The branches of a mission, through `octokitFor(installation)`. */
export function missionBranches({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionBranches {
  return {
    async prepare({ installation, repo, branch }) {
      const [owner = '', name = ''] = repo.split('/');
      const octokit = await octokitFor(installation);
      let data: unknown;
      try {
        ({ data } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo: name }));
      } catch (error) {
        if (statusOf(error) === 404) return { ok: false, why: notFoundWhy(repo) };
        throw error;
      }
      const read = RepoSchema.parse(data);
      // Only `true` is a yes: a repository GitHub does not say it of is never cut a branch it could not land.
      if (read.allow_rebase_merge !== true) return { ok: false, why: rebaseWhy(repo) };
      const head = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo: name, ref: `heads/${read.default_branch}` });
      const from = RefSchema.parse(head.data).object.sha;
      const existed = await exists(octokit, { owner, repo: name, branch });
      await branchHead(octokit, { owner, repo: name, branch, from, defaultBranch: read.default_branch });
      return { ok: true, cut: !existed };
    },
  };
}

/** GitHub names a repository whatever its case. */
const sameRepo = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * The repositories a product PRD's plan names (PRD omni-loop-21 s7): each row of its `## Repositories` table as `owner/name`, a bare
 * name read under `owner`, the mission repository's owner. None for a plan with no such table.
 */
export const planTargets = (plan: string, owner: string): string[] =>
  parsePlanRepositories(plan)
    .map(({ repo }) => repo.trim())
    .filter((repo) => REPOSITORY.test(repo))
    .map((repo) => (repo.includes('/') ? repo : `${owner}/${repo}`));

/** A Repositories cell that names a repository, `owner/name` or a bare `name`: a cell such as `omni-loop (this repository)` names none (bug #3271). */
const REPOSITORY = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?$/;

/**
 * Every repository the scope touches (PRD omni-loop-21 s7, spec "2. One mission branch per repository"), once each, in order: the
 * mission's own repository when a repository PRD is in scope, then each target of each product PRD's plan (`targets`, by PRD). A
 * product PRD whose plan was not read names none yet.
 */
export function scopeRepos({ repo, prds, targets }: { repo: string; prds: readonly MissionPrd[]; targets: ReadonlyMap<ProductPrdId, readonly string[]> }): string[] {
  const named = prds.flatMap((prd) => (isProductPrdId(prd) ? (targets.get(prd) ?? []) : [repo]));
  return named.filter((one, at) => named.findIndex((other) => sameRepo(other, one)) === at);
}

/**
 * The mission branch cut in each of `repos` (PRD omni-loop-21 s7): every repository is asked, in order, and the answer is ready only
 * when each is, naming the ones cut now; else every refusal, joined, for the mission to wait on.
 */
export async function prepareAll(
  branches: MissionBranches,
  { installation, repos, branch }: { installation: number; repos: readonly string[]; branch: string },
): Promise<{ ok: true; cut: string[] } | { ok: false; why: string }> {
  const cut: string[] = [];
  const refused: string[] = [];
  for (const repo of repos) {
    const prepared = await branches.prepare({ installation, repo, branch });
    if (!prepared.ok) refused.push(prepared.why);
    else if (prepared.cut) cut.push(repo);
  }
  return refused.length > 0 ? { ok: false, why: refused.join('; ') } : { ok: true, cut };
}

/** `GET /repos/{owner}/{repo}`: its default branch. */
const DefaultBranchSchema = z.looseObject({ default_branch: z.string() });

/**
 * The repository of a mission branch, as the App's installation: its client, owner, name and default branch, once `branch` is
 * shown not to be the default branch, which the App never writes (N-PRODUCT-15). Throws before anything else is asked otherwise.
 */
export async function missionRepo(
  octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient,
  { installation, repo: slug, branch }: { installation: number; repo: string; branch: string },
): Promise<{ octokit: GitHubClient; owner: string; repo: string; defaultBranch: string }> {
  const [owner = '', repo = ''] = slug.split('/');
  const octokit = await octokitFor(installation);
  const defaultBranch = DefaultBranchSchema.parse((await octokit.request('GET /repos/{owner}/{repo}', { owner, repo })).data).default_branch;
  refuseDefault(branch, defaultBranch);
  return { octokit, owner, repo, defaultBranch };
}

/** Whether `branch` exists already (a 404 says it does not). */
async function exists(octokit: GitHubClient, { owner, repo, branch }: { owner: string; repo: string; branch: string }): Promise<boolean> {
  try {
    await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` });
    return true;
  } catch (error) {
    if (statusOf(error) === 404) return false;
    throw error;
  }
}
