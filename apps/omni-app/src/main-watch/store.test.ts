import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { mainWatchStore } from './store.ts';

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

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  assertDefined(item, `request ${String(index)}`);
  return item;
}

const storeOn = (fetch: typeof globalThis.fetch) => mainWatchStore({ url: 'https://db.example', key: 'service-key', fetch });
const SHA = 'a'.repeat(40);
const LANE = { lane: 'acme/widgets', mergeSha: SHA, mergedAt: '2026-09-20T12:00:00Z', watchUntil: '2026-09-27T12:00:00Z' };
const KEY = { workspace: 'ws-1', repository: 'acme/widgets', prd: parsePrd(7), lane: 'acme/widgets' };
const BREAK = { kind: 'ci-red' as const, source: '1/unit', url: 'https://github.com/acme/widgets/actions/runs/1/job/10', title: 'CI › unit', parent: 'green' as const, at: '2026-09-20T12:10:00Z' };

describe('mainWatchStore — the watch as the service role, never calling Supabase (PRD 2410)', () => {
  it('opens one watch row per lane for the installation’s workspace, a row already there left as it is', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [{ lane: 'acme/widgets' }]]);
    const opened = await storeOn(db.fetch).open({ installationId: 7, repository: 'Acme/Widgets', prd: parsePrd(7), lanes: [LANE, { ...LANE, lane: 'acme/backend' }] });

    expect(opened).toEqual({ workspace: 'ws-1', reason: null, opened: 1 });
    const [workspace, insert] = [nth(db.requests, 0), nth(db.requests, 1)];
    expect([workspace.path, workspace.query.get('github_installation_id')]).toEqual(['/rest/v1/workspaces', 'eq.7']);
    expect([insert.method, insert.path, insert.query.get('on_conflict')]).toEqual(['POST', '/rest/v1/prd_main_watch', 'workspace_id,repository,prd,lane']);
    expect(insert.headers.get('prefer')).toContain('resolution=ignore-duplicates');
    expect(insert.body).toEqual([
      { workspace_id: 'ws-1', repository: 'acme/widgets', prd: 7, lane: 'acme/widgets', merge_sha: SHA, merged_at: LANE.mergedAt, watch_until: LANE.watchUntil },
      { workspace_id: 'ws-1', repository: 'acme/widgets', prd: 7, lane: 'acme/backend', merge_sha: SHA, merged_at: LANE.mergedAt, watch_until: LANE.watchUntil },
    ]);
    expect(workspace.headers.get('apikey')).toBe('service-key');
  });

  it('opens nothing, and says why, when no workspace holds the installation', async () => {
    const db = recordingFetch([[]]);
    expect(await storeOn(db.fetch).open({ installationId: 7, repository: 'acme/widgets', prd: parsePrd(7), lanes: [LANE] })).toEqual({
      workspace: null,
      reason: 'no workspace holds the installation 7',
      opened: 0,
    });
    expect(db.requests).toHaveLength(1);
  });

  it('adds the breaks a replay does not already hold, and marks the lane broke with what it could not read', async () => {
    const db = recordingFetch([[{ source: '1/unit' }], []]);
    expect(await storeOn(db.fetch).mark({ ...KEY, breaks: [BREAK], unread: ['regressions'] })).toEqual({ added: 1 });
    const [insert, update] = [nth(db.requests, 0), nth(db.requests, 1)];
    expect([insert.method, insert.path, insert.query.get('on_conflict')]).toEqual(['POST', '/rest/v1/prd_main_breaks', 'workspace_id,repository,prd,lane,kind,source']);
    expect(insert.headers.get('prefer')).toContain('resolution=ignore-duplicates');
    expect(insert.body).toEqual([{ workspace_id: 'ws-1', repository: 'acme/widgets', prd: 7, lane: 'acme/widgets', ...BREAK }]);
    expect([update.method, update.path]).toEqual(['PATCH', '/rest/v1/prd_main_watch']);
    expect(update.body).toEqual({ status: 'broke', unread: ['regressions'] });
    expect([update.query.get('workspace_id'), update.query.get('repository'), update.query.get('prd'), update.query.get('lane'), update.query.get('status')]).toEqual([
      'eq.ws-1',
      'eq.acme/widgets',
      'eq.7',
      'eq.acme/widgets',
      'neq.clean',
    ]);
  });

  it('with no break, writes only what it could not read, and adds no row', async () => {
    const db = recordingFetch([[]]);
    expect(await storeOn(db.fetch).mark({ ...KEY, breaks: [], unread: [] })).toEqual({ added: 0 });
    expect(db.requests.map((request) => [request.method, request.path])).toEqual([['PATCH', '/rest/v1/prd_main_watch']]);
    expect(nth(db.requests, 0).body).toEqual({ unread: [] });
  });

  it('closes a lane still watching as clean', async () => {
    const db = recordingFetch([[{ lane: 'acme/widgets' }]]);
    expect(await storeOn(db.fetch).close(KEY)).toEqual({ closed: true });
    const update = nth(db.requests, 0);
    expect([update.method, update.path, update.query.get('status')]).toEqual(['PATCH', '/rest/v1/prd_main_watch', 'eq.watching']);
    expect(update.body).toEqual({ status: 'clean', unread: [] });
  });

  it('throws what the database refused', async () => {
    const refusal = new Response(JSON.stringify({ message: 'new row violates check constraint', code: '23514' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const db = recordingFetch([refusal]);
    await expect(storeOn(db.fetch).mark({ ...KEY, breaks: [BREAK], unread: [] })).rejects.toThrow('the database refused: new row violates check constraint (23514)');
  });
});
