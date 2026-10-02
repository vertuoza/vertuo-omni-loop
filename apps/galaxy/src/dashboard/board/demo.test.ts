import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { describe, expect, it } from 'vitest';
import { demoBoard, demoRoster, DEMO_VIEWER } from './demo';
import type { PersonRow } from './tally';
import { sure } from '../../arcade/sure';

// The board in the demo (PRD 572): every part shows, with members at 0 among them.

const NOW = new Date('2026-09-26T10:00:00Z');
const galaxy = buildGalaxy(demoEvents(NOW), { projects: DEMO_PROJECTS, now: NOW, source: 'demo' });

describe('the demo board', () => {
  it('lists the demo heroes, you solo, and two members with no points, one of them with no fleet', () => {
    const roster = demoRoster(galaxy);
    expect(roster.length).toBe(galaxy.heroes.length + 2);
    expect(roster.find((m) => m.login === DEMO_VIEWER.login)?.fleet).toBeNull();
    expect(roster.filter((m) => !galaxy.heroes.some((h) => h.name.toLowerCase() === m.login)).map((m) => m.fleet)).toEqual(['builders', null]);
  });

  // Bug 864: a season is a calendar month, so on its first morning the demo's you has no point in it
  // yet and is no hero; the demo's you is still a member, whatever the day.
  it('keeps you on the roster, solo, on a season\'s first morning, before you score in it', () => {
    for (const at of ['2026-10-01T00:30:00Z', '2026-10-01T08:00:00Z', '2026-11-01T06:00:00Z', '2027-01-01T09:00:00Z']) {
      const now = new Date(at);
      const roster = demoRoster(buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' }));
      expect(roster.filter((m) => m.login === DEMO_VIEWER.login), at).toEqual([expect.objectContaining({ userId: DEMO_VIEWER.userId, fleet: null })]);
    }
  });

  for (const period of ['7d', '30d', 'season'] as const) {
    it(`shows every part of the workspace's board over ${period}`, () => {
      const board = demoBoard(galaxy, { scope: { kind: 'workspace' }, people: { kind: 'workspace' }, period, now: NOW });
      const tiles: Record<string, unknown> = { ...board.tiles };
      for (const value of [board.merges, board.prdEvents, board.repositories, board.people, board.fleets, ...Object.values(tiles)]) {
        expect(value).not.toBe('unreadable');
      }
      expect(board.tiles.prs).toBeGreaterThan(0);
      expect(board.tiles.answered).toBeGreaterThan(0);
      expect((board.repositories as unknown[]).length).toBeGreaterThan(1);
      const people = board.people as PersonRow[];
      expect(people.find((p) => p.login === 'paul-e')).toMatchObject({ points: 0, answered: 9 });
      expect((sure(people.find((p) => p.login === 'paul-e'), 'the item found').prs as number)).toBeGreaterThan(0);
      expect(people.find((p) => p.login === 'new-hire')).toMatchObject({ points: 0, prs: 0, answered: 0, fleet: 'solo' });
      expect(people.filter((p) => p.you).map((p) => p.login)).toEqual([DEMO_VIEWER.login]);
    });
  }

  it('counts a bot\'s merges in the workspace\'s totals, with no row', () => {
    const board = demoBoard(galaxy, { scope: { kind: 'workspace' }, people: { kind: 'workspace' }, period: '30d', now: NOW });
    const rowsPrs = (board.people as PersonRow[]).reduce((sum, p) => sum + (typeof p.prs === 'number' ? p.prs : 0), 0);
    expect(board.tiles.prs as number).toBeGreaterThan(rowsPrs);
  });
});
