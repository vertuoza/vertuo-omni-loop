import { describe, it, expect } from 'vitest';
import { authenticate, bearerToken, isCrewEmail } from './auth';
import { fakeSupabase } from './store.fake';

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const EVE = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com' };

describe('bearerToken', () => {
  it('reads the token of an Authorization: Bearer header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer   abc')).toBe('abc');
  });

  it('refuses anything else', () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken('')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(bearerToken('Bearer two tokens')).toBeNull();
  });
});

describe('isCrewEmail', () => {
  it('takes @vertuoza.com addresses only, as public.is_crew() does', () => {
    expect(isCrewEmail('ada@vertuoza.com')).toBe(true);
    expect(isCrewEmail('Ada@Vertuoza.COM')).toBe(true);
    expect(isCrewEmail('eve@example.com')).toBe(false);
    expect(isCrewEmail('eve@notvertuoza.com')).toBe(false);
    expect(isCrewEmail('vertuoza.com@example.com')).toBe(false);
    expect(isCrewEmail(null)).toBe(false);
    expect(isCrewEmail(undefined)).toBe(false);
  });
});

describe('authenticate', () => {
  const fake = fakeSupabase({ 'ada-token': ADA, 'eve-token': EVE });

  it('answers the crew account the Auth server vouches for', async () => {
    expect(await authenticate('Bearer ada-token', fake.client)).toEqual({ ok: true, caller: { ...ADA, token: 'ada-token' } });
  });

  it('refuses a missing or unknown token with 401', async () => {
    for (const header of [null, 'Basic x', 'Bearer forged-token']) {
      const result = await authenticate(header, fake.client);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    }
  });

  it('refuses an account outside the crew with 403', async () => {
    const result = await authenticate('Bearer eve-token', fake.client);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it('answers 503, not 401, when the Auth server itself cannot answer', async () => {
    for (const status of [0, 502, 503]) {
      const down = () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status, message: 'fetch failed' } }) } });
      expect(await authenticate('Bearer ada-token', down)).toMatchObject({ ok: false, status: 503 });
    }
  });
});
