import type { PushBrowser } from './client';

// A browser for the alert switches' tests (PRD 1322 s9): a service worker that registers, a push
// manager that subscribes once and keeps the subscription, a permission the test chooses, and a fetch
// that records each call and answers what the test says. Nothing leaves the test.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
export const SUBSCRIPTION = { endpoint: 'https://push.example/ada', expirationTime: null, keys: { p256dh: 'BPk1', auth: 'au1' } };

type Sent = { method: string; path: string; body: unknown };
type Answer = (sent: Sent) => { status: number; body: unknown };

interface FakeOptions {
  /** This device holds a subscription already. */
  existing?: boolean;
  permission?: 'granted' | 'denied';
  answer?: Answer;
  /** /sw.js is registered already. */
  registered?: boolean;
}

/** Answers every call as the routes do when they accept it: the switches sent back, or subscribed. */
const ACCEPT: Answer = (sent) => ({ status: 200, body: sent.path === '/api/push/channels' ? { channels: sent.body } : { subscribed: sent.method === 'POST' } });

export function fakeBrowser({ existing = false, permission = 'granted', answer = ACCEPT, registered = true }: FakeOptions = {}) {
  const sent: Sent[] = [];
  const events: string[] = [];
  let held = existing;
  const subscription = {
    endpoint: SUBSCRIPTION.endpoint,
    toJSON: () => SUBSCRIPTION,
    unsubscribe: () => { events.push('unsubscribe'); held = false; return Promise.resolve(true); },
  };
  const pushManager = {
    getSubscription: () => Promise.resolve(held ? subscription : null),
    subscribe: (options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array<ArrayBuffer> }) => {
      events.push(`subscribe ${String(options.userVisibleOnly)} ${[...options.applicationServerKey].join(',')}`);
      held = true;
      return Promise.resolve(subscription);
    },
  };
  const browser: PushBrowser = {
    userAgent: IPHONE,
    register: () => { events.push('register'); return Promise.resolve({ pushManager }); },
    registered: () => Promise.resolve(registered || held ? { pushManager } : null),
    permission: () => { events.push('permission'); return Promise.resolve(permission); },
    fetch: (input, init) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const one: Sent = { method: init?.method ?? 'GET', path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null };
      sent.push(one);
      const { status, body } = answer(one);
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    },
  };
  return { browser, sent, events };
}
