// The Omni Loop bug team's one GitHub read (PRD 3088 s3, spec section 2): whether each bug's issue is open, and the open pull
// request that closes it, when one does (a person is on it). One GraphQL call per run, through `octokitFor(installation)`, the
// installation of the workspace that runs the team on the Omni Loop repository. Read only: the team writes nothing on an issue
// (BR-PRODUCT-163). Every answer is parsed where it comes in; an issue the answer does not hold is not read, and is not taken.
import { z } from 'zod';
import { PrNumberSchema, type IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import type { IssueRead } from './bug-team.ts';

/** The issues to read: on repository `repo`, as installation `installation`. */
export type BugIssuesAt = { installation: number; repo: string; issues: readonly IssueNumber[] };

/** The bug team's GitHub read: each issue it holds, by number. */
export type MissionBugIssues = { read: (at: BugIssuesAt) => Promise<ReadonlyMap<IssueNumber, IssueRead>> };

/** The most issues one run reads: the first in the order the team takes them. */
export const ISSUES_READ = 20;

/** The pull requests GitHub links to an issue as closing it, open ones only. */
const LINKED = 10;

const IssueSchema = z.looseObject({
  state: z.enum(['OPEN', 'CLOSED']),
  closedByPullRequestsReferences: z.looseObject({ nodes: z.array(z.looseObject({ number: PrNumberSchema, state: z.string() }).nullable()) }).nullable(),
});
const AnswerSchema = z.looseObject({
  data: z.looseObject({ repository: z.record(z.string(), IssueSchema.nullable()).nullable() }).nullable(),
});

/** The GraphQL query for `issues`, each under its own alias; the numbers are branded positive integers, the only text inlined. */
export function issuesQuery(issues: readonly IssueNumber[]): string {
  const fields = issues
    .map((issue) => `i${String(issue)}: issue(number: ${String(issue)}) { state closedByPullRequestsReferences(first: ${String(LINKED)}, includeClosedPrs: false) { nodes { number state } } }`)
    .join(' ');
  return `query BugIssues($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`;
}

/** What GitHub answered, by issue: open or not, and its first open closing pull request. An issue it holds no answer for is absent. */
export function issuesOf(issues: readonly IssueNumber[], data: unknown): Map<IssueNumber, IssueRead> {
  const repository = AnswerSchema.parse(data).data?.repository ?? {};
  const read = new Map<IssueNumber, IssueRead>();
  for (const issue of issues) {
    const one = repository[`i${String(issue)}`];
    if (one == null) continue;
    const fix = one.closedByPullRequestsReferences?.nodes.find((node) => node?.state === 'OPEN') ?? null;
    read.set(issue, { open: one.state === 'OPEN', openFix: fix?.number ?? null });
  }
  return read;
}

const split = (repo: string): { owner: string; name: string } => {
  const [owner, name, ...rest] = repo.split('/');
  if (!owner || !name || rest.length > 0) throw new Error(`the repository "${repo}" is not owner/name`);
  return { owner, name };
};

/** The bug team's GitHub read, through `octokitFor(installation)`. */
export function missionBugIssues({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionBugIssues {
  return {
    async read({ installation, repo, issues }) {
      const asked = issues.slice(0, ISSUES_READ);
      if (asked.length === 0) return new Map();
      const octokit = await octokitFor(installation);
      const { data } = await octokit.request('POST /graphql', { query: issuesQuery(asked), variables: split(repo) });
      return issuesOf(asked, data);
    },
  };
}
