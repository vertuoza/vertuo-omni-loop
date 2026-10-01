// The stages sync's GitHub reader (PRD 587, s2): one repository's snapshot (./core.ts), read as the Omni
// Loop App through the installation the workspace owns. It reads the repository's `.omni-loop` config
// on its default branch (none: an empty snapshot, which gives nothing), the PRD folders in `inbox/` and
// `shipped/` there, every issue carrying the config's `labels.prd`, every pull request, and, for each
// open, non-draft feature PR of a folder's topic, when it was last marked ready for review. Given when
// the repository was last synced (issue 642), it reads only the issues and pull requests updated since
// then: the folders are still read in full, and a stage already stored keeps its date. Any other
// failure throws, and the route skips the repository. An installation token is kept in server memory
// until a minute before it expires, and never leaves this module.
import { z } from 'zod';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { githubApp, REPO, type AppCredentials } from '../../signup/github-app';
import { keptInstallationTokens } from '../../signup/installation-tokens';
import { syncConfig, type RepoSnapshot, type SnapshotPull } from './core';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
const CONFIG_PATH = '.omni-loop/config.yml';
/** The most pages of a hundred pull requests or issues read per repository, newest first. */
const MAX_PAGES = 20;

const Entries = z.array(z.object({ name: z.string(), type: z.string() }));
const Issues = z.array(z.object({
  number: z.number().int().positive(),
  created_at: z.string(),
  pull_request: z.unknown().optional(),
}));
const Pulls = z.array(z.object({
  number: z.number().int().positive(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean().optional().default(false),
  merged_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string().optional(),
  head: z.object({ ref: z.string() }),
  base: z.object({ ref: z.string() }),
}));
const Events = z.array(z.object({ event: z.string(), created_at: z.string() }));

const path = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export type StagesReader = {
  /** The repository as installation `installation` sees it; given `since`, only the issues and pull
   * requests updated since then. */
  snapshot(installation: number, repository: string, since?: string | null): Promise<RepoSnapshot>;
};

export function stagesReader(creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now): StagesReader {
  const app = githubApp(creds, fetchImpl, clock);
  const tokenFor = keptInstallationTokens((id) => app.installationToken(id), clock);

  return {
    async snapshot(installation, repository, since = null) {
      if (!REPO.test(repository)) throw new Error(`${repository} is not a repository name`);
      const token = await tokenFor(installation);
      /** A GitHub answer; null on 404. Throws on any other error. */
      async function get(route: string, raw = false): Promise<unknown> {
        const res = await fetchImpl(`${GITHUB}/repos/${repository}${route}`, {
          headers: {
            authorization: `Bearer ${token}`,
            accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
            'x-github-api-version': '2022-11-28',
          },
          cache: 'no-store',
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${route}`);
        return raw ? res.text() : res.json();
      }
      /** Every page, up to MAX_PAGES; the ones after a page that `last` says ends the read are not asked for. */
      async function pages<T>(route: (page: number) => string, parse: (data: unknown) => T[], last: (found: T[]) => boolean = () => false): Promise<T[]> {
        const all: T[] = [];
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const found = parse((await get(route(page))) ?? []);
          all.push(...found);
          if (found.length < 100 || last(found)) break;
        }
        return all;
      }

      const empty: RepoSnapshot = { repository, config: null, inbox: [], shipped: [], issues: [], pulls: [] };
      const text = await get(`/contents/${path(CONFIG_PATH)}`, true);
      if (typeof text !== 'string') return empty;
      const config = syncConfig(text, repository);

      const folders = async (dir: string) => {
        const listed = await get(`/contents/${path(`${config.delivery}/${dir}`)}?ref=${encodeURIComponent(config.defaultBranch)}`);
        return Array.isArray(listed) ? Entries.parse(listed).filter((e) => e.type === 'dir').map((e) => e.name) : [];
      };
      const [inbox, shipped] = await Promise.all([folders('inbox'), folders('shipped')]);

      const issues = (await pages(
        (page) => `/issues?${new URLSearchParams({ labels: config.prdLabel, state: 'all', per_page: '100', page: String(page), ...(since ? { since } : {}) })}`,
        (data) => Issues.parse(data),
      )).filter((i) => i.pull_request === undefined).map(({ number, created_at }) => ({ number, created_at }));

      // Since a sync: most recently updated first, up to the first one updated before it.
      const before = (p: { updated_at?: string }) => since !== null && Date.parse(p.updated_at ?? '') < Date.parse(since);
      const listed = (await pages(
        (page) => `/pulls?${new URLSearchParams({ state: 'all', sort: since ? 'updated' : 'created', direction: 'desc', per_page: '100', page: String(page) })}`,
        (data) => Pulls.parse(data),
        (found) => found.some(before),
      )).filter((p) => !before(p));
      const features = new Set([...inbox, ...shipped]
        .map((name) => (parseFolderName(name) as { topic: string } | null)?.topic)
        .filter((t): t is string => Boolean(t))
        .map((topic) => config.branches.feature.replace('{topic}', topic)));
      const pulls: SnapshotPull[] = await Promise.all(listed.map(async (p) => {
        let ready_at: string | null = null;
        if (p.state === 'open' && !p.draft && features.has(p.head.ref)) {
          const events = Events.parse((await get(`/issues/${p.number}/events?per_page=100`)) ?? []);
          ready_at = events.filter((e) => e.event === 'ready_for_review').map((e) => e.created_at).sort().pop() ?? null;
        }
        return {
          number: p.number, head: p.head.ref, base: p.base.ref, state: p.state, draft: p.draft,
          merged_at: p.merged_at, created_at: p.created_at, ready_at,
        };
      }));

      return { repository, config, inbox, shipped, issues, pulls };
    },
  };
}
