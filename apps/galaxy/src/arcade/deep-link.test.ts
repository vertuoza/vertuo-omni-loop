import { describe, expect, it } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { addressAt, DEEP_LINKS, landing, readHash } from './deep-link';
import type { Session } from './types';

// The arcade's deep links (moved out of ArcadeApp.tsx; PRD 238 adds #menu): the screen an address's
// hash opens, past the boot and the title, through the one door every route goes through; and the
// address the arcade writes for the screen it is on.

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const planet = view.planets[2];
const crew: Session = { id: 'u1', email: 'ada@vertuoza.com', givenName: 'Ada', crew: true, github: 'ada-gh' };
const visitor: Session = { ...crew, github: null };
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
    expect(readHash('#planet-999999', view)).toBeNull();
    expect(readHash(`#planet-${planet.prd}`, null)).toBeNull();
  });

  it('read nothing from any other hash', () => {
    for (const hash of ['', '#', '#boot', '#title', '#coin', '#invaders', '#levelup', '#MENU', '#menu-2']) {
      expect(readHash(hash, view), hash).toBeNull();
    }
  });
});

describe('/#menu', () => {
  it('opens SELECT MODE for a player, past the boot and the title', () => {
    expect(landing('#menu', { view, session: crew, linked: true })).toEqual({ scene: 'menu' });
  });

  it('opens SELECT MODE for a visitor who has not linked GitHub', () => {
    expect(landing('#menu', { view, session: visitor, linked: false })).toEqual({ scene: 'menu' });
  });

  it('shows INSERT COIN to anyone signed out, whether the page holds a galaxy or not', () => {
    expect(landing('#menu', { view: null, session: null, linked: false })).toEqual({ scene: 'coin' });
    expect(landing('#menu', { view, session: null, linked: false })).toEqual({ scene: 'coin' });
  });

  it('is the address at the menu', () => {
    expect(addressAt('/', { scene: 'menu', sel: 0 }, view)).toBe('/#menu');
  });
});

describe('every deep link, through the one door', () => {
  it('lands on INSERT COIN signed out', () => {
    for (const scene of DEEP_LINKS) {
      expect(landing(`#${scene}`, { view: null, session: null, linked: false }), scene).toEqual({ scene: 'coin' });
      expect(landing(`#${scene}`, { view, session: null, linked: false }), scene).toEqual({ scene: 'coin' });
    }
    expect(landing(`#planet-${planet.prd}`, { view, session: null, linked: false })).toEqual({ scene: 'coin', sel: 2 });
  });

  it('opens the screen it names for a player', () => {
    for (const scene of DEEP_LINKS) expect(landing(`#${scene}`, { view, session: crew, linked: true }), scene).toEqual({ scene });
    expect(landing(`#planet-${planet.prd}`, { view, session: crew, linked: true })).toEqual({ scene: 'planet', sel: 2 });
  });

  it('starts at the boot, as at /, for someone signed in whose page holds no galaxy', () => {
    expect(landing('#menu', { view: null, session: outsider, linked: false })).toBeNull();
    expect(landing('#map', { view: null, session: crew, linked: true })).toBeNull();
  });

  it('starts at the boot when the hash names no screen', () => {
    expect(landing('', { view, session: crew, linked: true })).toBeNull();
    expect(landing('#title', { view, session: null, linked: false })).toBeNull();
  });
});

describe('the address the arcade writes', () => {
  it('names the screen it is on, when a deep link names it', () => {
    expect(addressAt('/', { scene: 'map', sel: 0 }, view)).toBe('/#map');
    expect(addressAt('/', { scene: 'planet', sel: 2 }, view)).toBe(`/#planet-${planet.prd}`);
  });

  it('names nothing on any other screen', () => {
    for (const scene of ['title', 'coin', 'select', 'levelup', 'invaders', 'system'] as const) {
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
