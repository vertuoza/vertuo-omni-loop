import { describe, it, expect, vi } from 'vitest';
import { dossierCallbackPath, dossierSignInReturn } from './sign-in';

// Signing in from /prd/<id> (PRD 216): Google comes back to /prd/<id>/callback, which turns the code
// into the session cookie, joins the workspaces of the account's domain, and goes back to the same
// dossier, carrying the reason when the sign-in was refused.

const ID = '00000000-0000-4000-8000-0000000000d1';
const ORIGIN = 'https://omni.example';
const back = (query: string) => new URL(`${ORIGIN}/prd/${ID}/callback${query}`);

describe('the way back after signing in on a dossier', () => {
  it('comes back through the dossier\'s own callback', () => {
    expect(dossierCallbackPath(ID)).toBe(`/prd/${ID}/callback`);
  });

  it('exchanges the code, joins the account\'s workspaces, then goes back to the same dossier', async () => {
    const steps: string[] = [];
    const exchange = vi.fn(async (code: string) => { steps.push(`exchange ${code}`); return { error: null }; });
    const join = vi.fn(async () => { steps.push('join'); });
    expect(await dossierSignInReturn(back('?code=abc'), ORIGIN, ID, exchange, join)).toBe(`${ORIGIN}/prd/${ID}`);
    expect(steps).toEqual(['exchange abc', 'join']);
  });

  it('still goes back when joining fails: the page then says not found, never an error', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const join = async () => { throw new Error('down'); };
    expect(await dossierSignInReturn(back('?code=abc'), ORIGIN, ID, async () => ({ error: null }), join)).toBe(`${ORIGIN}/prd/${ID}`);
    quiet.mockRestore();
  });

  it('carries the reason when Google refused, and joins nothing', async () => {
    const join = vi.fn(async () => {});
    const url = new URL(await dossierSignInReturn(back('?error=access_denied&error_description=Not+allowed'), ORIGIN, ID, async () => ({ error: null }), join));
    expect(url.pathname).toBe(`/prd/${ID}`);
    expect(url.searchParams.get('signin_error')).toBe('Not allowed');
    expect(join).not.toHaveBeenCalled();
  });

  it('says so when the code could not be exchanged, and joins nothing', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const join = vi.fn(async () => {});
    const url = new URL(await dossierSignInReturn(back('?code=old'), ORIGIN, ID, async () => ({ error: { message: 'expired' } }), join));
    expect(url.searchParams.get('signin_error')).toBe('That sign-in could not be finished. Start again from this browser.');
    expect(join).not.toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('goes home, on this site, for anything that is not a dossier id', async () => {
    expect(await dossierSignInReturn(back('?code=abc'), ORIGIN, '..%2F..%2Fevil', async () => ({ error: null }), async () => {})).toBe(`${ORIGIN}/`);
    expect(await dossierSignInReturn(back(''), ORIGIN, 'https://evil.example', null, null)).toBe(`${ORIGIN}/`);
  });

  it('goes back without exchanging anything when this deployment has no database', async () => {
    expect(await dossierSignInReturn(back('?code=abc'), ORIGIN, ID, null, null)).toBe(`${ORIGIN}/prd/${ID}`);
  });
});
