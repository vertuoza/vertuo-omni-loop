import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { knowledgeReader } from '../knowledge/github';
import { githubApp, REPO, type AppCredentials } from '../signup/github-app';
import { keptInstallationTokens } from '../signup/installation-tokens';
import type { SettingsGithub } from './omni-settings.service';

// The settings repository's GitHub reader (PRD 2417, s3): its default branch's commit and a file at
// that commit, read as the Omni Loop App through the installation the workspace owns. A repository or
// file that is not there is null; any other failure throws. The installation token stays in this
// module. Calls go through the shared budget-aware client (packages/github) at `interactive`
// priority: a terminal waits on this answer.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
/** The most characters of one page kept: a larger file is cut. */
const MAX_FILE_CHARS = 200_000;
const Commit = z.object({ sha: z.string() });

const encoded = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export function settingsGithub(
  creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now, store: GithubStore | null = null,
): SettingsGithub {
  const app = githubApp(creds, fetchImpl, clock);
  const github = githubClient({ store, fetch: fetchImpl, clock });
  const knowledge = knowledgeReader(creds, fetchImpl, clock, console.error, { store });
  const tokenFor = keptInstallationTokens((id) => app.installationToken(id), clock);

  async function get(installation: number, repository: string, path: string, accept: string): Promise<Response | null> {
    if (!REPO.test(repository)) throw new Error(`${repository} is not a repository name`);
    const authorization = `Bearer ${await tokenFor(installation)}`;
    const res = await github.fetch(`${GITHUB}/repos/${repository}/${path}`, {
      installation, priority: 'interactive', headers: { authorization, accept, 'x-github-api-version': '2022-11-28' }, cache: 'no-store',
    });
    if (res.status === 404 || res.status === 409) return null;
    if (!res.ok) throw new Error(`GitHub answered ${String(res.status)} to ${repository}/${path}`);
    return res;
  }

  return {
    installationFor: (workspace) => knowledge.installationFor(workspace),

    async head(installation, repository) {
      const res = await get(installation, repository, 'commits/HEAD', 'application/vnd.github+json');
      return res === null ? null : Commit.parse(await res.json()).sha;
    },

    async file(installation, repository, commit, path) {
      const res = await get(installation, repository, `contents/${encoded(path)}?ref=${commit}`, 'application/vnd.github.raw+json');
      return res === null ? null : (await res.text()).slice(0, MAX_FILE_CHARS);
    },
  };
}
