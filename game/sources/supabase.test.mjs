import { describe, it, expect } from 'vitest';
import { supabaseRest, supabaseFromEnv, loadConfig, supabaseLedger } from './supabase.mjs';

// A fake PostgREST over in-memory tables: enough of GET (limit/offset, not-null filters) and of
// POST with on_conflict + ignore-duplicates to hold the client to the real contract.
function fakeSupabase(tables, { failOn = null } = {}) {
  const calls = [];
  const fetch = async (href, init = {}) => {
    const url = new URL(href);
    const table = url.pathname.split('/').pop();
    calls.push({ method: init.method ?? 'GET', table, url, headers: init.headers });
    const reply = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (failOn === table) return reply(503, { message: 'upstream down' });
    const rows = (tables[table] ??= []);
    if ((init.method ?? 'GET') === 'GET') {
      let out = rows;
      for (const [k, v] of url.searchParams) if (v === 'not.is.null') out = out.filter((r) => r[k] !== null && r[k] !== undefined);
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1e9);
      return reply(200, out.slice(offset, offset + limit));
    }
    const key = url.searchParams.get('on_conflict');
    const inserted = [];
    for (const row of JSON.parse(init.body)) {
      if (rows.some((r) => r[key] === row[key])) continue;
      rows.push(row);
      inserted.push({ [key]: row[key] });
    }
    return reply(201, inserted);
  };
  return { fetch, calls, tables };
}

const ev = (id, at, extra = {}) => ({ id, at, type: 'ZONE_SECURED', planet: 2332, data: {}, ...extra });

describe('supabaseRest', () => {
  it('sends the key on every call and pages past the row limit', async () => {
    const fake = fakeSupabase({ ledger_events: Array.from({ length: 1500 }, (_, i) => ({ id: `e${i}` })) });
    const rest = supabaseRest({ url: 'https://ref.supabase.co/', key: 'secret', fetch: fake.fetch });
    expect(await rest.select('ledger_events', 'select=id')).toHaveLength(1500);
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0].url.origin + fake.calls[0].url.pathname).toBe('https://ref.supabase.co/rest/v1/ledger_events');
    expect(fake.calls[0].headers).toMatchObject({ apikey: 'secret', Authorization: 'Bearer secret' });
  });

  it('names the table and the status when a read fails', async () => {
    const rest = supabaseRest({ url: 'https://ref.supabase.co', key: 'k', fetch: fakeSupabase({}, { failOn: 'teams' }).fetch });
    await expect(rest.select('teams', 'select=name')).rejects.toThrow(/read teams failed \(503/);
  });
});

describe('supabaseFromEnv', () => {
  it('says which variables to set when they are missing', () => {
    expect(() => supabaseFromEnv({})).toThrow(/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => supabaseFromEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k' })).not.toThrow();
  });
});

describe('loadConfig', () => {
  const tables = () => ({
    sectors: [{ name: 'core', repos: ['core-repo'] }],
    teams: [{ name: 'beaver', home: 'core', label: 'BEAVER', color: '#d08a4a', motto: '', mascot: 'beaver', sort: 10, retired_at: null }],
    players: [{ github_login: 'Alice', team: 'beaver' }, { github_login: null, team: 'beaver' }, { github_login: 'bob', team: null }],
  });

  it('builds the config from the three tables, with only linked players on the roster', async () => {
    const c = await loadConfig(supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fakeSupabase(tables()).fetch }));
    expect(c.repos).toEqual(['core-repo']);
    expect(c.teams.beaver).toMatchObject({ label: 'BEAVER', retired: false });
    expect(c.roster).toEqual({ alice: 'beaver' });
  });

  it.each(['sectors', 'teams', 'players'])('fails the poll when %s cannot be read (F7)', async (table) => {
    const rest = supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fakeSupabase(tables(), { failOn: table }).fetch });
    await expect(loadConfig(rest)).rejects.toThrow(new RegExp(`read ${table} failed`));
  });
});

describe('supabaseLedger', () => {
  it('keeps the ledger contract: new ids only, read back sorted, timestamps as the events wrote them', async () => {
    const fake = fakeSupabase({});
    const ledger = supabaseLedger(supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fake.fetch }));
    const first = await ledger.append([ev('b', '2026-09-02T10:00:00Z', { contributor: 'alice', team: 'beaver' }), ev('a', '2026-09-01T10:00:00Z')]);
    expect(first.map((e) => e.id)).toEqual(['b', 'a']);
    expect(fake.tables.ledger_events.find((r) => r.id === 'a')).toMatchObject({ region: null, contributor: null, team: null });
    expect((await ledger.append([ev('a', '2026-09-01T10:00:00Z'), ev('a', '2026-09-01T10:00:00Z')])).map((e) => e.id)).toEqual([]);
    // PostgREST returns timestamptz as +00:00; the ledger speaks Z.
    fake.tables.ledger_events.forEach((r) => { r.at = r.at.replace('Z', '+00:00'); });
    const back = await ledger.read();
    expect(back.map((e) => [e.id, e.at])).toEqual([['a', '2026-09-01T10:00:00Z'], ['b', '2026-09-02T10:00:00Z']]);
    expect(back[1]).toMatchObject({ contributor: 'alice', team: 'beaver' });
    expect(back[0].contributor).toBeUndefined();
  });

  it('refuses a malformed batch before writing any of it', async () => {
    const fake = fakeSupabase({});
    const ledger = supabaseLedger(supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fake.fetch }));
    await expect(ledger.append([ev('ok', '2026-09-01T10:00:00Z'), { id: 'x', at: 'nope', type: 'ZONE_SECURED', planet: 1 }])).rejects.toThrow();
    expect(fake.calls).toEqual([]);
  });
});
