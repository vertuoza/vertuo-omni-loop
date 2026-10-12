// The approved label (PRD 1299 s2, spec §3): once a PRD born on the server is approved, the omni-loop
// App adds the repository's `labels.approved` (omni:approved unless its `.omni-loop/config.yml` names
// another) to the PRD's issue. Nothing reads the label: it is for display, so the approval route logs a
// label that could not be added and keeps the approval. It finds the App's installation on the
// repository, makes an installation token for this one call, reads the config and adds the label,
// every call through the shared, budget-aware client (packages/github) at `interactive` priority.
// PRD 1612 s2: once that approval is voided, the same way removes it, so the App's `issues.unlabeled`
// webhook reruns the omni/approved check (the check reads the record, never the label).
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

type LabelDeps = { creds: AppCredentials; fetch: Fetch; store: GithubStore | null; clock?: () => number };

/** A GitHub call on the repository, as the App's installation. */
type Call = (route: string, init?: RequestInit & { accept?: string }) => Promise<Response>;

/** Runs `act` as the App's installation on the repository, with the approved label its config names;
 * does nothing where the App is not installed. */
function onApprovedLabel(
  { creds, fetch, store, clock = Date.now }: LabelDeps,
  act: (call: Call, label: string, issue: { route: string; name: string }) => Promise<void>,
): (repo: string, prd: PrdNumber) => Promise<void> {
  const app = githubApp(creds, fetch, clock);
  const github = githubClient({ store, fetch, clock });
  return async (repo, prd) => {
    const installation = await app.repoInstallation(repo);
    if (!installation) return;
    const { token } = await app.installationToken(installation.id);
    const call: Call = (route, init = {}) => github.fetch(`${GITHUB}/repos/${repo}${route}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: init.accept ?? 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      cache: 'no-store',
      installation: installation.id,
      priority: 'interactive',
    });
    const read = await call(`/contents/${CONFIG_PATH}`, { accept: 'application/vnd.github.raw+json' });
    await act(call, approvedLabelOf(read.ok ? await read.text() : null), { route: `/issues/${Number(prd)}`, name: `${repo}#${Number(prd)}` });
  };
}

/** Adds the approved label to PRD `prd`'s issue in `repo`; adds nothing where the App is not installed.
 * Throws when GitHub refuses. */
export function approvedLabeler(deps: LabelDeps): (repo: string, prd: PrdNumber) => Promise<void> {
  return onApprovedLabel(deps, async (call, label, issue) => {
    const added = await call(`${issue.route}/labels`, { method: 'POST', body: JSON.stringify({ labels: [label] }) });
    if (!added.ok) throw new Error(`GitHub answered ${added.status} to the ${label} label of ${issue.name}`);
  });
}

/** Removes the approved label from PRD `prd`'s issue in `repo`, once its approval is voided (PRD 1612
 * s2); removes nothing where the App is not installed, and an issue without the label is done already
 * (GitHub's 404). Throws when GitHub refuses otherwise. */
export function approvedUnlabeler(deps: LabelDeps): (repo: string, prd: PrdNumber) => Promise<void> {
  return onApprovedLabel(deps, async (call, label, issue) => {
    const removed = await call(`${issue.route}/labels/${encodeURIComponent(label)}`, { method: 'DELETE' });
    if (!removed.ok && removed.status !== 404) throw new Error(`GitHub answered ${removed.status} to removing the ${label} label of ${issue.name}`);
  });
}
