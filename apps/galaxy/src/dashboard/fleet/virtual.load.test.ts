import { describe, expect, it, vi } from 'vitest';
import { MASCOTS } from '@omni/design';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';

vi.mock('server-only', () => ({}));
vi.mock('../../data/supabase-server', () => ({ supabaseEnv: () => null, supabaseServer: () => Promise.reject(new Error('no server client here')) }));
vi.mock('../../env', async (actual) => {
  const env = await actual<typeof import('../../env')>();
  return { ...env, serverEnv: () => env.readEnv({}) };
});

const { loadFleetBoard } = await import('./fleet');
const { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } = await import('../../data/galaxy.fake');

// /app/fleet's read as a member (PRD 2842 s1): beside the fleet's board, the workspace the New virtual
// fleet button makes its fleet in, the fleet mascots, and the keys of the workspace's virtual fleets.

const NOW = new Date('2026-09-26T10:00:00Z');

describe('the Fleet section\'s read', () => {
  it('carries the workspace, the mascots and the virtual fleets\' keys', async () => {
    const seed = twoWorkspaces();
    const beaver = seed.teams?.find((t) => t.name === 'beaver');
    if (!beaver) throw new Error('the seed has no beaver fleet');
    seed.teams = [...(seed.teams ?? []), { ...beaver, name: 'night-shift', label: 'Night Shift', sort: 70, kind: 'virtual' }];
    const db = fakeGalaxyDb(seed, Object.values(PEOPLE)).client(PEOPLE.ada) as unknown as SupabaseClient<Database>;
    const read = await loadFleetBoard(db, { id: PEOPLE.ada.id }, null, '7d', NOW);
    expect(read.kind === 'no-workspace' ? null : read.virtual).toEqual({ workspace: VERTUOZA, mascots: MASCOTS, names: ['night-shift'] });
  });
});
