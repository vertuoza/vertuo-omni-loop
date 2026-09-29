import { describe, expect, it } from 'vitest';
import { faceOf, githubPicture, withFaces, type FacePlayer } from './faces';
import type { EngineeringValue } from './tally';

// The face beside a login in the Engineering board's top-people lists (PRD 645 s1): the player's game
// hero when the login is a player in the workspace, the GitHub picture otherwise.

const HERO = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };
const player = (over: Partial<FacePlayer> = {}): FacePlayer => ({ login: 'Ada', hero: HERO, color: '#e0457b', ...over });

describe('faceOf', () => {
  it('a player whose login matches, whatever the case: their hero, in their fleet\'s colour', () => {
    expect(faceOf('ada', [player()])).toEqual({ kind: 'hero', hero: HERO, color: '#e0457b' });
    expect(faceOf('ADA', [player({ login: 'ada' })])).toEqual({ kind: 'hero', hero: HERO, color: '#e0457b' });
  });

  it('a player with no fleet, or a fleet colour that is not a hex: the hero in its own colours', () => {
    expect(faceOf('ada', [player({ color: null })])).toEqual({ kind: 'hero', hero: HERO, color: undefined });
    expect(faceOf('ada', [player({ color: 'red;background:url(x)' })])).toEqual({ kind: 'hero', hero: HERO, color: undefined });
  });

  it('no player, or a player whose hero cannot be drawn: the GitHub picture', () => {
    expect(faceOf('bob', [player()])).toEqual({ kind: 'github', src: 'https://github.com/bob.png?size=56' });
    expect(faceOf('ada', [player({ hero: { v: 9 } })])).toEqual({ kind: 'github', src: 'https://github.com/ada.png?size=56' });
    expect(faceOf('ada', [])).toEqual({ kind: 'github', src: 'https://github.com/ada.png?size=56' });
  });

  it('encodes a login a URL would need escaped', () => {
    expect(githubPicture('a b/../?x')).toBe('https://github.com/a%20b%2F..%2F%3Fx.png?size=56');
  });
});

describe('withFaces', () => {
  const window = { from: new Date(0), to: new Date(1), days: [] } as unknown as Extract<EngineeringValue, { kind: 'board' }>['window'];

  it('gives each person of the three lists their face', () => {
    const board = {
      kind: 'board', window, people: { opened: [{ login: 'ada', count: 2 }], merged: [{ login: 'bob', count: 1 }], reviews: [] },
    } as unknown as EngineeringValue;
    const faced = withFaces(board, [player()]);
    expect(faced.kind === 'board' && faced.people.opened[0].face).toEqual({ kind: 'hero', hero: HERO, color: '#e0457b' });
    expect(faced.kind === 'board' && faced.people.merged[0].face).toEqual({ kind: 'github', src: 'https://github.com/bob.png?size=56' });
  });

  it('leaves an empty board as it is', () => {
    const empty: EngineeringValue = { kind: 'empty', window };
    expect(withFaces(empty, [player()])).toBe(empty);
  });
});
