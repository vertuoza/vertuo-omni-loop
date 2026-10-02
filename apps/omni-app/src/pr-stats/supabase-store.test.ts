import { describe, expect, it } from 'vitest';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { supabaseStore } from './supabase-store.ts';

type Recorded = { method: string; path: string; query: URLSearchParams; body: unknown; headers: Headers };

/** A fetch that records each request to the database and answers with the next of `answers`. */
function recordingFetch(answers: unknown[] = []) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body: unknown = init.body ? JSON.parse(printed(init.body)) : null;
      requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams, body, headers: new Headers(init.headers) });
      const answer = answers.shift() ?? [];
      resolve(new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

/** The request at `index`: the test fails when there is none. */
function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  assertDefined(item, `request ${index}`);
  return item;
}

/** Any value, as `String` prints it: a request body is whatever the port sent. */
const printed = (value: unknown) => String(value);

const connect = (fetch: typeof globalThis.fetch) => supabaseStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('supabaseStore — the collector\'s writes, never calling Supabase', () => {
  it('lists the tracked repositories of workspaces with an installation', async () => {
    const db = recordingFetch([
      [{ workspace_id: 'ws', full_name: 'vertuoza/apps', collected_until: null, workspaces: { github_installation_id: 7 } }],
    ]);
    const rows = await connect(db.fetch).trackedRepositories();

    expect(rows).toEqual([{ workspaceId: 'ws', installationId: 7, fullName: 'vertuoza/apps', collectedUntil: null }]);
    const request = nth(db.requests, 0);
    expect(request.path).toBe('/rest/v1/repositories');
    expect(request.query.get('tracked')).toBe('eq.true');
    expect(request.query.get('workspaces.github_installation_id')).toBe('not.is.null');
    expect(request.query.get('select')).toContain('workspaces!inner(github_installation_id)');
    expect(request.headers.get('apikey')).toBe('service-key');
  });

  it('upserts a pull request, then its reviews, on their keys', async () => {
    const db = recordingFetch();
    const row = { workspace_id: 'ws', repo: 'vertuoza/apps', number: 3, opened_at: '2026-09-27T00:00:00Z' };
    const review = { workspace_id: 'ws', repo: 'vertuoza/apps', number: 3, reviewer: 'bob', first_at: '2026-09-28T00:00:00Z' };
    await connect(db.fetch).savePull(row, [review]);

    expect(db.requests.map((request) => [request.method, request.path, request.query.get('on_conflict')])).toEqual([
      ['POST', '/rest/v1/pull_requests', 'workspace_id,repo,number'],
      ['POST', '/rest/v1/pull_request_reviews', 'workspace_id,repo,number,reviewer'],
    ]);
    expect(nth(db.requests, 0).headers.get('prefer')).toContain('resolution=merge-duplicates');
    expect(nth(db.requests, 1).body).toEqual([review]);
  });

  it('writes no review request for a pull request with none', async () => {
    const db = recordingFetch();
    await connect(db.fetch).savePull({ workspace_id: 'ws', repo: 'vertuoza/apps', number: 3, opened_at: '2026-09-27T00:00:00Z' }, []);
    expect(db.requests).toHaveLength(1);
  });

  it('updates one repository\'s collection columns', async () => {
    const db = recordingFetch();
    await connect(db.fetch).updateRepository('ws', 'vertuoza/apps', { collect_error: 'HTTP 404: Not Found' });

    const request = nth(db.requests, 0);
    expect([request.method, request.path]).toEqual(['PATCH', '/rest/v1/repositories']);
    expect(request.query.get('workspace_id')).toBe('eq.ws');
    expect(request.query.get('full_name')).toBe('eq.vertuoza/apps');
    expect(request.body).toEqual({ collect_error: 'HTTP 404: Not Found' });
  });

  it('throws what the database refused', async () => {
    const fetch = () => Promise.resolve(new Response(JSON.stringify({ message: 'permission denied', code: '42501' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    await expect(connect(fetch).updateRepository('ws', 'vertuoza/apps', {})).rejects.toThrow(/permission denied/);
  });
});
