import { describe, it, expect, vi } from 'vitest';

const signOut = vi.fn(async (_options?: { scope?: string }) => ({ error: null }));
vi.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ auth: { signOut } }) }));

const { supabaseAccount } = await import('./account-supabase');

describe('supabaseAccount', () => {
  it("signs out of this browser only, so the terminal's own sign-in (omni signin) survives", async () => {
    await supabaseAccount({ url: 'https://db.example.com', key: 'k', workspace: null }).signOut();
    // Supabase's default scope is global: it would revoke every session of the person, the one
    // `omni signin` keeps for ask mode included, and each terminal would fall back to asking itself.
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
