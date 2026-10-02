// pnpm game:xp: its run, with the REST client injected, against the fake PostgREST; then the script
// itself, as a process, against the same fake behind a local server. Nothing here reaches Supabase.
import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runXp } from './xp.ts';
import { supabaseRest } from '../sources/supabase.ts';
import { fakeSupabase, serveFake, type Call, type Init, type Reply, type Row, type Served } from '../test/fake-supabase.ts';
import { RULEBOOK } from '../rulebook.ts';
import { nth, present } from '../test/present.ts';
import { assertDefined } from '../../kit/test/assert.ts';

const here = dirname(fileURLToPath(import.meta.url));
const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const ACME = 'b0000000-0000-4000-8000-000000000002';
const NOW = new Date('2026-09-30T16:00:00Z');

const row = (workspace_id: string, id: string, at: string, type: string, over: Row = {}): Row => ({ workspace_id, id, at, type, planet: 2332, home: 'acme/plan', region: null, contributor: null, team: null, data: {}, ...over });
// Alice (as GitHub spells her) secured two zones in working hours; Bob one at night; Carol only claimed one.
const ledger = () => [
  row(VERTUOZA, 'planet:2332:charted', '2026-09-01T08:00:00+00:00', 'PLANET_CHARTED', { data: { ownerTeam: 'beaver' } }),
  row(VERTUOZA, 'zone:r:2332:s1:secured', '2026-08-17T12:00:00+00:00', 'ZONE_SECURED', { contributor: 'Alice', team: 'octopod' }),
  row(VERTUOZA, 'zone:r:2332:s2:secured', '2026-09-21T12:00:00+00:00', 'ZONE_SECURED', { contributor: 'alice', team: 'octopod' }),
  row(VERTUOZA, 'zone:r:2332:s3:secured', '2026-09-21T20:00:00+00:00', 'ZONE_SECURED', { contributor: 'bob', team: 'octopod' }),
  row(VERTUOZA, 'zone:r:2332:s4:claimed', '2026-09-22T12:00:00+00:00', 'ZONE_CLAIMED', { contributor: 'carol', team: 'beaver' }),
  // Acme's ledger names Alice too, and never counts for Vertuoza.
  row(ACME, 'zone:r:2332:s1:secured', '2026-09-21T12:00:00+00:00', 'ZONE_SECURED', { contributor: 'alice', team: 'roadrunners' }),
];
const restOn = (fake: { fetch: (href: string, init?: Init) => Promise<Reply> }) => supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fake.fetch });
const posts = (fake: { calls: Call[] }) => fake.calls.filter((c) => c.method === 'POST');

describe('runXp', () => {
  it('upserts every login of the workspace\'s ledger in one request, lower-cased, with its XP, level, unlocked games and time', async () => {
    const fake = fakeSupabase({ ledger_events: ledger(), player_xp: [] });
    const rows = await runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: NOW });

    const at = NOW.toISOString();
    const expected = [
      { workspace_id: VERTUOZA, github_login: 'alice', xp: 20, level: 1, unlocked: ['invaders'], computed_at: at },
      { workspace_id: VERTUOZA, github_login: 'bob', xp: 15, level: 1, unlocked: ['invaders'], computed_at: at },
      { workspace_id: VERTUOZA, github_login: 'carol', xp: 0, level: 0, unlocked: [], computed_at: at },
    ];
    expect(rows).toEqual(expected);
    expect(posts(fake)).toHaveLength(1);
    const [write] = posts(fake);
    assertDefined(write, 'the write');
    expect(write.table).toBe('player_xp');
    expect(write.url.searchParams.get('on_conflict')).toBe('workspace_id,github_login');
    expect(present(write.headers, 'headers').Prefer).toMatch(/resolution=merge-duplicates/);
    expect(write.body).toEqual(expected);
    expect(fake.tables.player_xp).toEqual(expected);
  });

  it('reads only the named workspace, and writes nothing of another', async () => {
    const acmeRow = { workspace_id: ACME, github_login: 'alice', xp: 999, level: 6, unlocked: ['invaders'], computed_at: '2026-09-01T00:00:00.000Z' };
    const fake = fakeSupabase({ ledger_events: ledger(), player_xp: [acmeRow] });
    await runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: NOW });
    for (const read of fake.calls.filter((c) => c.method === 'GET')) {
      expect(read.url.searchParams.get('workspace_id'), read.table).toBe(`eq.${VERTUOZA}`);
    }
    expect((nth(posts(fake), 0, 'the first post').body as Row[]).map((r) => r.workspace_id)).toEqual([VERTUOZA, VERTUOZA, VERTUOZA]);
    expect(present(fake.tables.player_xp, 'player_xp').find((r) => r.workspace_id === ACME)).toEqual(acmeRow);
  });

  it('rewrites a login\'s row at every run, and keeps its stored unlocks when a lowered weight drops its level', async () => {
    const fake = fakeSupabase({ ledger_events: ledger(), player_xp: [] });
    await runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: NOW });
    const later = new Date('2026-10-01T08:00:00Z');
    const nothingCounts = { ...RULEBOOK.xp, weights: { ...RULEBOOK.xp.weights, zoneSecured: 0 } };
    await runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: later, rules: nothingCounts });

    expect(fake.tables.player_xp).toHaveLength(3);
    expect(present(fake.tables.player_xp, 'player_xp').find((r) => r.github_login === 'alice')).toEqual({
      workspace_id: VERTUOZA, github_login: 'alice', xp: 0, level: 0, unlocked: ['invaders'], computed_at: later.toISOString(),
    });
    expect(present(present(fake.tables.player_xp, 'player_xp').find((r) => r.github_login === 'carol'), 'the player row').unlocked).toEqual([]);
  });

  it('restarts XP at the fresh start: rows with no home add nothing, and a game already unlocked stays (PRD 728)', async () => {
    const before = ledger().filter((r) => r.workspace_id === VERTUOZA).map((r) => ({ ...r, home: null }));
    const stored = { workspace_id: VERTUOZA, github_login: 'alice', xp: 20, level: 1, unlocked: ['invaders'], computed_at: '2026-09-29T00:00:00.000Z' };
    const fake = fakeSupabase({ ledger_events: before, player_xp: [stored] });
    const rows = await runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: NOW });
    expect(rows.map((r) => [r.github_login, r.xp, r.level, r.unlocked])).toEqual([
      ['alice', 0, 0, ['invaders']], ['bob', 0, 0, []], ['carol', 0, 0, []],
    ]);
  });

  it.each(['ledger_events', 'player_xp'])('writes nothing and fails when %s cannot be read', async (table) => {
    const fake = fakeSupabase({ ledger_events: ledger(), player_xp: [] }, { failOn: table });
    await expect(runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: NOW })).rejects.toThrow(new RegExp(`read ${table} failed`));
    expect(posts(fake)).toEqual([]);
  });

  it('refuses a stored row it cannot read, before writing', async () => {
    const fake = fakeSupabase({ ledger_events: ledger(), player_xp: [{ workspace_id: VERTUOZA, github_login: 'alice', unlocked: 'invaders' }] });
    await expect(runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: NOW })).rejects.toThrow();
    expect(posts(fake)).toEqual([]);
  });

  it('writes nothing for a ledger that names no login yet', async () => {
    const fake = fakeSupabase({ ledger_events: [nth(ledger(), 0, 'the first event')], player_xp: [] });
    expect(await runXp({ rest: restOn(fake), workspaceId: VERTUOZA, now: NOW })).toEqual([]);
    expect(posts(fake)).toEqual([]);
  });

  it('refuses to run without a workspace, before any call', async () => {
    const fake = fakeSupabase({ ledger_events: ledger() });
    await expect(runXp({ rest: restOn(fake), now: NOW } as Parameters<typeof runXp>[0])).rejects.toThrow(/workspace/);
    expect(fake.calls).toEqual([]);
  });
});

describe('pnpm game:xp, as a process', () => {
  let server: Served<Call> | null = null;
  afterEach(async () => { await server?.close(); server = null; });

  const workspaces = [{ id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan', theme: {}, created_at: '2026-09-26T12:00:00+00:00' }];
  async function xp(args: string[], env: Record<string, string> = {}) {
    try {
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(here, 'xp.ts'), ...args], {
        env: { PATH: process.env.PATH, SUPABASE_URL: present(server, 'the fake server').url, SUPABASE_SERVICE_ROLE_KEY: 'k', ...env },
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      const failed = err as { code: number; stdout: string; stderr: string };
      return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr };
    }
  }

  it('writes the workspace OMNI_LOOP_WORKSPACE names, and says how many logins it wrote', async () => {
    server = await serveFake({ workspaces, ledger_events: ledger(), player_xp: [] });
    const run = await xp([], { OMNI_LOOP_WORKSPACE: 'vertuoza' });
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/vertuoza: 3 logins · 2 with a level · written to player_xp/);
    expect(present(present(server, 'the fake server').tables.player_xp, 'player_xp').map((r) => [r.github_login, r.xp, r.level])).toEqual([['alice', 20, 1], ['bob', 15, 1], ['carol', 0, 0]]);
  });

  it('exits non-zero and writes nothing when the ledger cannot be read', async () => {
    server = await serveFake({ workspaces, ledger_events: ledger(), player_xp: [] }, { failOn: 'ledger_events' });
    const run = await xp(['--workspace', 'vertuoza']);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/read ledger_events failed \(503/);
    expect(server.calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('stops, naming both ways to name a workspace, when neither is set', async () => {
    server = await serveFake({ workspaces });
    const run = await xp([]);
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(/no workspace named: pass --workspace <slug>, or set OMNI_LOOP_WORKSPACE/);
    expect(server.calls).toEqual([]);
  });
});
