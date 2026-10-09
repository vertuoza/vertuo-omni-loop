// The approved label (PRD 1299 s2, spec §3): once a PRD born on the server is approved, the omni-loop
// App adds the repository's `labels.approved` (omni:approved unless its `.omni-loop/config.yml` names
// another) to the PRD's issue. Nothing reads the label: it is for display, so the approval route logs a
// label that could not be added and keeps the approval. It finds the App's installation on the
// repository, makes an installation token for this one call, reads the config and adds the label,
// every call through the shared, budget-aware client (packages/github) at `interactive` priority.
import { githubClient, type GithubStore } from '@omni/github';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { githubApp, type AppCredentials } from '../signup/github-app';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
const CONFIG_PATH = '.omni-loop/config.yml';
/** The label when the repository's config names none, or cannot be read: the kit's default. */
const DEFAULT_APPROVED_LABEL = 'omni:approved';

/** The label a repository's config names for an approved PRD; the default when it cannot be read. */
function approvedLabelOf(config: string | null): string {
  if (config === null) return DEFAULT_APPROVED_LABEL;
  try {
    return parseConfig(config, CONFIG_PATH, { ignoreUnknownKeys: true }).labels.approved;
  } catch {
    return DEFAULT_APPROVED_LABEL;
  }
}

/** Adds the approved label to PRD `prd`'s issue in `repo`; adds nothing where the App is not installed.
 * Throws when GitHub refuses. */
export function approvedLabeler({ creds, fetch, store, clock = Date.now }: {
  creds: AppCredentials; fetch: Fetch; store: GithubStore | null; clock?: () => number;
}): (repo: string, prd: PrdNumber) => Promise<void> {
  const app = githubApp(creds, fetch, clock);
  const github = githubClient({ store, fetch, clock });
  return async (repo, prd) => {
    const installation = await app.repoInstallation(repo);
    if (!installation) return;
    const { token } = await app.installationToken(installation.id);
    const call = (route: string, init: RequestInit & { accept?: string } = {}) => github.fetch(`${GITHUB}/repos/${repo}${route}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: init.accept ?? 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      cache: 'no-store',
      installation: installation.id,
      priority: 'interactive',
    });
    const read = await call(`/contents/${CONFIG_PATH}`, { accept: 'application/vnd.github.raw+json' });
    const label = approvedLabelOf(read.ok ? await read.text() : null);
    const added = await call(`/issues/${Number(prd)}/labels`, { method: 'POST', body: JSON.stringify({ labels: [label] }) });
    if (!added.ok) throw new Error(`GitHub answered ${added.status} to the ${label} label of ${repo}#${Number(prd)}`);
  };
}
