import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const signInWithOAuth = vi.hoisted(() => vi.fn<(options: unknown) => Promise<{ data: object; error: null | { message: string } }>>(() => Promise.resolve({ data: {}, error: null })));
vi.mock('@supabase/ssr', () => ({ createBrowserClient: () => ({ auth: { signInWithOAuth } }) }));

const { GITHUB_SCOPES, githubSignIn, startGithubSignIn } = await import('./sign-in-github');

const GALAXY = new URL('../..', import.meta.url).pathname;

/** Every source file of the app, tests and generated folders left out. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (['node_modules', '.next', 'dist', 'out'].includes(name)) return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('starting a sign-in', () => {
  it('is GitHub, asking for read:org, and nothing that filters the account chooser', () => {
    expect(githubSignIn('https://galaxy.example/auth/callback')).toEqual({
      provider: 'github',
      options: { redirectTo: 'https://galaxy.example/auth/callback', scopes: 'read:org' },
    });
    expect(GITHUB_SCOPES).toBe('read:org');
  });

  it('started by the server (sign-up signs the visitor in again), answers GitHub\'s address instead of leaving', () => {
    expect(githubSignIn('https://galaxy.example/signup/installed/callback', { fromServer: true })).toEqual({
      provider: 'github',
      options: { redirectTo: 'https://galaxy.example/signup/installed/callback', scopes: 'read:org', skipBrowserRedirect: true },
    });
  });

  it('leaves for GitHub from a sign-in card, coming back to the card\'s callback', async () => {
    signInWithOAuth.mockClear();
    expect(await startGithubSignIn({ url: 'https://db.example.com', key: 'k' }, 'https://galaxy.example/ask/callback')).toBeNull();
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'github', options: { redirectTo: 'https://galaxy.example/ask/callback', scopes: 'read:org' } });
  });

  it('for a voter (PRD 1246), asks for no read:org: a voter needs no workspace', async () => {
    expect(githubSignIn('https://galaxy.example/auth/callback?next=ideas', { orgs: false })).toEqual({
      provider: 'github',
      options: { redirectTo: 'https://galaxy.example/auth/callback?next=ideas' },
    });
    signInWithOAuth.mockClear();
    expect(await startGithubSignIn({ url: 'https://db.example.com', key: 'k' }, 'https://galaxy.example/auth/callback?next=ideas', { orgs: false })).toBeNull();
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'github', options: { redirectTo: 'https://galaxy.example/auth/callback?next=ideas' } });
  });

  it('says why when GitHub sign-in could not start', async () => {
    signInWithOAuth.mockResolvedValueOnce({ data: {}, error: { message: 'provider is not enabled' } });
    expect(await startGithubSignIn({ url: 'https://db.example.com', key: 'k' }, '/x')).toBe('GitHub sign-in could not start: provider is not enabled');
  });
});

describe('galaxy\'s sources (acceptance criterion 9)', () => {
  const files = [...sources(join(GALAXY, 'src')), ...sources(join(GALAXY, 'app'))];

  it('never start a Google sign-in, nor set hd', () => {
    const offenders = files.filter((path) => /provider:\s*['"]google['"]|\bhd:\s*['"]/.test(readFileSync(path, 'utf8')));
    expect(offenders.map((path) => relative(GALAXY, path))).toEqual([]);
  });

  it('start every sign-in through githubSignIn', () => {
    const direct = files.filter((path) => /signInWithOAuth\(\{/.test(readFileSync(path, 'utf8')));
    expect(direct.map((path) => relative(GALAXY, path))).toEqual([]);
  });
});
