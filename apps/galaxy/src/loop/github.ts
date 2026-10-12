// The loop's code host when it is GitHub (PRD 1665, s1): the one file of the loop's reads that knows
// GitHub. It reads a repository as the Omni Loop App, by REST only: it finds the App's installation on
// the repository, creates an installation token and keeps it in server memory until a minute before it
// expires, and sends every call through the shared, budget-aware client (`@omni/github`, PRD 902), so a
// repeated read goes out with its stored ETag and an unchanged answer (a 304) spends nothing of the
// budget. Reads are `interactive`: a person, or their agent, waits on the answer.
//
// What GitHub answers is mapped to the loop's facts (./loop.contract.ts): an open draft is `draft`, a
// closed pull request with a merge time is `merged`. The token never leaves this module: no answer,
// error or log line carries it.
import { GithubDeferred, GithubPaused, githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { PrNumberSchema, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { githubApp, type AppCredentials, type InstallationToken } from '../signup/github-app';
import type { Change, ChangeDetail, ChangesQuery, ChangeState } from './loop.contract';
import { HostSpent, HostUnreadable, type LoopHost } from './loop.service';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
/** A token is renewed this long before it expires. */
const TOKEN_MARGIN_MS = 60_000;
/** GitHub's page size, at most. */
const PAGE = 100;
/** How many pages of pull requests a list reads at most, label filtering included. */
export const MAX_LIST_PAGES = 5;
/** GitHub lists at most 3000 files of a pull request. */
const MAX_FILE_PAGES = 30;

const Pull = z.object({
  number: PrNumberSchema,
  title: z.string(),
  html_url: z.url(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  merged_at: z.string().nullable().optional().default(null),
  body: z.string().nullable().optional().default(null),
  user: z.object({ login: z.string() }).nullable().optional().default(null),
  labels: z.array(z.object({ name: z.string() })).optional().default([]),
  head: z.object({ ref: z.string(), sha: z.string() }),
  base: z.object({ ref: z.string() }),
});
type Pull = z.infer<typeof Pull>;
const Pulls = z.array(Pull);
const Files = z.array(z.object({ filename: z.string() }));
const Commit = z.object({ commit: z.object({ committer: z.object({ date: z.string() }).nullable() }) });

/** A pull request's state, in the loop's words. */
export function stateOf(pull: Pick<Pull, 'state' | 'draft' | 'merged_at'>): ChangeState {
  if (pull.state === 'open') return pull.draft ? 'draft' : 'open';
  return pull.merged_at ? 'merged' : 'closed';
}

/** A pull request as a change. */
export function changeOf(pull: Pull): Change {
  return {
    number: pull.number,
    title: pull.title,
    head: pull.head.ref,
    base: pull.base.ref,
    state: stateOf(pull),
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    mergedAt: pull.merged_at,
    labels: pull.labels.map((label) => label.name),
    body: pull.body ?? '',
    url: pull.html_url,
    author: pull.user?.login ?? null,
  };
}

/** GitHub's answer could not be read as it documents it. */
function malformed(route: string): Error {
  return new Error(`GitHub's answer to ${route} is not the shape it documents`);
}

export type GithubLoopHostDeps = {
  creds: AppCredentials;
  fetch?: Fetch;
  clock?: () => number;
  /** The budget's store (github_etags, github_budget); without one every call goes out plain. */
  store?: GithubStore | null;
};

export function githubLoopHost({ creds, fetch: send = (url, init) => fetch(url, init), clock = Date.now, store = null }: GithubLoopHostDeps): LoopHost {
  const app = githubApp(creds, send, clock);
  const github = githubClient({ store, fetch: send, clock });
  const tokens = new Map<string, InstallationToken & { installation: number }>();

  /** A token for `repo` and its installation, reused until a minute before it expires. */
  async function tokenFor(repo: string): Promise<{ token: string; installation: number }> {
    const kept = tokens.get(repo);
    if (kept && clock() < kept.expiresAt - TOKEN_MARGIN_MS) return kept;
    let found;
    try {
      const installation = await app.repoInstallation(repo);
      if (!installation) throw new HostUnreadable(repo, 'the app is not installed there');
      found = { ...(await app.installationToken(installation.id)), installation: installation.id };
    } catch (error) {
      if (error instanceof HostUnreadable) throw error;
      throw new HostUnreadable(repo, 'the app\'s token was refused');
    }
    tokens.set(repo, found);
    return found;
  }

  /** A GET of `route` under the repository, as JSON; null on a 404. A refusal of the token, or of the
   * repository, is HostUnreadable; a spent budget is HostSpent; any other error throws. */
  async function json(repo: string, route: string): Promise<unknown> {
    const { token, installation } = await tokenFor(repo);
    let res: Response;
    try {
      res = await github.fetch(`${GITHUB}/repos/${repo}${route}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
        cache: 'no-store',
        installation,
        priority: 'interactive',
      });
    } catch (error) {
      if (error instanceof GithubPaused || error instanceof GithubDeferred) throw new HostSpent(repo, error.until, 'GitHub');
      throw error;
    }
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) {
      tokens.delete(repo);
      throw new HostUnreadable(repo, `GitHub answered ${res.status}`);
    }
    if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${route}`);
    return res.json();
  }

  /** Every page of a list, until a short page or `pages` of them. */
  async function pages<T>(repo: string, route: (page: number) => string, schema: z.ZodType<T[]>, max: number, enough: (kept: T[]) => boolean = () => false): Promise<T[]> {
    const kept: T[] = [];
    for (let page = 1; page <= max; page += 1) {
      const path = route(page);
      const parsed = schema.safeParse((await json(repo, path)) ?? []);
      if (!parsed.success) throw malformed(path);
      kept.push(...parsed.data);
      if (parsed.data.length < PAGE || enough(kept)) break;
    }
    return kept;
  }

  return {
    async changes({ repo, base, head, label, state }: ChangesQuery, limit: number): Promise<Change[]> {
      const [owner] = repo.split('/');
      const filter = new URLSearchParams({ state, sort: 'created', direction: 'desc', per_page: String(PAGE) });
      if (base) filter.set('base', base);
      if (head) filter.set('head', `${owner}:${head}`);
      const labelled = (pull: Pull) => !label || pull.labels.some((l) => l.name === label);
      const pulls = await pages(repo, (page) => `/pulls?${filter}&page=${page}`, Pulls, MAX_LIST_PAGES, (kept) => kept.filter(labelled).length >= limit);
      return pulls.filter(labelled).slice(0, limit).map(changeOf);
    },

    async change(repo: string, number: PrNumber): Promise<ChangeDetail | null> {
      const route = `/pulls/${number}`;
      const answer = await json(repo, route);
      if (answer === null) return null;
      const parsed = Pull.safeParse(answer);
      if (!parsed.success) throw malformed(route);
      const pull = parsed.data;
      const [commit, files] = await Promise.all([
        json(repo, `/commits/${pull.head.sha}`),
        pages(repo, (page) => `${route}/files?per_page=${PAGE}&page=${page}`, Files, MAX_FILE_PAGES),
      ]);
      const committed = commit === null ? null : Commit.safeParse(commit);
      if (committed && !committed.success) throw malformed(`/commits/${pull.head.sha}`);
      return {
        ...changeOf(pull),
        lastCommitAt: committed?.data.commit.committer?.date ?? null,
        files: files.map((file) => file.filename),
      };
    },
  };
}
