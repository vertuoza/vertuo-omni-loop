import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces } from './galaxy.fake';
import { landingAfterSignIn } from './workspace';

const as = (person: (typeof PEOPLE)[keyof typeof PEOPLE]) =>
  fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE)).client(person) as unknown as SupabaseClient;

afterEach(() => { vi.restoreAllMocks(); });

describe('where a sign-in lands', () => {
  it('a member of a workspace lands in the arcade', async () => {
    expect(await landingAfterSignIn(as(PEOPLE.ada), PEOPLE.ada.id)).toBe('/play');
  });

  it('someone in no workspace goes straight on to sign-up', async () => {
    expect(await landingAfterSignIn(as(PEOPLE.eve), PEOPLE.eve.id)).toBe('/signup');
  });

  it('lands in the arcade when the workspaces cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'timeout' } }) }) }) };
    expect(await landingAfterSignIn(broken as unknown as SupabaseClient, PEOPLE.eve.id)).toBe('/play');
  });
});
