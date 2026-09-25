import { describe, it, expect } from 'vitest';
import { afterGate, afterReturn, afterStart, backStep, isDisbanded, isReady, nextStep, readReturn } from './onboarding';
import type { FleetRow, Player, Session } from './types';

const fleet = (name: string, retired = false): FleetRow => ({ name, home: null, label: name.toUpperCase(), color: '#2fc6a4', motto: '', mascot: null, sort: 0, retired });
const FLEETS = [fleet('beaver'), fleet('pirates'), fleet('invincible-team', true)];
const crew: Session = { id: 'u1', email: 'ada@vertuoza.com', givenName: 'ADA', crew: true };
const outsider: Session = { ...crew, email: 'eve@example.com', crew: false };
const player = (over: Partial<Player> = {}): Player => ({
  id: 'u1', display_name: 'ADA', team: 'pirates', team_since: '2026-09-25T10:00:00Z',
  hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, github_login: null, ...over,
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
    expect(afterStart(crew, player({ team: null }), FLEETS)).toBe('gate');
  });
});

describe('PRESS START', () => {
  it('plays the intro to a new player, the fleets to a disbanded one, the welcome to a returning one', () => {
    expect(afterGate(null, FLEETS)).toBe('intro');
    expect(afterGate(player({ team: 'invincible-team' }), FLEETS)).toBe('select');
    expect(afterGate(player(), FLEETS)).toBe('welcome');
  });

  it('knows a retired fleet from an active one', () => {
    expect(isDisbanded(player({ team: 'invincible-team' }), FLEETS)).toBe(true);
    expect(isDisbanded(player(), FLEETS)).toBe(false);
    expect(isReady(player(), FLEETS)).toBe(true);
    expect(isReady(player({ hero: { v: 1, body: 'girl', skin: 9, hair: 0, suit: 0, cape: 0 } }), FLEETS)).toBe(false);
  });
});

describe('the first visit', () => {
  it('runs intro → fleet → name → hero → GitHub → ready → menu', () => {
    const route = ['intro'];
    let me: Player | null = null;
    while (route.at(-1) !== 'menu') {
      if (route.at(-1) === 'select') me = player();
      route.push(nextStep(route.at(-1) as never, 'onboard', me));
    }
    expect(route).toEqual(['intro', 'select', 'name', 'hero', 'link', 'ready', 'menu']);
  });

  it('skips GitHub when it is already linked', () => {
    expect(nextStep('hero', 'onboard', player({ github_login: 'ada-gh' }))).toBe('ready');
  });

  it('goes back one screen with B, and to the title from the fleets', () => {
    expect(backStep('select', 'onboard')).toBe('title');
    expect(backStep('name', 'onboard')).toBe('select');
    expect(backStep('hero', 'onboard')).toBe('name');
    expect(backStep('link', 'onboard')).toBe('ready');
  });
});

describe('menu flows', () => {
  it('returns to the menu when the one thing asked is done', () => {
    expect(nextStep('select', 'change', player())).toBe('menu');
    expect(nextStep('name', 'myhero', player())).toBe('hero');
    expect(nextStep('hero', 'myhero', player())).toBe('menu');
    expect(nextStep('link', 'link', player())).toBe('menu');
    expect(backStep('hero', 'myhero')).toBe('name');
    expect(backStep('name', 'myhero')).toBe('menu');
    expect(backStep('select', 'change')).toBe('menu');
  });
});

describe('returns from Google and GitHub', () => {
  it('reads what the callback put in the query string', () => {
    expect(readReturn('?signin=ok')).toEqual({ kind: 'signin' });
    expect(readReturn('?signin_error=OMNI%20LOOP%20is%20for%20%40vertuoza.com%20accounts%20only.')).toEqual({ kind: 'signin_error', message: 'OMNI LOOP is for @vertuoza.com accounts only.' });
    expect(readReturn('?linked=ada-gh')).toEqual({ kind: 'linked', login: 'ada-gh' });
    expect(readReturn('?link_error=taken')).toEqual({ kind: 'link_error', message: 'taken' });
    expect(readReturn('')).toBeNull();
  });

  it('opens the screen that waits for a key, so the music can play', () => {
    expect(afterReturn({ kind: 'signin' }, crew, null, FLEETS)).toBe('gate');
    expect(afterReturn({ kind: 'signin' }, crew, player(), FLEETS)).toBe('gate');
    expect(afterReturn({ kind: 'signin' }, outsider, null, FLEETS)).toBe('outsider');
    expect(afterReturn({ kind: 'signin_error', message: 'x' }, null, null, FLEETS)).toBe('coin');
    expect(afterReturn({ kind: 'linked', login: 'ada-gh' }, crew, player(), FLEETS)).toBe('link');
  });
});
