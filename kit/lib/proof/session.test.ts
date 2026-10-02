import { describe, expect, it } from 'vitest';
import { SessionRefused, storageState } from './session.ts';
import type { StateCookie } from './session.ts';
import { assertDefined } from '../../test/assert.ts';

const REF = 'fzskrlcmmzvvxaeebezc';
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);
const EXP = NOW / 1000 + 3600;
const jwt = (claims: Record<string, unknown>) => ['h', Buffer.from(JSON.stringify(claims)).toString('base64url'), 's'].join('.');
const TOKEN = jwt({ iss: `https://${REF}.supabase.co/auth/v1`, sub: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'pat@acme.test', exp: EXP, app_metadata: {}, user_metadata: { user_name: 'pat' } });

/** The session a cookie carries, read back the way @supabase/ssr reads it. */
const sessionOf = (cookies: StateCookie[]) => JSON.parse(Buffer.from(cookies.map((c) => c.value).join('').replace(/^base64-/, ''), 'base64url').toString());

describe('storageState', () => {
  it('turns the omni sign-in into the app\'s own auth cookie, on the app\'s host, until the token expires', () => {
    const { state, email, expiresAt } = storageState(TOKEN, { host: 'omni.example', now: NOW });
    expect(state.origins).toEqual([]);
    expect(state.cookies).toHaveLength(1);
    expect(state.cookies[0]).toMatchObject({ name: `sb-${REF}-auth-token`, domain: 'omni.example', path: '/', expires: EXP, secure: true, sameSite: 'Lax' });
    assertDefined(state.cookies[0], 'state.cookies[0]');
    expect(state.cookies[0].value.startsWith('base64-')).toBe(true);
    expect(email).toBe('pat@acme.test');
    expect(expiresAt).toBe(EXP);
  });

  it('carries the access token and never the refresh token, so the browser cannot rotate the CLI\'s sign-in', () => {
    const session = sessionOf(storageState(TOKEN, { host: 'omni.example', now: NOW }).state.cookies);
    expect(session).toMatchObject({ access_token: TOKEN, refresh_token: '', token_type: 'bearer', expires_at: EXP, expires_in: 3600 });
    expect(session.user).toMatchObject({ id: 'u-1', email: 'pat@acme.test', user_metadata: { user_name: 'pat' } });
  });

  it('splits a long session into numbered cookies of at most 3180 characters, as @supabase/ssr does', () => {
    const big = jwt({ iss: `https://${REF}.supabase.co/auth/v1`, sub: 'u-1', exp: EXP, user_metadata: { pad: 'x'.repeat(4000) } });
    const { cookies } = storageState(big, { host: 'omni.example', now: NOW }).state;
    expect(cookies.length).toBeGreaterThan(1);
    expect(cookies.map((c) => c.name)).toEqual(cookies.map((_, i) => `sb-${REF}-auth-token.${i}`));
    expect(Math.max(...cookies.map((c) => c.value.length))).toBeLessThanOrEqual(3180);
    expect(sessionOf(cookies).access_token).toBe(big);
  });

  it('refuses a token that is not a Supabase sign-in, or has expired', () => {
    expect(() => storageState('not-a-jwt', { host: 'omni.example', now: NOW })).toThrow(SessionRefused);
    expect(() => storageState(jwt({ iss: 'https://example.com', exp: EXP }), { host: 'omni.example', now: NOW })).toThrow(SessionRefused);
    expect(() => storageState(jwt({ iss: `https://${REF}.supabase.co/auth/v1`, exp: NOW / 1000 - 1 }), { host: 'omni.example', now: NOW })).toThrow(SessionRefused);
  });
});
