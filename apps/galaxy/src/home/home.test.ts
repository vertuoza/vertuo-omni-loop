import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// HOME at `/`, and the game moved to `/play` (PRD 261). HOME is rendered as the server renders it,
// with every Supabase door stubbed to fail loudly: it must open none of them.
const supabase = vi.hoisted(() => ({
  env: vi.fn(() => null as null | { url: string; key: string }),
  server: vi.fn(async () => { throw new Error('HOME must not reach Supabase'); }),
  exchange: vi.fn(async () => ({ error: null as null | { message: string } })),
}));
const afterSignIn = vi.hoisted(() => vi.fn(async () => ['signed_in', '1'] as [string, string]));

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: supabase.env,
  supabaseServer: async () => { await supabase.server(); return { auth: { exchangeCodeForSession: supabase.exchange } }; },
  supabaseAs: () => { throw new Error('not in this test'); },
}));
vi.mock('../data/sign-in', () => ({ afterSignIn, joinBeforeIssue: () => { throw new Error('not in this test'); } }));
vi.mock('../data/workspace', () => ({ joinByDomain: () => { throw new Error('not in this test'); } }));
vi.mock('../ask/cli-code-live', () => ({ cliCallbackDeps: () => { throw new Error('not in this test'); } }));

const ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'OMNI_LOOP_DEMO'] as const;
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

beforeEach(() => {
  for (const k of ENV) delete process.env[k];
  supabase.env.mockReturnValue(null);
  supabase.server.mockClear();
});
afterEach(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
});

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('HOME at /', () => {
  const render = async () => {
    const { default: Page } = await import('../../app/page.tsx');
    return renderToStaticMarkup((await Page()) as ReactElement);
  };

  it('shows the headline, JOIN THE LOOP!', async () => {
    expect(text(await render())).toContain('JOIN THE LOOP!');
  });

  it('links PRESS START to the game at /play', async () => {
    expect(await render()).toMatch(/<a [^>]*href="\/play"[^>]*>PRESS START<\/a>/);
  });

  it('forwards the arcade\'s old links before anything paints: its script comes first', async () => {
    const html = await render();
    const script = html.indexOf('<script');
    expect(script).toBeGreaterThanOrEqual(0);
    expect(script).toBeLessThan(html.indexOf('JOIN THE LOOP!'));
    expect(html).toContain("location.replace('/play'");
  });

  it('renders with no session and no Supabase settings, and reaches no Supabase at all', async () => {
    await render();
    expect(supabase.server).not.toHaveBeenCalled();
  });

  it('renders the same in a build that has Supabase settings', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    supabase.env.mockReturnValue({ url: 'http://127.0.0.1:54321', key: 'anon' });
    expect(text(await render())).toContain('JOIN THE LOOP!');
    expect(supabase.server).not.toHaveBeenCalled();
  });

  it('is the page `/` serves, reading neither the session nor the arcade', () => {
    const source = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/supabase|arcade|cookies|headers/i);
  });
});

describe('the game at /play', () => {
  it('is today\'s arcade page, moved', async () => {
    const { default: Play } = await import('../../app/play/page.tsx');
    expect(typeof Play).toBe('function');
    const source = readFileSync(new URL('../../app/play/page.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/<ArcadeClient mode="demo"/);
    expect(source).toMatch(/<ArcadeClient mode="closed"/);
    expect(source).toMatch(/<ArcadeClient mode="supabase"/);
  });
});

// The arcade's two returns: Google's sign-in and GitHub's link come back through the auth callback,
// and signing out reloads the page. Both land in the game, not on HOME.
describe('coming back to the game', () => {
  const callback = async (query: string) => {
    const { GET } = await import('../../app/auth/callback/route.ts');
    const { NextRequest } = await import('next/server');
    const res = await GET(new NextRequest(`https://galaxy.example/auth/callback${query}`));
    return new URL(res.headers.get('location') ?? '');
  };

  it('sends a finished sign-in back to /play, with its outcome', async () => {
    supabase.env.mockReturnValue({ url: 'http://127.0.0.1:54321', key: 'anon' });
    supabase.server.mockResolvedValueOnce(undefined as never);
    const back = await callback('?code=google');
    expect(back.pathname).toBe('/play');
    expect(back.searchParams.get('signed_in')).toBe('1');
  });

  it('sends a refused sign-in back to /play, with the reason', async () => {
    const back = await callback('?error=access_denied&error_description=Nope');
    expect(back.pathname).toBe('/play');
    expect(back.searchParams.get('signin_error')).toBe('Nope');
  });

  it('sends a callback without a code back to /play', async () => {
    expect((await callback('')).pathname).toBe('/play');
  });

  it('reloads the arcade at /play after signing out', () => {
    const source = readFileSync(new URL('../arcade/ArcadeApp.tsx', import.meta.url), 'utf8');
    const signOut = /const signOut = useCallback\([\s\S]*?\}, \[account, go\]\);/.exec(source)?.[0];
    expect(signOut).toBeTruthy();
    expect(signOut).toContain("window.location.assign('/play')");
    expect(signOut).not.toContain("window.location.assign('/')");
  });
});
