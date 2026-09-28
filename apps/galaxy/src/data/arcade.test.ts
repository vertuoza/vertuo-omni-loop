import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

import type { DossierListRow } from '../dossier/store';
import { arcadeFor, OUT_OF_REACH } from './arcade';
import { withDossiers, type FakeDossier } from './dossiers.fake';
import { demoFleets } from './load-galaxy';
import { ACME, authUser, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';

const NOW = new Date('2026-09-26T10:00:00Z');

/** A dossier of the workspace's plan repository, as dossier_list() lists it. */
const dossierRow = (id: string, workspace_id: string, home_repo: string, prd: number | null, more: Partial<DossierListRow> = {}): DossierListRow => ({
  id, workspace_id, home_repo, prd, title: `PRD ${prd}`, opened_by: null, created_at: '2026-09-20T09:00:00Z',
  numbered_at: prd === null ? null : '2026-09-20T10:00:00Z', repos: [home_repo], latest: {}, asked: 0, answered: 0,
  last_activity: '2026-09-20T10:00:00Z', ...more,
});

/** Each workspace's planet #12 has a dossier in its plan repository; Vertuoza's has a spec and a question answered. */
const DOSSIERS: FakeDossier[] = [
  {
    row: dossierRow('d-vz-12', VERTUOZA, 'vertuoza/vertuo-omni-plan', 12, {
      latest: { spec: { id: 'v1', version: 2, source: 'kit', created_at: '2026-09-24T08:00:00Z' } }, asked: 1, answered: 1,
    }),
    rounds: [{
      rule: 'brainstorm', round_id: 'r1', session_id: 's1', asked_by: PEOPLE.ada.id, repo: 'vertuoza/vertuo-omni-plan', branch: 'main',
      questions: [{ question: 'Who owns a workspace?', header: 'Owner', multiSelect: false, options: [] }], answers: { 'Who owns a workspace?': 'Its first member' },
      status: 'answered', answered_via: 'page', answered_by: PEOPLE.ada.id, category: null, category_by: null, prd: null, skill: null,
      created_at: '2026-09-20T09:05:00Z', answered_at: '2026-09-20T09:06:00Z',
    }],
  },
  { row: dossierRow('d-acme-12', ACME, 'acme/acme-plan', 12), rounds: [] },
];

type World = ReturnType<typeof fakeGalaxyDb> & { dossiers: ReturnType<typeof withDossiers> };

/** The page's data for one person (null: signed out), and every call the database received. */
async function page(person: FakeUser | null, arrange: (world: World) => void = () => {}) {
  const galaxy = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  const dossiers = withDossiers(galaxy, DOSSIERS);
  const world: World = Object.assign(galaxy, { dossiers });
  arrange(world);
  const db = dossiers.client(person) as unknown as SupabaseClient;
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
    const { reads, world } = await page(PEOPLE.ada);
    const game = reads.filter((c) => c.table !== 'workspace_members' && c.table !== 'workspaces');
    expect(new Set(game.map((c) => c.table))).toEqual(new Set(['ledger_events', 'sectors', 'teams', 'players', 'player_xp', 'arcade_scores']));
    for (const call of game) expect(call.eq, call.table).toMatchObject({ workspace_id: VERTUOZA });
    // The planets' dossiers: the workspace's plan repository, then its dossiers there.
    expect(reads.filter((c) => c.table === 'workspaces').map((c) => c.eq)).toEqual([{ id: VERTUOZA }]);
    for (const call of world.dossiers.calls.filter((c) => c.kind === 'from')) expect(call.eq).toMatchObject({ workspace_id: VERTUOZA });
  });

  it('is not joined again: a member triggers no call at all', async () => {
    const { rpcs } = await page(PEOPLE.ada);
    expect(rpcs).toEqual([]);
  });

  it('gets the workspace\'s name and theme as the arcade\'s brand', async () => {
    expect((await page(PEOPLE.ada)).data.brand).toEqual({ name: 'Vertuoza', theme: {} });
    expect((await page(PEOPLE.wile)).data.brand).toEqual({ name: 'Acme', theme: { plasma: '#2fc6a4', 'plasma-dark': '#178a80' } });
  });
});

describe('the viewer\'s role (PRD 400)', () => {
  it('says whether the member owns the workspace they play, read as themselves', async () => {
    expect((await page(PEOPLE.ada)).data.owner).toBe(false);
    const { data, reads } = await page(PEOPLE.ada, (world) => {
      world.tables.workspace_members.find((m) => m.user_id === PEOPLE.ada.id && m.workspace_id === VERTUOZA)!.role = 'owner';
    });
    expect(data.owner).toBe(true);
    expect(reads.filter((c) => c.table === 'workspace_members').map((c) => c.eq)).toContainEqual({ workspace_id: VERTUOZA, user_id: PEOPLE.ada.id });
  });

  it('owns only the workspace played: owning another one changes nothing', async () => {
    const { data } = await page(PEOPLE.both, (world) => {
      world.tables.workspace_members.find((m) => m.user_id === PEOPLE.both.id && m.workspace_id === VERTUOZA)!.role = 'owner';
    });
    expect(data.workspace).toBe(ACME);
    expect(data.owner).toBe(false);
  });

  it('reads as a member when the role is out of reach, and shows the galaxy all the same', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data } = await page(PEOPLE.ada, (world) => {
      world.tables.workspace_members.find((m) => m.user_id === PEOPLE.ada.id)!.role = 'owner';
      const members = world.tables.workspace_members;
      // The role's read, and only it, fails: the membership read that picks the workspace comes first.
      let reads = 0;
      world.tables.workspace_members = new Proxy(members, {
        get(target, prop) {
          if (prop === 'filter' && ++reads > 1) throw new Error('fake: role out of reach');
          return Reflect.get(target, prop);
        },
      });
    });
    expect(data.view).not.toBeNull();
    expect(data.problem).toBeUndefined();
    expect(data.owner).toBe(false);
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
  it('happens at sign-in only: the page joins nobody, not even a member of the org (PRD 359)', async () => {
    const { data, world, rpcs } = await page(PEOPLE.bea);
    expect(rpcs).toEqual([]);
    expect(world.tables.workspace_members.some((m) => m.user_id === PEOPLE.bea.id)).toBe(false);
    expect(data.workspace).toBeNull();
    expect(data.session?.crew).toBe(false);
  });

  it('plays once the sign-in joined: a new member, with no player row yet', async () => {
    const { data } = await page(PEOPLE.bea, (world) => {
      world.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: PEOPLE.bea.id, role: 'member', joined_at: '2026-09-28T08:00:00Z' });
    });
    expect(data.workspace).toBe(VERTUOZA);
    expect(data.session?.crew).toBe(true);
    expect(data.me).toBeNull();
    expect(data.fleets.map((f) => f.name)).toEqual(['beaver', 'pirates', 'invincible-team']);
  });

  it('leaves an account in no workspace outside: no crew, and nothing read of any workspace', async () => {
    for (const person of [PEOPLE.eve, PEOPLE.una]) {
      const { data, reads, rpcs } = await page(person);
      expect(rpcs, person.email).toHaveLength(0);
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
    const { data, reads } = await page(bea, (world) => {
      world.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: bea.id, role: 'member', joined_at: '2026-09-28T08:00:00Z' });
    });
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

describe('the planets\' dossiers', () => {
  it('reads each planet\'s dossier in the workspace played: its plan repository\'s PRD of the planet\'s number', async () => {
    const { data } = await page(PEOPLE.ada);
    expect(data.dossiers).toEqual({
      12: {
        id: 'd-vz-12', url: '/prd/d-vz-12', asked: 1, answered: 1,
        latest: { 'before-after': null, spec: { version: 2, at: '2026-09-24T08:00:00Z' }, plan: null },
        last: [{ question: 'Who owns a workspace?', answer: 'Its first member', more: 0, at: '2026-09-20T09:06:00Z' }],
      },
    });
    expect((await page(PEOPLE.both)).data.dossiers).toEqual({ 12: expect.objectContaining({ id: 'd-acme-12' }) });
  });

  it('reads them for a visitor without GitHub linked too: a visitor may look at every planet', async () => {
    const { data } = await page(PEOPLE.una, (world) => {
      world.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: PEOPLE.una.id, role: 'member', joined_at: '2026-09-26T09:00:00Z' });
    });
    expect(data.dossiers).toEqual({ 12: expect.objectContaining({ id: 'd-vz-12' }) });
  });

  it('gives a planet with no dossier none', async () => {
    const { data } = await page(PEOPLE.ada, (world) => { world.dossiers.state.gone.add('d-vz-12'); });
    expect(data.dossiers).toEqual({});
  });

  it('says the dossiers are out of reach when only they cannot be read, and keeps the galaxy, the XP and the scores', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { data } = await page(PEOPLE.ada, (world) => { world.dossiers.state.failOn = 'dossiers'; });
    expect(data.dossiers).toBe('unreadable');
    expect(data.view?.planets.map((p) => p.title)).toEqual(['Workspaces']);
    expect(data.xp).toEqual({ xp: 180, level: 3, unlocked: ['invaders'] });
    expect(data.scores?.invaders).not.toBe('unreadable');
    expect(data.problem).toBeUndefined();
  });

  it('reads none signed out, for an outsider, or with the galaxy out of reach', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const person of [null, PEOPLE.eve]) {
      const { data, world } = await page(person);
      expect(data.dossiers).toBeUndefined();
      expect(world.dossiers.calls).toEqual([]);
    }
    const { data, world } = await page(PEOPLE.ada, (w) => { w.state.failOn = 'ledger_events'; });
    expect(data.dossiers).toBeUndefined();
    expect(world.dossiers.calls).toEqual([]);
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
