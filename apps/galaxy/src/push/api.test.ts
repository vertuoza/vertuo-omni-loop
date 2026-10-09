import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIGN_IN_FIRST, setChannelsRoute, subscribeRoute, unsubscribeRoute, type AlertRouteDeps } from './api';
import type { AlertChannels, PushDevice } from './device';
import type { AlertStore } from './store';

// The profile page's alert routes on a fake store (PRD 1322 s9): both switches saved as sent, this
// device subscribed and unsubscribed, each as the signed-in person only; a signed-out caller gets 401
// and nothing is written; a malformed body gets 400; a database failure gets 500 and one log line.

const ME = 'u-ada';
const DEVICE: PushDevice = { endpoint: 'https://push.example/ada-phone', keys: { p256dh: 'BPk1', auth: 'au1' }, label: 'iPhone · Safari' };

function fakeStore(fail = false) {
  const calls: unknown[][] = [];
  const act = <T>(call: unknown[], value: T) => {
    calls.push(call);
    return fail ? Promise.reject(new Error('down')) : Promise.resolve(value);
  };
  const store: AlertStore = {
    channels: (userId) => act(['channels', userId], { push: false, email: false }),
    setChannels: (userId, channels: AlertChannels) => act(['setChannels', userId, channels], channels),
    subscribe: (userId, device) => act(['subscribe', userId, device], undefined),
    unsubscribe: (userId, endpoint) => act(['unsubscribe', userId, endpoint], undefined),
  };
  return { store, calls };
}

function deps(signedIn = true, fail = false): { deps: AlertRouteDeps; calls: unknown[][] } {
  const { store, calls } = fakeStore(fail);
  return { deps: { session: () => Promise.resolve(signedIn ? { userId: ME, store } : null) }, calls };
}

const send = (method: string, path: string, body: unknown) =>
  new Request(`https://galaxy.test${path}`, { method, headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/push/channels', () => {
  it('saves both switches as the signed-in person and answers them', async () => {
    const { deps: d, calls } = deps();
    const res = await setChannelsRoute(send('POST', '/api/push/channels', { push: true, email: false }), d);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ channels: { push: true, email: false } });
    expect(calls).toEqual([['setChannels', ME, { push: true, email: false }]]);
  });

  it('refuses a body missing a switch, a switch that is not a boolean, or no JSON', async () => {
    for (const body of [{ push: true }, { push: 'on', email: false }, 'not json', { push: true, email: false, sms: true }]) {
      const { deps: d, calls } = deps();
      const res = await setChannelsRoute(send('POST', '/api/push/channels', body), d);
      expect(res.status).toBe(400);
      expect(calls).toEqual([]);
    }
  });

  it('signed out: 401, and nothing is saved', async () => {
    const { deps: d, calls } = deps(false);
    const res = await setChannelsRoute(send('POST', '/api/push/channels', { push: true, email: true }), d);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: SIGN_IN_FIRST });
    expect(calls).toEqual([]);
  });

  it('the database failing: 500 and one log line', async () => {
    const { deps: d } = deps(true, true);
    const res = await setChannelsRoute(send('POST', '/api/push/channels', { push: true, email: true }), d);
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith('push: saving the channels failed (down)');
  });
});

describe('POST /api/push/subscription', () => {
  it('stores this device\'s subscription as the signed-in person', async () => {
    const { deps: d, calls } = deps();
    const res = await subscribeRoute(send('POST', '/api/push/subscription', DEVICE), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: true });
    expect(calls).toEqual([['subscribe', ME, DEVICE]]);
  });

  it('keeps only the endpoint, the two keys and the label of what the browser sent', async () => {
    const { deps: d, calls } = deps();
    await subscribeRoute(send('POST', '/api/push/subscription', { ...DEVICE, expirationTime: null }), d);
    expect(calls).toEqual([['subscribe', ME, DEVICE]]);
  });

  it('refuses an endpoint that is not https, or a missing key', async () => {
    for (const body of [{ ...DEVICE, endpoint: 'http://push.example/x' }, { ...DEVICE, keys: { auth: 'a' } }, {}]) {
      const { deps: d, calls } = deps();
      expect((await subscribeRoute(send('POST', '/api/push/subscription', body), d)).status).toBe(400);
      expect(calls).toEqual([]);
    }
  });

  it('signed out: 401, and nothing is stored', async () => {
    const { deps: d, calls } = deps(false);
    expect((await subscribeRoute(send('POST', '/api/push/subscription', DEVICE), d)).status).toBe(401);
    expect(calls).toEqual([]);
  });
});

describe('DELETE /api/push/subscription', () => {
  it('removes this device\'s subscription as the signed-in person', async () => {
    const { deps: d, calls } = deps();
    const res = await unsubscribeRoute(send('DELETE', '/api/push/subscription', { endpoint: DEVICE.endpoint }), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: false });
    expect(calls).toEqual([['unsubscribe', ME, DEVICE.endpoint]]);
  });

  it('refuses a body with no https endpoint', async () => {
    const { deps: d, calls } = deps();
    expect((await unsubscribeRoute(send('DELETE', '/api/push/subscription', { endpoint: 'ftp://x' }), d)).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('signed out: 401, and nothing is removed', async () => {
    const { deps: d, calls } = deps(false);
    expect((await unsubscribeRoute(send('DELETE', '/api/push/subscription', { endpoint: DEVICE.endpoint }), d)).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('the database failing: 500 and one log line', async () => {
    const { deps: d } = deps(true, true);
    expect((await unsubscribeRoute(send('DELETE', '/api/push/subscription', { endpoint: DEVICE.endpoint }), d)).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith('push: unsubscribing a device failed (down)');
  });
});
