import { describe, expect, it } from 'vitest';
import { peopleOf } from '../people/load';
import { loginsShown, withPeople } from './faced';
import type { EngineeringValue } from './tally';
import { sure } from '../arcade/test/sure';

// The face beside a login in the Engineering board's top-people lists (PRD 652 s3): resolved by
// login through the workspace's people directory, so a member's hero (or photo) shows, and a login
// outside the workspace keeps its public GitHub photo.

const HERO = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };
const PEOPLE = peopleOf(
  [{ user_id: 'u-ada', name: 'Ada', github_login: 'Ada', avatar_url: null, fleet: 'octo', hero: HERO }],
  [{ name: 'octo', label: 'OCTO', color: '#e0457b', mascot: null }],
);
const window = { from: new Date(0), to: new Date(1), days: [] } as unknown as Extract<EngineeringValue, { kind: 'board' }>['window'];
const ranked = (logins: string[]) => logins.map((login) => ({ login, count: 1 }));
const board = (opened: string[], merged: string[] = [], reviews: string[] = []) => ({
  kind: 'board', window, people: { opened: ranked(opened), merged: ranked(merged), reviews: ranked(reviews) },
}) as unknown as EngineeringValue;

describe('withPeople', () => {
  it('a member, whatever the case of the login: their face from the directory', () => {
    const faced = withPeople(board(['ada']), PEOPLE);
    expect(faced.kind === 'board' && sure(faced.people.opened[0], 'faced.people.opened[0]').face).toEqual(PEOPLE.byLogin('ada').face);
    expect(faced.kind === 'board' && sure(faced.people.opened[0], 'faced.people.opened[0]').face?.kind).toBe('hero');
  });

  it('a login outside the workspace: its GitHub photo', () => {
    const faced = withPeople(board([], ['bob']), PEOPLE);
    expect(faced.kind === 'board' && sure(faced.people.merged[0], 'faced.people.merged[0]').face).toEqual({ kind: 'photo', url: 'https://github.com/bob.png?size=48' });
  });

  it('leaves an empty board as it is', () => {
    const empty: EngineeringValue = { kind: 'empty', window };
    expect(withPeople(empty, PEOPLE)).toBe(empty);
  });
});

describe('loginsShown', () => {
  it('every login the three lists show, once each', () => {
    expect(loginsShown(board(['ada', 'bob'], ['bob'], ['carl']))).toEqual(['ada', 'bob', 'carl']);
  });
});
