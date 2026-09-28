import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { LedgerEvent } from '@omni/galaxy';

vi.mock('server-only', () => ({}));

// The parts' loaders, as load.ts calls them: each stands in for its folder's own (week/, counts/,
// rankings/), so these tests hold whatever the parts become. Each resolves with a marker of its own
// unless a test says otherwise.
const parts = vi.hoisted(() => ({
  week: vi.fn(async (_input: unknown): Promise<unknown> => 'the week'),
  counts: vi.fn(async (_input: unknown): Promise<unknown> => 'the counts'),
  rankings: vi.fn(async (_input: unknown): Promise<unknown> => 'the rankings'),
}));
vi.mock('./week/load', () => ({ loadWeek: parts.week }));
vi.mock('./counts/load', () => ({ loadCounts: parts.counts }));
vi.mock('./rankings/load', () => ({ loadRankings: parts.rankings }));

import { authUser, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from '../data/galaxy.fake';
import { loadDashboard } from './load';
import type { PartInput } from './part';

// The dashboard's loader (PRD 328), on the in-memory fake database (src/data/galaxy.fake.ts), read as
// one signed-in person under row-level security. It decides the States table's situations for a
// signed-in person (no workspace, no player row, no GitHub, a failed read), reads the hero block
// itself, and runs every part's loader in parallel, each on its own: a part that fails reads
// 'unreadable', alone.

const NOW = new Date('2026-09-26T10:00:00Z');

/** A zone secured this season, credited to a login of a fleet: 10 points on a working day. */
const secured = (planet: number, zone: string, contributor: string, team: string, at: string): LedgerEvent & Record<string, unknown> => ({
  workspace_id: VERTUOZA, id: `planet:${planet}:zone:${zone}:secured`, at, type: 'ZONE_SECURED', planet,
  region: 'vertuo-core', contributor, team, data: {},
});

/** Vertuoza's season so far: BOTH (BEAVER) secured two zones, ADA (PIRATES) one. */
const SEASON = [
  secured(12, 's1', 'both-gh', 'beaver', '2026-09-22T10:00:00Z'),
  secured(12, 's2', 'both-gh', 'beaver', '2026-09-23T10:00:00Z'),
  secured(12, 's3', 'Ada-GH', 'pirates', '2026-09-24T10:00:00Z'),
];

/** A member of Vertuoza whose player row never got a GitHub login, and whose account links none. */
const NOGH: FakeUser = { id: '00000000-0000-4000-8000-0000000000f1', email: 'nogh@vertuoza.com' };

function world(arrange: (w: ReturnType<typeof fakeGalaxyDb>) => void = () => {}) {
  const seed = twoWorkspaces();
  seed.ledger_events = [...(seed.ledger_events ?? []), ...SEASON];
  seed.workspace_members = [...(seed.workspace_members ?? []), { workspace_id: VERTUOZA, user_id: NOGH.id, role: 'member', joined_at: '2026-09-26T08:00:00Z' }];
  seed.players = [...(seed.players ?? []), {
    workspace_id: VERTUOZA, user_id: NOGH.id, display_name: 'NOGH', team: 'beaver', team_since: '2026-09-21T10:00:00Z',
    hero: { v: 1, body: 'boy', skin: 2, hair: 1, suit: 0, cape: 0 }, github_id: null, github_login: null,
  }];
  const w = fakeGalaxyDb(seed, [...Object.values(PEOPLE), NOGH]);
  arrange(w);
  return w;
}

async function dashboardOf(person: FakeUser, arrange?: (w: ReturnType<typeof fakeGalaxyDb>) => void) {
  const w = world(arrange);
  const db = w.client(person) as unknown as SupabaseClient;
  const load = await loadDashboard(db, authUser(person) as unknown as User, NOW);
  return { load, w, reads: w.calls.filter((c) => c.kind === 'from') };
}

/** The dashboard, for a person who has one. */
async function dashboard(person: FakeUser, arrange?: (w: ReturnType<typeof fakeGalaxyDb>) => void) {
  const { load, w, reads } = await dashboardOf(person, arrange);
  if (load.kind !== 'dashboard') throw new Error(`expected a dashboard, got ${load.kind}`);
  return { ...load.dashboard, w, reads };
}

const errors = () => vi.mocked(console.error).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  for (const load of Object.values(parts)) load.mockClear();
  parts.week.mockImplementation(async () => 'the week');
  parts.counts.mockImplementation(async () => 'the counts');
  parts.rankings.mockImplementation(async () => 'the rankings');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the full dashboard', () => {
  it('is the player\'s: their name, hero and fleet, their season points and both places, then every part', async () => {
    const d = await dashboard(PEOPLE.ada);
    expect(d.name).toBe('ADA');
    expect(d.season).toMatchObject({ name: 'September', key: '2026-09' });
    expect(d.you).toEqual({
      kind: 'player',
      hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 },
      fleet: { name: 'pirates', label: 'PIRATES', color: '#2fc6a4' },
      score: { points: 10, you: { rank: 2, of: 2 }, fleet: { label: 'PIRATES', rank: 2, of: 2 } },
    });
    expect([d.week, d.counts, d.rankings]).toEqual(['the week', 'the counts', 'the rankings']);
  });

  it('hands every part the same input: the database, the workspace, the person, their lower-cased login and fleet, now and the season', async () => {
    const d = await dashboard(PEOPLE.ada);
    for (const load of Object.values(parts)) {
      expect(load).toHaveBeenCalledTimes(1);
      const input = load.mock.calls[0][0] as PartInput;
      expect(input).toMatchObject({ workspace: VERTUOZA, userId: PEOPLE.ada.id, login: 'ada-gh', team: 'pirates', now: NOW });
      expect(input.season).toEqual(d.season);
      expect(typeof input.db.from).toBe('function');
    }
  });

  it('reads the galaxy once, however many parts ask for it', async () => {
    parts.rankings.mockImplementation(async (input) => (await (input as PartInput).galaxy()).heroes.length);
    parts.counts.mockImplementation(async (input) => (await (input as PartInput).galaxy()).teams.length);
    const d = await dashboard(PEOPLE.ada);
    expect([d.rankings, d.counts]).toEqual([2, 2]);
    expect(d.reads.filter((c) => c.table === 'ledger_events')).toHaveLength(1);
  });

  it('matches the login ignoring case: the ledger credits Ada-GH, the player is ada-gh', async () => {
    const d = await dashboard(PEOPLE.ada);
    expect(d.you).toMatchObject({ score: { points: 10, you: { rank: 2, of: 2 } } });
  });

  it('ranks first whoever leads: two more zones, and ADA is #1 of 2, PIRATES #1 of 2', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => {
      w.tables.ledger_events.push(
        secured(12, 's4', 'Ada-GH', 'pirates', '2026-09-25T10:00:00Z'),
        secured(12, 's5', 'Ada-GH', 'pirates', '2026-09-25T11:00:00Z'),
      );
    });
    expect(d.you).toMatchObject({ kind: 'player', score: { points: 30, you: { rank: 1, of: 2 }, fleet: { label: 'PIRATES', rank: 1, of: 2 } } });
  });

  it('counts this season only: points scored in August are August\'s', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => {
      w.tables.ledger_events.push(secured(12, 's0', 'Ada-GH', 'pirates', '2026-08-27T10:00:00Z'));
    });
    expect(d.you).toMatchObject({ score: { points: 10 } });
  });

  it('reads only the workspace shown: every read of the game filters on it', async () => {
    parts.rankings.mockImplementation(async (input) => (await (input as PartInput).galaxy()).heroes.length);
    const { reads } = await dashboard(PEOPLE.both);
    const game = reads.filter((c) => c.table !== 'workspace_members' && c.table !== 'workspaces');
    expect(game.length).toBeGreaterThan(0);
    for (const call of game) expect(call.eq, call.table).toMatchObject({ workspace_id: expect.any(String) });
    // BOTH joined Acme first: Acme is the workspace shown, and nothing of Vertuoza's is read.
    for (const call of game) expect(call.eq.workspace_id, call.table).not.toBe(VERTUOZA);
  });
});

describe('each situation of a signed-in person', () => {
  it('an account in no workspace: no dashboard, and nothing of the game read', async () => {
    const { load, reads } = await dashboardOf(PEOPLE.eve);
    expect(load).toEqual({ kind: 'no-workspace' });
    expect(reads.every((c) => c.table === 'workspace_members')).toBe(true);
    for (const load of Object.values(parts)) expect(load).not.toHaveBeenCalled();
  });

  it('an account of the domain in no workspace yet is joined, then has its dashboard', async () => {
    const { load, w } = await dashboardOf(PEOPLE.bea);
    expect(load.kind).toBe('dashboard');
    expect(w.calls).toContainEqual({ kind: 'rpc', fn: 'join_by_domain' });
  });

  it('a member who never joined a fleet: no hero block, their first name as the heading, and the parts counting by their linked GitHub', async () => {
    const d = await dashboard(PEOPLE.bea);
    expect(d.you).toEqual({ kind: 'no-player' });
    expect(d.name).toBe('Bea');
    expect(parts.week.mock.calls[0][0]).toMatchObject({ login: 'bea-gh', team: null });
    expect([d.week, d.counts, d.rankings]).toEqual(['the week', 'the counts', 'the rankings']);
  });

  it('a player with no GitHub linked: the hero and fleet show, the points and places say to link it, the parts get no login', async () => {
    const d = await dashboard(NOGH);
    expect(d.name).toBe('NOGH');
    expect(d.you).toEqual({
      kind: 'player',
      hero: { v: 1, body: 'boy', skin: 2, hair: 1, suit: 0, cape: 0 },
      fleet: { name: 'beaver', label: 'BEAVER', color: '#2fc6a4' },
      score: 'no-github',
    });
    expect(parts.counts.mock.calls[0][0]).toMatchObject({ userId: NOGH.id, login: null, team: 'beaver' });
  });

  it('a player whose fleet the workspace no longer knows keeps their hero, with no fleet named', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => {
      const row = w.tables.players.find((p) => p.user_id === PEOPLE.ada.id)!;
      row.team = 'gone';
    });
    expect(d.you).toMatchObject({ kind: 'player', fleet: null, score: { points: 10, fleet: null } });
  });
});

describe('one read failing', () => {
  it('the galaxy: only the hero block\'s figures read unreadable; the hero, the name, the fleet and the parts stay', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.failOn = 'ledger_events'; });
    expect(d.name).toBe('ADA');
    expect(d.you).toMatchObject({ kind: 'player', fleet: { label: 'PIRATES' }, score: 'unreadable' });
    expect([d.week, d.counts, d.rankings]).toEqual(['the week', 'the counts', 'the rankings']);
    expect(errors().some((e) => /ledger_events/.test(e))).toBe(true);
  });

  it('the galaxy, for a part that reads it: that part alone reads unreadable', async () => {
    parts.rankings.mockImplementation(async (input) => (await (input as PartInput).galaxy()).heroes.length);
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.failOn = 'ledger_events'; });
    expect(d.rankings).toBe('unreadable');
    expect([d.week, d.counts]).toEqual(['the week', 'the counts']);
  });

  it('the player row: the hero block reads unreadable, the heading falls back to the first name, the parts count by the linked GitHub', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.failOn = 'players'; });
    expect(d.you).toBe('unreadable');
    expect(d.name).toBe('Ada');
    expect(parts.week.mock.calls[0][0]).toMatchObject({ login: 'ada-gh', team: null });
    expect([d.week, d.counts, d.rankings]).toEqual(['the week', 'the counts', 'the rankings']);
  });

  it('the fleets: the hero block reads unreadable, and the parts still come', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.failOn = 'teams'; });
    expect(d.you).toBe('unreadable');
    expect([d.week, d.counts]).toEqual(['the week', 'the counts']);
  });

  it.each(['week', 'counts', 'rankings'] as const)('the %s: that part alone reads unreadable, and the error is logged', async (name) => {
    parts[name].mockImplementation(async () => { throw new Error(`${name} is down`); });
    const d = await dashboard(PEOPLE.ada);
    expect(d[name]).toBe('unreadable');
    const others = (['week', 'counts', 'rankings'] as const).filter((n) => n !== name);
    for (const other of others) expect(d[other]).toBe(`the ${other}`);
    expect(d.you).toMatchObject({ kind: 'player', score: { points: 10 } });
    expect(errors().some((e) => e.includes(`${name} is down`))).toBe(true);
  });

  it('a part that says unreadable itself is carried as it is', async () => {
    parts.counts.mockImplementation(async () => 'unreadable');
    expect((await dashboard(PEOPLE.ada)).counts).toBe('unreadable');
  });

  it('the workspace itself: every part reads unreadable, nobody is turned away, and the heading is the first name', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.fail = { message: 'timeout' }; });
    expect(d.name).toBe('Ada');
    expect([d.you, d.week, d.counts, d.rankings]).toEqual(['unreadable', 'unreadable', 'unreadable', 'unreadable']);
    expect(d.season).toMatchObject({ key: '2026-09' });
    for (const load of Object.values(parts)) expect(load).not.toHaveBeenCalled();
  });
});
