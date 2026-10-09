import { describe, expect, it } from 'vitest';
import { fakeBrowser, SUBSCRIPTION } from '../push/browser.fake';
import { ALERT_LINE } from '../push/client';
import { ALERTS_LINE, emailLabel, phoneHint, turnEmail, turnPhone, type AlertsHeld } from './alerts';

// The profile's two alert switches pressed, on a fake browser (PRD 1322 s9): Phone alerts subscribes
// this device then saves the switch, or unsubscribes it then saves; an iPhone not on the home screen
// and a browser without Web Push are told why, and nothing is subscribed or saved; Email saves alone.

const KEY = 'AQID';
const OFF: AlertsHeld = { channels: { push: false, email: false }, device: false };
const ON: AlertsHeld = { channels: { push: true, email: true }, device: true };

describe('Phone alerts', () => {
  it('on: subscribes this device, then saves the switch with Email as it was', async () => {
    const { browser, sent, events } = fakeBrowser();
    expect(await turnPhone(true, { ...OFF, channels: { push: false, email: true } }, browser, KEY, 'ready'))
      .toEqual({ ok: true, value: { channels: { push: true, email: true }, device: true } });
    expect(events).toEqual(['permission', 'register', 'subscribe true 1,2,3']);
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(['POST /api/push/subscription', 'POST /api/push/channels']);
    expect(sent[1]?.body).toEqual({ push: true, email: true });
  });

  it('on, on an iPhone not added to the home screen: told to add it first, nothing subscribed', async () => {
    const { browser, sent, events } = fakeBrowser();
    expect(await turnPhone(true, OFF, browser, KEY, 'add-to-home-screen')).toEqual({ ok: false, message: ALERTS_LINE.homeScreen });
    expect(events).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('on, in a browser with no Web Push: says so, nothing subscribed', async () => {
    const { browser, sent } = fakeBrowser();
    expect(await turnPhone(true, OFF, browser, KEY, 'unsupported')).toEqual({ ok: false, message: ALERTS_LINE.unsupported });
    expect(sent).toEqual([]);
  });

  it('on, notifications blocked: says so, and the switch is not saved', async () => {
    const { browser, sent } = fakeBrowser({ permission: 'denied' });
    expect(await turnPhone(true, OFF, browser, KEY, 'ready')).toEqual({ ok: false, message: ALERT_LINE.denied });
    expect(sent).toEqual([]);
  });

  it('off: unsubscribes this device, then saves the switch', async () => {
    const { browser, sent, events } = fakeBrowser({ existing: true });
    expect(await turnPhone(false, ON, browser, KEY, 'ready'))
      .toEqual({ ok: true, value: { channels: { push: false, email: true }, device: false } });
    expect(events).toEqual(['unsubscribe']);
    expect(sent).toEqual([
      { method: 'DELETE', path: '/api/push/subscription', body: { endpoint: SUBSCRIPTION.endpoint } },
      { method: 'POST', path: '/api/push/channels', body: { push: false, email: true } },
    ]);
  });

  it('off, even where Web Push cannot be had: the switch is saved off', async () => {
    const { browser, sent } = fakeBrowser({ registered: false });
    expect((await turnPhone(false, ON, browser, KEY, 'add-to-home-screen')).ok).toBe(true);
    expect(sent.map((s) => s.path)).toEqual(['/api/push/channels']);
  });

  it('the switch refused by the route: says its reason', async () => {
    const { browser } = fakeBrowser({ answer: (one) => (one.path === '/api/push/channels' ? { status: 401, body: { error: 'Sign in first.' } } : { status: 200, body: { subscribed: true } }) });
    expect(await turnPhone(true, OFF, browser, KEY, 'ready')).toEqual({ ok: false, message: 'Sign in first.' });
  });
});

describe('what the switches say', () => {
  it('Phone alerts: no key on this deployment first, then an iPhone off the home screen, then no Web Push', () => {
    expect(phoneHint(null, 'ready')).toBe(ALERTS_LINE.noKeys);
    expect(phoneHint(KEY, 'add-to-home-screen')).toBe(ALERTS_LINE.homeScreen);
    expect(phoneHint(KEY, 'unsupported')).toBe(ALERTS_LINE.unsupported);
    expect(phoneHint(KEY, 'ready')).toBeNull();
    expect(phoneHint(KEY, null)).toBeNull();
  });

  it('Email: your address, or that your sign-in has none', () => {
    expect(emailLabel('ada@example.com')).toBe('Email · ada@example.com');
    expect(emailLabel(null)).toBe(ALERTS_LINE.noEmail);
  });
});

describe('Email', () => {
  it('saves its switch, Phone alerts as it was', async () => {
    const { browser, sent } = fakeBrowser();
    expect(await turnEmail(true, { channels: { push: true, email: false }, device: true }, browser))
      .toEqual({ ok: true, value: { channels: { push: true, email: true }, device: true } });
    expect(sent).toEqual([{ method: 'POST', path: '/api/push/channels', body: { push: true, email: true } }]);
  });

  it('refused: says its reason', async () => {
    const { browser } = fakeBrowser({ answer: () => ({ status: 500, body: { error: 'The database could not answer. Try again.' } }) });
    expect(await turnEmail(false, ON, browser)).toEqual({ ok: false, message: 'The database could not answer. Try again.' });
  });
});
