import { describe, it, expect } from 'vitest';
import { authenticate, bearerToken, withInstallLink } from './auth';
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

describe('withInstallLink', () => {
  const LINK = 'https://github.com/apps/omni-loop-invader/installations/new';

  it('ends the database\'s "install the Omni App" refusal with the App\'s install link', () => {
    expect(withInstallLink('no workspace owns acme/api yet — install the Omni App', LINK))
      .toBe(`no workspace owns acme/api yet — install the Omni App: ${LINK}`);
  });

  it('leaves every other reason, and a deployment with no link, as they are', () => {
    expect(withInstallLink('you are not a member of Globex, which owns globex/web', LINK)).toBe('you are not a member of Globex, which owns globex/web');
    expect(withInstallLink('no workspace owns acme/api yet — install the Omni App', null)).toBe('no workspace owns acme/api yet — install the Omni App');
  });
});

describe('authenticate', () => {
  const fake = fakeSupabase({ 'ada-token': ADA, 'eve-token': EVE });

  it('answers the account the Auth server vouches for, whatever its address: membership is the database\'s call', async () => {
    expect(await authenticate('Bearer ada-token', fake.client)).toEqual({ ok: true, caller: { ...ADA, token: 'ada-token' } });
    expect(await authenticate('Bearer eve-token', fake.client)).toEqual({ ok: true, caller: { ...EVE, token: 'eve-token' } });
  });

  it('lets through an account with no email, as GitHub allows', async () => {
    const hidden = () => ({ auth: { getUser: () => Promise.resolve({ data: { user: { id: EVE.id, email: null } }, error: null }) } });
    expect(await authenticate('Bearer hidden-token', hidden)).toEqual({ ok: true, caller: { id: EVE.id, email: null, token: 'hidden-token' } });
  });

  it('refuses a missing or unknown token with 401', async () => {
    for (const header of [null, 'Basic x', 'Bearer forged-token']) {
      const result = await authenticate(header, fake.client);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(401);
    }
  });

  it('answers 503, not 401, when the Auth server itself cannot answer', async () => {
    for (const status of [0, 502, 503]) {
      const down = () => ({ auth: { getUser: () => Promise.resolve({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status, message: 'fetch failed' } }) } });
      expect(await authenticate('Bearer ada-token', down)).toMatchObject({ ok: false, status: 503 });
    }
  });
});
