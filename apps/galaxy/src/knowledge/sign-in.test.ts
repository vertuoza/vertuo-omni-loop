import { describe, it, expect } from 'vitest';
import { knowledgeCallbackPath, knowledgeSignInReturn } from './sign-in';

const ORIGIN = 'https://galaxy.example';
const callback = (query: string) => new URL(`${ORIGIN}/knowledge/callback${query}`);
const ok = async () => ({ error: null });

describe('signing in from the knowledge map', () => {
  it('asks Google to come back through the page’s own callback, carrying the entry the address named', () => {
    expect(knowledgeCallbackPath({})).toBe('/knowledge/callback');
    expect(knowledgeCallbackPath({ domain: 'product', entry: 'BR-PRODUCT-3' })).toBe('/knowledge/callback?domain=product&entry=BR-PRODUCT-3');
    expect(knowledgeCallbackPath({ domain: '', entry: null })).toBe('/knowledge/callback');
  });

  it('comes back to /knowledge once the code is exchanged, on the same entry', async () => {
    const codes: string[] = [];
    const exchange = async (code: string) => { codes.push(code); return { error: null }; };
    expect(await knowledgeSignInReturn(callback('?code=abc&domain=product&entry=BR-PRODUCT-3'), ORIGIN, exchange))
      .toBe(`${ORIGIN}/knowledge?domain=product&entry=BR-PRODUCT-3`);
    expect(codes).toEqual(['abc']);
    expect(await knowledgeSignInReturn(callback('?code=abc'), ORIGIN, ok)).toBe(`${ORIGIN}/knowledge`);
  });

  it("comes back with Google's or Supabase's reason when the sign-in was refused", async () => {
    const back = new URL(await knowledgeSignInReturn(callback('?error=access_denied&error_description=Only+%40vertuoza.com+accounts'), ORIGIN, ok));
    expect(back.pathname).toBe('/knowledge');
    expect(back.searchParams.get('signin_error')).toBe('Only @vertuoza.com accounts');
  });

  it('says so when the code cannot be exchanged', async () => {
    const back = new URL(await knowledgeSignInReturn(callback('?code=stale'), ORIGIN, async () => ({ error: { message: 'invalid flow state' } })));
    expect(back.pathname).toBe('/knowledge');
    expect(back.searchParams.get('signin_error')).toBe('That sign-in could not be finished. Start again from this browser.');
  });

  it('comes straight back without a database', async () => {
    expect(await knowledgeSignInReturn(callback('?code=abc'), ORIGIN, null)).toBe(`${ORIGIN}/knowledge`);
  });

  it('always comes back to /knowledge on this site, carrying nothing but the domain and the entry', async () => {
    const back = new URL(await knowledgeSignInReturn(callback('?code=abc&next=https://evil.example&domain=%2F%2Fevil.example&redirect=%2Fx'), ORIGIN, ok));
    expect(back.origin).toBe(ORIGIN);
    expect(back.pathname).toBe('/knowledge');
    expect([...back.searchParams.keys()]).toEqual(['domain']);
  });
});
