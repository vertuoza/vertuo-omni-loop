import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardReads } from '../board/load';
import type { Activity, Member, PersonRow } from '../board/tally';
import { loadFleet, type FleetRequest } from './load';

// /app/fleet's loader on fake reads (PRD 572): the viewer's fleet by default, `?fleet` any fleet, the
// picker otherwise, the fleet's season place, and each read failing alone.

const NOW = new Date('2026-09-26T10:00:00Z');
const member = (userId: string, login: string | null, fleet: string | null, name: string): Member => ({ userId, name, login, avatarUrl: null, fleet });
const ROSTER: Member[] = [
  member('u-ada', 'ada-gh', 'octo', 'ADA'),
  member('u-paul', 'paetienne', 'octo', 'Paul Etienne'),
  member('u-bob', 'bob-gh', 'beaver', 'BOB'),
  member('u-sol', 'sol-gh', null, 'SOL'),
];
const merged = (login: string, n: number): Activity => ({ kind: 'pr-merged', repo: 'vertuo-ai-domain', number: n, login, at: '2026-09-25T08:00:00Z' });
const ACTIVITY = [...Array.from({ length: 7 }, (_, i) => merged('paetienne', 100 + i)), merged('bob-gh', 1), merged('stranger', 2)];
const GALAXY = {
  heroes: [{ name: 'ada-gh', points: 120 }, { name: 'bob-gh', points: 300 }],
  teams: [
    { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', mascot: null, points: 300, rank: 1 },
    { name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod', points: 120, rank: 2 },
  ],
};

const reads = (fail: Partial<Record<keyof BoardReads, boolean>> = {}, galaxy = GALAXY): BoardReads => {
  const read = <T>(name: keyof BoardReads, value: T) => async () => {
    if (fail[name]) throw new Error(`${name} is down`);
    return value;
  };
  return {
    roster: read('roster', ROSTER),
    activity: read('activity', ACTIVITY),
    answered: read('answered', [{ user_id: 'u-paul', answered: 9 }, { user_id: 'u-bob', answered: 2 }]),
    galaxy: read('galaxy', galaxy),
    prds: read('prds', [{ stage: 'shipped', login: 'ada-gh', userId: null }, { stage: 'inbox', login: 'bob-gh', userId: null }]),
  };
};
const request = (over: Partial<FleetRequest> = {}): FleetRequest => ({ asked: null, viewerId: 'u-ada', period: '7d', now: NOW, ...over });

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('loadFleet', () => {
  it('shows your fleet by default: its members, Paul at 0 points among them, its merges only, its place', async () => {
    const fleet = await loadFleet(reads(), request());
    if (fleet.kind !== 'board') throw new Error(fleet.kind);
    expect(fleet.fleet).toEqual({ name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod', place: { rank: 2, of: 2 } });
    expect(fleet.board.tiles.prs).toBe(7);
    expect(fleet.board.tiles.answered).toBe(9);
    expect(fleet.board.tiles.prds).toMatchObject({ shipped: 1, inbox: 0 });
    const people = fleet.board.people as PersonRow[];
    expect(people.map((p) => p.userId)).toEqual(['u-paul', 'u-ada']);
    expect(people.find((p) => p.userId === 'u-paul')).toMatchObject({ prs: 7, answered: 9, points: 0 });
    expect(people.find((p) => p.userId === 'u-ada')?.you).toBe(true);
    expect((fleet.fleets as { name: string; yours: boolean }[]).map((f) => [f.name, f.yours])).toEqual([['beaver', false], ['octo', true]]);
  });

  it('carries each fleet\'s colour and mascot to the picker, for its chip (PRD 652)', async () => {
    const fleet = await loadFleet(reads(), request());
    if (fleet.kind !== 'board') throw new Error(fleet.kind);
    expect((fleet.fleets as { name: string; color: string; mascot: string | null }[]).map((f) => [f.name, f.color, f.mascot]))
      .toEqual([['beaver', '#8a5a2b', null], ['octo', '#3355ff', 'octopod']]);
  });

  it('shows the fleet ?fleet names', async () => {
    const fleet = await loadFleet(reads(), request({ asked: 'beaver' }));
    if (fleet.kind !== 'board') throw new Error(fleet.kind);
    expect(fleet.fleet.place).toEqual({ rank: 1, of: 2 });
    expect(fleet.board.tiles.prs).toBe(1);
    expect((fleet.board.people as PersonRow[]).map((p) => p.userId)).toEqual(['u-bob']);
  });

  it('asks a solo viewer to pick, and a ?fleet that names no fleet too', async () => {
    const solo = await loadFleet(reads(), request({ viewerId: 'u-sol' }));
    expect(solo.kind).toBe('pick');
    expect(solo.kind === 'pick' && (solo.fleets as unknown[]).length).toBe(2);
    expect((await loadFleet(reads(), request({ asked: 'ghosts' }))).kind).toBe('pick');
  });

  it('says the workspace has no fleet yet', async () => {
    expect(await loadFleet(reads({}, { heroes: [], teams: [] }), request())).toEqual({ kind: 'none' });
  });

  it('with the galaxy down: your fleet still, its place and the picker unreadable, the rest drawn', async () => {
    const fleet = await loadFleet(reads({ galaxy: true }), request());
    if (fleet.kind !== 'board') throw new Error(fleet.kind);
    expect(fleet.fleet).toEqual({ name: 'octo', label: 'OCTO', color: null, mascot: null, place: 'unreadable' });
    expect(fleet.fleets).toBe('unreadable');
    expect(fleet.board.tiles.prs).toBe(7);
  });

  it('with the roster down: a named fleet\'s board says it could not load; no ?fleet asks to pick', async () => {
    const fleet = await loadFleet(reads({ roster: true }), request({ asked: 'octo' }));
    if (fleet.kind !== 'board') throw new Error(fleet.kind);
    expect(fleet.board.tiles.prs).toBe('unreadable');
    expect(fleet.board.people).toBe('unreadable');
    expect(fleet.fleet.place).toEqual({ rank: 2, of: 2 });
    expect((await loadFleet(reads({ roster: true }), request())).kind).toBe('pick');
  });

  it('with the contributions down: only their parts unreadable', async () => {
    const fleet = await loadFleet(reads({ activity: true }), request());
    if (fleet.kind !== 'board') throw new Error(fleet.kind);
    expect(fleet.board.tiles.prs).toBe('unreadable');
    expect(fleet.board.merges).toBe('unreadable');
    expect(fleet.board.tiles.answered).toBe(9);
    expect(fleet.board.people).not.toBe('unreadable');
  });
});
