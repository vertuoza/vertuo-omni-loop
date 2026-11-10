// A stuck check shows as delayed (PRD 2688 s6): the sweep posts a check due over 10 minutes as `queued`, on the job's head
// commit, under that kind's check name; one due less is left alone; a job of another kind is never posted for.
import { GithubDeferred } from '@omni/github';
import { describe, expect, it } from 'vitest';
import type { RequestOctokit } from '../knowledge-harvest/github.ts';
import { DELAYED_AFTER_MINUTES, DELAYED_SUMMARY, delayedStore, postDelayed, type DelayedStore, type DueJob } from './delayed.ts';

const NOW = Date.UTC(2026, 10, 10, 12, 0);
const HEAD = 'a'.repeat(40);
const OTHER_HEAD = 'b'.repeat(40);

const job = (kind: string, headSha = HEAD, repo = 'demo-app'): DueJob => ({
  kind,
  key: `acme/${repo}#7`,
  payload: { installationId: 42, owner: 'acme', repo, prNumber: 7, headSha },
});

type Post = { name: unknown; head_sha: unknown; status: unknown; summary: unknown; repo: unknown };

function world(due: DueJob[], failOn?: (params: Record<string, unknown>) => Error | undefined) {
  const posts: Post[] = [];
  const asked: { kinds: string[]; before: string }[] = [];
  const store: DelayedStore = {
    due: (input) => {
      asked.push(input);
      return Promise.resolve(due.filter((entry) => input.kinds.includes(entry.kind)));
    },
  };
  const octokit: RequestOctokit = {
    request: (route, params) => {
      const given = (params ?? {}) as Record<string, unknown>;
      const error = failOn?.(given);
      if (error) return Promise.reject(error);
      expect(route).toBe('POST /repos/{owner}/{repo}/check-runs');
      posts.push({
        name: given.name,
        head_sha: given.head_sha,
        status: given.status,
        summary: (given.output as { summary?: unknown } | undefined)?.summary,
        repo: given.repo,
      });
      return Promise.resolve({ data: { id: 1 } });
    },
  };
  const lines: string[] = [];
  const run = () => postDelayed({ store, octokitFor: () => octokit, clock: () => NOW, log: (line) => lines.push(line) });
  return { posts, asked, lines, run };
}

describe('the delayed check (PRD 2688 s6)', () => {
  it('asks for the jobs of the four kinds due over 10 minutes ago, and no other kind', async () => {
    const { asked, run } = world([]);
    await run();
    expect(DELAYED_AFTER_MINUTES).toBe(10);
    expect(asked).toEqual([{ kinds: ['pr-outbox', 'pr-inbox', 'pr-approved', 'pr-budgets'], before: new Date(NOW - 10 * 60_000).toISOString() }]);
  });

  it("posts each check queued, with the delayed summary, on the job's head commit, under its kind's check name", async () => {
    const { posts, run } = world([job('pr-outbox'), job('pr-inbox', OTHER_HEAD), job('pr-approved'), job('pr-budgets')]);
    const summary = await run();
    expect(posts).toEqual([
      { name: 'outbox', head_sha: HEAD, status: 'queued', summary: DELAYED_SUMMARY, repo: 'demo-app' },
      { name: 'inbox', head_sha: OTHER_HEAD, status: 'queued', summary: DELAYED_SUMMARY, repo: 'demo-app' },
      { name: 'omni/approved', head_sha: HEAD, status: 'queued', summary: DELAYED_SUMMARY, repo: 'demo-app' },
      { name: 'omni / budgets', head_sha: HEAD, status: 'queued', summary: DELAYED_SUMMARY, repo: 'demo-app' },
    ]);
    expect(DELAYED_SUMMARY).toBe('Delayed: Omni is retrying this check');
    expect(summary).toEqual({ due: 4, posted: 4, skipped: 0, failed: 0, stopped: false });
  });

  it('never posts on a job of another kind', async () => {
    const { posts, run } = world([job('knowledge-pack'), job('something-else')]);
    expect(await run()).toEqual({ due: 0, posted: 0, skipped: 0, failed: 0, stopped: false });
    expect(posts).toEqual([]);
  });

  it("leaves a job whose payload holds no head commit alone, and says so", async () => {
    const broken: DueJob = { kind: 'pr-outbox', key: 'acme/demo-app#7', payload: { owner: 'acme' } };
    const { posts, lines, run } = world([broken]);
    expect(await run()).toEqual({ due: 1, posted: 0, skipped: 1, failed: 0, stopped: false });
    expect(posts).toEqual([]);
    expect(lines.join('\n')).toContain('pr-outbox');
  });

  it('goes on past a repository GitHub refuses, logging only the first line of the error', async () => {
    const { posts, lines, run } = world(
      [job('pr-outbox', HEAD, 'gone'), job('pr-inbox', HEAD, 'demo-app')],
      (params) => (params.repo === 'gone' ? new Error('Not Found\nsecond line with detail') : undefined),
    );
    expect(await run()).toEqual({ due: 2, posted: 1, skipped: 0, failed: 1, stopped: false });
    expect(posts).toHaveLength(1);
    expect(lines.join('\n')).not.toContain('second line');
  });

  it('stops at the first refusal for a low GitHub budget', async () => {
    const { posts, run } = world([job('pr-outbox'), job('pr-inbox')], () => new GithubDeferred(NOW + 60_000));
    expect(await run()).toEqual({ due: 2, posted: 0, skipped: 0, failed: 0, stopped: true });
    expect(posts).toEqual([]);
  });
});

describe('delayedStore, on the database', () => {
  it('reads the queued jobs of the given kinds due before the cutoff, and parses what comes back', async () => {
    const urls: string[] = [];
    const rows = [{ kind: 'pr-outbox', key: 'acme/demo-app#7', payload: { headSha: HEAD } }];
    const fetch: typeof globalThis.fetch = (input) => {
      urls.push(decodeURIComponent(String(input instanceof Request ? input.url : input)));
      return Promise.resolve(Response.json(rows));
    };
    const store = delayedStore({ url: 'https://db.example', key: 'service-key', fetch });
    expect(await store.due({ kinds: ['pr-outbox', 'pr-inbox'], before: '2026-11-10T11:50:00.000Z' })).toEqual(rows);
    const [url = ''] = urls;
    expect(url).toContain('/rest/v1/background_jobs');
    expect(url).toContain('state=eq.queued');
    expect(url).toContain('kind=in.(pr-outbox,pr-inbox)');
    expect(url).toContain('run_after=lte.2026-11-10T11:50:00.000Z');
  });
});
