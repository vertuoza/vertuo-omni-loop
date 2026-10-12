import { z } from 'zod';
import { AlertChannels, applicationServerKey, deviceLabel, PushDevice, WORKER_PATH, WORKER_SCOPE, type BrowserFacts } from './device';

// The profile page's alert switches in the browser (PRD 1322 s9): this device subscribed to Web Push
// through the service worker at /api/push/sw.js and stored by POST /api/push/subscription; unsubscribed and
// removed by DELETE; and both switches saved by POST /api/push/channels. The browser's own objects are
// behind PushBrowser, so every step runs on fakes in a test. Each call answers what it did, or why
// not in plain words: it never throws.

/** What the browser serialises a subscription to, read as a PushDevice once labelled. */
interface PushSubscriptionLike {
  endpoint: string;
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

interface PushManagerLike {
  getSubscription(): Promise<PushSubscriptionLike | null>;
  subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array<ArrayBuffer> }): Promise<PushSubscriptionLike>;
}

/** The browser's objects the switches use: `navigator.serviceWorker`, `Notification`, `fetch`. */
export interface PushBrowser {
  userAgent: string;
  /** Registers the service worker (or answers the registration already there) and its push manager. */
  register(): Promise<{ pushManager: PushManagerLike }>;
  /** The service worker's push manager when it is registered already, else null. */
  registered(): Promise<{ pushManager: PushManagerLike } | null>;
  /** Asks the person to allow notifications, once; answers what they chose (or chose before). */
  permission(): Promise<'granted' | 'denied' | 'default'>;
  fetch: typeof globalThis.fetch;
}

export type Done<T> = { ok: true; value: T } | { ok: false; message: string };

export const ALERT_LINE = {
  denied: 'Notifications are blocked for this page. Allow them in this browser’s settings, then turn this on again.',
  failed: 'Couldn’t turn phone alerts on here. Try again in a moment.',
  notSaved: 'Couldn’t save this. Try again in a moment.',
} as const;

const Answer = z.union([z.strictObject({ channels: AlertChannels }), z.strictObject({ error: z.string() })]);
const Subscribed = z.union([z.strictObject({ subscribed: z.boolean() }), z.strictObject({ error: z.string() })]);

async function call<T>(fetch: PushBrowser['fetch'], method: string, path: string, body: unknown, schema: z.ZodType<T>): Promise<Done<T>> {
  try {
    const res = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const parsed = schema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) return { ok: false, message: ALERT_LINE.notSaved };
    const answer = parsed.data;
    if (res.ok) return { ok: true, value: answer };
    return { ok: false, message: z.object({ error: z.string() }).safeParse(answer).data?.error ?? ALERT_LINE.notSaved };
  } catch {
    return { ok: false, message: ALERT_LINE.notSaved };
  }
}

/** Both switches, saved as the signed-in person; answers them as stored. */
export async function saveChannels(browser: Pick<PushBrowser, 'fetch'>, channels: AlertChannels): Promise<Done<AlertChannels>> {
  const done = await call(browser.fetch, 'POST', '/api/push/channels', channels, Answer);
  if (!done.ok) return done;
  return 'channels' in done.value ? { ok: true, value: done.value.channels } : { ok: false, message: done.value.error };
}

/** Whether this device holds a subscription already. */
export async function thisDeviceSubscribed(browser: PushBrowser): Promise<boolean> {
  try {
    const registration = await browser.registered();
    return (await registration?.pushManager.getSubscription()) != null;
  } catch {
    return false;
  }
}

/** This device, asked for permission, subscribed with the VAPID public key and stored. */
export async function subscribeThisDevice(browser: PushBrowser, publicKey: string): Promise<Done<true>> {
  try {
    if ((await browser.permission()) !== 'granted') return { ok: false, message: ALERT_LINE.denied };
    const { pushManager } = await browser.register();
    const subscription = (await pushManager.getSubscription())
      ?? (await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) }));
    const device = PushDevice.safeParse({ ...z.object({}).loose().parse(subscription.toJSON()), label: deviceLabel(browser.userAgent) });
    if (!device.success) return { ok: false, message: ALERT_LINE.failed };
    const stored = await call(browser.fetch, 'POST', '/api/push/subscription', device.data, Subscribed);
    return stored.ok ? { ok: true, value: true } : stored;
  } catch {
    return { ok: false, message: ALERT_LINE.failed };
  }
}

/** This browser's own objects, read when a switch is pressed or the page mounts: never on the server. */
export function livePushBrowser(): PushBrowser {
  return {
    userAgent: navigator.userAgent,
    register: () => navigator.serviceWorker.register(WORKER_PATH, { scope: WORKER_SCOPE, updateViaCache: 'none' }),
    registered: async () => (await navigator.serviceWorker.getRegistration(WORKER_SCOPE)) ?? null,
    permission: () => Notification.requestPermission(),
    fetch: (input, init) => globalThis.fetch(input, init),
  };
}

/** What this browser says of itself, for pushSupport. */
export function liveBrowserFacts(): BrowserFacts {
  const safariStandalone = 'standalone' in navigator && navigator.standalone === true;
  return {
    userAgent: navigator.userAgent,
    standalone: safariStandalone || globalThis.matchMedia('(display-mode: standalone)').matches,
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in globalThis,
  };
}

/** This device's subscription, removed on the server, then dropped by the browser. */
export async function unsubscribeThisDevice(browser: PushBrowser): Promise<Done<true>> {
  try {
    const registration = await browser.registered();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return { ok: true, value: true };
    const removed = await call(browser.fetch, 'DELETE', '/api/push/subscription', { endpoint: subscription.endpoint }, Subscribed);
    if (!removed.ok) return removed;
    await subscription.unsubscribe();
    return { ok: true, value: true };
  } catch {
    return { ok: false, message: ALERT_LINE.notSaved };
  }
}
