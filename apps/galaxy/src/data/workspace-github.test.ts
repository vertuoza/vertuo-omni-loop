import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces } from './galaxy.fake';
import { memberGithub } from './workspace';

// Where the knowledge map's repository picker starts: every workspace a person belongs to, with its
// GitHub org and the App installation it owns, read as that person.

const as = (person: (typeof PEOPLE)[keyof typeof PEOPLE]) =>
  fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE)).client(person) as unknown as SupabaseClient;

describe('memberGithub — the workspaces a person belongs to, as GitHub knows them', () => {
  it('gives each of their workspaces, by slug, with its org and installation', async () => {
    expect(await memberGithub(as(PEOPLE.both), PEOPLE.both.id)).toEqual([
      { slug: 'acme', github_org: 'acme', github_installation_id: 91002 },
      { slug: 'vertuoza', github_org: 'vertuoza', github_installation_id: 91001 },
    ]);
  });

  it('gives only their own workspaces, and none to someone in none', async () => {
    expect(await memberGithub(as(PEOPLE.ada), PEOPLE.ada.id)).toEqual([{ slug: 'vertuoza', github_org: 'vertuoza', github_installation_id: 91001 }]);
    expect(await memberGithub(as(PEOPLE.eve), PEOPLE.eve.id)).toEqual([]);
  });

  it('keeps a workspace made before sign-up recorded its installation, with none', async () => {
    const seed = twoWorkspaces();
    seed.workspaces = seed.workspaces!.map((w) => (w.slug === 'vertuoza' ? { ...w, github_installation_id: null } : w));
    const db = fakeGalaxyDb(seed, Object.values(PEOPLE)).client(PEOPLE.ada) as unknown as SupabaseClient;
    expect(await memberGithub(db, PEOPLE.ada.id)).toEqual([{ slug: 'vertuoza', github_org: 'vertuoza', github_installation_id: null }]);
  });

  it('says so when the workspaces cannot be read', async () => {
    const broken = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'timeout' } }) }) }) };
    await expect(memberGithub(broken as unknown as SupabaseClient, PEOPLE.eve.id)).rejects.toThrow(/could not read your workspaces \(timeout\)/);
  });
});
