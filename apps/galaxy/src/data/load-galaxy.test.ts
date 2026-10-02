import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: () => { throw new Error('the live cache is never reached in a test'); } }));

import { loadGalaxy } from './load-galaxy';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from './galaxy.fake';

// PRD 728: every ledger row the game writes names its PRD's home (`ledger_events.home`), and the
// galaxy keys a planet by `<home>#<n>`. The loader carries the column to buildGalaxy, so two
// repositories' PRD 88 are two planets on the map and two lines of points.

const NOW = new Date('2026-09-26T10:00:00Z');

const row = (home: string | null, id: string, type: string, extra: Record<string, unknown> = {}) => ({
  workspace_id: VERTUOZA, id, at: '2026-09-21T10:00:00Z', type, planet: 88, home,
  region: null, contributor: null, team: null, data: {}, ...extra,
});

function twins(home: string, who: string) {
  return [
    row(home, `planet:${home}#88:charted`, 'PLANET_CHARTED', { at: '2026-09-20T10:00:00Z', data: { title: `88 of ${home}`, captain: who } }),
    row(home, `zone:${home}:${home}#88:s1:opened`, 'ZONE_OPENED', { region: home, data: { wave: 1 } }),
    row(home, `zone:${home}:${home}#88:s1:secured`, 'ZONE_SECURED', { at: '2026-09-21T12:00:00Z', region: home, contributor: who, team: 'beaver' }),
  ];
}

function world(ledger: Record<string, unknown>[]) {
  const seed = twoWorkspaces();
  const fake = fakeGalaxyDb({ ...seed, ledger_events: ledger }, Object.values(PEOPLE));
  return fake.client(PEOPLE.ada) as unknown as SupabaseClient<Database>;
}

describe('loadGalaxy keys a planet by its home (PRD 728)', () => {
  it('reads each row\'s home, so two repositories\' PRD 88 are two planets', async () => {
    const db = world([...twins('vertuoza/vertuo-omni-plan', 'ada-gh'), ...twins('vertuoza/vertuo-automation-plan', 'paul-gh')]);
    const view = await loadGalaxy(db, VERTUOZA, NOW, null);
    expect(view.planets.map((p) => [p.key, p.home, p.title])).toEqual([
      ['vertuoza/vertuo-automation-plan#88', 'vertuoza/vertuo-automation-plan', '88 of vertuoza/vertuo-automation-plan'],
      ['vertuoza/vertuo-omni-plan#88', 'vertuoza/vertuo-omni-plan', '88 of vertuoza/vertuo-omni-plan'],
    ]);
    expect(view.planets.map((p) => p.secured)).toEqual([1, 1]);
    expect(Object.fromEntries(view.heroes.map((h) => [h.name, h.points]))).toEqual({ 'ada-gh': 10, 'paul-gh': 10 });
  });

  it('never reads a row written before the fresh start: it has no home, shows no planet and counts for nothing', async () => {
    const db = world([row(null, 'planet:88:charted', 'PLANET_CHARTED', { data: { title: 'Old' } })]);
    const view = await loadGalaxy(db, VERTUOZA, NOW, null);
    expect(view.planets).toEqual([]);
  });
});
