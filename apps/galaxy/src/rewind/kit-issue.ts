// The issue an approved Omni-setup finding opens on the kit's repository (PRD 2410, s7), as the omni-loop
// App: its installation on the kit's repository, a token for this one call, then one issue holding the card's
// words, through the shared, budget-aware client (packages/github) at `interactive` priority, since a member
// waits on it. The token stays on the server (N-PRODUCT-17). It answers the issue's link, or GitHub's refusal
// in words; a network failure throws, and the decision service says so on the card.
import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { githubApp, type AppCredentials } from '../signup/github-app';
import { KIT_REPOSITORY } from './rewind.approval';
import type { Sent } from './rewind.service';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';

export type KitIssueDeps = { creds: AppCredentials; fetch: Fetch; store: GithubStore | null; clock?: () => number };

const Opened = z.object({ html_url: z.url() });

/** Opens one issue titled `title` holding `body` on the kit's repository. */
export function kitIssueOpener({ creds, fetch, store, clock = Date.now }: KitIssueDeps): (title: string, body: string) => Promise<Sent> {
  const app = githubApp(creds, fetch, clock);
  const github = githubClient({ store, fetch, clock });
  return async (title, body) => {
    const installation = await app.repoInstallation(KIT_REPOSITORY);
    if (!installation) return { ok: false, error: 'The Omni app is not installed on the kit\'s repository.' };
    const { token } = await app.installationToken(installation.id);
    const opened = await github.fetch(`${GITHUB}/repos/${KIT_REPOSITORY}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body }),
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      cache: 'no-store',
      installation: installation.id,
      priority: 'interactive',
    });
    if (!opened.ok) return { ok: false, error: `GitHub answered ${String(opened.status)}.` };
    return { ok: true, link: Opened.parse(await opened.json()).html_url };
  };
}
