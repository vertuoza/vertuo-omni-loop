import { describe, expect, it, vi } from 'vitest';
import { APP_CALLBACK } from '../dashboard/sign-in';
import { buttonKey, initialOf, menuKey, profileHref, signInFromBar, signOutAndLeave, SIGN_OUT_HOME } from './user-menu';

// The user menu's pure parts (PRD 438): the WAI-ARIA menu-button keys, sign-in from the top bar, and
// sign-out, which ends this browser's session and lands on HOME.

describe('the menu button\'s keys', () => {
  it('opens on ArrowDown, Enter and Space with the first item focused', () => {
    for (const key of ['ArrowDown', 'Enter', ' ']) expect(buttonKey(key, 3)).toEqual({ kind: 'open', index: 0 });
  });

  it('opens on ArrowUp with the last item focused', () => {
    expect(buttonKey('ArrowUp', 3)).toEqual({ kind: 'open', index: 2 });
  });

  it('leaves any other key alone', () => {
    expect(buttonKey('a', 3)).toEqual({ kind: 'none' });
    expect(buttonKey('Tab', 3)).toEqual({ kind: 'none' });
  });
});

describe('the menu\'s keys', () => {
  it('moves down and up between items, wrapping at both ends', () => {
    expect(menuKey('ArrowDown', 0, 3)).toEqual({ kind: 'focus', index: 1 });
    expect(menuKey('ArrowDown', 2, 3)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKey('ArrowUp', 1, 3)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKey('ArrowUp', 0, 3)).toEqual({ kind: 'focus', index: 2 });
  });

  it('stays on the one item when there is only one', () => {
    expect(menuKey('ArrowDown', 0, 1)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKey('ArrowUp', 0, 1)).toEqual({ kind: 'focus', index: 0 });
  });

  it('jumps to the first item on Home, and the last on End', () => {
    expect(menuKey('Home', 2, 3)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKey('End', 0, 3)).toEqual({ kind: 'focus', index: 2 });
  });

  it('closes on Escape and gives the focus back to the avatar', () => {
    expect(menuKey('Escape', 1, 3)).toEqual({ kind: 'close', refocus: true });
  });

  it('closes on Tab and lets the focus move on', () => {
    expect(menuKey('Tab', 1, 3)).toEqual({ kind: 'close', refocus: false });
  });

  it('leaves any other key alone', () => {
    expect(menuKey('a', 1, 3)).toEqual({ kind: 'none' });
  });
});

describe('Sign out', () => {
  it('signs out of this browser only, then goes to HOME', async () => {
    const calls: string[] = [];
    const client = { auth: { signOut: vi.fn(async (o: { scope: 'local' }) => { calls.push(`signOut:${o.scope}`); return { error: null }; }) } };
    await signOutAndLeave(client, (to) => calls.push(`go:${to}`));
    expect(SIGN_OUT_HOME).toBe('/');
    expect(calls).toEqual(['signOut:local', 'go:/']);
  });

  it('still goes to HOME when there is no database (the demo)', async () => {
    const go = vi.fn();
    await signOutAndLeave(null, go);
    expect(go).toHaveBeenCalledWith('/');
  });

  it('still goes to HOME when the sign-out throws', async () => {
    const go = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await signOutAndLeave({ auth: { signOut: async () => { throw new Error('offline'); } } }, go);
    expect(go).toHaveBeenCalledWith('/');
    error.mockRestore();
  });
});

describe('Sign in with GitHub', () => {
  it('starts the GitHub sign-in, returning through /app/callback', async () => {
    const start = vi.fn(async () => null);
    const supabase = { url: 'http://127.0.0.1:54321', key: 'anon' };
    expect(await signInFromBar(supabase, 'https://omni.test', start)).toBeNull();
    expect(APP_CALLBACK).toBe('/app/callback');
    expect(start).toHaveBeenCalledWith(supabase, 'https://omni.test/app/callback');
  });

  it('says why when it could not start', async () => {
    const start = async () => 'GitHub sign-in could not start: down';
    expect(await signInFromBar({ url: 'u', key: 'k' }, 'https://omni.test', start)).toBe('GitHub sign-in could not start: down');
  });

  it('says so when this deployment has no database', async () => {
    const start = vi.fn(async () => null);
    expect(await signInFromBar(null, 'https://omni.test', start)).toMatch(/not open here/);
    expect(start).not.toHaveBeenCalled();
  });
});

describe('the avatar\'s fallback', () => {
  it('is the first letter of the name, then the login, upper-cased', () => {
    expect(initialOf({ name: 'ada Lovelace', login: 'ada' })).toBe('A');
    expect(initialOf({ name: null, login: 'grace' })).toBe('G');
    expect(initialOf({ name: null, login: null })).toBe('?');
  });
});

describe('My profile (PRD 698)', () => {
  it('opens /app/people/<login>, the login in lower case', () => {
    expect(profileHref('ada')).toBe('/app/people/ada');
    expect(profileHref('Grace-Hopper')).toBe('/app/people/grace-hopper');
  });

  it('is absent without a login', () => {
    expect(profileHref(null)).toBeNull();
    expect(profileHref('')).toBeNull();
  });

  it('is reached by the arrow keys, Home and End, between the two items', () => {
    expect(buttonKey('ArrowDown', 2)).toEqual({ kind: 'open', index: 0 });
    expect(menuKey('ArrowDown', 0, 2)).toEqual({ kind: 'focus', index: 1 });
    expect(menuKey('ArrowUp', 1, 2)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKey('Home', 1, 2)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKey('End', 0, 2)).toEqual({ kind: 'focus', index: 1 });
  });
});
