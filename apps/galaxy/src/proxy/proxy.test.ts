import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config } from '../../proxy';
import { refreshSession } from './session';

vi.mock('server-only', () => ({}));

// The proxy (PRD 657 s2): it keeps the session fresh before a page renders, through
// auth.getClaims() (a local JWT check with asymmetric keys, never slower than getUser), and it does
// not run for the API's polls and routes, nor for static files. Tested on the matcher's own pattern
// and on a fake client, never on Supabase.

/** Whether the matcher's pattern covers `path`, the way Next reads it: the whole path. */
const covers = (path: string) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe('the proxy matcher', () => {
  it.each(['/', '/app', '/app/workspace', '/app/fleet', '/prd', '/prd/1f0c9a2e-8a55-4c55-9a1e-0f5c2d4b7e11', '/ask', '/play', '/apple'])(
    'covers the page %s',
    (path) => {
      expect(covers(path)).toBe(true);
    },
  );

  it.each([
    '/api', '/api/waiting/outbox', '/api/stages/event', '/_next/static/chunks/app.js', '/_next/image', '/favicon.ico',
    '/fonts/anton.woff2', '/fonts/inter.woff', '/styles/app.css', '/mascots/beaver.gif', '/hero.png', '/hero.jpg', '/hero.jpeg',
    '/crest.svg', '/hero.webp', '/hero.avif', '/robots.txt', '/sitemap.xml',
  ])('leaves out %s', (path) => {
    expect(covers(path)).toBe(false);
  });
});

function fakeCreate() {
  const calls = { getClaims: 0, getUser: 0 };
  let cookies: { setAll(list: { name: string; value: string; options?: object }[]): void } | null = null;
  const create = (_url: string, _key: string, options: { cookies: typeof cookies }) => {
    cookies = options.cookies;
    return {
      auth: {
        getClaims() {
          calls.getClaims += 1;
          cookies?.setAll([{ name: 'sb-token', value: 'fresh', options: { path: '/' } }]);
          return Promise.resolve({ data: null, error: null });
        },
        getUser() {
          calls.getUser += 1;
          return Promise.reject(new Error('the proxy never calls getUser'));
        },
      },
    };
  };
  return { create: create as never, calls };
}

describe('refreshSession', () => {
  it('calls getClaims, never getUser, and hands the refreshed cookies to the browser', async () => {
    const { create, calls } = fakeCreate();
    const response = await refreshSession(new NextRequest('https://galaxy.example/app'), { url: 'https://db.example', key: 'anon' }, create);
    expect(calls).toEqual({ getClaims: 1, getUser: 0 });
    expect(response.cookies.get('sb-token')?.value).toBe('fresh');
  });

  it('does nothing without a database', async () => {
    const { create, calls } = fakeCreate();
    const response = await refreshSession(new NextRequest('https://galaxy.example/app'), null, create);
    expect(calls).toEqual({ getClaims: 0, getUser: 0 });
    expect(response.status).toBe(200);
  });
});
