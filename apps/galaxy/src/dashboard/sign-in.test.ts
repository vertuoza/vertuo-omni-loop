import { describe, expect, it, vi } from 'vitest';
import { APP_CALLBACK, dashboardSignInReturn } from './sign-in';

// Signing in from /app (PRD 328): Google comes back to /app/callback, which turns the code into the
// session cookie, joins the workspaces of the account's domain, and goes back to /app, carrying the
// reason when the sign-in was refused.

const ORIGIN = 'https://omni.example';
const back = (query: string) => new URL(`${ORIGIN}/app/callback${query}`);

describe('the way back after signing in on the dashboard', () => {
  it('comes back through /app/callback', () => {
    expect(APP_CALLBACK).toBe('/app/callback');
  });

  it('exchanges the code, joins the account\'s workspaces, then goes back to /app', async () => {
    const steps: string[] = [];
    const exchange = vi.fn(async (code: string) => { steps.push(`exchange ${code}`); return { error: null }; });
    const join = vi.fn(async () => { steps.push('join'); });
    expect(await dashboardSignInReturn(back('?code=abc'), ORIGIN, exchange, join)).toBe(`${ORIGIN}/app`);
    expect(steps).toEqual(['exchange abc', 'join']);
  });

  it('still goes back when joining fails: the page then says the account is in no workspace, never an error', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const join = async () => { throw new Error('down'); };
    expect(await dashboardSignInReturn(back('?code=abc'), ORIGIN, async () => ({ error: null }), join)).toBe(`${ORIGIN}/app`);
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('carries the reason when Google refused, and joins nothing', async () => {
    const join = vi.fn(async () => {});
    const url = new URL(await dashboardSignInReturn(back('?error=access_denied&error_description=Not+allowed'), ORIGIN, async () => ({ error: null }), join));
    expect(url.pathname).toBe('/app');
    expect(url.searchParams.get('signin_error')).toBe('Not allowed');
    expect(join).not.toHaveBeenCalled();
  });

  it('says so when the code could not be exchanged, and joins nothing', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const join = vi.fn(async () => {});
    const url = new URL(await dashboardSignInReturn(back('?code=old'), ORIGIN, async () => ({ error: { message: 'expired' } }), join));
    expect(url.pathname).toBe('/app');
    expect(url.searchParams.get('signin_error')).toBe('That sign-in could not be finished. Start again from this browser.');
    expect(join).not.toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('only ever goes back to /app on this site, whatever the address carries', async () => {
    expect(await dashboardSignInReturn(back('?code=abc&next=https://evil.example'), ORIGIN, async () => ({ error: null }), null)).toBe(`${ORIGIN}/app`);
  });

  it('goes back without exchanging anything when this deployment has no database', async () => {
    expect(await dashboardSignInReturn(back('?code=abc'), ORIGIN, null, null)).toBe(`${ORIGIN}/app`);
  });
});
