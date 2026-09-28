// The only code in galaxy that reads a repository (PRD 426, part 1): for a numbered dossier, its
// home repository's PRD on GitHub, as the Omni Loop App. It finds the App's installation on the
// repository (not the workspace's stored one, so a workspace made before PRD 359 works too), creates
// an installation token and keeps it in server memory until a minute before it expires, reads the
// repository's own `.omni-loop` config for its branch shapes and delivery path (no branch name or
// path is written here), finds the PRD's folder and topic, then reads the issue, the most recent
// pull request on each of the phase-0, feature and retro branches, and the sub-PRs merged into the
// feature branch. Each of those reads fails on its own (`UNREAD`); the App not installed, or no
// config, and the whole summary is null. Every answer, null included, is cached 60 s per dossier.
// The token never leaves this module: the summary holds only numbers, states and github.com links.
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.mjs';
import { z } from 'zod';
import { githubApp, REPO, type AppCredentials, type InstallationToken } from '../../signup/github-app';
import { UNREAD, type GithubSummary, type IssueRef, type PullRef, type Read } from './summary';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
/** How long a summary is kept per dossier. */
export const SUMMARY_TTL_MS = 60_000;
/** A token is renewed this long before it expires. */
export const TOKEN_MARGIN_MS = 60_000;
const CONFIG_PATH = '.omni-loop/config.yml';
const TOPIC = '([a-z0-9]+(?:-[a-z0-9]+)*)';

/** What the reader needs of a dossier: its id (the cache key), its home repository and its PRD. */
export type DossierRef = { id: string; home_repo: string; prd: number };

/** What the reader takes from the repository's config. */
type RepoConfig = {
  defaultBranch: string;
  branches: { feature: string; phase0: string; retro: string };
  delivery: string;
  links: { feature: string; phase0: string };
};

const Pull = z.object({
  number: z.number().int().positive(),
  html_url: z.string().url(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean().optional().default(false),
  merged_at: z.string().nullable().optional().default(null),
  created_at: z.string(),
  head: z.object({ ref: z.string() }),
  body: z.string().nullable().optional().default(null),
});
type Pull = z.infer<typeof Pull>;
const Pulls = z.array(Pull);
const Issue = z.object({ number: z.number().int().positive(), html_url: z.string().url(), state: z.enum(['open', 'closed']) });
const Entries = z.array(z.object({ name: z.string(), type: z.string() }));

/** The pull request a branch counts: the most recent open or merged one; a closed, unmerged one is absent. */
export function latestPull(pulls: readonly Pull[]): PullRef | null {
  const counted = pulls.filter((p) => p.state === 'open' || p.merged_at !== null)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.number - a.number);
  const [pull] = counted;
  return pull ? { number: pull.number, url: pull.html_url, state: pull.state === 'open' ? 'open' : 'merged', draft: pull.draft } : null;
}

const fill = (shape: string, values: Record<string, string>) =>
  shape.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const path = (p: string) => p.split('/').map(encodeURIComponent).join('/');

function repoConfig(text: string): RepoConfig {
  const config = parseConfig(text, CONFIG_PATH) as unknown as {
    repo: { defaultBranch: string };
    branches: { feature: string; phase0: string; retro: string };
    paths: { delivery: string };
    prLinks: { feature: string; phase0: string };
  };
  return {
    defaultBranch: config.repo.defaultBranch,
    branches: { feature: config.branches.feature, phase0: config.branches.phase0, retro: config.branches.retro },
    delivery: config.paths.delivery.replace(/\/+$/, ''),
    links: { feature: config.prLinks.feature, phase0: config.prLinks.phase0 },
  };
}

export type GithubReader = { summary(dossier: DossierRef): Promise<GithubSummary | null> };

export function githubReader(creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now): GithubReader {
  const app = githubApp(creds, fetchImpl, clock);
  const tokens = new Map<string, InstallationToken>();
  const summaries = new Map<string, { at: number; value: GithubSummary | null }>();

  /** A token for `repo`, reused until a minute before it expires; null when the App is not installed there. */
  async function tokenFor(repo: string): Promise<string | null> {
    const kept = tokens.get(repo);
    if (kept && clock() < kept.expiresAt - TOKEN_MARGIN_MS) return kept.token;
    const installation = await app.repoInstallation(repo);
    if (!installation) return null;
    const token = await app.installationToken(installation.id);
    tokens.set(repo, token);
    return token.token;
  }

  async function read(repo: string, token: string) {
    /** A GitHub answer as JSON; null on 404. Throws on any other error. */
    async function json(route: string, accept = 'application/vnd.github+json'): Promise<unknown> {
      const res = await fetchImpl(`${GITHUB}/repos/${repo}${route}`, {
        headers: { authorization: `Bearer ${token}`, accept, 'x-github-api-version': '2022-11-28' },
        cache: 'no-store',
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${route}`);
      return accept.includes('raw') ? res.text() : res.json();
    }
    const contents = (file: string, ref: string, raw: boolean) =>
      json(`/contents/${path(file)}?ref=${encodeURIComponent(ref)}`, raw ? 'application/vnd.github.raw+json' : undefined);
    const pulls = async (query: Record<string, string>) =>
      Pulls.parse((await json(`/pulls?${new URLSearchParams({ state: 'all', per_page: '100', ...query })}`)) ?? []);
    const owner = repo.split('/')[0];
    return {
      async config(): Promise<RepoConfig> {
        const text = await json(`/contents/${path(CONFIG_PATH)}`, 'application/vnd.github.raw+json');
        if (typeof text !== 'string') throw new Error(`${repo} has no ${CONFIG_PATH}`);
        return repoConfig(text);
      },
      /** The PRD's folder under `dir` on `ref`; null when there is none. */
      async folderIn(dir: string, ref: string, prd: number): Promise<string | null> {
        const listed = await contents(dir, ref, false);
        if (listed === null || !Array.isArray(listed)) return null;
        return Entries.parse(listed).find((e) => e.type === 'dir' && parseFolderName(e.name)?.prd === prd)?.name ?? null;
      },
      /** A topic from a recent phase-0 or feature pull request whose body carries the PRD's link line. */
      async topicFromPulls(config: RepoConfig, prd: number): Promise<string | null> {
        const kinds = (['phase0', 'feature'] as const).map((kind) => ({
          head: new RegExp(`^${escape(fill(config.branches[kind], { topic: '\u0000' })).replace('\u0000', TOPIC)}$`),
          link: new RegExp(`${escape(fill(config.links[kind], { prd: String(prd) }))}(?!\\d)`),
        }));
        for (const pull of await pulls({ sort: 'created', direction: 'desc' })) {
          for (const { head, link } of kinds) {
            const match = head.exec(pull.head.ref);
            if (match && link.test(pull.body ?? '')) return match[1];
          }
        }
        return null;
      },
      async issue(prd: number): Promise<IssueRef | null> {
        const answer = await json(`/issues/${prd}`);
        if (answer === null) return null;
        const issue = Issue.parse(answer);
        return { number: issue.number, url: issue.html_url, state: issue.state };
      },
      async pullOn(branch: string): Promise<PullRef | null> {
        return latestPull(await pulls({ head: `${owner}:${branch}`, sort: 'created', direction: 'desc' }));
      },
      async mergedInto(branch: string): Promise<number> {
        return (await pulls({ base: branch, state: 'closed' })).filter((p) => p.merged_at !== null).length;
      },
    };
  }

  /** One read on its own: its answer, or UNREAD when it failed. */
  async function part<T>(what: string, run: () => Promise<T>): Promise<Read<T>> {
    try {
      return await run();
    } catch (error) {
      console.error(`PRD page: ${what} could not be read from GitHub: ${error instanceof Error ? error.message : String(error)}`);
      return UNREAD;
    }
  }

  async function fresh({ home_repo: repo, prd }: DossierRef): Promise<GithubSummary | null> {
    if (!REPO.test(repo)) return null;
    const token = await tokenFor(repo);
    if (!token) return null;
    const gh = await read(repo, token);
    const config = await gh.config();
    const main = config.defaultBranch;
    const folder = (await part('the shipped folder', () => gh.folderIn(`${config.delivery}/shipped`, main, prd)).then((f) => (f === UNREAD ? null : f)))
      ?? (await part('the inbox folder', () => gh.folderIn(`${config.delivery}/inbox`, main, prd)).then((f) => (f === UNREAD ? null : f)));
    const topic = folder ? parseFolderName(folder)!.topic
      : await part('the pull requests', () => gh.topicFromPulls(config, prd)).then((t) => (t === UNREAD ? null : t));
    const branch = (shape: string) => fill(shape, { topic: topic ?? '' });
    const none = async () => null;
    const [issue, phase0, feature, retro, mergedSlices] = await Promise.all([
      part('the issue', () => gh.issue(prd)),
      part('the phase-0 PR', topic ? () => gh.pullOn(branch(config.branches.phase0)) : none),
      part('the feature PR', topic ? () => gh.pullOn(branch(config.branches.feature)) : none),
      part('the retro PR', topic ? () => gh.pullOn(branch(config.branches.retro)) : none),
      part('the merged sub-PRs', topic ? () => gh.mergedInto(branch(config.branches.feature)) : async () => 0),
    ]);
    return { repo, prd, folder, topic, issue, phase0, feature, retro, mergedSlices };
  }

  return {
    async summary(dossier) {
      const kept = summaries.get(dossier.id);
      if (kept && clock() - kept.at < SUMMARY_TTL_MS) return kept.value;
      let value: GithubSummary | null;
      try {
        value = await fresh(dossier);
      } catch (error) {
        console.error(`PRD page: GitHub could not be read for ${dossier.home_repo}: ${error instanceof Error ? error.message : String(error)}`);
        value = null;
      }
      summaries.set(dossier.id, { at: clock(), value });
      return value;
    },
  };
}
