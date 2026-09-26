import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { savePlayer } from './players';
import { ACME, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';
import type { Hero } from '@omni/design';

const HERO: Hero = { v: 1, body: 'boy', skin: 2, hair: 1, suit: 0, cape: 0 };

function as(person: FakeUser) {
  const world = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  return { world, db: world.client(person) as unknown as SupabaseClient };
}

describe('joining a fleet', () => {
  it('writes the player row with its workspace and the person, and reads it back as the arcade\'s player', async () => {
    const { world, db } = as(PEOPLE.bea);
    world.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: PEOPLE.bea.id, role: 'member', joined_at: '2026-09-26T09:00:00Z' });
    const row = await savePlayer(db, VERTUOZA, PEOPLE.bea.id, { team: 'pirates', display_name: 'BEA', hero: HERO }, null);
    expect(world.tables.players.at(-1)).toMatchObject({ workspace_id: VERTUOZA, user_id: PEOPLE.bea.id, team: 'pirates' });
    expect(row).toEqual({
      id: PEOPLE.bea.id, display_name: 'BEA', team: 'pirates', team_since: expect.any(String), hero: HERO, github_login: 'bea-gh',
    });
  });

  it('changes a fleet in the workspace shown only: a player of two keeps the other row as it was', async () => {
    const { world, db } = as(PEOPLE.both);
    const acme = await savePlayer(db, ACME, PEOPLE.both.id, { display_name: 'COYOTE' }, { id: PEOPLE.both.id } as never);
    expect(acme).toMatchObject({ id: PEOPLE.both.id, display_name: 'COYOTE', team: 'roadrunners' });
    const rows = world.tables.players.filter((p) => p.user_id === PEOPLE.both.id);
    expect(rows.map((p) => [p.workspace_id, p.display_name])).toEqual([[ACME, 'COYOTE'], [VERTUOZA, 'BOTH']]);
  });

  it('tells a visitor without GitHub to link it first', async () => {
    const { world, db } = as(PEOPLE.una);
    world.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: PEOPLE.una.id, role: 'member', joined_at: '2026-09-26T09:00:00Z' });
    await expect(savePlayer(db, VERTUOZA, PEOPLE.una.id, { team: 'pirates', display_name: 'UNA', hero: HERO }, null))
      .rejects.toThrow('Link your GitHub first: it is what makes you a player.');
  });

  it('writes nothing for a person with no workspace', async () => {
    const { world, db } = as(PEOPLE.eve);
    await expect(savePlayer(db, null, PEOPLE.eve.id, { team: 'pirates', display_name: 'EVE', hero: HERO }, null))
      .rejects.toThrow('This account belongs to no workspace yet.');
    expect(world.calls).toEqual([]);
  });
});
