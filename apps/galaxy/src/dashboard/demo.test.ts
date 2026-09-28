import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Each part's demo, as demo.ts calls it: a marker carrying what it was given, so these tests hold
// whatever the parts' demos become (each part folder tests its own).
const given = vi.hoisted(() => ({ inputs: [] as unknown[] }));
vi.mock('./week/demo', () => ({ demoWeek: (input: unknown) => { given.inputs.push(input); return 'the week'; } }));
vi.mock('./counts/demo', () => ({ demoCounts: (input: unknown) => { given.inputs.push(input); return 'the counts'; } }));
vi.mock('./rankings/demo', () => ({ demoRankings: (input: unknown) => { given.inputs.push(input); return 'the rankings'; } }));

import { demoGalaxy } from '../data/load-galaxy';
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
    const d = demoDashboard(NOW);
    expect(d.name).toBe('DAM-DEV');
    expect(d.you).toMatchObject({ kind: 'player', hero: DEFAULT_HERO, fleet: 'solo' });
  });

  it('scores *you* as the demo galaxy does: your points and your place, and no fleet\'s', () => {
    const galaxy = demoGalaxy(NOW);
    const hero = galaxy.heroes.find((h) => h.name === DEMO_YOU.login)!;
    expect(demoDashboard(NOW).you).toMatchObject({
      score: { points: hero.points, you: { rank: hero.rank, of: galaxy.heroes.length }, fleet: null },
    });
  });

  it('names no fleet of its own: nothing in the dashboard\'s demo is keyed by a fleet', () => {
    const source = readFileSync(new URL('./demo.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/beaver|octopod|picsou|pirates|\bcia\b|invincible|demoFleets/i);
  });

  it('on the season\'s first hours, before the demo world scores anything: no points yet, and 0 shown as 0', () => {
    expect(demoDashboard(new Date('2026-10-01T01:00:00Z')).you).toMatchObject({ score: { points: 0, you: null } });
  });

  it('hands each part\'s demo the demo world and *you*, and carries what it gives', () => {
    given.inputs.length = 0;
    const d = demoDashboard(NOW);
    expect([d.week, d.counts, d.rankings]).toEqual(['the week', 'the counts', 'the rankings']);
    expect(given.inputs).toHaveLength(3);
    for (const input of given.inputs as DemoInput[]) {
      expect(input).toMatchObject({ now: NOW, login: 'dam-dev', team: null, season: { key: '2026-09' } });
      expect(input.galaxy.heroes.length).toBeGreaterThan(0);
    }
  });
});
