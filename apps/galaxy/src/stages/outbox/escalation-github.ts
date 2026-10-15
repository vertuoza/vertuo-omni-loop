// The escalation record's GitHub read (PRD 1794, s5): the comments of a PRD's open feature PR, read as the
// Omni Loop App through its installation on the repository, and the `<!-- omni:escalation -->` record
// among them (./escalation.ts). The recount makes this one read per open feature PR, beside its
// summary. Every call goes through the shared, budget-aware client (packages/github, PRD 902) at
// `background` priority: nobody waits on a recount. An installation token is kept in server memory until
// a minute before it expires, and never leaves this module.
import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import type { RecordLine } from 'vertuo-omni-plan/kit/lib/escalation/comments.ts';
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { githubApp, REPO, type AppCredentials } from '../../signup/github-app';
import { keptInstallationTokens } from '../../signup/installation-tokens';
import { recordIn } from './escalation';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';

// At most the first 100 comments, as the PRD page reads the outbox comment: the record is kept from the
// first outbox check run that saw something held.
const Comments = z.array(z.object({ body: z.string().nullable().optional() }));

/** The escalation record of `repository`'s pull request `pr`; null when it carries none, or the App is not installed there. */
export type EscalationRead = (ref: { repository: string; pr: PrNumber }) => Promise<RecordLine[] | null>;

export function escalationReader(
  creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now, store: GithubStore | null = null,
): EscalationRead {
  const app = githubApp(creds, fetchImpl, clock);
  const github = githubClient({ store, fetch: fetchImpl, clock });
  const tokenFor = keptInstallationTokens((id) => app.installationToken(id), clock);
  const installations = new Map<string, number>();

  async function installationOf(repository: string): Promise<number | null> {
    const kept = installations.get(repository);
    if (kept !== undefined) return kept;
    const found = await app.repoInstallation(repository);
    if (found === null) return null;
    installations.set(repository, found.id);
    return found.id;
  }

  return async ({ repository, pr }) => {
    if (!REPO.test(repository)) throw new Error(`${repository} is not a repository name`);
    const installation = await installationOf(repository);
    if (installation === null) return null;
    const route = `/issues/${String(pr)}/comments?per_page=100`;
    const res = await github.fetch(`${GITHUB}/repos/${repository}${route}`, {
      installation,
      priority: 'background',
      headers: {
        authorization: `Bearer ${await tokenFor(installation)}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub answered ${String(res.status)} to ${route}`);
    return recordIn(Comments.parse(await res.json()));
  };
}
