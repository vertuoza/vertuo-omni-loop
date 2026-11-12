// The comparison, on a stubbed GitHub and a fake ledger (PRD 2676 s4): no pack, an older pack, the same pack, a
// repository the App is not installed on, a low budget. Then its retro's rule (PRD omni-loop-4 s3): a feature PR
// merged in the last fourteen days gets an owed `retro` job, under the same budget.
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

describe('the comparison — a retro owed at the switch (PRD omni-loop-4 s3)', () => {
  const NOW = Date.parse('2026-11-12T12:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;
  const FEATURE_CONFIG = ['kit: 1', 'branches:', '  feature: feat/{topic}'].join('\n');
  const WIDGETS = { name: 'widgets', owner: { login: 'acme' }, default_branch: 'main' };

  /** A pull request merged into main `days` days before NOW, from `head`. */
  const merged = (number: number, days: number, head = `feat/topic-${String(number)}`) => ({
    number,
    merged_at: new Date(NOW - days * DAY).toISOString(),
    merge_commit_sha: `m${String(number)}`,
    head: { ref: head },
  });

  /** An installation holding `acme/widgets`, whose closed pull requests into main are `pulls`, its config `config`. */
  function installed(pulls: unknown[], { config = FEATURE_CONFIG, calls = [] as string[] } = {}) {
    return stub(
      {
        'GET /installation/repositories': { repositories: [WIDGETS] },
        'GET /repos/{owner}/{repo}/pulls': pulls,
        [TREE]: (params?: Record<string, unknown>) => ({
          truncated: false,
          tree: params?.tree_sha === 'd' ? [{ path: 'config.yml', mode: '100644', type: 'blob', sha: 'f', size: config.length }] : [{ path: '.omni-loop', mode: '040000', type: 'tree', sha: 'd' }],
        }),
        [BLOB]: { content: Buffer.from(config).toString('base64'), encoding: 'base64' },
      },
      calls,
    );
  }

  const app = () => stub({ 'GET /app/installations': [{ id: 7 }] });

  /** The comparison with no product-held repository: only the retro's rule runs. */
  const compare = (octokit: RequestOctokit, added: NewJob[], ledger = ledgerOf(added)) =>
    compareGaps({ store: { held: () => Promise.resolve([]) }, ledger, appOctokit: app, octokitFor: () => octokit, now: () => NOW, log: () => undefined });

  it('adds an owed `retro` job for a feature PR merged in the last fourteen days, keyed and laned as `/api/github` adds it', async () => {
    const added: NewJob[] = [];
    const summary = await compare(installed([merged(12, 3, 'feat/widget')]), added);
    expect(summary.retros).toEqual({ read: 1, added: 1, failed: 0 });
    expect(added).toEqual([
      {
        kind: 'retro',
        key: 'acme/widgets#12',
        subject: 'acme/widgets',
        lane: 'acme/widgets',
        payload: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, mergeSha: 'm12', mergedAt: merged(12, 3).merged_at, owed: true },
        maxTries: 4,
      },
    ]);
  });

  it('adds none for a pull request merged over fourteen days ago, closed unmerged, or not a feature PR', async () => {
    const added: NewJob[] = [];
    const unmerged = { number: 14, merged_at: null, merge_commit_sha: null, head: { ref: 'feat/closed' } };
    await compare(installed([merged(13, 15), unmerged, merged(15, 1, 'docs/phase-0-widget'), merged(16, 1, 'feat/widget--s1/x')]), added);
    expect(added).toEqual([]);
  });

  it('counts none for a merge whose job is already held: the ledger keys it, so a retro already added is never added twice', async () => {
    const summary = await compare(installed([merged(12, 3)]), [], { add: () => Promise.resolve(false) });
    expect(summary.retros).toEqual({ read: 1, added: 0, failed: 0 });
  });

  it('reads no config when nothing merged in the window, and leaves a repository without config alone, saying so', async () => {
    const calls: string[] = [];
    await compare(installed([merged(13, 20)], { calls }), []);
    expect(calls).toEqual(['GET /installation/repositories', 'GET /repos/{owner}/{repo}/pulls']);
    const lines: string[] = [];
    const summary = await compareGaps({
      store: { held: () => Promise.resolve([]) },
      ledger: ledgerOf([]),
      appOctokit: app,
      octokitFor: () => stub({ 'GET /installation/repositories': { repositories: [WIDGETS] }, 'GET /repos/{owner}/{repo}/pulls': [merged(12, 1)], [TREE]: { truncated: false, tree: [] } }),
      now: () => NOW,
      log: (line) => lines.push(line),
    });
    expect(summary.retros).toEqual({ read: 1, added: 0, failed: 0 });
    expect(lines.join('\n')).toContain('acme/widgets');
  });

  it('stops on a low budget, as the pack’s rule does, and runs not at all once that rule stopped', async () => {
    const summary = await compare(stub({ 'GET /installation/repositories': new GithubDeferred(Date.parse('2026-11-12T13:00:00Z')) }), []);
    expect(summary).toMatchObject({ stopped: true, retros: { read: 0, added: 0, failed: 0 } });

    const asked: string[] = [];
    const stopped = await compareGaps({
      store: { held: () => Promise.resolve([held(null)]) },
      ledger: ledgerOf([]),
      appOctokit: () => stub({ 'GET /repos/{owner}/{repo}/installation': { id: 7 }, 'GET /app/installations': [{ id: 7 }] }),
      octokitFor: () => stub({ 'GET /repos/{owner}/{repo}': new GithubDeferred(Date.parse('2026-11-12T13:00:00Z')) }, asked),
      now: () => NOW,
      log: () => undefined,
    });
    expect(stopped.stopped).toBe(true);
    expect(stopped.retros).toBeUndefined();
    expect(asked).toEqual(['GET /repos/{owner}/{repo}']);
  });

  it('goes on to the next repository when GitHub refuses one for another reason, and says so when the App’s installations cannot be read', async () => {
    const two = { repositories: [{ ...WIDGETS, name: 'a' }, { ...WIDGETS, name: 'b' }] };
    const summary = await compare(stub({ 'GET /installation/repositories': two }), []);
    expect(summary.retros).toEqual({ read: 0, added: 0, failed: 2 });

    const lines: string[] = [];
    const none = await compareGaps({ store: { held: () => Promise.resolve([]) }, ledger: ledgerOf([]), appOctokit: () => stub({}), octokitFor: () => stub({}), now: () => NOW, log: (line) => lines.push(line) });
    expect(none.retros).toEqual({ read: 0, added: 0, failed: 1 });
    expect(lines.join('\n')).toContain('installations');
  });
});
