// The Omni Loop repository's issues, as the Omni App (PRD 2980 s4): the live side of `BugIssues` (./file.ts). The App's own
// JWT finds its installation on the repository, then that installation's client writes, so the issue and its comments are
// signed as the Omni App, never as a person (L-AIACT-1). Every answer is parsed where it comes in.
//
// `bugGithub` (PRD 3088 s4) is the live side of `BugGithub` (./follow.ts): it only reads, the issue, the fix pull request and
// the releases, by the same installation.
import { IssueNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { z } from 'zod';
import type { OctokitFor } from '../octokit-for.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import type { BugIssues } from './file.ts';
import type { BugGithub } from './follow.ts';

const InstallationSchema = z.looseObject({ id: z.number().int().positive() });
const IssueCreatedSchema = z.looseObject({ number: IssueNumberSchema });
const IssueReadSchema = z.looseObject({ state: z.string(), state_reason: z.string().nullish() });
const PullReadSchema = z.looseObject({ state: z.string(), merged: z.boolean().nullish(), merge_commit_sha: z.string().nullish() });
const ReleasesSchema = z.array(z.looseObject({ tag_name: z.string(), draft: z.boolean().nullish(), prerelease: z.boolean().nullish() }));
const CompareSchema = z.looseObject({ status: z.string() });

/** The App's own client: it looks up its installation on a repository (`GET /repos/{owner}/{repo}/installation`). */
type AppLookup = () => Promise<GitHubClient> | GitHubClient;

/** How many releases the sweep reads: the newest, which is where a missed one is. */
const RELEASES_READ = 50;

const split = (repo: string): { owner: string; repo: string } => {
  const [owner, name, ...rest] = repo.split('/');
  if (!owner || !name || rest.length > 0) throw new Error(`the repository "${repo}" is not owner/name`);
  return { owner, repo: name };
};

type Deps = { octokitFor: OctokitFor<GitHubClient>; app: AppLookup };

const repoClientOf = ({ octokitFor, app }: Deps) => async (repo: string) => {
  const at = split(repo);
  const { data } = await (await app()).request('GET /repos/{owner}/{repo}/installation', at);
  return { at, octokit: await octokitFor(InstallationSchema.parse(data).id) };
};

/** The issues of the repository a report names, written by the installation the App holds on it. */
export function bugIssues(deps: Deps): BugIssues {
  const clientFor = repoClientOf(deps);
  return {
    create: async ({ repo, title, body, labels }) => {
      const { at, octokit } = await clientFor(repo);
      const { data } = await octokit.request('POST /repos/{owner}/{repo}/issues', { ...at, title, body, labels: [...labels] });
      return IssueCreatedSchema.parse(data).number;
    },
    comment: async ({ repo, issue, body }) => {
      const { at, octokit } = await clientFor(repo);
      await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { ...at, issue_number: issue, body });
    },
  };
}

/** The repository's issue, pull requests and releases, read by the installation the App holds on it. */
export function bugGithub(deps: Deps): BugGithub {
  const clientFor = repoClientOf(deps);
  return {
    issue: async (repo, issue) => {
      const { at, octokit } = await clientFor(repo);
      const read = IssueReadSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}', { ...at, issue_number: issue })).data);
      return { open: read.state === 'open', notPlanned: read.state_reason === 'not_planned' };
    },
    pull: async (repo, pr) => {
      const { at, octokit } = await clientFor(repo);
      const read = PullReadSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { ...at, pull_number: pr })).data);
      return { merged: read.merged === true, open: read.state === 'open', mergeCommit: read.merge_commit_sha ?? null };
    },
    releases: async (repo) => {
      const { at, octokit } = await clientFor(repo);
      const read = ReleasesSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/releases', { ...at, per_page: RELEASES_READ })).data);
      return read.filter((one) => one.draft !== true && one.prerelease !== true).map((one) => one.tag_name);
    },
    holds: async (repo, sha, tag) => {
      const { at, octokit } = await clientFor(repo);
      const read = CompareSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', { ...at, basehead: `${sha}...${tag}` })).data);
      // The tag is ahead of the commit or at it: the commit is in the tag's history.
      return read.status === 'ahead' || read.status === 'identical';
    },
  };
}
