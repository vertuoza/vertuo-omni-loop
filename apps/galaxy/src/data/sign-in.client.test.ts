import { beforeEach, describe, expect, it, vi } from 'vitest';

// The sign-in module (PRD 1318): the one browser module that may build a Supabase client, because
// signing in and out is authentication, not data. Its sign-out builds the browser client from the
// public pair and signs out of it.

const signOut = vi.fn<() => Promise<{ error: null }>>();
const createBrowserClient = vi.fn((url: string, key: string) => ({ url, key, auth: { signOut } }));
vi.mock('@supabase/ssr', () => ({ createBrowserClient }));

const { signOutHere } = await import('./sign-in.client');

describe('the sign-in module', () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue({ error: null });
    createBrowserClient.mockClear();
  });

  it('signs out of the browser client built from the public pair', async () => {
    await signOutHere({ url: 'https://db.example', key: 'public-key' });
    expect(createBrowserClient).toHaveBeenCalledWith('https://db.example', 'public-key');
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
