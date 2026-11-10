import { describe, expect, it } from 'vitest';
import { runnerQueue } from './runner-queue.ts';

type Recorded = { method: string; table: string; query: URLSearchParams };

/** A fetch that answers each request with the rows of its `<METHOD> <table>`, none when unnamed, and records it. */
function tableFetch(rows: Record<string, unknown[]>) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init.method ?? 'GET';
    const table = url.pathname.replace('/rest/v1/', '');
    requests.push({ method, table, query: url.searchParams });
    return Promise.resolve(new Response(JSON.stringify(rows[`${method} ${table}`] ?? []), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  return { fetch, requests };
}

const queueOn = (fetch: typeof globalThis.fetch) => runnerQueue({ url: 'https://db.example', key: 'service-key', fetch });
const JOB = { installationId: 7, repository: 'Acme/Widgets', line: '/omni:retro-apply --retro 21' };
const WORKSPACE = { 'GET workspaces': [{ id: 'ws-1' }], 'POST runner_jobs': [{ id: 'job-1' }] };

describe('runnerQueue — a repository the workspace removed gets no job from the app (#2693)', () => {
  it('queues nothing, and says why, for a repository the workspace removed', async () => {
    const db = tableFetch({ ...WORKSPACE, 'GET repositories': [{ removed_at: '2026-11-08T10:00:00+00:00' }] });

    expect(await queueOn(db.fetch)(JOB)).toEqual({ job: null, created: false, reason: 'the workspace removed acme/widgets' });
    expect(db.requests.filter((request) => request.method === 'POST')).toEqual([]);
    const read = db.requests.find((request) => request.table === 'repositories');
    expect([read?.method, read?.query.get('workspace_id'), read?.query.get('full_name')]).toEqual(['GET', 'eq.ws-1', 'eq.acme/widgets']);
  });

  it('gives back no job already queued for a repository the workspace removed', async () => {
    const db = tableFetch({ ...WORKSPACE, 'GET repositories': [{ removed_at: '2026-11-08T10:00:00+00:00' }], 'GET runner_jobs': [{ id: 'job-0' }] });

    expect(await queueOn(db.fetch)(JOB)).toEqual({ job: null, created: false, reason: 'the workspace removed acme/widgets' });
  });

  it('queues the job for a repository the workspace lists', async () => {
    const db = tableFetch({ ...WORKSPACE, 'GET repositories': [{ removed_at: null }] });

    expect(await queueOn(db.fetch)(JOB)).toEqual({ job: 'job-1', created: true, reason: null });
  });

  it('queues the job for a repository the workspace never listed', async () => {
    const db = tableFetch(WORKSPACE);

    expect(await queueOn(db.fetch)(JOB)).toEqual({ job: 'job-1', created: true, reason: null });
  });
});
