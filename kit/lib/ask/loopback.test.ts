// @ts-nocheck
import { connect } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { LoopbackError, startLoopback } from './loopback.ts';

const STATE = 'state-0123456789abcdef';

let listener;
afterEach(async () => {
  await listener?.close();
  listener = undefined;
});

const get = (port, path) => fetch(`http://127.0.0.1:${port}${path}`);

/** Whether anything still accepts a connection on the port. */
function accepts(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
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
    const caught = [];
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
