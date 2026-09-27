import { describe, it, expect } from 'vitest';
import {
  callbackPath, FOR_ME_CALLBACK, forMeSignInReturn, HISTORY_CALLBACK, historySignInReturn, isSessionId, questionCallbackPath, questionSignInReturn, requestOrigin, signInReturn,
} from './sign-in';

const ID = '7c1e2a94-0b1d-4c3e-9f00-1234567890ab';
const ORIGIN = 'https://galaxy.example';
const callback = (query: string) => new URL(`${ORIGIN}${callbackPath(ID)}${query}`);

describe('signing in from an ask page', () => {
  it('asks Google to come back to this session', () => {
    expect(callbackPath(ID)).toBe(`/ask/${ID}/callback`);
  });

  it('comes back to the same session once the code is exchanged', async () => {
    const codes: string[] = [];
    const exchange = async (code: string) => { codes.push(code); return { error: null }; };
    expect(await signInReturn(callback('?code=abc'), ORIGIN, ID, exchange)).toBe(`${ORIGIN}/ask/${ID}`);
    expect(codes).toEqual(['abc']);
  });

  it("comes back with Google's or Supabase's reason when the sign-in was refused", async () => {
    const exchange = async () => ({ error: null });
    const back = new URL(await signInReturn(callback('?error=access_denied&error_description=Only+%40vertuoza.com+accounts'), ORIGIN, ID, exchange));
    expect(back.pathname).toBe(`/ask/${ID}`);
    expect(back.searchParams.get('signin_error')).toBe('Only @vertuoza.com accounts');
  });

  it('says so when the code cannot be exchanged', async () => {
    const exchange = async () => ({ error: { message: 'invalid flow state' } });
    const back = new URL(await signInReturn(callback('?code=stale'), ORIGIN, ID, exchange));
    expect(back.pathname).toBe(`/ask/${ID}`);
    expect(back.searchParams.get('signin_error')).toBe('That sign-in could not be finished. Start again from this browser.');
  });

  it('comes straight back without a code, or without a database', async () => {
    expect(await signInReturn(callback(''), ORIGIN, ID, async () => ({ error: null }))).toBe(`${ORIGIN}/ask/${ID}`);
    expect(await signInReturn(callback('?code=abc'), ORIGIN, ID, null)).toBe(`${ORIGIN}/ask/${ID}`);
  });

  it('goes home, on this site, for anything that is not a session id', async () => {
    for (const id of ['..', '../auth/callback', 'https://evil.example', '']) {
      const back = new URL(await signInReturn(new URL(`${ORIGIN}/ask/x/callback?code=abc`), ORIGIN, id, async () => ({ error: null })));
      expect(back.origin, id).toBe(ORIGIN);
      expect(back.pathname, id).toBe('/');
    }
  });
});

describe("signing in from the person's page, /ask", () => {
  it('asks Google to come back to /ask/callback, and goes back to /ask', async () => {
    expect(callbackPath(null)).toBe('/ask/callback');
    const codes: string[] = [];
    const exchange = async (code: string) => { codes.push(code); return { error: null }; };
    expect(await signInReturn(new URL(`${ORIGIN}/ask/callback?code=abc`), ORIGIN, null, exchange)).toBe(`${ORIGIN}/ask`);
    expect(codes).toEqual(['abc']);
  });

  it('comes back to /ask with the reason when the sign-in was refused', async () => {
    const back = new URL(await signInReturn(new URL(`${ORIGIN}/ask/callback?error=access_denied`), ORIGIN, null, null));
    expect(back.pathname).toBe('/ask');
    expect(back.searchParams.get('signin_error')).toBe('access_denied');
  });
});

describe('a session id', () => {
  it('is a uuid', () => {
    expect(isSessionId(ID)).toBe(true);
    expect(isSessionId(ID.toUpperCase())).toBe(true);
    for (const id of ['', 'demo', `${ID}x`, '7c1e2a94-0b1d-4c3e-9f00']) expect(isSessionId(id), id).toBe(false);
  });
});

describe('the address the person came from', () => {
  it('is the one the browser used, behind a proxy too', () => {
    const request = (url: string, headers: Record<string, string> = {}) => ({ url, headers: new Headers(headers) });
    expect(requestOrigin(request('http://10.0.0.1:3000/ask/x/callback', { 'x-forwarded-host': 'galaxy.example', 'x-forwarded-proto': 'https' }))).toBe('https://galaxy.example');
    expect(requestOrigin(request('http://localhost:3000/ask/x/callback', { host: 'localhost:3000' }))).toBe('http://localhost:3000');
    expect(requestOrigin(request('http://localhost:3000/ask/x/callback'))).toBe('http://localhost:3000');
  });
});

describe('signing in from a shared question, or For me (PRD 144)', () => {
  const exchange = async () => ({ error: null });

  it('comes back to the same question', async () => {
    expect(questionCallbackPath(ID)).toBe(`/ask/q/${ID}/callback`);
    expect(await questionSignInReturn(new URL(`${ORIGIN}${questionCallbackPath(ID)}?code=abc`), ORIGIN, ID, exchange)).toBe(`${ORIGIN}/ask/q/${ID}`);
    expect(await questionSignInReturn(new URL(`${ORIGIN}/ask/q/x/callback?code=abc`), ORIGIN, '//evil.example', exchange)).toBe(`${ORIGIN}/`);
  });

  it('comes back to For me, with the reason when the sign-in was refused', async () => {
    expect(FOR_ME_CALLBACK).toBe('/ask/for-me/callback');
    const back = new URL(await forMeSignInReturn(new URL(`${ORIGIN}${FOR_ME_CALLBACK}?error=access_denied`), ORIGIN, exchange));
    expect(back.pathname).toBe('/ask/for-me');
    expect(back.searchParams.get('signin_error')).toBe('access_denied');
  });

  it('comes back to the history', async () => {
    expect(HISTORY_CALLBACK).toBe('/ask/history/callback');
    expect(await historySignInReturn(new URL(`${ORIGIN}${HISTORY_CALLBACK}?code=abc`), ORIGIN, exchange)).toBe(`${ORIGIN}/ask/history`);
  });
});
