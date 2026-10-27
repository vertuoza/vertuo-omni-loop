import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { fleetBoardStore } from './store.ts';

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

const storeOn = (fetch: typeof globalThis.fetch) => fleetBoardStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('fleetBoardStore — the fleets as the service role, never calling Supabase (PRD 2530 s2)', () => {
  it('reads the workspaces that track the repository, in lower case, through this installation only', async () => {
    const db = recordingFetch([
      [
        { workspace_id: 'ws-1', workspaces: { github_installation_id: 4242 } },
        { workspace_id: 'ws-2', workspaces: { github_installation_id: '4242' } },
        { workspace_id: 'ws-3', workspaces: { github_installation_id: 9 } },
      ],
    ]);
    expect(await storeOn(db.fetch).workspaces({ installationId: 4242, repository: 'Acme/Widgets' })).toEqual(['ws-1', 'ws-2']);

    const read = nth(db.requests, 0);
    expect(read.path).toBe('/rest/v1/repositories');
    expect(read.query.get('full_name')).toBe('eq.acme/widgets');
    expect(read.query.get('tracked')).toBe('eq.true');
    expect(read.query.get('removed_at')).toBe('is.null');
    expect(read.query.get('workspaces.github_installation_id')).toBe('eq.4242');
    expect(read.headers.get('apikey')).toBe('service-key');
  });

  it('finds the author’s active fleet and its board, the login matched case-insensitively', async () => {
    const db = recordingFetch([[{ team: 'core' }], [{ name: 'core', project_url: 'https://github.com/orgs/acme/projects/7' }]]);
    expect(await storeOn(db.fetch).fleetOf({ workspace: 'ws-1', login: 'Ada-L' })).toEqual({ name: 'core', projectUrl: 'https://github.com/orgs/acme/projects/7' });

    const [player, team] = [nth(db.requests, 0), nth(db.requests, 1)];
    expect([player.path, player.query.get('workspace_id'), player.query.get('github_login'), player.query.get('team')]).toEqual(['/rest/v1/players', 'eq.ws-1', 'ilike.Ada-L', 'not.is.null']);
    expect([team.path, team.query.get('workspace_id'), team.query.get('name'), team.query.get('retired_at')]).toEqual(['/rest/v1/teams', 'eq.ws-1', 'eq.core', 'is.null']);
  });

  it('finds no fleet for a player in none, a retired fleet, or a login no player can have, reading nothing for the last', async () => {
    expect(await storeOn(recordingFetch([[]]).fetch).fleetOf({ workspace: 'ws-1', login: 'grace' })).toBeNull();
    expect(await storeOn(recordingFetch([[{ team: 'core' }], []]).fetch).fleetOf({ workspace: 'ws-1', login: 'ada' })).toBeNull();
    const bot = recordingFetch();
    expect(await storeOn(bot.fetch).fleetOf({ workspace: 'ws-1', login: 'omni-loop-invader[bot]' })).toBeNull();
    expect(await storeOn(bot.fetch).fleetOf({ workspace: 'ws-1', login: 'a%' })).toBeNull();
    expect(bot.requests).toEqual([]);
  });

  it('notes the fleet only while it still holds the board, cut to 200 characters', async () => {
    const db = recordingFetch([[{ name: 'core', project_url: 'https://github.com/orgs/acme/projects/7' }], []]);
    const store = storeOn(db.fetch);
    const input = { workspace: 'ws-1', fleet: 'core', projectUrl: 'https://github.com/orgs/acme/projects/7', note: 'Added #28 · acme/widgets', at: '2026-10-27T10:30:00.000Z' };
    expect(await store.note(input)).toEqual({ noted: true });
    expect(await store.note({ ...input, note: 'x'.repeat(250) })).toEqual({ noted: false });

    const [first, second] = [nth(db.requests, 0), nth(db.requests, 1)];
    expect([first.method, first.path]).toEqual(['PATCH', '/rest/v1/teams']);
    expect(first.body).toEqual({ project_note: 'Added #28 · acme/widgets', project_noted_at: '2026-10-27T10:30:00.000Z' });
    expect([first.query.get('workspace_id'), first.query.get('name'), first.query.get('project_url')]).toEqual(['eq.ws-1', 'eq.core', 'eq.https://github.com/orgs/acme/projects/7']);
    expect((second.body as { project_note: string }).project_note).toHaveLength(200);
  });

  it('throws when the database refuses, so the step retries', async () => {
    const refused = new Response(JSON.stringify({ message: 'down', code: '500' }), { status: 500, headers: { 'content-type': 'application/json' } });
    await expect(storeOn(recordingFetch([refused]).fetch).workspaces({ installationId: 1, repository: 'a/b' })).rejects.toThrow('the database refused: down');
  });
});
