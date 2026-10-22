// A concept's issue, closed or reopened as the omni-loop App (PRD 2213, s3), as the approved label is added
// (../approval/label.ts): the App's installation on the repository, a token for this one call, then the
// issue's state and one comment naming who, every call through the shared, budget-aware client
// (packages/github) at `interactive` priority. The token stays on the server (N-PRODUCT-17). Throws when
// the App is not installed there or GitHub refuses; the comment, once the state changed, is best-effort.
import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { IssueNumberSchema, type IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import type { FixIssue } from '../dossier/github/fix';
import { githubApp, type AppCredentials } from '../signup/github-app';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';

export type DoneGithubDeps = { creds: AppCredentials; fetch: Fetch; store: GithubStore | null; clock?: () => number };

/** What GitHub answers to the issue's update. */
const Updated = z.object({
  number: IssueNumberSchema,
  html_url: z.url(),
  state: z.enum(['open', 'closed']),
  created_at: z.string(),
  user: z.object({ login: z.string() }).nullable().optional(),
});

/** The comment that says who marked it, or reopened it, on the Omni page. */
export const doneComment = (done: boolean, login: string) =>
  done ? `Marked done on the Omni page by @${login}.` : `Reopened on the Omni page by @${login}.`;

/** Closes (`done`, as completed) or reopens issue `issue` of `repo`, with the comment naming `login`; the
 * issue as it stands after. */
export function issueSetter(deps: DoneGithubDeps): (repo: string, issue: IssueNumber, done: boolean, login: string) => Promise<FixIssue> {
  const { creds, fetch, store, clock = Date.now } = deps;
  const app = githubApp(creds, fetch, clock);
  const github = githubClient({ store, fetch, clock });
  return async (repo, issue, done, login) => {
    const installation = await app.repoInstallation(repo);
    if (!installation) throw new Error(`The Omni app is not installed on ${repo}.`);
    const { token } = await app.installationToken(installation.id);
    const call = (route: string, body: unknown) => github.fetch(`${GITHUB}/repos/${repo}/issues/${Number(issue)}${route}`, {
      method: route === '' ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      cache: 'no-store',
      installation: installation.id,
      priority: 'interactive',
    });
    const updated = await call('', done ? { state: 'closed', state_reason: 'completed' } : { state: 'open', state_reason: 'reopened' });
    if (!updated.ok) throw new Error(`GitHub answered ${updated.status} to updating ${repo}#${Number(issue)}`);
    const read = Updated.parse(await updated.json());
    const commented = await call('/comments', { body: doneComment(done, login) });
    if (!commented.ok) console.error(`concept done: ${repo}#${Number(issue)} is updated, but its comment was not added (GitHub answered ${commented.status})`);
    return { number: read.number, url: read.html_url, state: read.state, author: read.user?.login ?? null, createdAt: read.created_at, risk: null, regression: false };
  };
}
