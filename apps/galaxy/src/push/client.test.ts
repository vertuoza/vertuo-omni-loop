import { describe, expect, it } from 'vitest';
import { fakeBrowser, SUBSCRIPTION } from './browser.fake';
import { ALERT_LINE, saveChannels, subscribeThisDevice, thisDeviceSubscribed, unsubscribeThisDevice } from './client';

// The profile's alert switches in the browser, on a fake browser (PRD 1322 s9): a device subscribed
// with the VAPID public key and stored, its subscription reused when it has one, refused when the
// person blocks notifications; unsubscribed on the server first, then in the browser; the switches
// saved, and every failure said in plain words, never thrown.

const KEY = 'AQID';

describe('subscribeThisDevice', () => {
  it('asks for permission, registers /sw.js, subscribes with the public key and stores the device, labelled', async () => {
    const { browser, sent, events } = fakeBrowser();
    expect(await subscribeThisDevice(browser, KEY)).toEqual({ ok: true, value: true });
    expect(events).toEqual(['permission', 'register', 'subscribe true 1,2,3']);
    expect(sent).toEqual([{
      method: 'POST', path: '/api/push/subscription',
      body: { endpoint: SUBSCRIPTION.endpoint, keys: SUBSCRIPTION.keys, label: 'iPhone · Safari' },
    }]);
  });

  it('reuses the subscription this device holds already', async () => {
    const { browser, sent, events } = fakeBrowser({ existing: true });
    expect((await subscribeThisDevice(browser, KEY)).ok).toBe(true);
    expect(events).toEqual(['permission', 'register']);
    expect(sent).toHaveLength(1);
  });

  it('notifications blocked: says so, and subscribes nothing', async () => {
    const { browser, sent, events } = fakeBrowser({ permission: 'denied' });
    expect(await subscribeThisDevice(browser, KEY)).toEqual({ ok: false, message: ALERT_LINE.denied });
    expect(events).toEqual(['permission']);
    expect(sent).toEqual([]);
  });

  it('the route refusing: says its reason', async () => {
    const { browser } = fakeBrowser({ answer: () => ({ status: 401, body: { error: 'Sign in first.' } }) });
    expect(await subscribeThisDevice(browser, KEY)).toEqual({ ok: false, message: 'Sign in first.' });
  });

  it('the browser failing: says it could not, never throws', async () => {
    const { browser } = fakeBrowser();
    browser.register = () => Promise.reject(new Error('no service worker'));
    expect(await subscribeThisDevice(browser, KEY)).toEqual({ ok: false, message: ALERT_LINE.failed });
  });
});

describe('unsubscribeThisDevice', () => {
  it('removes the device on the server, then in the browser', async () => {
    const { browser, sent, events } = fakeBrowser({ existing: true });
    expect(await unsubscribeThisDevice(browser)).toEqual({ ok: true, value: true });
    expect(sent).toEqual([{ method: 'DELETE', path: '/api/push/subscription', body: { endpoint: SUBSCRIPTION.endpoint } }]);
    expect(events).toEqual(['unsubscribe']);
    expect(await thisDeviceSubscribed(browser)).toBe(false);
  });

  it('nothing subscribed here: nothing to do', async () => {
    const { browser, sent } = fakeBrowser({ registered: false });
    expect(await unsubscribeThisDevice(browser)).toEqual({ ok: true, value: true });
    expect(sent).toEqual([]);
  });

  it('the route refusing: the browser keeps its subscription', async () => {
    const { browser, events } = fakeBrowser({ existing: true, answer: () => ({ status: 500, body: { error: 'The database could not answer. Try again.' } }) });
    expect(await unsubscribeThisDevice(browser)).toEqual({ ok: false, message: 'The database could not answer. Try again.' });
    expect(events).toEqual([]);
  });
});

describe('thisDeviceSubscribed', () => {
  it('is whether /sw.js holds a subscription', async () => {
    expect(await thisDeviceSubscribed(fakeBrowser({ existing: true }).browser)).toBe(true);
    expect(await thisDeviceSubscribed(fakeBrowser().browser)).toBe(false);
    expect(await thisDeviceSubscribed(fakeBrowser({ registered: false }).browser)).toBe(false);
  });
});

describe('saveChannels', () => {
  it('posts both switches and answers them as stored', async () => {
    const { browser, sent } = fakeBrowser();
    expect(await saveChannels(browser, { push: false, email: true })).toEqual({ ok: true, value: { push: false, email: true } });
    expect(sent).toEqual([{ method: 'POST', path: '/api/push/channels', body: { push: false, email: true } }]);
  });

  it('a refusal says its reason; an answer it cannot read says it could not save', async () => {
    const refused = fakeBrowser({ answer: () => ({ status: 401, body: { error: 'Sign in first.' } }) });
    expect(await saveChannels(refused.browser, { push: true, email: true })).toEqual({ ok: false, message: 'Sign in first.' });
    const odd = fakeBrowser({ answer: () => ({ status: 200, body: { what: 1 } }) });
    expect(await saveChannels(odd.browser, { push: true, email: true })).toEqual({ ok: false, message: ALERT_LINE.notSaved });
  });

  it('the network failing: says it could not save', async () => {
    const { browser } = fakeBrowser();
    browser.fetch = () => Promise.reject(new Error('offline'));
    expect(await saveChannels(browser, { push: true, email: true })).toEqual({ ok: false, message: ALERT_LINE.notSaved });
  });
});
