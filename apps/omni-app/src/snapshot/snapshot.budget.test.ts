// Bug #2766: the installation's GitHub budget ran out most afternoons, and the pull-request checks waited behind it.
// Every answer GitHub sends counts against the hour, a 304 included, and its ETag is bound to the token that read it,
// which each function run mints anew. A snapshot reads one tree per folder and one blob per file it lists, through
// the shared client: the outbox check of a fix pull request in this repository reads about 570 blobs, the budgets
// check about 280 blobs and 30 trees, and both read the same ones again on every push and every re-run. A Git
// object named by its sha never changes, so a snapshot of a commit already read sends nothing to GitHub.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { githubClient, memoryGithubStore, type GithubStore } from '@omni/github';
import { afterEach, describe, expect, it } from 'vitest';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import { snapshot } from './snapshot.ts';

const INSTALLATION = 7;
const sha = (n: number) => n.toString(16).padStart(40, '0');
const COMMIT = sha(1);

/** One repository at one commit, as GitHub's Git Data API answers it: every object named by a 40-hex sha. */
const OBJECTS: Record<string, unknown> = {
  [`trees/${COMMIT}`]: { sha: sha(2), truncated: false, tree: [{ path: '.omni-loop', mode: '040000', type: 'tree', sha: sha(3) }] },
  [`trees/${sha(3)}`]: {
    sha: sha(3),
    truncated: false,
    tree: [
      { path: 'config.yml', mode: '100644', type: 'blob', sha: sha(4), size: 6 },
      { path: 'knowledge', mode: '040000', type: 'tree', sha: sha(5) },
    ],
  },
  [`trees/${sha(5)}`]: {
    sha: sha(5),
    truncated: false,
    tree: [
      { path: 'a.md', mode: '100644', type: 'blob', sha: sha(6), size: 2 },
      { path: 'b.md', mode: '100644', type: 'blob', sha: sha(7), size: 2 },
    ],
  },
  [`blobs/${sha(4)}`]: { content: Buffer.from('kit: 1').toString('base64'), encoding: 'base64' },
  [`blobs/${sha(6)}`]: { content: Buffer.from('# A').toString('base64'), encoding: 'base64' },
  [`blobs/${sha(7)}`]: { content: Buffer.from('# B').toString('base64'), encoding: 'base64' },
};

/** GitHub behind HTTP: every request it was sent kept, each answer with its ETag and the hour's budget. */
function github() {
  const sent: string[] = [];
  const fetch = (url: string) => {
    sent.push(url);
    const object = OBJECTS[new URL(url).pathname.replace(/^\/repos\/acme\/widgets\/git\//, '')];
    if (object === undefined) return Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 }));
    const headers = { 'content-type': 'application/json', etag: `W/"${String(sent.length)}"`, 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4000', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) };
    return Promise.resolve(new Response(JSON.stringify(object), { status: 200, headers }));
  };
  return { sent, fetch };
}

/** The part of Octokit `snapshot` calls, sending each route through the shared client as a run's Octokit does. */
function octokitOver(store: GithubStore, send: (url: string) => Promise<Response>): GitHubClient {
  const fetch = githubClient({ store, fetch: send, log: () => undefined }).bound({ installation: INSTALLATION, priority: 'interactive' });
  return {
    request: async (route: string, params: Record<string, unknown> = {}) => {
      const inPath = new Set<string>();
      const path = route.replace(/^GET /, '').replace(/\{(\w+)\}/g, (_, name: string) => {
        inPath.add(name);
        return String(params[name]);
      });
      const query = new URLSearchParams(Object.entries(params).filter(([key]) => !inPath.has(key)).map(([key, value]) => [key, String(value)])).toString();
      const res = await fetch(`https://api.github.com${path}${query ? `?${query}` : ''}`, { headers: { authorization: `Bearer run-${String(Math.random())}` } });
      if (!res.ok) throw Object.assign(new Error('Not Found'), { status: res.status });
      return { data: await res.json() };
    },
  };
}

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A snapshot of the config and the knowledge folder at the commit, in a fresh folder. */
async function snapshotOnce(octokit: GitHubClient) {
  const dest = mkdtempSync(join(tmpdir(), 'snapshot-budget-'));
  folders.push(dest);
  await snapshot(octokit, { owner: 'acme', repo: 'widgets', ref: COMMIT, paths: ['.omni-loop/config.yml', '.omni-loop/knowledge'], dest });
  return dest;
}

describe('a snapshot spends the GitHub budget only on what it never read (bug #2766)', () => {
  it('a second run on the same commit, with its own token, sends nothing and writes the same files', async () => {
    const store = memoryGithubStore();
    const { sent, fetch } = github();
    await snapshotOnce(octokitOver(store, fetch));
    const first = sent.length;
    expect(first).toBe(6);

    const again = await snapshotOnce(octokitOver(store, fetch));
    expect(sent).toHaveLength(first);
    expect(readFileSync(join(again, '.omni-loop/knowledge/b.md'), 'utf8')).toBe('# B');
    expect(readFileSync(join(again, '.omni-loop/config.yml'), 'utf8')).toBe('kit: 1');
  });
});
