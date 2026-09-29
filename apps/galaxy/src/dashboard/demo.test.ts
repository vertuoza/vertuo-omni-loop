import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Waiting for you's demo, as demo.ts calls it: a marker carrying what it was given (counts/ tests its
// own). The board is board/'s demo world, drawn for real.
const given = vi.hoisted(() => ({ inputs: [] as unknown[] }));
vi.mock('./counts/demo', () => ({ demoWaiting: (input: unknown) => { given.inputs.push(input); return 'waiting'; } }));

import { demoGalaxy } from '../data/load-galaxy';
import { DEMO_VIEWER } from './board/demo';
import { DEMO_YOU, demoDashboard } from './demo';
import type { DemoInput } from './part';
import { DEFAULT_HERO } from './you';

// The dashboard in the demo (PRD 328): the demo world, with a demo *you*, one of its heroes.

const NOW = new Date('2026-09-28T10:00:00Z');

describe('the demo dashboard', () => {
  it('is DAM-DEV\'s, one of the demo world\'s heroes, playing solo, wearing the demo guest\'s default hero', () => {
    const galaxy = demoGalaxy(NOW);
    expect(galaxy.heroes.map((h) => h.name)).toContain(DEMO_YOU.login);
    expect(DEMO_YOU.team).toBeNull();
    const d = demoDashboard('7d', NOW);
    expect(d.name).toBe('DAM-DEV');
    expect(d.you).toMatchObject({ kind: 'player', hero: DEFAULT_HERO, fleet: 'solo' });
  });

  it('scores *you* as the demo galaxy does: your points and your place, and no fleet\'s', () => {
    const galaxy = demoGalaxy(NOW);
    const hero = galaxy.heroes.find((h) => h.name === DEMO_YOU.login)!;
    expect(demoDashboard('7d', NOW).you).toMatchObject({
      score: { points: hero.points, you: { rank: hero.rank, of: galaxy.heroes.length }, fleet: null },
    });
  });

  it('names no fleet of its own: nothing in the dashboard\'s demo is keyed by a fleet', () => {
    const source = readFileSync(new URL('./demo.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/beaver|octopod|picsou|pirates|\bcia\b|invincible|demoFleets/i);
  });

  it('on the season\'s first hours, before the demo world scores anything: no points yet, and 0 shown as 0', () => {
    expect(demoDashboard('7d', new Date('2026-10-01T01:00:00Z')).you).toMatchObject({ score: { points: 0, you: null } });
  });

  it('hands Waiting for you\'s demo the demo world and *you*, and carries what it gives', () => {
    given.inputs.length = 0;
    const d = demoDashboard('7d', NOW);
    expect(d.waiting).toBe('waiting');
    expect(given.inputs).toHaveLength(1);
    for (const input of given.inputs as DemoInput[]) {
      expect(input).toMatchObject({ now: NOW, login: 'dam-dev', team: null, season: { key: '2026-09' } });
      expect(input.galaxy.heroes.length).toBeGreaterThan(0);
    }
  });

  it('draws the board with scope *you*: DAM-DEV\'s own merges, for the period asked', () => {
    const d = demoDashboard('30d', NOW);
    expect(d.board.window.period).toBe('30d');
    expect(d.board.window.days).toHaveLength(30);
    if (d.board.people === 'unreadable') throw new Error('people unreadable');
    const me = d.board.people[0];
    expect(d.board.tiles.prs).toBe(me.prs);
  });

  it('*you* play solo: your team is your own row, marked, and the page links to Fleet', () => {
    const d = demoDashboard('7d', NOW);
    expect(d.solo).toBe(true);
    expect(d.board.people).toEqual([expect.objectContaining({ userId: DEMO_VIEWER.userId, you: true, name: 'DAM-DEV' })]);
  });
});
