import { describe, expect, it } from 'vitest';
import type { Player } from '../arcade/types';
import { firstName, linkedLogin, loginOf, nameOf, scoreOf } from './you';

// The hero block's own rules (PRD 328): your season in the galaxy, found by login ignoring case, and
// who you are when there is no player row to say it.

const hero = (name: string, points: number, rank: number) => ({ name, team: null, points, rank });
const fleet = (name: string, label: string, rank: number) => ({ name, label, rank }) as never;

const GALAXY = {
  heroes: [hero('inky', 980, 1), hero('dime', 870, 2), hero('Pierre-GH', 280, 3), hero('lea', 120, 4)],
  teams: [fleet('octopod', 'OCTOPOD', 1), fleet('beaver', 'BEAVER', 2), fleet('picsou', 'PICSOU', 3)],
};

describe('scoreOf', () => {
  it('gives your points, your place among the individuals and your fleet\'s among the fleets', () => {
    expect(scoreOf(GALAXY, 'pierre-gh', 'beaver')).toEqual({
      points: 280, you: { rank: 3, of: 4 }, fleet: { label: 'BEAVER', rank: 2, of: 3 },
    });
  });

  it('matches your login ignoring case', () => {
    expect(scoreOf(GALAXY, 'PIERRE-gh', 'beaver').you).toEqual({ rank: 3, of: 4 });
  });

  it('with no points this season: 0 points and no place of yours, your fleet\'s still', () => {
    expect(scoreOf(GALAXY, 'max-gh', 'picsou')).toEqual({ points: 0, you: null, fleet: { label: 'PICSOU', rank: 3, of: 3 } });
  });

  it('with no fleet the season knows: no fleet place', () => {
    expect(scoreOf(GALAXY, 'inky', null).fleet).toBeNull();
    expect(scoreOf(GALAXY, 'inky', 'gone').fleet).toBeNull();
  });

  it('with an empty season: nothing ranked yet', () => {
    expect(scoreOf({ heroes: [], teams: [] }, 'inky', 'octopod')).toEqual({ points: 0, you: null, fleet: null });
  });
});

describe('who you are', () => {
  const user = (over: Record<string, unknown> = {}) => ({
    email: 'pierre@vertuoza.com', user_metadata: { given_name: 'Pierre', full_name: 'Pierre Derval' }, identities: [], ...over,
  }) as never;
  const player = (over: Partial<Player> = {}): Player => ({
    id: 'u1', display_name: 'PIERRE', team: 'beaver', team_since: null, hero: { v: 1, body: 'boy', skin: 0, hair: 0, suit: 0, cape: 0 }, github_login: 'Pierre-GH', ...over,
  });

  it('your login is the player row\'s, in lower case, else the linked GitHub identity\'s, else none', () => {
    const linked = user({ identities: [{ provider: 'github', identity_data: { user_name: 'Other-GH' } }] });
    expect(loginOf(player(), linked)).toBe('pierre-gh');
    expect(loginOf(player({ github_login: null }), linked)).toBe('other-gh');
    expect(loginOf(null, linked)).toBe('other-gh');
    expect(loginOf(null, user())).toBeNull();
  });

  it('reads the linked identity\'s user name, or its preferred one', () => {
    expect(linkedLogin(user({ identities: [{ provider: 'github', identity_data: { preferred_username: 'pd' } }] }))).toBe('pd');
    expect(linkedLogin(user({ identities: [{ provider: 'google', identity_data: { user_name: 'nope' } }] }))).toBeNull();
  });

  it('your heading is the player\'s name, else the account\'s first name', () => {
    expect(nameOf(player(), user())).toBe('PIERRE');
    expect(nameOf(player({ display_name: '  ' }), user())).toBe('Pierre');
    expect(nameOf(null, user())).toBe('Pierre');
    expect(firstName(user({ user_metadata: {} }))).toBe('pierre');
  });
});
