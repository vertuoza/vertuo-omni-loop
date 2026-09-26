import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

import { arcadeFor, OUT_OF_REACH } from './arcade';
import { demoFleets } from './load-galaxy';
import { ACME, authUser, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';

const NOW = new Date('2026-09-26T10:00:00Z');

/** The page's data for one person (null: signed out), and every call the database received. */
async function page(person: FakeUser | null, arrange: (world: ReturnType<typeof fakeGalaxyDb>) => void = () => {}) {
  const world = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  arrange(world);
  const db = world.client(person) as unknown as SupabaseClient;
  const data = await arcadeFor(db, person ? (authUser(person) as unknown as User) : null, NOW);
  return { data, world, reads: world.calls.filter((c) => c.kind === 'from'), rpcs: world.calls.filter((c) => c.kind === 'rpc') };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('signed out', () => {
  it('makes no database call, and plays the built-in fleets under the house brand', async () => {
    const { data, world } = await page(null);
    expect(world.calls).toEqual([]);
    expect(data).toEqual({ view: null, fleets: demoFleets(), session: null, workspace: null });
  });
});

describe('a member', () => {
  it('plays their workspace: the galaxy, its fleets, its crew and their own row', async () => {
    const { data } = await page(PEOPLE.ada);
    expect(data.workspace).toBe(VERTUOZA);
    expect(data.session).toMatchObject({ id: PEOPLE.ada.id, crew: true });
    expect(data.fleets.map((f) => f.name)).toEqual(['beaver', 'pirates', 'invincible-team']);
    expect(data.view?.planets.map((p) => [p.prd, p.title])).toEqual([[12, 'Workspaces']]);
    expect(data.view?.sectors.map((s) => s.name)).toEqual(['core-belt']);
    expect(data.me).toMatchObject({ id: PEOPLE.ada.id, display_name: 'ADA', team: 'pirates', github_login: 'ada-gh' });
    expect(data.crew?.map((p) => p.display_name)).toEqual(['ADA', 'BOTH']);
  });

  it('filters every read of the game by that workspace', async () => {
    const { reads } = await page(PEOPLE.ada);
    const game = reads.filter((c) => c.table !== 'workspace_members');
    expect(new Set(game.map((c) => c.table))).toEqual(new Set(['ledger_events', 'sectors', 'teams', 'players', 'player_xp', 'arcade_scores']));
    for (const call of game) expect(call.eq, call.table).toMatchObject({ workspace_id: VERTUOZA });
  });

  it('is not joined again: a member triggers no call to join_by_domain()', async () => {
    const { rpcs } = await page(PEOPLE.ada);
    expect(rpcs).toEqual([]);
  });

  it('gets the workspace\'s name and theme as the arcade\'s brand', async () => {
    expect((await page(PEOPLE.ada)).data.brand).toEqual({ name: 'Vertuoza', theme: {} });
    expect((await page(PEOPLE.wile)).data.brand).toEqual({ name: 'Acme', theme: { plasma: '#2fc6a4', 'plasma-dark': '#178a80' } });
  });
});

describe('a member of two workspaces', () => {
  it('plays the one they joined first, and reads nothing of the other', async () => {
    const { data } = await page(PEOPLE.both);
    expect(data.workspace).toBe(ACME);
    expect(data.brand?.name).toBe('Acme');
    expect(data.fleets.map((f) => f.name)).toEqual(['roadrunners']);
    expect(data.view?.planets.map((p) => p.title)).toEqual(['Anvils']);
    expect(data.me).toMatchObject({ team: 'roadrunners' });
    expect(data.crew?.map((p) => p.display_name)).toEqual(['BOTH', 'WILE']);
  });

  it('joined both at once: the first by slug', async () => {
    const { data } = await page(PEOPLE.both, (world) => {
      for (const m of world.tables.workspace_members) if (m.user_id === PEOPLE.both.id) m.joined_at = '2026-09-26T08:00:00Z';
      world.tables.workspaces.find((w) => w.id === ACME)!.slug = 'zeta';
    });
    expect(data.workspace).toBe(VERTUOZA);
  });
});

describe('joining', () => {
  it('joins a session from before workspaces once, then plays', async () => {
    const { data, world, rpcs } = await page(PEOPLE.bea);
    expect(rpcs).toEqual([{ kind: 'rpc', fn: 'join_by_domain' }]);
    expect(world.tables.workspace_members).toContainEqual(expect.objectContaining({ workspace_id: VERTUOZA, user_id: PEOPLE.bea.id }));
    expect(data.workspace).toBe(VERTUOZA);
    expect(data.session?.crew).toBe(true);
    expect(data.me).toBeNull();
    expect(data.fleets.map((f) => f.name)).toEqual(['beaver', 'pirates', 'invincible-team']);
  });

  it('leaves an account no workspace joins outside: no crew, and nothing read of any workspace', async () => {
    for (const person of [PEOPLE.eve, PEOPLE.una]) {
      const { data, reads, rpcs } = await page(person);
      expect(rpcs, person.email).toHaveLength(1);
      expect(reads.every((c) => c.table === 'workspace_members'), person.email).toBe(true);
      expect(data, person.email).toEqual({
        view: null, fleets: demoFleets(), session: expect.objectContaining({ id: person.id, crew: false }), workspace: null,
      });
    }
  });
});

describe('the player\'s XP', () => {
  it('reads their player_xp row in the workspace played, by their lower-cased GitHub login', async () => {
    const { data, reads } = await page(PEOPLE.ada);
    expect(data.xp).toEqual({ xp: 180, level: 3, unlocked: ['invaders'] });
    expect(reads.filter((c) => c.table === 'player_xp')).toEqual([
      { kind: 'from', table: 'player_xp', op: 'select', eq: { workspace_id: VERTUOZA, github_login: 'ada-gh' } },
    ]);
  });

  it('reads a member of two workspaces\' XP in the one they joined first only', async () => {
    expect((await page(PEOPLE.both)).data.xp).toEqual({ xp: 60, level: 2, unlocked: ['invaders'] });
  });

  it('lower-cases a login GitHub spells with capitals, and finds XP earned before the player row existed', async () => {
    const bea = { ...PEOPLE.bea, github: { id: 41, login: 'Bea-GH' } };
    const { data, reads } = await page(bea);
    expect(data.me).toBeNull();
    expect(data.xp).toEqual({ xp: 10, level: 1, unlocked: ['invaders'] });
    expect(reads.find((c) => c.table === 'player_xp')?.eq).toEqual({ workspace_id: VERTUOZA, github_login: 'bea-gh' });
  });

  it('gives a player the workflow has not written a row for no XP yet', async () => {
    expect((await page(PEOPLE.wile)).data.xp).toBeNull();
  });

  it('reads nothing for a visitor without GitHub linked', async () => {
    const { data, reads } = await page(PEOPLE.una, (world) => {
      world.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: PEOPLE.una.id, role: 'member', joined_at: '2026-09-26T09:00:00Z' });
    });
    expect(data.workspace).toBe(VERTUOZA);
    expect(data.xp).toBeNull();
    expect(reads.some((c) => c.table === 'player_xp')).toBe(false);
  });

  it('says XP is out of reach when only it cannot be read, and keeps the galaxy', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data } = await page(PEOPLE.ada, (world) => { world.state.failOn = 'player_xp'; });
    expect(data.xp).toBe('unreadable');
    expect(data.view?.planets.map((p) => p.title)).toEqual(['Workspaces']);
    expect(data.problem).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('the crew\'s high scores', () => {
  it('reads each game\'s top five in the workspace played, with the player\'s own best', async () => {
    const { data } = await page(PEOPLE.ada);
    expect(data.scores).toEqual({
      invaders: {
        top: [
          { id: PEOPLE.ada.id, name: 'ADA', hero: expect.any(Object), team: 'pirates', best: 1240 },
          { id: PEOPLE.both.id, name: 'BOTH', hero: expect.any(Object), team: 'beaver', best: 385 },
        ],
        mine: 1240,
      },
    });
    expect((await page(PEOPLE.both)).data.scores?.invaders).toEqual({ top: [expect.objectContaining({ name: 'WILE', best: 9210 })], mine: null });
  });

  it('reads nothing for a visitor without GitHub linked: every cabinet is locked to them', async () => {
    const { data, reads } = await page(PEOPLE.una, (world) => {
      world.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: PEOPLE.una.id, role: 'member', joined_at: '2026-09-26T09:00:00Z' });
    });
    expect(data.scores).toEqual({});
    expect(reads.some((c) => c.table === 'arcade_scores')).toBe(false);
  });

  it('says the scores are out of reach when only they cannot be read, and keeps the galaxy and the XP', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data } = await page(PEOPLE.ada, (world) => { world.state.failOn = 'arcade_scores'; });
    expect(data.scores).toEqual({ invaders: 'unreadable' });
    expect(data.xp).toEqual({ xp: 180, level: 3, unlocked: ['invaders'] });
    expect(data.view?.planets.map((p) => p.title)).toEqual(['Workspaces']);
    expect(data.problem).toBeUndefined();
  });
});

describe('the session', () => {
  it('carries the Google first name, the email and the linked GitHub login', async () => {
    expect((await page(PEOPLE.ada)).data.session).toEqual({ id: PEOPLE.ada.id, email: 'ada@vertuoza.com', givenName: 'Ada', crew: true, github: 'ada-gh' });
    expect((await page(PEOPLE.eve)).data.session).toEqual({ id: PEOPLE.eve.id, email: 'eve@example.com', givenName: 'Eve', crew: false, github: null });
  });
});

describe('the database out of reach', () => {
  it('plays the attract mode with the built-in fleets, and says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data } = await page(PEOPLE.ada, (world) => { world.state.fail = { message: 'relation "public.workspace_members" does not exist' }; });
    expect(data).toEqual({
      view: null, fleets: demoFleets(), session: expect.objectContaining({ id: PEOPLE.ada.id }), workspace: null, problem: OUT_OF_REACH,
    });
    expect(console.error).toHaveBeenCalled();
  });

  it('does not turn a member away when it cannot tell: the out-of-reach message, never the wrong cartridge', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data } = await page(PEOPLE.ada, (world) => { world.state.fail = { message: 'timeout' }; });
    expect(data.session?.crew).toBe(true);
  });

  it('keeps the workspace\'s brand when only the galaxy is out of reach', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data } = await page(PEOPLE.wile, (world) => { world.state.failOn = 'ledger_events'; });
    expect(data).toMatchObject({ view: null, fleets: demoFleets(), workspace: ACME, brand: { name: 'Acme' }, problem: OUT_OF_REACH });
    expect(data.session?.crew).toBe(true);
  });
});
