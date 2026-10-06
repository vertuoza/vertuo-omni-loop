import { describe, it, expect, vi } from 'vitest';

const signOut = vi.fn<(options?: { scope?: string }) => Promise<{ error: null }>>(() => Promise.resolve({ error: null }));
const signInWithOAuth = vi.fn<(options: unknown) => Promise<{ data: object; error: null | { message: string } }>>(() => Promise.resolve({ data: {}, error: null }));
const linkIdentity = vi.fn<(options: unknown) => Promise<{ data: object; error: null }>>(() => Promise.resolve({ data: {}, error: null }));
vi.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ auth: { signOut, signInWithOAuth, linkIdentity } }) }));
vi.stubGlobal('window', { location: { origin: 'https://galaxy.example' } });

const { supabaseAccount } = await import('./account-supabase');
const account = () => supabaseAccount({ url: 'https://db.example.com', key: 'k', workspace: null });

describe('supabaseAccount', () => {
  it("signs out of this browser only, so the terminal's own sign-in (omni signin) survives", async () => {
    await account().signOut();
    // Supabase's default scope is global: it would revoke every session of the person, the one
    // `omni signin` keeps for ask mode included, and each terminal would fall back to asking itself.
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signs in with GitHub only, asking for read:org, coming back through the auth callback (PRD 359)', async () => {
    signInWithOAuth.mockClear();
    await account().signIn();
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'github', options: { redirectTo: 'https://galaxy.example/auth/callback', scopes: 'read:org' } });
  });

  it('links by signing in with GitHub again: the callback links every sign-in', async () => {
    signInWithOAuth.mockClear();
    await account().linkGithub();
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'github', options: { redirectTo: 'https://galaxy.example/auth/callback?next=link', scopes: 'read:org' } });
    expect(linkIdentity).not.toHaveBeenCalled();
  });

  it('says why when GitHub sign-in could not start', async () => {
    signInWithOAuth.mockResolvedValueOnce({ data: {}, error: { message: 'provider is not enabled' } });
    await expect(account().signIn()).rejects.toThrow('GitHub sign-in: provider is not enabled');
  });
});
