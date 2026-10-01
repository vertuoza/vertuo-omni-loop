import { describe, expect, it } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { addressAt, DEEP_LINKS, landing, readHash } from './deep-link';
import { twinEvents, twinGalaxy } from './twins.fake';
import type { Session } from './types';

// The arcade's deep links (moved out of ArcadeApp.tsx; PRD 238 adds #menu): the screen an address's
// hash opens, past the boot and the title, through the one door every route goes through; and the
// address the arcade writes for the screen it is on.

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const planet = view.planets[2];
const crew: Session = { id: 'u1', email: 'ada@vertuoza.com', givenName: 'Ada', crew: true, github: 'ada-gh' };
const outsider: Session = { ...crew, email: 'eve@elsewhere.example', crew: false, github: null };

describe('the deep links', () => {
  it('are the screens an address may name, the menu among them', () => {
    expect(DEEP_LINKS).toEqual(['map', 'chart', 'fleets', 'heroes', 'games', 'briefing', 'menu']);
  });

  it('read a screen from the hash, with or without its #', () => {
    expect(readHash('#menu', view)).toEqual({ scene: 'menu' });
    expect(readHash('chart', view)).toEqual({ scene: 'chart' });
  });

  it('read a planet by its PRD number, when the galaxy holds it', () => {
    expect(readHash(`#planet-${planet.prd}`, view)).toEqual({ scene: 'planet', sel: 2 });
    expect(readHash(`#planet-${planet.prd}`, null)).toBeNull();
  });

  it('read nothing from any other hash', () => {
    for (const hash of ['', '#', '#boot', '#title', '#coin', '#invaders', '#platformer', '#levelup', '#MENU', '#menu-2']) {
      expect(readHash(hash, view), hash).toBeNull();
    }
  });
});

describe('/#menu', () => {
  it('opens SELECT MODE for a player, past the boot and the title', () => {
    expect(landing('#menu', { view, session: crew })).toEqual({ scene: 'menu' });
  });

  it('opens SELECT MODE for a signed-in account that has joined no fleet yet: no GitHub link step', () => {
    expect(landing('#menu', { view, session: { ...crew, github: null } })).toEqual({ scene: 'menu' });
  });

  it('shows INSERT COIN to anyone signed out, whether the page holds a galaxy or not', () => {
    expect(landing('#menu', { view: null, session: null })).toEqual({ scene: 'coin' });
    expect(landing('#menu', { view, session: null })).toEqual({ scene: 'coin' });
  });

  it('is the address at the menu', () => {
    expect(addressAt('/', { scene: 'menu', sel: 0 }, view)).toBe('/#menu');
  });
});

describe('every deep link, through the one door', () => {
  it('lands on INSERT COIN signed out', () => {
    for (const scene of DEEP_LINKS) {
      expect(landing(`#${scene}`, { view: null, session: null }), scene).toEqual({ scene: 'coin' });
      expect(landing(`#${scene}`, { view, session: null }), scene).toEqual({ scene: 'coin' });
    }
    expect(landing(`#planet-${planet.prd}`, { view, session: null })).toEqual({ scene: 'coin', sel: 2 });
  });

  it('opens the screen it names for a player', () => {
    for (const scene of DEEP_LINKS) expect(landing(`#${scene}`, { view, session: crew }), scene).toEqual({ scene });
    expect(landing(`#planet-${planet.prd}`, { view, session: crew })).toEqual({ scene: 'planet', sel: 2 });
  });

  it('starts at the boot, as at /, for someone signed in whose page holds no galaxy', () => {
    expect(landing('#menu', { view: null, session: outsider })).toBeNull();
    expect(landing('#map', { view: null, session: crew })).toBeNull();
  });

  it('starts at the boot when the hash names no screen', () => {
    expect(landing('', { view, session: crew })).toBeNull();
    expect(landing('#title', { view, session: null })).toBeNull();
  });
});

describe('the address the arcade writes', () => {
  it('names the screen it is on, when a deep link names it', () => {
    expect(addressAt('/', { scene: 'map', sel: 0 }, view)).toBe('/#map');
    expect(addressAt('/', { scene: 'planet', sel: 2 }, view)).toBe(`/#planet-${planet.home}/${planet.prd}`);
  });

  it('names nothing on any other screen', () => {
    for (const scene of ['title', 'coin', 'select', 'levelup', 'invaders', 'platformer', 'system'] as const) {
      expect(addressAt('/', { scene, sel: 0 }, view), scene).toBe('/');
    }
  });

  it('names no planet the galaxy does not hold', () => {
    expect(addressAt('/', { scene: 'planet', sel: 999 }, view)).toBe('/');
    expect(addressAt('/', { scene: 'planet', sel: 0 }, null)).toBe('/');
  });

  it('keeps the page\'s own path', () => {
    expect(addressAt('/arcade.html', { scene: 'menu', sel: 0 }, view)).toBe('/arcade.html#menu');
  });
});

describe('a planet named by its home (PRD 728)', () => {
  const twins = twinGalaxy();

  it('holds two planets for two repositories\' PRD 88', () => {
    expect(twins.planets.map((p) => p.key)).toEqual(['acme/plan#88', 'acme/tools#88']);
  });

  it('writes the home into a planet\'s address, and reads each twin back to its own planet', () => {
    expect(addressAt('/', { scene: 'planet', sel: 0 }, twins)).toBe('/#planet-acme/plan/88');
    expect(addressAt('/', { scene: 'planet', sel: 1 }, twins)).toBe('/#planet-acme/tools/88');
    expect(readHash('#planet-acme/plan/88', twins)).toEqual({ scene: 'planet', sel: 0 });
    expect(readHash('#planet-acme/tools/88', twins)).toEqual({ scene: 'planet', sel: 1 });
  });

  it('reads a link by number alone when one planet holds that number, and the map when two do', () => {
    const one = twinGalaxy(twinEvents('acme/plan', 'beaver', 'bob'));
    expect(readHash('#planet-88', one)).toEqual({ scene: 'planet', sel: 0 });
    expect(readHash('#planet-88', twins)).toEqual({ scene: 'map' });
  });

  it('lands on the map for a planet the galaxy does not hold', () => {
    expect(readHash('#planet-999999', view)).toEqual({ scene: 'map' });
    expect(readHash('#planet-acme/other/88', twins)).toEqual({ scene: 'map' });
    expect(readHash('#planet-acme/plan/89', twins)).toEqual({ scene: 'map' });
    expect(landing('#planet-acme/other/88', { view: twins, session: crew })).toEqual({ scene: 'map' });
    expect(landing('#planet-acme/plan/88', { view: twins, session: crew })).toEqual({ scene: 'planet', sel: 0 });
  });

  it('names a planet with no home by its number alone, as before', () => {
    const bare = twinGalaxy(twinEvents('acme/plan', 'beaver', 'bob').map(({ home: _home, ...e }) => e));
    expect(bare.planets[0].home).toBeNull();
    expect(addressAt('/', { scene: 'planet', sel: 0 }, bare)).toBe('/#planet-88');
    expect(readHash('#planet-88', bare)).toEqual({ scene: 'planet', sel: 0 });
  });
});
