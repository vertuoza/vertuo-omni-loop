import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { GalaxyView, LedgerEvent } from '@omni/galaxy';
import { sure } from '../arcade/test/sure';

vi.mock('server-only', () => ({}));

// The parts' loaders, as load.ts calls them: Waiting for you (counts/) and the board (board/) stand in
// for their folder's own, so these tests hold whatever the parts become. The board's reads are made
// with the page's galaxy (supabaseReads) and drawn with Home's request (loadBoard); boardOf, which
// draws a board from reads that all failed, is the real one.
const parts = vi.hoisted(() => ({
  waiting: vi.fn<(input: unknown) => Promise<unknown>>(() => Promise.resolve('the waiting')),
  board: vi.fn<(reads: { galaxy: () => Promise<GalaxyView> }, request: unknown) => Promise<unknown>>(() => Promise.resolve('the board')),
  reads: vi.fn((_db: unknown, _workspace: string, galaxy: () => Promise<GalaxyView>) => ({ galaxy })),
}));
vi.mock('./counts/load', async (actual) => ({ ...(await actual<typeof import('./counts/load')>()), loadWaiting: parts.waiting }));
vi.mock('./board/load', async (actual) => ({ ...(await actual<typeof import('./board/load')>()), loadBoard: parts.board, supabaseReads: parts.reads }));

import { authUser, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from '../data/galaxy.fake';
import { loadDashboard } from './load';
import type { PartInput } from './part';

// Home's loader (PRD 328, reshaped by PRD 572), on the in-memory fake database
// (src/data/galaxy.fake.ts), read as one signed-in person under row-level security. It decides the
// States table's situations for a signed-in person (no workspace, no player row, no GitHub, a failed
// read), reads the hero block itself, and runs Waiting for you and the board in parallel, each on its
// own: a part that fails reads 'unreadable', alone. The board is *you*'s; its People table is your
// fleet's members, or your own row with no fleet.

const NOW = new Date('2026-09-26T10:00:00Z');

/** A zone secured this season, credited to a login of a fleet: 10 points on a working day. */
const secured = (planet: number, zone: string, contributor: string, team: string, at: string): LedgerEvent & Record<string, unknown> => ({
  workspace_id: VERTUOZA, id: `planet:${planet}:zone:${zone}:secured`, at, type: 'ZONE_SECURED', planet,
  home: 'vertuoza/vertuo-core', region: 'vertuo-core', contributor, team, data: {},
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
  // Bea joined Vertuoza by her GitHub org when she signed in (PRD 359): the page itself never joins.
  seed.workspace_members = [...(seed.workspace_members ?? []),
    { workspace_id: VERTUOZA, user_id: NOGH.id, role: 'member', joined_at: '2026-09-26T08:00:00Z' },
    { workspace_id: VERTUOZA, user_id: PEOPLE.bea.id, role: 'member', joined_at: '2026-09-26T09:00:00Z' }];
  seed.players = [...(seed.players ?? []), {
    workspace_id: VERTUOZA, user_id: NOGH.id, display_name: 'NOGH', team: 'beaver', team_since: '2026-09-21T10:00:00Z',
    hero: { v: 1, body: 'boy', skin: 2, hair: 1, suit: 0, cape: 0 }, github_id: null, github_login: null,
  }];
  const w = fakeGalaxyDb(seed, [...Object.values(PEOPLE), NOGH]);
  arrange(w);
  return w;
}

async function dashboardOf(person: FakeUser, arrange?: (w: ReturnType<typeof fakeGalaxyDb>) => void, period: '7d' | '30d' | 'season' = '7d') {
  const w = world(arrange);
  const db = w.client(person) as unknown as SupabaseClient<Database>;
  const load = await loadDashboard(db, authUser(person) as unknown as User, period, NOW);
  return { load, w, reads: w.calls.filter((c) => c.kind === 'from') };
}

/** The dashboard, for a person who has one. */
async function dashboard(person: FakeUser, arrange?: (w: ReturnType<typeof fakeGalaxyDb>) => void) {
  const { load, w, reads } = await dashboardOf(person, arrange);
  if (load.kind !== 'dashboard') throw new Error(`expected a dashboard, got ${load.kind}`);
  return { ...load.dashboard, w, reads };
}

/** The request the board was drawn for. */
const request = () => sure(parts.board.mock.calls[0], 'parts.board.mock.calls[0]')[1] as Record<string, unknown>;
const errors = () => vi.mocked(console.error).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  for (const load of Object.values(parts)) load.mockClear();
  parts.waiting.mockImplementation(() => Promise.resolve('the waiting'));
  parts.board.mockImplementation(() => Promise.resolve('the board'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Home', () => {
  it('is the player\'s: their name, hero and fleet, their season points and both places, then Waiting for you and the board', async () => {
    const d = await dashboard(PEOPLE.ada);
    expect(d.name).toBe('ADA');
    expect(d.season).toMatchObject({ name: 'September', key: '2026-09' });
    expect(d.you).toEqual({
      kind: 'player',
      hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 },
      fleet: { name: 'pirates', label: 'PIRATES', color: '#2fc6a4', mascot: null },
      score: { points: 10, you: { rank: 2, of: 2 }, fleet: { label: 'PIRATES', rank: 2, of: 2 } },
    });
    expect([d.waiting, d.board]).toEqual(['the waiting', 'the board']);
  });

  it('draws the board with scope *you*, and your fleet as your team, for the period asked', async () => {
    const { load } = await dashboardOf(PEOPLE.ada, undefined, '30d');
    expect(request()).toEqual({
      scope: { kind: 'you', userId: PEOPLE.ada.id, login: 'ada-gh' },
      people: { kind: 'fleet', fleet: 'pirates' },
      viewerId: PEOPLE.ada.id, period: '30d', now: NOW,
    });
    expect(load).toMatchObject({ dashboard: { solo: false } });
  });

  it('reads the board in the workspace shown', async () => {
    await dashboard(PEOPLE.ada);
    expect(sure(parts.reads.mock.calls[0], 'parts.reads.mock.calls[0]')[1]).toBe(VERTUOZA);
  });

  it('hands Waiting for you the database, the workspace, the person, their lower-cased login and fleet, now and the season', async () => {
    const d = await dashboard(PEOPLE.ada);
    const input = sure(parts.waiting.mock.calls[0], 'parts.waiting.mock.calls[0]')[0] as PartInput;
    expect(input).toMatchObject({ workspace: VERTUOZA, userId: PEOPLE.ada.id, login: 'ada-gh', team: 'pirates', now: NOW });
    expect(input.season).toEqual(d.season);
  });

  it('reads the galaxy once, for the hero block and the board', async () => {
    parts.board.mockImplementation(async (reads) => (await reads.galaxy()).heroes.length);
    const d = await dashboard(PEOPLE.ada);
    expect(d.board).toBe(2);
    expect(d.reads.filter((c) => c.table === 'ledger_events')).toHaveLength(1);
  });

  it('matches the login ignoring case: the ledger credits Ada-GH, the player is ada-gh', async () => {
    const d = await dashboard(PEOPLE.ada);
    expect(d.you).toMatchObject({ score: { points: 10, you: { rank: 2, of: 2 } } });
  });

  it('counts this season only: points scored in August are August\'s', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => {
      w.tables.ledger_events.push(secured(12, 's0', 'Ada-GH', 'pirates', '2026-08-27T10:00:00Z'));
    });
    expect(d.you).toMatchObject({ score: { points: 10 } });
  });
});

describe('each situation of a signed-in person', () => {
  it('an account in no workspace: no dashboard, and nothing of the game read', async () => {
    const { load, reads } = await dashboardOf(PEOPLE.eve);
    expect(load).toEqual({ kind: 'no-workspace' });
    expect(reads.every((c) => c.table === 'workspace_members')).toBe(true);
    for (const load of Object.values(parts)) expect(load).not.toHaveBeenCalled();
  });

  it('a member who never played: no hero block, their first name as the heading, their own row as their team and the link to Fleet', async () => {
    const d = await dashboard(PEOPLE.bea);
    expect(d.you).toEqual({ kind: 'no-player' });
    expect(d.name).toBe('Bea');
    expect(d.solo).toBe(true);
    const you = { kind: 'you', userId: PEOPLE.bea.id, login: 'bea-gh' };
    expect(request()).toMatchObject({ scope: you, people: you });
  });

  it('a solo player (a player row with no fleet): their hero, SOLO, their own row and the link to Fleet', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => {
      sure(w.tables.players.find((p) => p.user_id === PEOPLE.ada.id), 'the item found').team = null;
    });
    expect(d.you).toMatchObject({ kind: 'player', fleet: 'solo' });
    expect(d.solo).toBe(true);
    expect(request()).toMatchObject({ people: { kind: 'you', userId: PEOPLE.ada.id } });
  });

  it('a player with no GitHub linked: the hero and fleet show, the figures say to link it, the board has no login and the fleet is the team', async () => {
    const d = await dashboard(NOGH);
    expect(d.you).toMatchObject({ kind: 'player', fleet: { name: 'beaver' }, score: 'no-github' });
    expect(request()).toMatchObject({ scope: { kind: 'you', userId: NOGH.id, login: null }, people: { kind: 'fleet', fleet: 'beaver' } });
  });
});

describe('one read failing', () => {
  it('the galaxy: only the hero block\'s figures read unreadable; the rest stays', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.failOn = 'ledger_events'; });
    expect(d.you).toMatchObject({ kind: 'player', fleet: { label: 'PIRATES' }, score: 'unreadable' });
    expect([d.waiting, d.board]).toEqual(['the waiting', 'the board']);
    expect(errors().some((e) => /ledger_events/.test(e))).toBe(true);
  });

  it('the player row: the hero block reads unreadable, the heading falls back to the first name, the board is yours alone by your linked GitHub', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.failOn = 'players'; });
    expect(d.you).toBe('unreadable');
    expect(d.name).toBe('Ada');
    expect(d.solo).toBe(true);
    expect(request()).toMatchObject({ scope: { login: 'ada-gh' } });
    expect(d.board).toBe('the board');
  });

  it('Waiting for you from the questions the layout read (PRD 657): counted from them, the ask tables not read again', async () => {
    const w = world();
    const db = w.client(PEOPLE.ada) as unknown as SupabaseClient<Database>;
    const questions = vi.fn(() => Promise.resolve([
      { kind: 'question' as const, id: 'r1', sessionTitle: 'feat/ada', question: 'Which storage?', askedAt: 1, sharedBy: null },
      { kind: 'question' as const, id: 'r2', sessionTitle: 'feat/both', question: 'Who reads it?', askedAt: 2, sharedBy: 'BOTH' },
    ]));
    const load = await loadDashboard(db, authUser(PEOPLE.ada) as unknown as User, '7d', NOW, questions);
    expect(load).toMatchObject({ kind: 'dashboard', dashboard: { waiting: { count: 2, href: '/ask' } } });
    expect(questions).toHaveBeenCalledTimes(1);
    expect(parts.waiting).not.toHaveBeenCalled();
  });

  it('Waiting for you from the layout\'s questions: their read failing reads unreadable alone', async () => {
    const w = world();
    const db = w.client(PEOPLE.ada) as unknown as SupabaseClient<Database>;
    const load = await loadDashboard(db, authUser(PEOPLE.ada) as unknown as User, '7d', NOW, () => Promise.reject(new Error('questions are down')));
    expect(load).toMatchObject({ kind: 'dashboard', dashboard: { waiting: 'unreadable', board: 'the board' } });
    expect(errors().some((e) => e.includes('questions are down'))).toBe(true);
  });

  it('Waiting for you: it alone reads unreadable, and the error is logged', async () => {
    parts.waiting.mockImplementation(() => Promise.reject(new Error('ask is down')));
    const d = await dashboard(PEOPLE.ada);
    expect(d.waiting).toBe('unreadable');
    expect(d.board).toBe('the board');
    expect(d.you).toMatchObject({ kind: 'player', score: { points: 10 } });
    expect(errors().some((e) => e.includes('ask is down'))).toBe(true);
  });

  it('the workspace itself: every part reads unreadable, nobody is turned away, and the heading is the first name', async () => {
    const d = await dashboard(PEOPLE.ada, (w) => { w.state.fail = { message: 'timeout' }; });
    expect(d.name).toBe('Ada');
    expect([d.you, d.waiting]).toEqual(['unreadable', 'unreadable']);
    expect(d.board).toMatchObject({ people: 'unreadable', merges: 'unreadable', repositories: 'unreadable', fleets: 'unreadable' });
    expect(d.board.tiles).toEqual({ prs: 'unreadable', prds: 'unreadable', repositories: 'unreadable', answered: 'unreadable' });
    expect(d.board.window.period).toBe('7d');
    for (const load of Object.values(parts)) expect(load).not.toHaveBeenCalled();
  });
});
