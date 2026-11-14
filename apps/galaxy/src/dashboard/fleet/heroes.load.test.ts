import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { heroesService } from '../../virtual-fleets/heroes/heroes.service';
import { ADA, BEN, fakeHeroesDb } from '../../virtual-fleets/heroes/heroes.fake';

vi.mock('server-only', () => ({}));
vi.mock('../../data/supabase-server', () => ({ supabaseEnv: () => null, supabaseServer: () => Promise.reject(new Error('no server client here')) }));
vi.mock('../../env', async (actual) => {
  const env = await actual<typeof import('../../env')>();
  return { ...env, serverEnv: () => env.readEnv({}) };
});

const person = { current: ADA };
const broken = { current: false };
vi.mock('../../virtual-fleets/heroes/heroes.live', () => ({
  heroesServiceAs: () => {
    if (broken.current) throw new Error('down');
    return heroesService(fakeHeroesDb('00000000-0000-4000-8000-00000000000a').as(person.current));
  },
}));

const { loadFleetBoard } = await import('./fleet');
const { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } = await import('../../data/galaxy.fake');

// /app/fleet's read of a virtual fleet's heroes (PRD 2842 s6): the Heroes tab's rows and whether the viewer
// may change them, only for a virtual fleet, and `null` when they cannot be read, the board still drawn.

const NOW = new Date('2026-09-26T10:00:00Z');

function db(virtual: boolean) {
  const seed = twoWorkspaces();
  const beaver = seed.teams?.find((t) => t.name === 'beaver');
  if (!beaver) throw new Error('the seed has no beaver fleet');
  seed.teams = [...(seed.teams ?? []), { ...beaver, name: 'night-shift', label: 'Night Shift', color: '#4fb0ff', sort: 70, kind: virtual ? 'virtual' : 'crew' }];
  return fakeGalaxyDb(seed, Object.values(PEOPLE)).client(PEOPLE.ada) as unknown as SupabaseClient<Database>;
}

const heroesOf = async (asked: string, virtual = true) => {
  const read = await loadFleetBoard(db(virtual), { id: PEOPLE.ada.id }, asked, '7d', NOW);
  return read.kind === 'board' ? read.heroes : 'no board';
};

describe('the Fleet section\'s read of heroes', () => {
  it('reads a virtual fleet\'s heroes in its colour, an owner able to change them', async () => {
    person.current = ADA;
    const heroes = await heroesOf('night-shift');
    expect(heroes).toMatchObject({ workspace: VERTUOZA, fleet: 'night-shift', color: '#4fb0ff', canEdit: true });
    expect(heroes !== null && heroes !== 'no board' && heroes !== undefined ? heroes.heroes.map((h) => h.role) : null).toEqual(['engineer', 'qa']);
  });

  it('shows a member the heroes without the means to change them', async () => {
    person.current = BEN;
    expect(await heroesOf('night-shift')).toMatchObject({ canEdit: false });
  });

  it('reads no heroes for a players\' fleet', async () => {
    person.current = ADA;
    expect(await heroesOf('beaver')).toBeUndefined();
  });

  it('answers null when the heroes cannot be read, and logs it', async () => {
    broken.current = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await heroesOf('night-shift')).toBeNull();
      expect(log).toHaveBeenCalledWith('fleet: the heroes could not be read (down)');
    } finally {
      broken.current = false;
      log.mockRestore();
    }
  });
});
