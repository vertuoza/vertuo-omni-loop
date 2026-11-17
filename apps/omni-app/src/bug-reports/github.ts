// The Omni Loop repository's issues, as the Omni App (PRD 2980 s4): the live side of `BugIssues` (./file.ts). The App's own
// JWT finds its installation on the repository, then that installation's client writes, so the issue and its comments are
// signed as the Omni App, never as a person (L-AIACT-1). Every answer is parsed where it comes in.
import { IssueNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { z } from 'zod';
import type { OctokitFor } from '../octokit-for.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import type { BugIssues } from './file.ts';

const InstallationSchema = z.looseObject({ id: z.number().int().positive() });
const IssueCreatedSchema = z.looseObject({ number: IssueNumberSchema });

/** The App's own client: it looks up its installation on a repository (`GET /repos/{owner}/{repo}/installation`). */
export type AppLookup = () => Promise<GitHubClient> | GitHubClient;

const split = (repo: string): { owner: string; repo: string } => {
  const [owner, name, ...rest] = repo.split('/');
  if (!owner || !name || rest.length > 0) throw new Error(`the repository "${repo}" is not owner/name`);
  return { owner, repo: name };
};

/** The issues of the repository a report names, written by the installation the App holds on it. */
export function bugIssues({ octokitFor, app }: { octokitFor: OctokitFor<GitHubClient>; app: AppLookup }): BugIssues {
  const clientFor = async (repo: string) => {
    const at = split(repo);
    const { data } = await (await app()).request('GET /repos/{owner}/{repo}/installation', at);
    return { at, octokit: await octokitFor(InstallationSchema.parse(data).id) };
  };
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
