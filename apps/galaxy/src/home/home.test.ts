import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { item } from '../ask/test-item';

// HOME at `/`, and the game moved to `/play` (PRD 261). HOME is rendered as the server renders it,
// with every Supabase door stubbed to fail loudly: it must open none of them.
const supabase = vi.hoisted(() => ({
  env: vi.fn(() => null as null | { url: string; key: string }),
  server: vi.fn(() => Promise.reject(new Error('HOME must not reach Supabase'))),
  exchange: vi.fn(() => Promise.resolve({ error: null as null | { message: string } })),
}));
const afterSignIn = vi.hoisted(() => vi.fn(() => Promise.resolve(['signed_in', '1'] as [string, string])));
// The high scores as the build would count them: two counters read, one out of reach.
const highScores = vi.hoisted(() => vi.fn(() => ({ prdsShipped: 21, slicesMerged: 134, decisionsAdopted: '—' as const })));

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: supabase.env,
  supabaseServer: async () => { await supabase.server(); return { auth: { exchangeCodeForSession: supabase.exchange } }; },
  supabaseAs: () => { throw new Error('not in this test'); },
}));
vi.mock('../data/sign-in', async (actual) => ({
  appLanding: (await actual<typeof import('../data/sign-in')>()).appLanding,
  afterSignIn,
  joinBeforeIssue: () => { throw new Error('not in this test'); },
}));
vi.mock('../data/workspace', () => ({ joinByDomain: () => { throw new Error('not in this test'); } }));
vi.mock('./scores', async (actual) => ({ ...(await actual<typeof import('./scores')>()), countHighScores: highScores }));
vi.mock('../ask/cli-code-live', () => ({ cliCallbackDeps: () => { throw new Error('not in this test'); } }));

const ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'OMNI_LOOP_DEMO'] as const;
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

beforeEach(() => {
  for (const k of ENV) Reflect.deleteProperty(process.env, k);
  supabase.env.mockReturnValue(null);
  supabase.server.mockClear();
});
afterEach(() => {
  for (const k of ENV) if (saved[k] === undefined) Reflect.deleteProperty(process.env, k); else process.env[k] = saved[k];
});

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('HOME at /', () => {
  const render = async () => {
    const { default: Page } = await import('../../app/page.tsx');
    return renderToStaticMarkup(Page() as ReactElement);
  };

  it('shows the headline, AGENTS SHIP. YOU STEER.', async () => {
    expect(text(await render())).toContain('AGENTS SHIP. YOU STEER.');
  });

  it('links PRESS START to the game at /play', async () => {
    expect(await render()).toMatch(/<a [^>]*href="\/play"[^>]*>PRESS START<\/a>/);
  });

  it('forwards the arcade\'s old links before anything paints: its script comes first', async () => {
    const html = await render();
    const script = html.indexOf('<script');
    expect(script).toBeGreaterThanOrEqual(0);
    expect(script).toBeLessThan(html.indexOf('<h1'));
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
    expect(text(await render())).toContain('AGENTS SHIP. YOU STEER.');
    expect(supabase.server).not.toHaveBeenCalled();
  });

  it('is the page `/` serves, reading neither the session nor the arcade', () => {
    const source = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/supabase|arcade|cookies|headers/i);
  });
});

// The poster above the fold (PRD 261, reworded by PRD 285): the Star Fox split, a text column beside
// a starfield, saying what the loop is worth.
describe('the poster', () => {
  const render = async () => {
    const { Home } = await import('./Home');
    return renderToStaticMarkup(Home());
  };
  const element = (html: string, attr: string) => new RegExp(`<[a-z]+ [^>]*${attr}[^>]*>`).exec(html)?.[0] ?? '';

  it('carries the kicker, the headline, the pitch, the three promises and the quote, in the column\'s order', async () => {
    const page = text(await render());
    const order = [
      'THE DELIVERY FRAMEWORK FOR CODING AGENTS',
      'AGENTS SHIP. YOU STEER.',
      'Describe the feature once. Coding agents plan it, build it test-first and open the pull requests. Your team owns the product and the rules, and sees every decision the agents took.',
      'ONE FOLDER IN, ONE FOLDER OUT',
      'EVERY DECISION WRITTEN DOWN',
      'A PERSON ALWAYS MERGES',
      '“TO JOIN INSTANTLY, SIGN UP WITH GITHUB!”',
    ].map((line) => page.indexOf(line));
    expect(order.every((at) => at >= 0), String(order)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('makes AGENTS SHIP. YOU STEER. the page\'s one headline', async () => {
    const html = await render();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(text(/<h1[\s\S]*?<\/h1>/.exec(html)?.[0] ?? '')).toBe('AGENTS SHIP. YOU STEER.');
  });

  it('lists the promise strip as three starred items', async () => {
    const html = await render();
    const strip = /<ul class="home-promises"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
    const items = [...strip.matchAll(/<li>[\s\S]*?<\/li>/g)].map(([li]) => text(li));
    expect(items).toEqual(['★ ONE FOLDER IN, ONE FOLDER OUT', '★ EVERY DECISION WRITTEN DOWN', '★ A PERSON ALWAYS MERGES']);
  });

  it('shows OmniMan in his omni-point pose, and the crest in its full form', async () => {
    const html = await render();
    expect(element(html, 'data-pose="omni-point"')).toBeTruthy();
    expect(html).toContain('aria-label="OmniMan pointing at the crest"');
    expect(element(html, 'data-logo="full"')).toBeTruthy();
    expect(html).toContain('aria-label="Omni Loop"');
  });

  it('draws the invaded planet and the starfield on the page itself, with no script', async () => {
    const html = await render();
    const planet = element(html, 'class="home-planet"');
    expect(planet).toMatch(/role="img"/);
    expect(planet).toMatch(/aria-label="[^"]*invasion[^"]*"/);
    expect(html).toMatch(/class="home-planet"[\s\S]*?<svg /);
    expect(html).toMatch(/class="home-stars"[^>]*aria-hidden="true"/);
  });

  it('shows sign-up buttons that are enabled and start the GitHub sign-in: the poster\'s and the order form\'s (PRD 359)', async () => {
    const html = await render();
    const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(([b]) => b);
    const signUp = buttons.filter((b) => /SIGN UP WITH GITHUB/.test(b));
    expect(signUp).toHaveLength(2);
    for (const button of signUp) {
      expect(text(button)).toBe('SIGN UP WITH GITHUB');
      expect(button).not.toMatch(/disabled/);
      expect(button).not.toMatch(/coming soon/i);
      expect(button).toMatch(/type="button"/);
      expect(button).toContain('data-sign-up=""');
      expect(/aria-label="([^"]*)"/.exec(button)?.[1]).toBe('Sign up with GitHub');
    }
  });

  it('leaves SELECT YOUR APP out of the server markup: the controls draw it in the browser, on a click (PRD 932)', async () => {
    const html = await render();
    expect(html).not.toContain('SELECT YOUR APP');
    expect(html).not.toContain('home-select');
    expect(html).not.toContain('REMEMBER MY CHOICE');
    expect(supabase.server).not.toHaveBeenCalled();
  });

  it('carries no hint line under the sign-up buttons, only the empty place the browser draws it in (PRD 932, s4)', async () => {
    const html = await render();
    expect(html).not.toMatch(/Opens the (Omni app|Arcade)/);
    expect(html).not.toContain('data-sign-up-change');
    expect(html).not.toContain('home-signup-hint');
    const slots = [...html.matchAll(/<span\b[^>]*data-sign-up-hint=""[^>]*>([\s\S]*?)<\/span>/g)];
    expect(slots).toHaveLength(2);
    for (const [, inner] of slots) expect(text(inner ?? '')).toBe('SIGN UP WITH GITHUB');
  });

  it('marks PRESS START for the controls, and keeps it a plain link to /play', async () => {
    const html = await render();
    const starts = [...html.matchAll(/<a\b[^>]*>PRESS START<\/a>/g)].map(([a]) => a);
    expect(starts.length).toBeGreaterThan(0);
    for (const a of starts) {
      expect(a).toContain('href="/play"');
      expect(a).toContain('data-press-start=""');
    }
  });

  it('mounts the controls: Enter, the Konami code and CHEAT ACTIVATED! live on HOME', async () => {
    expect(await render()).toMatch(/class="home-cheat"[^>]*role="status"/);
  });

  it('puts the crest, the headline and PRESS START first on a phone, then the planet and the column in its order', () => {
    const css = readFileSync(new URL('./home.css', import.meta.url), 'utf8');
    const phone = /@media \(max-width: 760px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const order = (cls: string) => Number(new RegExp(`\\.${cls} \\{[^}]*order: (-?\\d+)`).exec(phone)?.[1]);
    expect(order('home-crest')).toBeLessThan(order('home-head'));
    expect(order('home-head')).toBeLessThan(order('home-poster .home-start'));
    expect(order('home-planet')).toBeGreaterThan(order('home-poster .home-start'));
    const rest = ['home-kicker', 'home-dots', 'home-pitch', 'home-promises', 'home-quote', 'home-spokes'].map(order);
    for (const at of rest) expect(at).toBeGreaterThan(order('home-planet'));
    expect([...rest].sort((a, b) => a - b), 'the column keeps its order').toEqual(rest);
  });
});

// The magazine spreads under the poster (PRD 285): value first, then the loop's proof, the game and
// the order form. Each spread is its own component, with its own test beside it under spreads/.
describe('the spreads', () => {
  const render = async () => {
    const { Home } = await import('./Home');
    return renderToStaticMarkup(Home());
  };
  const HEADS = [
    'What\'s in it for you?',
    'Strategy guide: the loop, level by level',
    'You see everything',
    'Easy in, easy out',
    'High scores: the loop built this',
    'The game: Entropy you can see',
    'Join the loop!',
  ];

  it('come under the poster, in the spec\'s order, each under its own h2', async () => {
    const html = await render();
    const heads = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(item(m, 1)));
    expect(heads).toEqual(HEADS);
    expect(html.indexOf('<h2')).toBeGreaterThan(html.indexOf('</h1>'));
  });

  it('are composed by Spreads.tsx alone, one component per spread', () => {
    const source = readFileSync(new URL('./spreads/Spreads.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/<section\b|<h2\b/);
    for (const name of ['ForYou', 'StrategyGuide', 'SeeEverything', 'InOut', 'HighScores', 'Game', 'OrderForm']) {
      expect(source, name).toMatch(new RegExp(`from '\\./${name}'`));
    }
  });

  it('link nowhere but the game at /play, the release notes at /releases and the docs at /docs (PRD 346), the pages open without signing in', async () => {
    const html = await render();
    const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(([, href]) => href);
    expect(hrefs).toContain('/play');
    expect(hrefs).toContain('/releases');
    expect(hrefs).toContain('/docs');
    expect(new Set(hrefs)).toEqual(new Set(['/play', '/releases', '/docs']));
    expect(html.match(/<a\b/g)?.length, 'every link has an href').toBe(hrefs.length);
    expect(html).not.toMatch(/<(?:form|area|link)\b[^>]*\b(?:action|href)=/);
  });

  it('name no Nintendo game, console or mark', async () => {
    const page = text(await render());
    expect(page).not.toMatch(/nintendo|snes|super famicom|star fox|mario|zelda|metroid|game boy/i);
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

  it('lands a finished sign-in that picked the Omni app on /app (PRD 932)', async () => {
    supabase.env.mockReturnValue({ url: 'http://127.0.0.1:54321', key: 'anon' });
    supabase.server.mockResolvedValueOnce(undefined as never);
    const back = await callback('?code=github&next=app');
    expect(back.pathname).toBe('/app');
    expect(back.origin).toBe('https://galaxy.example');
  });

  it('never lands on a path taken from next (PRD 932)', async () => {
    supabase.env.mockReturnValue({ url: 'http://127.0.0.1:54321', key: 'anon' });
    for (const next of ['//evil.example', 'https%3A%2F%2Fevil.example', '%2Fapp%2F..%2Fx', 'arcade']) {
      supabase.server.mockResolvedValueOnce(undefined as never);
      const back = await callback(`?code=github&next=${next}`);
      expect(back.origin).toBe('https://galaxy.example');
      expect(back.pathname).toBe('/play');
    }
  });

  it('sends a refused sign-in that picked the Omni app back to /play, with the reason (PRD 932)', async () => {
    const back = await callback('?next=app&error=access_denied&error_description=Nope');
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
