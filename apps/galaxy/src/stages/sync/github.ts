// The stages sync's GitHub reader (PRD 587, s2): one repository's snapshot (./core.ts), read as the Omni
// Loop App through the installation the workspace owns. It reads the repository's `.omni-loop` config
// on its default branch (none: an empty snapshot, which gives nothing), the PRD folders in `inbox/` and
// `shipped/` there, every issue carrying the config's `labels.prd`, every pull request, and, for each
// open, non-draft feature PR of a folder's topic, when it was last marked ready for review. Given when
// the repository was last synced (issue 642), it reads only the issues and pull requests updated since
// then: the folders are still read in full, and a stage already stored keeps its date. Any other
// failure throws, and the route skips the repository. An installation token is kept in server memory
// until a minute before it expires, and never leaves this module. Every call goes through the shared,
// budget-aware client (packages/github, PRD 902, s1) at `background` priority: nobody waits on the sync,
// so it steps back first when the installation's budget runs low, and stops while GitHub has paused it.
//
// PRD 2370 (s1): for the timeline's milestones, each pull request keeps its body, as the list gives it, and
// a feature PR's events are read once it merged too, for when it was first marked ready. A ◆ PRD's feature
// PR, whose folder is not on the default branch, is the one whose body carries the config's feature link.
import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { parseFolderName } from 'omni-loop/kit/lib/layout.ts';
import { githubApp, REPO, type AppCredentials } from '../../signup/github-app';
import { keptInstallationTokens } from '../../signup/installation-tokens';
import { anyTopic, featureLinkOf, linkPattern, syncConfig, type RepoSnapshot, type SnapshotPull } from './core';
import { PrdNumberSchema, PrNumberSchema, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RecordLine } from 'omni-loop/kit/lib/escalation/comments.ts';
import { recordIn } from '../outbox/escalation';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
const CONFIG_PATH = '.omni-loop/config.yml';
/** The most pages of a hundred pull requests or issues read per repository, newest first. */
const MAX_PAGES = 20;

const Entries = z.array(z.object({ name: z.string(), type: z.string() }));
// The `labels.prd` issues: each one's number is its PRD's.
const Issues = z.array(z.object({
  number: PrdNumberSchema,
  created_at: z.string(),
  pull_request: z.unknown().optional(),
}));
const Pulls = z.array(z.object({
  number: PrNumberSchema,
  state: z.enum(['open', 'closed']),
  draft: z.boolean().optional().default(false),
  merged_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
  updated_at: z.string().optional(),
  head: z.object({ ref: z.string() }),
  base: z.object({ ref: z.string() }),
  body: z.string().nullable().optional().default(null),
}));
type Listed = z.infer<typeof Pulls>[number];
/** An open pull request ready for review. */
const isLive = (p: Listed) => p.state === 'open' && !p.draft;
const Events = z.array(z.object({ event: z.string(), created_at: z.string() }));

const path = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export type StagesReader = {
  /** The repository as installation `installation` sees it; given `since`, only the issues and pull
   * requests updated since then. */
  snapshot(installation: number, repository: string, since?: string | null): Promise<RepoSnapshot>;
};

export function stagesReader(
  creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now, store: GithubStore | null = null,
): StagesReader {
  const app = githubApp(creds, fetchImpl, clock);
  const github = githubClient({ store, fetch: fetchImpl, clock });
  const tokenFor = keptInstallationTokens((id) => app.installationToken(id), clock);

  return {
    async snapshot(installation, repository, since = null) {
      if (!REPO.test(repository)) throw new Error(`${repository} is not a repository name`);
      const token = await tokenFor(installation);
      /** A GitHub answer; null on 404. Throws on any other error. */
      async function get(route: string, raw = false): Promise<unknown> {
        const res = await github.fetch(`${GITHUB}/repos/${repository}${route}`, {
          installation,
          priority: 'background',
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
      const before = (p: { updated_at?: string | undefined }) => since !== null && Date.parse(p.updated_at ?? '') < Date.parse(since);
      const listed = (await pages(
        (page) => `/pulls?${new URLSearchParams({ state: 'all', sort: since ? 'updated' : 'created', direction: 'desc', per_page: '100', page: String(page) })}`,
        (data) => Pulls.parse(data),
        (found) => found.some(before),
      )).filter((p) => !before(p));
      const features = new Set([...inbox, ...shipped]
        .map((name) => parseFolderName(name)?.topic)
        .filter((t): t is string => Boolean(t))
        .map((topic) => config.branches.feature.replace('{topic}', topic)));
      // PRD 2370: a ◆ PRD's feature PR is known by the feature link its body carries, on a feature branch.
      const featureLink = featureLinkOf(text, repository);
      const linked = linkPattern(featureLink);
      const featureShape = anyTopic(config.branches.feature);
      const isFeature = (p: Listed) => features.has(p.head.ref) || isLinked(p);
      const isLinked = (p: Listed) => linked !== null && featureShape.test(p.head.ref) && linked.test(p.body ?? '');
      /** Every time it was marked ready, oldest first; null when its events are not read. A feature PR's are
       * read while it is open and ready, and once merged (PRD 2370). */
      const readiedOf = async (p: Listed): Promise<string[] | null> => {
        if (!isFeature(p) || !(isLive(p) || p.merged_at !== null)) return null;
        const events = Events.parse((await get(`/issues/${p.number}/events?per_page=100`)) ?? []);
        return events.filter((e) => e.event === 'ready_for_review').map((e) => e.created_at).sort();
      };
      const pulls: SnapshotPull[] = await Promise.all(listed.map(async (p) => {
        const readied = await readiedOf(p);
        const ready_at = isLive(p) && features.has(p.head.ref) ? readied?.at(-1) ?? null : null;
        return {
          number: p.number, head: p.head.ref, base: p.base.ref, state: p.state, draft: p.draft,
          merged_at: p.merged_at, created_at: p.created_at, ready_at, body: p.body,
          ...(readied === null ? {} : { first_ready_at: readied[0] ?? null }),
        };
      }));

      return { repository, config, inbox, shipped, issues, pulls, featureLink };
    },
  };
}

// PRD 1794 (s5): the escalation record's read, for the recount (../outbox/recount.ts): the comments of a
// PRD's open feature PR, read as the Omni Loop App through its installation on the repository, and the
// `<!-- omni:escalation -->` record among them (../outbox/escalation.ts). One read per open feature PR,
// beside its summary, at `background` priority through the same budget-aware client; its token is kept
// as the sync's are, and never leaves this module.

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
