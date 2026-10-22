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
// PRD 2370 (s4): a target feature PR of a plan repository's PRD (its body starts `Part of <owner/repo>#<n>`,
// read from the same list) is a feature PR too: its events are read as theirs are, for its lane's ready.
// PRD 2377 (s1): for the waits (./waits.ts), the list gives each pull request's labels, body and the
// reviewers asked. Then, only for a pull request the waits count (open, ready, into the default branch)
// that the run listed, so changed since the last sync, three reads: its events (when a review was last
// asked, and when it was last marked ready), its reviews, and its head commit's check runs (whether one
// failed, and the locked laws its outbox check holds it on). Each such pull request's reads either all
// land or leave its reviews and checks null: a refusal, or the budget stepping back, closes no wait.
import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { parseFolderName } from 'omni-loop/kit/lib/layout.ts';
import { githubApp, REPO, type AppCredentials } from '../../signup/github-app';
import { keptInstallationTokens } from '../../signup/installation-tokens';
import { anyTopic, featureLinkOf, linkPattern, planPrdOf, syncConfig, type RepoSnapshot, type SnapshotPull, type SnapshotReview } from './core';
import { waitedPull } from './waits';
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
  head: z.object({ ref: z.string(), sha: z.string().optional() }),
  base: z.object({ ref: z.string() }),
  body: z.string().nullable().optional().default(null),
  labels: z.array(z.object({ name: z.string() })).optional().default([]),
  requested_reviewers: z.array(z.object({ login: z.string() })).optional().default([]),
  requested_teams: z.array(z.object({ slug: z.string() })).optional().default([]),
}));
type ListedPull = z.infer<typeof Pulls>[number];
/** An open pull request ready for review. */
const isLive = (p: ListedPull) => p.state === 'open' && !p.draft;
const Events = z.array(z.object({ event: z.string(), created_at: z.string() }));
const Reviews = z.array(z.object({
  user: z.object({ login: z.string() }).nullable().optional(),
  state: z.string(),
  submitted_at: z.string().nullable().optional(),
}));
const CheckRuns = z.object({
  check_runs: z.array(z.object({
    name: z.string(),
    conclusion: z.string().nullable().optional(),
    output: z.object({ title: z.string().nullable().optional() }).optional(),
  })),
});

/** The conclusions of a check run that failed. */
const RED: ReadonlySet<string> = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);
/** The outbox check's title while a locked law holds it (apps/omni-app/src/outbox-check/law-locked.ts), the laws after the dash. */
const LAW_LOCKED = /^Locked law changed without its CODEOWNER's approval — ([^;]+)/;

/** The latest time of an event among `events`; null for none. */
const lastOf = (events: z.infer<typeof Events>, event: string) =>
  events.filter((e) => e.event === event).map((e) => e.created_at).sort().pop() ?? null;

/** Whether a check run failed, and the locked laws the outbox check (`check`) holds the pull request on. */
function checksOf(runs: z.infer<typeof CheckRuns>['check_runs'], check: string): { lawLocked: string[]; checksRed: boolean } {
  const held = runs.filter((run) => run.name === check && run.conclusion === 'failure')
    .flatMap((run) => (LAW_LOCKED.exec(run.output?.title ?? '')?.[1] ?? '').split(',').map((law) => law.trim()).filter(Boolean));
  return { lawLocked: [...new Set(held)], checksRed: runs.some((run) => RED.has(run.conclusion ?? '')) };
}

/** A listed pull request's reviewers asked: logins, then `org/team`s (the repository's owner is the team's org). */
const requestedOf = (p: ListedPull, repository: string) =>
  [...p.requested_reviewers.map((r) => r.login), ...p.requested_teams.map((t) => `${repository.split('/')[0] ?? ''}/${t.slug}`)];

const path = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/** What the waits read of a counted pull request beyond the list; null each when not read. */
type WaitFacts = Pick<SnapshotPull, 'ready_at' | 'requested_at' | 'reviews' | 'lawLocked' | 'checksRed'>;
const UNREAD: WaitFacts = { ready_at: null, requested_at: null, reviews: null, lawLocked: null, checksRed: null };
/** The waits' facts of a pull request not counted, or whose reads failed: only when it was last marked ready, when read. */
const unreadFacts = (read: z.infer<typeof Events> | null): WaitFacts => ({ ...UNREAD, ready_at: read ? lastOf(read, 'ready_for_review') : null });
/** When it was first marked ready (PRD 2370): nothing when its events were not read, null when it never was. */
const firstReady = (read: z.infer<typeof Events> | null) =>
  read === null ? {} : { first_ready_at: read.filter((e) => e.event === 'ready_for_review').map((e) => e.created_at).sort()[0] ?? null };

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
      const isFeature = (p: ListedPull) => features.has(p.head.ref) || isLinked(p) || isTarget(p);
      const isLinked = (p: ListedPull) => linked !== null && featureShape.test(p.head.ref) && linked.test(p.body ?? '');
      // PRD 2370 (s4): a plan repository's target feature PR, into the default branch, whose body names its PRD.
      const isTarget = (p: ListedPull) => p.base.ref === config.defaultBranch && planPrdOf(p.body, repository) !== null;
      const events = async (p: ListedPull) => Events.parse((await get(`/issues/${p.number}/events?per_page=100`)) ?? []);
      /** The waits' reads of a counted pull request; all null when one of them fails. */
      async function waitFacts(p: ListedPull, read: z.infer<typeof Events> | null): Promise<WaitFacts> {
        const unread = unreadFacts(read);
        try {
          if (p.head.sha === undefined) return unread;
          const [found, reviews, runs] = await Promise.all([
            read ?? events(p),
            get(`/pulls/${p.number}/reviews?per_page=100`).then((data) => Reviews.parse(data ?? [])),
            get(`/commits/${encodeURIComponent(p.head.sha)}/check-runs?per_page=100`).then((data) => CheckRuns.parse(data ?? { check_runs: [] })),
          ]);
          return {
            ready_at: lastOf(found, 'ready_for_review'),
            requested_at: lastOf(found, 'review_requested'),
            reviews: reviews.map((r): SnapshotReview => ({ login: r.user?.login ?? null, state: r.state, submitted_at: r.submitted_at ?? null })),
            ...checksOf(runs.check_runs, config.outboxCheck),
          };
        } catch {
          return unread;
        }
      }
      /** One events read: a feature PR's while it is open and ready (the waits, PRD 2377) and once merged
       * (when it was first marked ready, PRD 2370); null for any other pull request. */
      const eventsOf = (p: ListedPull) => (isFeature(p) && (isLive(p) || p.merged_at !== null) ? events(p) : Promise.resolve(null));
      const pulls: SnapshotPull[] = await Promise.all(listed.map(async (p) => {
        const read = await eventsOf(p);
        const live = isLive(p) && features.has(p.head.ref) ? read : null;
        const labels = p.labels.map((l) => l.name);
        const counted = waitedPull(config, { inbox, shipped }, { ...p, head: p.head.ref, base: p.base.ref, labels }) !== null;
        const facts = counted ? await waitFacts(p, live) : unreadFacts(live);
        return {
          number: p.number, head: p.head.ref, base: p.base.ref, state: p.state, draft: p.draft,
          merged_at: p.merged_at, created_at: p.created_at, labels, body: p.body, requested: requestedOf(p, repository), ...facts,
          ...firstReady(read),
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
