import { describe, it, expect } from 'vitest';
import { supabaseRest, supabaseFromEnv, loadWorkspace, loadConfig, supabaseLedger, exportWorkspace } from './supabase.mjs';
import { fakeSupabase } from '../test/fake-supabase.mjs';

const ev = (id, at, extra = {}) => ({ id, at, type: 'ZONE_SECURED', planet: 2332, data: {}, ...extra });

// Two workspaces share every table: whatever the game reads or writes for one must never touch the other.
const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const ACME = 'b0000000-0000-4000-8000-000000000002';
const workspaces = () => [
  { id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan', join_domain: 'vertuoza.com', theme: {}, created_at: '2026-09-26T12:00:00+00:00' },
  { id: ACME, slug: 'acme', name: 'Acme', github_org: 'acme-gh', plan_repo: 'acme-plan', join_domain: null, theme: { plasma: '#2fc6a4' }, created_at: '2026-09-27T12:00:00+00:00' },
];
const restOn = (fake) => supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fake.fetch });

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

  it('names the table and the cause when Supabase cannot be reached', async () => {
    const unreachable = async () => { throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) }); };
    const rest = supabaseRest({ url: 'http://127.0.0.1:9', key: 'k', fetch: unreachable });
    await expect(rest.select('workspaces', 'select=id')).rejects.toThrow('Supabase: read workspaces failed (ECONNREFUSED at http://127.0.0.1:9)');
    await expect(rest.insertNew('ledger_events', [{ id: 'a' }], 'id')).rejects.toThrow(/write ledger_events 0–1 failed \(ECONNREFUSED/);
  });
});

describe('supabaseFromEnv', () => {
  it('says which variables to set when they are missing', () => {
    expect(() => supabaseFromEnv({})).toThrow(/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => supabaseFromEnv({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k' })).not.toThrow();
  });
});

describe('loadWorkspace', () => {
  it('reads one workspace by its slug, with the GitHub organisation and plan repository it names', async () => {
    const fake = fakeSupabase({ workspaces: workspaces() });
    const w = await loadWorkspace(restOn(fake), 'acme');
    expect(w).toMatchObject({ id: ACME, slug: 'acme', name: 'Acme', github_org: 'acme-gh', plan_repo: 'acme-plan' });
    expect(fake.calls[0].url.searchParams.get('slug')).toBe('eq.acme');
  });

  it('keeps a workspace that names no GitHub organisation yet: the commands that need one refuse it', async () => {
    const fake = fakeSupabase({ workspaces: [{ ...workspaces()[1], github_org: null, plan_repo: null }] });
    expect(await loadWorkspace(restOn(fake), 'acme')).toMatchObject({ github_org: null, plan_repo: null });
  });

  it('throws naming an unknown slug', async () => {
    await expect(loadWorkspace(restOn(fakeSupabase({ workspaces: workspaces() })), 'ghost')).rejects.toThrow(/no workspace "ghost"/);
  });

  it('sends a slug as a value, never as more of the query', async () => {
    const fake = fakeSupabase({ workspaces: workspaces() });
    await expect(loadWorkspace(restOn(fake), 'acme&id=not.is.null')).rejects.toThrow(/no workspace "acme&id=not.is.null"/);
    expect(fake.calls[0].url.searchParams.get('slug')).toBe('eq.acme&id=not.is.null');
    expect(fake.calls[0].url.searchParams.has('id')).toBe(false);
  });
});

describe('loadConfig', () => {
  const tables = () => ({
    sectors: [{ workspace_id: VERTUOZA, name: 'core', repos: ['core-repo'] }, { workspace_id: ACME, name: 'rockets', repos: ['acme-rockets'] }],
    teams: [
      { workspace_id: VERTUOZA, name: 'beaver', home: 'core', label: 'BEAVER', color: '#d08a4a', motto: '', mascot: 'beaver', sort: 10, retired_at: null },
      { workspace_id: ACME, name: 'roadrunner', home: 'rockets', label: 'MEEP', color: '#ffd84a', motto: '', mascot: null, sort: 10, retired_at: null },
    ],
    players: [
      { workspace_id: VERTUOZA, github_login: 'Alice', team: 'beaver' },
      { workspace_id: VERTUOZA, github_login: null, team: 'beaver' },
      { workspace_id: VERTUOZA, github_login: 'bob', team: null },
      { workspace_id: ACME, github_login: 'wile', team: 'roadrunner' },
    ],
  });

  it('builds the config from one workspace\'s three tables, with only linked players on the roster', async () => {
    const c = await loadConfig(restOn(fakeSupabase(tables())), VERTUOZA);
    expect(c.repos).toEqual(['core-repo']);
    expect(Object.keys(c.teams)).toEqual(['beaver']);
    expect(c.teams.beaver).toMatchObject({ label: 'BEAVER', retired: false });
    expect(c.roster).toEqual({ alice: 'beaver' });
  });

  it('filters every read by the workspace', async () => {
    const fake = fakeSupabase(tables());
    await loadConfig(restOn(fake), ACME);
    expect(fake.calls.map((c) => c.table).sort()).toEqual(['players', 'sectors', 'teams']);
    for (const call of fake.calls) expect(call.url.searchParams.get('workspace_id')).toBe(`eq.${ACME}`);
  });

  it('refuses to read without a workspace, before any call', async () => {
    const fake = fakeSupabase(tables());
    await expect(loadConfig(restOn(fake))).rejects.toThrow(/workspace/);
    expect(fake.calls).toEqual([]);
  });

  it.each(['sectors', 'teams', 'players'])('fails the poll when %s cannot be read (F7)', async (table) => {
    const rest = supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fakeSupabase(tables(), { failOn: table }).fetch });
    await expect(loadConfig(rest, VERTUOZA)).rejects.toThrow(new RegExp(`read ${table} failed`));
  });
});

describe('supabaseLedger', () => {
  it('keeps the ledger contract: new ids only, read back sorted, timestamps as the events wrote them', async () => {
    const fake = fakeSupabase({});
    const ledger = supabaseLedger(restOn(fake), VERTUOZA);
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
    expect(back[0].workspace_id).toBeUndefined(); // a storage column, never an event field
  });

  it('appends each row with its workspace, keyed by workspace and id', async () => {
    const fake = fakeSupabase({});
    await supabaseLedger(restOn(fake), VERTUOZA).append([ev('a', '2026-09-01T10:00:00Z')]);
    const post = fake.calls.find((c) => c.method === 'POST');
    expect(post.url.searchParams.get('on_conflict')).toBe('workspace_id,id');
    expect(post.body).toEqual([expect.objectContaining({ workspace_id: VERTUOZA, id: 'a' })]);
  });

  it('holds one id in two workspaces, and reads back only its own', async () => {
    const fake = fakeSupabase({});
    const acme = supabaseLedger(restOn(fake), ACME);
    const vertuoza = supabaseLedger(restOn(fake), VERTUOZA);
    expect((await acme.append([ev('planet:12:charted', '2026-09-01T10:00:00Z', { planet: 12 })])).map((e) => e.id)).toEqual(['planet:12:charted']);
    expect((await vertuoza.append([ev('planet:12:charted', '2026-09-03T10:00:00Z', { planet: 12 })])).map((e) => e.id)).toEqual(['planet:12:charted']);
    expect((await vertuoza.read()).map((e) => e.at)).toEqual(['2026-09-03T10:00:00Z']);
    const reads = fake.calls.filter((c) => c.method === 'GET');
    expect(reads.map((c) => c.url.searchParams.get('workspace_id'))).toEqual([`eq.${VERTUOZA}`]);
  });

  it('refuses a ledger without a workspace', () => {
    expect(() => supabaseLedger(restOn(fakeSupabase({})))).toThrow(/workspace/);
  });

  it('refuses a malformed batch before writing any of it', async () => {
    const fake = fakeSupabase({});
    const ledger = supabaseLedger(restOn(fake), VERTUOZA);
    await expect(ledger.append([ev('ok', '2026-09-01T10:00:00Z'), { id: 'x', at: 'nope', type: 'ZONE_SECURED', planet: 1 }])).rejects.toThrow();
    expect(fake.calls).toEqual([]);
  });
});

describe('exportWorkspace', () => {
  const tables = () => ({
    workspaces: workspaces(),
    ledger_events: [
      { workspace_id: VERTUOZA, id: 'planet:12:charted', at: '2026-09-01T10:00:00+00:00', type: 'PLANET_CHARTED', planet: 12, region: null, contributor: null, team: null, data: {} },
      { workspace_id: ACME, id: 'planet:12:charted', at: '2026-09-02T10:00:00+00:00', type: 'PLANET_CHARTED', planet: 12, region: null, contributor: null, team: null, data: {} },
    ],
    sectors: [{ workspace_id: VERTUOZA, name: 'core', repos: ['core-repo'] }, { workspace_id: ACME, name: 'rockets', repos: [] }],
    teams: [
      { workspace_id: VERTUOZA, name: 'beaver', home: 'core', label: 'BEAVER', color: '#d08a4a', motto: '', mascot: 'beaver', sort: 10, retired_at: null },
      { workspace_id: ACME, name: 'roadrunner', home: null, label: 'MEEP', color: '#ffd84a', motto: '', mascot: null, sort: 10, retired_at: null },
    ],
    players: [
      { workspace_id: VERTUOZA, user_id: 'u1', display_name: 'ALICE', team: 'beaver', team_since: null, hero: {}, github_id: 1, github_login: 'alice', created_at: 'c', updated_at: 'u' },
      { workspace_id: ACME, user_id: 'u1', display_name: 'WILE', team: 'roadrunner', team_since: null, hero: {}, github_id: 1, github_login: 'alice', created_at: 'c', updated_at: 'u' },
    ],
  });

  it('reads one workspace: its row, then its ledger, sectors, fleets and players, and nothing of another', async () => {
    const fake = fakeSupabase(tables());
    const out = await exportWorkspace(restOn(fake), VERTUOZA);
    expect(Object.keys(out)).toEqual(['workspace', 'ledger_events', 'sectors', 'teams', 'players']);
    expect(out.workspace).toEqual([workspaces()[0]]);
    for (const table of ['ledger_events', 'sectors', 'teams', 'players']) {
      expect(out[table]).toHaveLength(1);
      expect(out[table][0].workspace_id).toBe(VERTUOZA);
    }
    expect(out.players[0]).toMatchObject({ user_id: 'u1', display_name: 'ALICE', github_login: 'alice' });
    expect(JSON.stringify(out)).not.toContain(ACME);
  });

  it('refuses to export without a workspace, before any call', async () => {
    const fake = fakeSupabase(tables());
    await expect(exportWorkspace(restOn(fake))).rejects.toThrow(/workspace/);
    expect(fake.calls).toEqual([]);
  });
});
