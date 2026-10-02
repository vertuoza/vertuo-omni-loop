import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { afterGate, afterReturn, afterStart, allowed, arrive, backStep, isDisbanded, isPlayer, isReady, nextStep, readReturn } from './onboarding';
import type { FleetRow, Player, Session } from './types';
import type { Database } from '../../../../supabase/database.types.ts';
import { arcadeFor } from '../data/arcade';
import { authUser, fakeGalaxyDb, PEOPLE, twoWorkspaces, type FakeUser } from '../data/galaxy.fake';

vi.mock('server-only', () => ({}));

const fleet = (name: string, retired = false): FleetRow => ({ name, home: null, label: name.toUpperCase(), color: '#2fc6a4', motto: '', mascot: null, sort: 0, retired });
const FLEETS = [fleet('beaver'), fleet('pirates'), fleet('invincible-team', true)];
/** Signed in with GitHub, in a workspace: a player at once (PRD 359). */
const crew: Session = { id: 'u1', email: 'ada@vertuoza.com', givenName: 'ADA', crew: true, github: 'ada-gh' };
/** Signed in with GitHub, in no workspace: the outsider screen sends them to sign up. */
const outsider: Session = { ...crew, email: 'eve@example.com', crew: false, github: 'eve-gh' };
const player = (over: Partial<Player> = {}): Player => ({
  id: 'u1', display_name: 'ADA', team: 'pirates', team_since: '2026-09-25T10:00:00Z',
  hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, github_login: 'ada-gh', ...over,
});

describe('START', () => {
  it('asks a signed-out visitor for a coin, and turns away another domain', () => {
    expect(afterStart(null, null, FLEETS)).toBe('coin');
    expect(afterStart(outsider, null, FLEETS)).toBe('outsider');
  });

  it('welcomes a player with an active fleet back, and sends everyone else through the gate', () => {
    expect(afterStart(crew, player(), FLEETS)).toBe('welcome');
    expect(afterStart(crew, null, FLEETS)).toBe('gate');
    expect(afterStart(crew, player({ team: 'invincible-team' }), FLEETS)).toBe('gate');
    // A solo player (a row with no fleet) is ready too (PRD 400).
    expect(afterStart(crew, player({ team: null }), FLEETS)).toBe('welcome');
  });
});

describe('crew is membership', () => {
  /** The session the page hands the arcade, for one person, from their workspaces. */
  const sessionOf = async (person: FakeUser) => {
    const world = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
    return (await arcadeFor(world.client(person) as unknown as SupabaseClient<Database>, authUser(person) as unknown as User)).session;
  };

  it('lets a session with a workspace in, whatever its email\'s domain', async () => {
    for (const person of [PEOPLE.ada, PEOPLE.wile]) {
      const session = await sessionOf(person);
      expect(session?.crew, person.email).toBe(true);
      expect(afterStart(session, null, FLEETS), person.email).toBe('gate');
      expect(afterReturn({ kind: 'signin' }, session, null, FLEETS), person.email).toBe('gate');
    }
  });

  it('sends a session without one to the outsider screen, a vertuoza.com address and an org member who has not signed in since included', async () => {
    for (const person of [PEOPLE.eve, PEOPLE.una, PEOPLE.bea]) {
      const session = await sessionOf(person);
      expect(session?.crew, person.email).toBe(false);
      expect(afterStart(session, null, FLEETS), person.email).toBe('outsider');
      expect(afterReturn({ kind: 'signin' }, session, null, FLEETS), person.email).toBe('outsider');
    }
  });
});

describe('PRESS START', () => {
  it('sends a signed-in account straight on to the fleets, with no GitHub link step', () => {
    expect(afterGate(null, FLEETS)).toBe('intro');
    // Joined before GitHub was the sign-in: no link step either.
    expect(afterGate(player({ github_login: null, team: null }), FLEETS)).toBe('welcome');
    expect(afterGate(player({ github_login: null }), FLEETS)).toBe('welcome');
  });

  it('plays the intro to a new player, the fleets to a disbanded one, the welcome to a returning one', () => {
    expect(afterGate(null, FLEETS)).toBe('intro');
    expect(afterGate(player({ team: 'invincible-team' }), FLEETS)).toBe('select');
    expect(afterGate(player(), FLEETS)).toBe('welcome');
  });

  it('knows a retired fleet from an active one, and a signed-in account is a player', () => {
    expect(isDisbanded(player({ team: 'invincible-team' }), FLEETS)).toBe(true);
    expect(isDisbanded(player(), FLEETS)).toBe(false);
    expect(isReady(player(), FLEETS)).toBe(true);
    expect(isReady(player({ github_login: null }), FLEETS)).toBe(true);
    expect(isReady(player({ hero: { v: 1, body: 'girl', skin: 9, hair: 0, suit: 0, cape: 0 } }), FLEETS)).toBe(false);
    expect(isPlayer(crew)).toBe(true);
    expect(isPlayer({ ...crew, github: null })).toBe(true);
    expect(isPlayer(outsider)).toBe(false);
    expect(isPlayer(null)).toBe(false);
  });
});

describe('the first visit', () => {
  it('runs straight to the fleet pick: intro → fleet → name → hero → ready → menu, no link step', () => {
    const route: string[] = [afterGate(null, FLEETS)];
    let me: Player | null = null;
    while (route.at(-1) !== 'menu') {
      const step = route.at(-1) as never;
      if (step === 'select') me = player();
      route.push(nextStep(step, 'onboard', me, FLEETS));
    }
    expect(route).toEqual(['intro', 'select', 'name', 'hero', 'ready', 'menu']);
  });

  it('goes back one screen with B, and to the title from the fleets', () => {
    expect(backStep('select', 'onboard', FLEETS)).toBe('title');
    expect(backStep('name', 'onboard', FLEETS)).toBe('select');
    expect(backStep('hero', 'onboard', FLEETS)).toBe('name');
  });
});

describe('a fleet is optional (PRD 400)', () => {
  const NONE: FleetRow[] = [];
  const ONLY_RETIRED = [fleet('invincible-team', true)];
  /** The first visit's screens, from PRESS START to the menu; `pick` is what the fleet step locks in. */
  const firstVisit = (fleets: FleetRow[], pick: string | null) => {
    const route: string[] = [afterGate(null, fleets)];
    let me: Player | null = null;
    while (route.at(-1) !== 'menu') {
      const step = route.at(-1) as never;
      if (step === 'select') me = player({ team: pick });
      if (step === 'name' && !me) me = player({ team: null });
      route.push(nextStep(step, 'onboard', me, fleets));
    }
    return { route, me };
  };

  it('skips the fleet step when the workspace has no fleets, and the player has no team', () => {
    for (const fleets of [NONE, ONLY_RETIRED]) {
      const { route, me } = firstVisit(fleets, null);
      expect(route).toEqual(['intro', 'name', 'hero', 'ready', 'menu']);
      expect(me?.team).toBeNull();
      expect(isReady(me, fleets)).toBe(true);
    }
  });

  it('offers the fleet step when it has fleets, a fleet or solo alike', () => {
    expect(firstVisit(FLEETS, 'beaver').route).toEqual(['intro', 'select', 'name', 'hero', 'ready', 'menu']);
    const solo = firstVisit(FLEETS, null);
    expect(solo.route).toEqual(['intro', 'select', 'name', 'hero', 'ready', 'menu']);
    expect(solo.me?.team).toBeNull();
  });

  it('counts a solo player as ready, with fleets or without', () => {
    for (const fleets of [FLEETS, NONE]) {
      expect(isReady(player({ team: null }), fleets)).toBe(true);
      expect(afterStart(crew, player({ team: null }), fleets)).toBe('welcome');
      expect(afterGate(player({ team: null }), fleets)).toBe('welcome');
    }
  });

  it('sends a disbanded player to the fleets while any fly, and lets them play on when none do', () => {
    expect(afterGate(player({ team: 'invincible-team' }), FLEETS)).toBe('select');
    expect(afterGate(player({ team: 'invincible-team' }), ONLY_RETIRED)).toBe('welcome');
    expect(isReady(player({ team: 'invincible-team' }), ONLY_RETIRED)).toBe(true);
  });

  it('goes back from the name to the title with no fleet step, and to the fleets with one', () => {
    expect(backStep('name', 'onboard', NONE)).toBe('title');
    expect(backStep('name', 'onboard', FLEETS)).toBe('select');
  });
});

describe('menu flows', () => {
  it('returns to the menu when the one thing asked is done', () => {
    expect(nextStep('select', 'change', player(), FLEETS)).toBe('menu');
    expect(nextStep('name', 'myhero', player(), FLEETS)).toBe('hero');
    expect(nextStep('hero', 'myhero', player(), FLEETS)).toBe('menu');
    expect(backStep('hero', 'myhero', FLEETS)).toBe('name');
    expect(backStep('name', 'myhero', FLEETS)).toBe('menu');
    expect(backStep('select', 'change', FLEETS)).toBe('menu');
  });
});

describe('arriving at the menu', () => {
  it('plays the level-up first when one is due, whichever screen leads there', () => {
    expect(arrive('menu', true)).toBe('levelup');
    expect(arrive('menu', false)).toBe('menu');
  });

  it('leaves every other screen as it is, due or not', () => {
    for (const scene of ['title', 'games', 'invaders', 'map', 'welcome', 'ready'] as const) {
      expect(arrive(scene, true), scene).toBe(scene);
      expect(arrive(scene, false), scene).toBe(scene);
    }
  });

  it('runs welcome back → level up → menu, and ready → level up → menu, once a level is due', () => {
    expect(arrive(nextStep('welcome', 'onboard', player(), FLEETS), true)).toBe('levelup');
    expect(arrive(nextStep('ready', 'onboard', player(), FLEETS), true)).toBe('levelup');
    expect(arrive(nextStep('hero', 'myhero', player(), FLEETS), true)).toBe('levelup');
  });
});

describe('returns from GitHub', () => {
  it('reads what the callback put in the query string, and nothing of a link step', () => {
    expect(readReturn('?signin=ok')).toEqual({ kind: 'signin' });
    expect(readReturn('?signin_error=Omni%20Loop%20signs%20in%20with%20GitHub%20only.')).toEqual({ kind: 'signin_error', message: 'Omni Loop signs in with GitHub only.' });
    expect(readReturn('?linked=ada-gh')).toBeNull();
    expect(readReturn('?link_error=taken')).toBeNull();
    expect(readReturn('')).toBeNull();
  });

  it('opens the screen that waits for a key, so the music can play', () => {
    expect(afterReturn({ kind: 'signin' }, crew, null, FLEETS)).toBe('gate');
    expect(afterReturn({ kind: 'signin' }, crew, player(), FLEETS)).toBe('gate');
    expect(afterReturn({ kind: 'signin' }, outsider, null, FLEETS)).toBe('outsider');
    expect(afterReturn({ kind: 'signin_error', message: 'x' }, null, null, FLEETS)).toBe('coin');
  });
});

describe('the one door', () => {
  it('shows nothing past INSERT COIN without a session, whatever the route', () => {
    for (const scene of ['gate', 'intro', 'select', 'name', 'hero', 'ready', 'welcome', 'menu', 'map', 'planet', 'fleets', 'heroes', 'briefing', 'chart', 'system', 'games', 'invaders', 'platformer', 'levelup']) {
      expect(allowed(scene, null), scene).toBe('coin');
      expect(allowed(scene, crew), scene).toBe(scene);
    }
    for (const scene of ['boot', 'title', 'coin', 'outsider']) expect(allowed(scene, null)).toBe(scene);
  });

  it('lets every signed-in account play: the fleets, the game room, Entropy Invaders and the level-up', () => {
    for (const scene of ['intro', 'select', 'name', 'hero', 'ready', 'welcome', 'games', 'invaders', 'levelup']) {
      expect(allowed(scene, crew), scene).toBe(scene);
    }
  });

  it('ignores a crafted return URL when nobody is signed in', () => {
    expect(afterReturn({ kind: 'signin' }, null, null, FLEETS)).toBe('coin');
  });
});
