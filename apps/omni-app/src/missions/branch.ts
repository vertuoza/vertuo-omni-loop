// The mission branch the App cuts (PRD 2896, spec "2. The mission branch"): above `with-you`, a mission builds its PRDs on
// `branches.mission`, cut once from the repository's default branch. Through GitHub's REST API only, as the App's installation:
//
//   prepare   reads the repository: when it does not allow rebase merges (`allow_rebase_merge`, which a person alone can turn on),
//             nothing is cut and the answer names the setting; otherwise the branch is read, and cut from the default branch's head
//             when it does not exist yet (../git-write/git-write.ts's `branchHead`, which never writes the default branch).
//             A branch that exists is left as it is: the mission branch holds one commit per PRD, and this run never moves it.
//
// Throws when GitHub refuses or answers out of shape: the run fails, and the worker retries it.
import { z } from 'zod';
import { branchHead } from '../git-write/git-write.ts';
import { RefSchema, statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';

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

/** The branches of a mission, through `octokitFor(installation)`. */
export function missionBranches({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionBranches {
  return {
    async prepare({ installation, repo, branch }) {
      const [owner = '', name = ''] = repo.split('/');
      const octokit = await octokitFor(installation);
      const { data } = await octokit.request('GET /repos/{owner}/{repo}', { owner, repo: name });
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
