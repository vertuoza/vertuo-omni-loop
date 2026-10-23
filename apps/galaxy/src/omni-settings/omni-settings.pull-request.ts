import { githubClient, type GithubStore } from '@omni/github';
import { z } from 'zod';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { knowledgeReader } from '../knowledge/github';
import { githubApp, REPO, type AppCredentials } from '../signup/github-app';
import { keptInstallationTokens } from '../signup/installation-tokens';
import type { ProposeOutcome, SettingsPullRequests } from './omni-settings.service';

// The settings repository's pull-request writer (PRD 2417, s7): a workspace owner's change to a playbook
// page, written as the Omni Loop App through the installation the workspace owns. It reads the default
// branch and its head, and the page's file there; when the file already holds the text it opens
// nothing. Otherwise it cuts the change's branch from that head, writes the file on it (changed, or
// added for a page still on the kit's first default) and opens one pull request into the default
// branch, which a person merges. It never merges, never writes the default branch and stores nothing.
// A repository it cannot see, or one with no commit, answers `unreachable`; a refused write throws,
// naming its step. The installation token stays in this module. Calls go through the shared
// budget-aware client (packages/github) at `interactive` priority: an owner waits on the answer.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const GITHUB = 'https://api.github.com';
const Repository = z.object({ default_branch: z.string().min(1) });
const Ref = z.object({ object: z.object({ sha: z.string() }) });
const Contents = z.object({ sha: z.string(), content: z.string().optional(), encoding: z.string().optional() });
const Pull = z.object({ number: PrNumberSchema, html_url: z.url() });

const encoded = (p: string) => p.split('/').map(encodeURIComponent).join('/');
const base64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

/** The text a contents answer holds, or null when GitHub sent none (a file too large to inline). */
function textOf(file: z.infer<typeof Contents>): string | null {
  return file.encoding === 'base64' && file.content !== undefined ? Buffer.from(file.content, 'base64').toString('utf8') : null;
}

export function settingsPullRequests(
  creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now, store: GithubStore | null = null,
): SettingsPullRequests {
  const app = githubApp(creds, fetchImpl, clock);
  const github = githubClient({ store, fetch: fetchImpl, clock });
  const knowledge = knowledgeReader(creds, fetchImpl, clock, (message) => { log.error({ event: 'omni-settings', message }); }, { store });
  const tokenFor = keptInstallationTokens((id) => app.installationToken(id), clock);

  async function call(installation: number, repository: string, path: string, method = 'GET', body?: unknown): Promise<Response> {
    const authorization = `Bearer ${await tokenFor(installation)}`;
    return github.fetch(`${GITHUB}/repos/${repository}${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      installation,
      priority: 'interactive',
      headers: { authorization, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      cache: 'no-store',
    });
  }

  /** A read's answer, or null when GitHub has nothing there (404, or 409 for an empty repository). */
  async function read<T>(installation: number, repository: string, path: string, shape: z.ZodType<T>): Promise<T | null> {
    const res = await call(installation, repository, path);
    if (res.status === 404 || res.status === 409) return null;
    if (!res.ok) throw new Error(`GitHub answered ${String(res.status)} to reading ${repository}${path}`);
    return shape.parse(await res.json());
  }

  /** A write that must succeed; its answer. */
  async function write(installation: number, repository: string, step: string, path: string, method: string, body: unknown): Promise<Response> {
    const res = await call(installation, repository, path, method, body);
    if (!res.ok) throw new Error(`GitHub answered ${String(res.status)} to ${step} on ${repository}`);
    return res;
  }

  return {
    installationFor: (workspace) => knowledge.installationFor(workspace),

    async propose(installation, repository, change): Promise<ProposeOutcome> {
      if (!REPO.test(repository)) throw new Error(`${repository} is not a repository name`);
      const repo = await read(installation, repository, '', Repository);
      if (repo === null) return { kind: 'unreachable' };
      const base = repo.default_branch;
      const head = await read(installation, repository, `/git/ref/heads/${encoded(base)}`, Ref);
      if (head === null) return { kind: 'unreachable' };
      const file = await read(installation, repository, `/contents/${encoded(change.path)}?ref=${head.object.sha}`, Contents);
      if (file !== null && textOf(file) === change.text) return { kind: 'unchanged' };
      await write(installation, repository, 'cutting the branch', '/git/refs', 'POST', { ref: `refs/heads/${change.branch}`, sha: head.object.sha });
      await write(installation, repository, 'writing the page', `/contents/${encoded(change.path)}`, 'PUT', {
        message: change.message, content: base64(change.text), branch: change.branch, ...(file === null ? {} : { sha: file.sha }),
      });
      const opened = await write(installation, repository, 'opening the pull request', '/pulls', 'POST', {
        title: change.title, head: change.branch, base, body: change.body,
      });
      const pull = Pull.parse(await opened.json());
      return { kind: 'opened', pullRequest: { number: pull.number, url: pull.html_url } };
    },
  };
}
