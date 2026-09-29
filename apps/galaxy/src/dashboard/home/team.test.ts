import { describe, expect, it } from 'vitest';
import { membersOf, type Member } from '../board/tally';
import { FLEET_PATH, homeRequest } from './team';

// Home's board (PRD 572): its tiles and charts are *you*; its People table is your team, the members
// of your fleet, or only your own row when you play solo or have no player row yet.

const member = (userId: string, login: string | null, fleet: string | null): Member => ({ userId, name: userId, login, avatarUrl: null, fleet });
const ROSTER = [member('u-ada', 'ada-gh', 'octo'), member('u-paul', 'paetienne', 'octo'), member('u-bob', 'bob-gh', 'beaver'), member('u-new', null, null)];

describe('homeRequest', () => {
  it('in a fleet: the board is yours, the People table your fleet\'s members, 0s kept', () => {
    const r = homeRequest({ userId: 'u-ada', login: 'ada-gh', team: 'octo' });
    expect(r.scope).toEqual({ kind: 'you', userId: 'u-ada', login: 'ada-gh' });
    expect(r.people).toEqual({ kind: 'fleet', fleet: 'octo' });
    expect(r.solo).toBe(false);
    expect(membersOf(r.people, ROSTER).map((m) => m.userId)).toEqual(['u-ada', 'u-paul']);
  });

  it('solo, or with no player row: your own row only, and the link to Fleet', () => {
    const r = homeRequest({ userId: 'u-new', login: null, team: null });
    expect(r.people).toEqual(r.scope);
    expect(r.solo).toBe(true);
    expect(membersOf(r.people, ROSTER).map((m) => m.userId)).toEqual(['u-new']);
  });

  it('links to the Fleet page', () => {
    expect(FLEET_PATH).toBe('/app/fleet');
  });
});
