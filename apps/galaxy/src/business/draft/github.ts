import { z } from 'zod';
import { githubApp, REPO, type AppCredentials } from '../../signup/github-app';
import { keptInstallationTokens } from '../../signup/installation-tokens';
import { syncConfig } from '../../stages/sync/core';
import type { RepoListing } from './sources';

// The draft's GitHub reader (PRD 774, spec step 1): a repository's listing and its files, read as the
// Omni Loop App through the installation the workspace owns, on the default branch. The listing is
// three or four calls (the root, `docs/`, and with the kit layout its config and `<delivery>/shipped`);
// ./sources.ts then picks at most twelve files, one call each. A folder or a file that is not there is
// empty or null; any other failure throws, and the draft skips the repository or the file. The
// installation token is kept in server memory and never leaves this module.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
const CONFIG_PATH = '.omni-loop/config.yml';
/** The most characters of one file kept: a larger file is cut. */
export const MAX_FILE_CHARS = 200_000;

const Entries = z.array(z.object({ name: z.string(), type: z.string() }));

const encoded = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export type RepoReader = {
  /** What `repository` holds, as installation `installation` sees it. */
  listing(installation: number, repository: string): Promise<RepoListing>;
  /** A file's text, or null when it is not there. */
  file(installation: number, repository: string, path: string): Promise<string | null>;
};

export function repoReader(creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now): RepoReader {
  const app = githubApp(creds, fetchImpl, clock);
  const tokenFor = keptInstallationTokens((id) => app.installationToken(id), clock);

  /** A contents answer, raw text or JSON; null on 404. */
  async function contents(installation: number, repository: string, path: string, raw: boolean): Promise<unknown> {
    if (!REPO.test(repository)) throw new Error(`${repository} is not a repository name`);
    const token = await tokenFor(installation);
    const res = await fetchImpl(`${GITHUB}/repos/${repository}/contents/${encoded(path)}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${repository}/${path}`);
    return raw ? res.text() : res.json();
  }

  const entries = async (installation: number, repository: string, path: string, type: 'file' | 'dir') => {
    const listed = await contents(installation, repository, path, false);
    return Array.isArray(listed) ? Entries.parse(listed).filter((e) => e.type === type).map((e) => e.name) : [];
  };

  return {
    async listing(installation, repository) {
      const [root, docs, config] = await Promise.all([
        entries(installation, repository, '', 'file'),
        entries(installation, repository, 'docs', 'file'),
        contents(installation, repository, CONFIG_PATH, true),
      ]);
      if (typeof config !== 'string') return { root, docs, delivery: null, shipped: [] };
      const { delivery } = syncConfig(config, repository);
      return { root, docs, delivery, shipped: await entries(installation, repository, `${delivery}/shipped`, 'dir') };
    },

    async file(installation, repository, path) {
      const text = await contents(installation, repository, path, true);
      return typeof text === 'string' ? text.slice(0, MAX_FILE_CHARS) : null;
    },
  };
}
