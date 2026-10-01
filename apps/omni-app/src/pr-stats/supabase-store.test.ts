// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { supabaseStore } from './supabase-store.ts';

/** A fetch that records each request to the database and answers with the next of `answers`. */
function recordingFetch(answers = []) {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams, body: init.body ? JSON.parse(init.body) : null, headers: new Headers(init.headers) });
    const answer = answers.shift() ?? [];
    return new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, requests };
}

const connect = (fetch) => supabaseStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('supabaseStore — the collector\'s writes, never calling Supabase', () => {
  it('lists the tracked repositories of workspaces with an installation', async () => {
    const db = recordingFetch([
      [{ workspace_id: 'ws', full_name: 'vertuoza/apps', collected_until: null, workspaces: { github_installation_id: 7 } }],
    ]);
    const rows = await connect(db.fetch).trackedRepositories();

    expect(rows).toEqual([{ workspaceId: 'ws', installationId: 7, fullName: 'vertuoza/apps', collectedUntil: null }]);
    const [request] = db.requests;
    expect(request.path).toBe('/rest/v1/repositories');
    expect(request.query.get('tracked')).toBe('eq.true');
    expect(request.query.get('workspaces.github_installation_id')).toBe('not.is.null');
    expect(request.query.get('select')).toContain('workspaces!inner(github_installation_id)');
    expect(request.headers.get('apikey')).toBe('service-key');
  });

  it('upserts a pull request, then its reviews, on their keys', async () => {
    const db = recordingFetch();
    const row = { workspace_id: 'ws', repo: 'vertuoza/apps', number: 3 };
    const review = { workspace_id: 'ws', repo: 'vertuoza/apps', number: 3, reviewer: 'bob', first_at: '2026-09-28T00:00:00Z' };
    await connect(db.fetch).savePull(row, [review]);

    expect(db.requests.map((request) => [request.method, request.path, request.query.get('on_conflict')])).toEqual([
      ['POST', '/rest/v1/pull_requests', 'workspace_id,repo,number'],
      ['POST', '/rest/v1/pull_request_reviews', 'workspace_id,repo,number,reviewer'],
    ]);
    expect(db.requests[0].headers.get('prefer')).toContain('resolution=merge-duplicates');
    expect(db.requests[1].body).toEqual([review]);
  });

  it('writes no review request for a pull request with none', async () => {
    const db = recordingFetch();
    await connect(db.fetch).savePull({ workspace_id: 'ws', repo: 'vertuoza/apps', number: 3 }, []);
    expect(db.requests).toHaveLength(1);
  });

  it('updates one repository\'s collection columns', async () => {
    const db = recordingFetch();
    await connect(db.fetch).updateRepository('ws', 'vertuoza/apps', { collect_error: 'HTTP 404: Not Found' });

    const [request] = db.requests;
    expect([request.method, request.path]).toEqual(['PATCH', '/rest/v1/repositories']);
    expect(request.query.get('workspace_id')).toBe('eq.ws');
    expect(request.query.get('full_name')).toBe('eq.vertuoza/apps');
    expect(request.body).toEqual({ collect_error: 'HTTP 404: Not Found' });
  });

  it('throws what the database refused', async () => {
    const fetch = async () => new Response(JSON.stringify({ message: 'permission denied', code: '42501' }), { status: 403, headers: { 'content-type': 'application/json' } });
    await expect(connect(fetch).updateRepository('ws', 'vertuoza/apps', {})).rejects.toThrow(/permission denied/);
  });
});
