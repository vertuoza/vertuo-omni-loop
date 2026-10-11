// What the Attestation page reads of GitHub (PRD 1612 s4), as the omni-loop App: the PRD's pinned files
// at the head the omni/approved check ran on, and the PRD's target PRs. The files are read through Git
// trees and blobs, never a clone, as the check reads them: one recursive tree of the head, then one blob
// per pinned file it holds. A head GitHub does not know, a truncated tree, the App not installed or any
// error reads `unread`: the page shows each file `?`, held, never failed. The target PRs are the open or
// merged PRs, in the product's other repositories, whose body starts `Part of <home>#<n>`; a repository
// the App is not installed on has none to show, and any error leaves them unread.
//
// Every installation-token call goes through the shared, budget-aware client (packages/github, PRD 902)
// at `interactive` priority: a person waits on the page. The token never leaves this module.
import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { githubApp, REPO, type AppCredentials } from '../../signup/github-app';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
/** A token is renewed this long before it expires. */
const TOKEN_MARGIN_MS = 60_000;
/** The most recent PRs of a target repository read for its `Part of` line. */
const PULLS_READ = 50;

/** The pinned files at a head: each path's text, null when the head holds no such file; or `unread`. */
export type HeadFiles = { kind: 'read'; files: ReadonlyMap<string, string | null> } | { kind: 'unread' };

/** A target PR of the PRD, open or merged. */
export type TargetPull = { repo: string; number: number; url: string; state: 'open' | 'merged'; draft: boolean };

const Tree = z.object({
  truncated: z.boolean().optional().default(false),
  tree: z.array(z.object({ path: z.string(), type: z.string(), sha: z.string() })),
});

const Pulls = z.array(z.object({
  number: z.number().int().positive(),
  html_url: z.url(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean().optional().default(false),
  merged_at: z.string().nullable().optional().default(null),
  body: z.string().nullable().optional().default(null),
}));

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether a PR's body starts `Part of <home>#<prd>`, as a target PR's does. */
export function isTargetOf(body: string | null, home: string, prd: PrdNumber): boolean {
  return new RegExp(`^\\s*Part of ${escape(home)}#${Number(prd)}(?!\\d)`, 'i').test(body ?? '');
}

export type AttestationGithubDeps = { creds: AppCredentials; fetch?: Fetch; store: GithubStore | null; clock?: () => number };

export function attestationGithub({ creds, fetch: send = fetch, store, clock = Date.now }: AttestationGithubDeps) {
  const app = githubApp(creds, send, clock);
  const github = githubClient({ store, fetch: send, clock });
  const tokens = new Map<string, { token: string; installation: number; expiresAt: number }>();

  /** The App's token on `repo`, reused until a minute before it expires; null where it is not installed. */
  async function tokenFor(repo: string) {
    const kept = tokens.get(repo);
    if (kept && clock() < kept.expiresAt - TOKEN_MARGIN_MS) return kept;
    const installation = await app.repoInstallation(repo);
    if (!installation) return null;
    const made = { ...(await app.installationToken(installation.id)), installation: installation.id };
    tokens.set(repo, made);
    return made;
  }

  /** A GitHub route of `repo` as the App; null where the App is not installed. */
  async function caller(repo: string) {
    if (!REPO.test(repo)) return null;
    const token = await tokenFor(repo);
    if (!token) return null;
    return (route: string, accept = 'application/vnd.github+json') => github.fetch(`${GITHUB}/repos/${repo}${route}`, {
      headers: { authorization: `Bearer ${token.token}`, accept, 'x-github-api-version': '2022-11-28' },
      cache: 'no-store',
      installation: token.installation,
      priority: 'interactive',
    });
  }

  const why = (error: unknown) => (error instanceof Error ? error.message : String(error));

  return {
    /** The text of each of `paths` at `head` in `repo`. */
    async headFiles(repo: string, head: string, paths: readonly string[]): Promise<HeadFiles> {
      try {
        const call = await caller(repo);
        if (!call) return { kind: 'unread' };
        const answer = await call(`/git/trees/${encodeURIComponent(head)}?recursive=1`);
        if (!answer.ok) {
          if (answer.status !== 404 && answer.status !== 422) console.error(`Attestation: GitHub answered ${answer.status} to the tree of ${repo}@${head}`);
          return { kind: 'unread' };
        }
        const tree = Tree.parse(await answer.json());
        if (tree.truncated) return { kind: 'unread' };
        const blobs = new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));
        const read = await Promise.all(paths.map(async (path): Promise<[string, string | null]> => {
          const blob = blobs.get(path);
          if (blob === undefined) return [path, null];
          const text = await call(`/git/blobs/${blob}`, 'application/vnd.github.raw+json');
          if (!text.ok) throw new Error(`GitHub answered ${text.status} to the blob of ${path}`);
          return [path, await text.text()];
        }));
        return { kind: 'read', files: new Map(read) };
      } catch (error) {
        console.error(`Attestation: ${repo}@${head} could not be read: ${why(error)}`);
        return { kind: 'unread' };
      }
    },

    /** The open or merged PRs of `repos` whose body starts `Part of <home>#<prd>`; null when one could not be read. */
    async targets(repos: readonly string[], home: string, prd: PrdNumber): Promise<TargetPull[] | null> {
      try {
        const each = await Promise.all(repos.map(async (repo): Promise<TargetPull[]> => {
          const call = await caller(repo);
          if (!call) return [];
          const answer = await call(`/pulls?state=all&sort=created&direction=desc&per_page=${PULLS_READ}`);
          if (!answer.ok) throw new Error(`GitHub answered ${answer.status} to the pull requests of ${repo}`);
          return Pulls.parse(await answer.json()).flatMap((pull) => {
            if (!isTargetOf(pull.body, home, prd)) return [];
            if (pull.state === 'closed' && pull.merged_at === null) return [];
            return [{ repo, number: pull.number, url: pull.html_url, state: pull.state === 'open' ? 'open' : 'merged', draft: pull.draft }];
          });
        }));
        return each.flat();
      } catch (error) {
        console.error(`Attestation: the target PRs of ${home}#${Number(prd)} could not be read: ${why(error)}`);
        return null;
      }
    },
  };
}

export type AttestationGithub = ReturnType<typeof attestationGithub>;
