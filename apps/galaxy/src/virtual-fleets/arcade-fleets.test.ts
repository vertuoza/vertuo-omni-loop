import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';

vi.mock('server-only', () => ({}));

import { loadFleets } from '../data/load-galaxy';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from '../data/galaxy.fake';

// A Virtual Fleet's members are agents, never players (PRD 2842 s1): the arcade reads the workspace's
// fleets a player may fly in, which leave every virtual fleet out, while Settings › Fleets and the Fleet
// section still read them all.

function world() {
  const seed = twoWorkspaces();
  const beaver = seed.teams?.find((t) => t.name === 'beaver');
  if (!beaver) throw new Error('the seed has no beaver fleet');
  seed.teams = [...(seed.teams ?? []), { ...beaver, name: 'night-shift', label: 'Night Shift', sort: 70, kind: 'virtual' }];
  const db = fakeGalaxyDb(seed, Object.values(PEOPLE));
  return db.client(PEOPLE.ada) as unknown as SupabaseClient<Database>;
}

describe('the fleets the arcade offers', () => {
  it('leaves out a virtual fleet for the players, and keeps it for every other read', async () => {
    const db = world();
    expect((await loadFleets(db, VERTUOZA, { players: true })).map((f) => f.name)).toEqual(['beaver', 'pirates', 'invincible-team']);
    expect((await loadFleets(db, VERTUOZA)).map((f) => f.name)).toEqual(['beaver', 'pirates', 'invincible-team', 'night-shift']);
  });
});
