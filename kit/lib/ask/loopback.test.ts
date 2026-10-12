import { connect } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { LoopbackError, startLoopback, startTokenLoopback } from './loopback.ts';

const STATE = 'state-0123456789abcdef';

let listener: Awaited<ReturnType<typeof startLoopback>> | undefined;
let tokens: Awaited<ReturnType<typeof startTokenLoopback>> | undefined;
afterEach(async () => {
  await listener?.close();
  await tokens?.close();
  listener = undefined;
  tokens = undefined;
});

const get = (port: number, path: string) => fetch(`http://127.0.0.1:${port}${path}`);

/** Whether anything still accepts a connection on the port. */
function accepts(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

describe('the loopback listener omni signin starts', () => {
  it('listens on 127.0.0.1 only, at a port of its own', async () => {
    listener = await startLoopback({ state: STATE });
    const other = await startLoopback({ state: STATE });
    expect(listener.address).toBe('127.0.0.1');
    expect(listener.port).toBeGreaterThan(0);
    expect(other.port).not.toBe(listener.port);
    await other.close();
  });

  it('catches the code of a callback carrying its state, answers the browser, then closes', async () => {
    listener = await startLoopback({ state: STATE });
    const response = await get(listener.port, `/callback?state=${STATE}&code=one-time-code`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    expect(await response.text()).toMatch(/terminal/);
    await expect(listener.code).resolves.toBe('one-time-code');
    await listener.closed;
    expect(await accepts(listener.port)).toBe(false);
  });

  it('refuses a callback whose state does not match, and keeps waiting for the right one', async () => {
    listener = await startLoopback({ state: STATE });
    const caught: string[] = [];
    listener.code.then((code) => caught.push(code), () => {});
    for (const state of ['state-somebody-else', '', STATE.slice(0, -1), `${STATE}x`]) {
      const refused = await get(listener.port, `/callback?state=${encodeURIComponent(state)}&code=planted`);
      expect(refused.status).toBe(400);
      expect(await refused.text()).toMatch(/not started by this terminal/);
    }
    expect(await get(listener.port, '/callback?code=planted').then((r) => r.status)).toBe(400);
    expect(caught).toEqual([]);
    await get(listener.port, `/callback?state=${STATE}&code=the-real-one`);
    await expect(listener.code).resolves.toBe('the-real-one');
  });

  it('refuses a callback without a code, and anything but GET /callback', async () => {
    listener = await startLoopback({ state: STATE });
    expect((await get(listener.port, `/callback?state=${STATE}`)).status).toBe(400);
    expect((await get(listener.port, '/favicon.ico')).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${listener.port}/callback?state=${STATE}&code=c`, { method: 'POST' })).status).toBe(404);
    expect(await accepts(listener.port)).toBe(true);
  });

  it('gives up after its wait, and stops listening', async () => {
    listener = await startLoopback({ state: STATE, timeoutMs: 50 });
    await expect(listener.code).rejects.toBeInstanceOf(LoopbackError);
    await expect(listener.code).rejects.toThrow(/no sign-in came back/);
    await listener.closed;
    expect(await accepts(listener.port)).toBe(false);
  });

  it('stops listening when closed before a callback, and the wait ends', async () => {
    listener = await startLoopback({ state: STATE });
    await listener.close();
    await expect(listener.code).rejects.toThrow(/stopped/);
    expect(await accepts(listener.port)).toBe(false);
  });

  it('needs a state to compare with', async () => {
    await expect(startLoopback({ state: '' })).rejects.toThrow(/state/);
  });
});

const TOKEN = 'omk_Zq9xW3vK7pL2mN8bR4tY6uJ1hG5fD0sA_-cE3iO9wQv';
const EXPIRES = '2027-01-09T10:00:00.000Z';
const tokenQuery = (over: Record<string, string> = {}) => new URLSearchParams({ state: STATE, token: TOKEN, expires_at: EXPIRES, ...over }).toString();

describe('the loopback listener omni setup-token starts (PRD 1628)', () => {
  it('catches the token and its expiry of a callback carrying its state, answers the browser, then closes', async () => {
    tokens = await startTokenLoopback({ state: STATE });
    expect(tokens.address).toBe('127.0.0.1');
    expect(tokens.redirectUri).toBe(`http://127.0.0.1:${tokens.port}/callback`);
    const response = await get(tokens.port, `/callback?${tokenQuery()}`);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/terminal has your token/);
    expect(body).not.toContain(TOKEN);
    await expect(tokens.token).resolves.toEqual({ token: TOKEN, expiresAt: EXPIRES });
    await tokens.closed;
    expect(await accepts(tokens.port)).toBe(false);
  });

  it('refuses a callback whose state does not match, and keeps waiting for the right one', async () => {
    tokens = await startTokenLoopback({ state: STATE });
    const caught: unknown[] = [];
    tokens.token.then((made) => caught.push(made), () => {});
    for (const state of ['state-somebody-else', '', `${STATE}x`]) {
      const refused = await get(tokens.port, `/callback?${tokenQuery({ state })}`);
      expect(refused.status).toBe(400);
      const body = await refused.text();
      expect(body).toMatch(/not asked for by this terminal/);
      expect(body).toMatch(/omni setup-token/);
    }
    expect(caught).toEqual([]);
    await get(tokens.port, `/callback?${tokenQuery()}`);
    await expect(tokens.token).resolves.toEqual({ token: TOKEN, expiresAt: EXPIRES });
  });

  it('refuses a callback without a well-formed token or a readable expiry, and a code instead of a token', async () => {
    tokens = await startTokenLoopback({ state: STATE });
    const bad = [
      `state=${STATE}&expires_at=${EXPIRES}`,
      tokenQuery({ token: 'omk_short' }),
      tokenQuery({ token: `omb_${TOKEN.slice(4)}` }),
      tokenQuery({ token: `${TOKEN}x` }),
      `state=${STATE}&token=${TOKEN}`,
      tokenQuery({ expires_at: 'someday' }),
      `state=${STATE}&code=one-time-code`,
    ];
    for (const query of bad) {
      const refused = await get(tokens.port, `/callback?${query}`);
      expect(refused.status).toBe(400);
      expect(await refused.text()).toMatch(/came back incomplete/);
    }
    expect(await accepts(tokens.port)).toBe(true);
  });

  it('never takes a token on the sign-in listener', async () => {
    listener = await startLoopback({ state: STATE });
    expect((await get(listener.port, `/callback?${tokenQuery()}`)).status).toBe(400);
    expect(await accepts(listener.port)).toBe(true);
  });

  it('gives up after its wait, naming the token', async () => {
    tokens = await startTokenLoopback({ state: STATE, timeoutMs: 50 });
    await expect(tokens.token).rejects.toBeInstanceOf(LoopbackError);
    await expect(tokens.token).rejects.toThrow(/no token came back/);
    await tokens.closed;
  });

  it('stops listening when closed before a callback', async () => {
    tokens = await startTokenLoopback({ state: STATE });
    await tokens.close();
    await expect(tokens.token).rejects.toThrow(/stopped before a token came back/);
    expect(await accepts(tokens.port)).toBe(false);
  });

  it('needs a state to compare with', async () => {
    await expect(startTokenLoopback({ state: '' })).rejects.toThrow(/state/);
  });
});
