import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { runnerQueue } from './runner-queue.ts';

type Recorded = { method: string; path: string; query: URLSearchParams; body: unknown; headers: Headers };

/** A fetch that records each request to the database and answers with the next of `answers`. */
function recordingFetch(answers: unknown[] = []) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams, body, headers: new Headers(init.headers) });
      const answer: unknown = answers.shift() ?? [];
      resolve(answer instanceof Response ? answer : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

/** The request at `index`: the test fails when there is none. */
function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  assertDefined(item, `request ${String(index)}`);
  return item;
}

const queueOn = (fetch: typeof globalThis.fetch) => runnerQueue({ url: 'https://db.example', key: 'service-key', fetch });
const JOB = { installationId: 7, repository: 'Acme/Widgets', line: '/omni:retro-apply --retro 21' };

describe('runnerQueue — the retro’s job for a runner, never calling Supabase (PRD 2338)', () => {
  it('queues the line for the installation’s workspace and the repository, sent by the app and by no person', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [], [{ id: 'job-1' }]]);
    const queued = await queueOn(db.fetch)(JOB);

    expect(queued).toEqual({ job: 'job-1', created: true, reason: null });
    const [workspace, lookup, insert] = [nth(db.requests, 0), nth(db.requests, 1), nth(db.requests, 2)];
    expect([workspace.method, workspace.path, workspace.query.get('github_installation_id')]).toEqual(['GET', '/rest/v1/workspaces', 'eq.7']);
    expect([lookup.method, lookup.path]).toEqual(['GET', '/rest/v1/runner_jobs']);
    expect([lookup.query.get('workspace_id'), lookup.query.get('repo'), lookup.query.get('line')]).toEqual(['eq.ws-1', 'eq.acme/widgets', 'eq./omni:retro-apply --retro 21']);
    expect([insert.method, insert.path]).toEqual(['POST', '/rest/v1/runner_jobs']);
    expect(insert.body).toEqual({ workspace_id: 'ws-1', repo: 'acme/widgets', line: '/omni:retro-apply --retro 21', sent_by_app: 'omni-app' });
    expect(insert.body).not.toHaveProperty('sent_by');
    expect(insert.query.get('workspace_id')).toBeNull();
    expect(workspace.headers.get('apikey')).toBe('service-key');
  });

  it('finds the job already queued with the line, and queues no second one', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [{ id: 'job-1' }]]);
    expect(await queueOn(db.fetch)(JOB)).toEqual({ job: 'job-1', created: false, reason: null });
    expect(db.requests.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('queues nothing, and says why, when no workspace holds the installation', async () => {
    const db = recordingFetch([[]]);
    expect(await queueOn(db.fetch)(JOB)).toEqual({ job: null, created: false, reason: 'no workspace holds the installation 7' });
    expect(db.requests).toHaveLength(1);
  });

  it('throws what the database refused', async () => {
    const refusal = new Response(JSON.stringify({ message: 'new row violates check constraint "runner_jobs_one_sender"', code: '23514' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
    const db = recordingFetch([[{ id: 'ws-1' }], [], refusal]);
    await expect(queueOn(db.fetch)(JOB)).rejects.toThrow('the database refused: new row violates check constraint "runner_jobs_one_sender" (23514)');
  });

  it('throws when the database answers a job of another shape', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [{ id: 7 }]]);
    await expect(queueOn(db.fetch)(JOB)).rejects.toThrow();
  });
});
