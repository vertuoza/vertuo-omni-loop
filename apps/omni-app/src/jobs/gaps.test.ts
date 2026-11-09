// The comparison, on a stubbed GitHub and a fake ledger (PRD 2676 s4): no pack, an older pack, the same pack, a
// repository the App is not installed on, a low budget.
import { GithubDeferred } from '@omni/github';
import { describe, expect, it } from 'vitest';
import type { RequestOctokit } from '../knowledge-harvest/github.ts';
import { compareGaps, type HeldRepository } from './gaps.ts';
import type { NewJob } from './ledger.ts';

const NEW = 'c'.repeat(40);
const OLD = 'b'.repeat(40);
const NEW_DATE = '2026-11-09T09:00:00Z';
const OLD_DATE = '2026-11-01T09:00:00Z';
const CONFIG = ['kit: 1', 'paths:', '  knowledge: .omni-loop/knowledge'].join('\n');

/** An octokit whose answers come from `routes`, by route text; a route missing is a 404. */
function stub(routes: Record<string, unknown>, calls: string[] = []): RequestOctokit {
  return {
    request: (route, params) => {
      calls.push(`${route}${params && 'path' in params ? ` ${String(params.path)}` : ''}`);
      const key = params && 'path' in params && route.endsWith('/commits') ? `${route} ${String(params.path)}` : route;
      const route_ = routes[key];
      const answer = typeof route_ === 'function' ? (route_ as (p?: Record<string, unknown>) => unknown)(params) : route_;
      if (answer instanceof Error) return Promise.reject(answer);
      if (answer === undefined) return Promise.reject(Object.assign(new Error('Not Found'), { status: 404 }));
      return Promise.resolve({ data: answer });
    },
  };
}

const COMMITS = 'GET /repos/{owner}/{repo}/commits';
const TREE = 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}';
const BLOB = 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}';

/** What an installation's octokit answers for a repository whose knowledge was last touched by `commit`. */
function installation(commit: { sha: string; date: string } | null) {
  const commits = commit ? [{ sha: commit.sha, commit: { committer: { date: commit.date } } }] : [];
  return {
    'GET /repos/{owner}/{repo}': { default_branch: 'main' },
    [TREE]: (params?: Record<string, unknown>) => ({
      truncated: false,
      tree: params?.tree_sha === 'd' ? [{ path: 'config.yml', mode: '100644', type: 'blob', sha: 'f', size: CONFIG.length }] : [{ path: '.omni-loop', mode: '040000', type: 'tree', sha: 'd' }],
    }),
    [BLOB]: { content: Buffer.from(CONFIG).toString('base64'), encoding: 'base64' },
    [`${COMMITS} .omni-loop/knowledge`]: commits,
    [`${COMMITS} .omni-loop/config.yml`]: [],
  };
}

function ledgerOf(added: NewJob[]) {
  return { add: (job: NewJob) => Promise.resolve(added.push(job) > 0) };
}

const held = (pack: HeldRepository['pack']): HeldRepository => ({ repository: 'initech/pack-api', pack });

describe('the comparison (PRD 2676 s4)', () => {
  it('adds a job for a repository with no pack, with no pull request', async () => {
    const added: NewJob[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([held(null)]) },
      ledger: ledgerOf(added),
      appOctokit: () => stub({ 'GET /repos/{owner}/{repo}/installation': { id: 7 } }),
      octokitFor: () => stub(installation({ sha: NEW, date: NEW_DATE })),
      log: () => undefined,
    });
    expect(summary).toMatchObject({ read: 1, added: 1, stopped: false });
    expect(added).toEqual([
      { kind: 'knowledge-pack', key: `initech/pack-api@${NEW}`, subject: 'initech/pack-api', payload: { installationId: 7, owner: 'initech', repo: 'pack-api', sha: NEW, committedAt: NEW_DATE } },
    ]);
  });

  it('adds a job for a repository whose newest pack is older than its latest knowledge commit', async () => {
    const added: NewJob[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([held({ sha: OLD, committedAt: OLD_DATE })]) },
      ledger: ledgerOf(added),
      appOctokit: () => stub({ 'GET /repos/{owner}/{repo}/installation': { id: 7 } }),
      octokitFor: () => stub(installation({ sha: NEW, date: NEW_DATE })),
      log: () => undefined,
    });
    expect(summary.added).toBe(1);
    expect(added.map((job) => job.key)).toEqual([`initech/pack-api@${NEW}`]);
  });

  it('adds none for a repository whose newest pack is the latest knowledge commit', async () => {
    const added: NewJob[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([held({ sha: NEW, committedAt: NEW_DATE })]) },
      ledger: ledgerOf(added),
      appOctokit: () => stub({ 'GET /repos/{owner}/{repo}/installation': { id: 7 } }),
      octokitFor: () => stub(installation({ sha: NEW, date: NEW_DATE })),
      log: () => undefined,
    });
    expect(summary).toMatchObject({ read: 1, added: 0 });
    expect(added).toEqual([]);
  });

  it('adds none for a repository the App is not installed on, and reads nothing as an installation', async () => {
    const added: NewJob[] = [];
    const asked: string[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([held(null)]) },
      ledger: ledgerOf(added),
      appOctokit: () => stub({}),
      octokitFor: () => stub(installation({ sha: NEW, date: NEW_DATE }), asked),
      log: () => undefined,
    });
    expect(summary).toMatchObject({ read: 1, added: 0, skipped: 1, failed: 0 });
    expect(added).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('adds none for a repository with no config, and says so', async () => {
    const added: NewJob[] = [];
    const lines: string[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([held(null)]) },
      ledger: ledgerOf(added),
      appOctokit: () => stub({ 'GET /repos/{owner}/{repo}/installation': { id: 7 } }),
      octokitFor: () => stub({ 'GET /repos/{owner}/{repo}': { default_branch: 'main' }, [TREE]: { sha: 't', truncated: false, tree: [] } }),
      log: (line) => lines.push(line),
    });
    expect(summary.skipped).toBe(1);
    expect(added).toEqual([]);
    expect(lines.join('\n')).toContain('initech/pack-api');
  });

  it('stops on a low budget, leaving the repositories after it for the next hour', async () => {
    const added: NewJob[] = [];
    const asked: string[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([held(null), { repository: 'initech/second', pack: null }]) },
      ledger: ledgerOf(added),
      appOctokit: () => stub({ 'GET /repos/{owner}/{repo}/installation': { id: 7 } }),
      octokitFor: () => stub({ 'GET /repos/{owner}/{repo}': new GithubDeferred(Date.parse('2026-11-09T10:00:00Z')) }, asked),
      log: () => undefined,
    });
    expect(summary).toMatchObject({ read: 0, added: 0, stopped: true });
    expect(asked).toEqual(['GET /repos/{owner}/{repo}']);
  });

  it('goes on to the next repository when GitHub refuses one for another reason', async () => {
    const added: NewJob[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([held(null), { repository: 'initech/second', pack: null }]) },
      ledger: ledgerOf(added),
      appOctokit: () => stub({ 'GET /repos/{owner}/{repo}/installation': { id: 7 } }),
      octokitFor: () => stub({}),
      log: () => undefined,
    });
    expect(summary).toMatchObject({ read: 0, failed: 2, stopped: false });
  });
});
