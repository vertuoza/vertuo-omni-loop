import { describe, expect, it } from 'vitest';
import { SIGN_UP_ATTR, signUp, type SignUpPorts } from './sign-up';

// HOME's SIGN UP WITH GITHUB (PRD 359, s5): the GitHub sign-in s2 made, coming back to the
// galaxy's own callback, which joins the person's workspaces and sends them on.

function ports(supabase: SignUpPorts['supabase'], answer: string | null = null) {
  const calls: string[] = [];
  const at: SignUpPorts = {
    supabase,
    origin: 'https://galaxy.example',
    start: (env, redirectTo) => { calls.push(`start ${env.url} ${redirectTo}`); return Promise.resolve(answer); },
    go: (href) => { calls.push(`go ${href}`); },
  };
  return { at, calls };
}

describe('pressing SIGN UP WITH GITHUB', () => {
  it('is marked by its own attribute, for Controls to answer', () => {
    expect(SIGN_UP_ATTR).toBe('data-sign-up');
  });

  it('starts the GitHub sign-in, coming back to the galaxy\'s callback', async () => {
    const { at, calls } = ports({ url: 'https://db.example.com', key: 'k' });
    expect(await signUp(at)).toBeNull();
    expect(calls).toEqual(['start https://db.example.com https://galaxy.example/auth/callback']);
  });

  it('says why when GitHub sign-in could not start, and goes nowhere', async () => {
    const { at, calls } = ports({ url: 'https://db.example.com', key: 'k' }, 'GitHub sign-in could not start: provider is not enabled');
    expect(await signUp(at)).toBe('GitHub sign-in could not start: provider is not enabled');
    expect(calls).toHaveLength(1);
  });

  it('without Supabase (the demo), opens the game instead', async () => {
    const { at, calls } = ports(null);
    expect(await signUp(at)).toBeNull();
    expect(calls).toEqual(['go /play']);
  });
});

// SELECT YOUR APP (PRD 932, s1): the pick rides through the sign-in, as `next=app` on the callback.
describe('signing up with an app picked', () => {
  it('an Omni app pick comes back to the callback with next=app', async () => {
    const { at, calls } = ports({ url: 'https://db.example.com', key: 'k' });
    expect(await signUp(at, 'app')).toBeNull();
    expect(calls).toEqual(['start https://db.example.com https://galaxy.example/auth/callback?next=app']);
  });

  it('an Arcade pick comes back to the bare callback', async () => {
    const { at, calls } = ports({ url: 'https://db.example.com', key: 'k' });
    expect(await signUp(at, 'arcade')).toBeNull();
    expect(calls).toEqual(['start https://db.example.com https://galaxy.example/auth/callback']);
  });

  it('without Supabase, the Omni app pick opens /app', async () => {
    const { at, calls } = ports(null);
    expect(await signUp(at, 'app')).toBeNull();
    expect(calls).toEqual(['go /app']);
  });

  it('without Supabase, the Arcade pick opens /play', async () => {
    const { at, calls } = ports(null);
    expect(await signUp(at, 'arcade')).toBeNull();
    expect(calls).toEqual(['go /play']);
  });
});
