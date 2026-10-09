import { z } from 'zod';

// A person's alert switches and a device's Web Push subscription (PRD 1322 s9), shared by the profile
// page in the browser and the push routes on the server: the shapes they exchange, whether this
// browser can be subscribed (an iPhone only once the page is on its home screen, iOS 16.4 and later),
// the few words a device is stored under, and the VAPID public key as the bytes the Push API takes.

/** A person's two switches: Phone alerts (Web Push to their subscribed devices) and Email. */
export const AlertChannels = z.strictObject({ push: z.boolean(), email: z.boolean() });
export type AlertChannels = z.infer<typeof AlertChannels>;

/** Both switches off: a person who never turned one on. */
export const CHANNELS_OFF: AlertChannels = Object.freeze({ push: false, email: false });

/** The bounds `push_subscriptions` checks. */
const ENDPOINT_MAX = 2000;
const KEY_MAX = 200;
const LABEL_MAX = 120;

const pushKey = z.string().min(1).max(KEY_MAX);

/** This device's subscription, as `PushSubscription.toJSON()` gives it, with the label it is stored under. */
export const PushDevice = z.object({
  endpoint: z.string().max(ENDPOINT_MAX).regex(/^https:\/\//, 'an https address'),
  keys: z.object({ p256dh: pushKey, auth: pushKey }),
  label: z.string().max(LABEL_MAX),
});
export type PushDevice = z.infer<typeof PushDevice>;

/** What the browser says of itself, read once on the page. */
export interface BrowserFacts {
  userAgent: string;
  /** The page runs from the home screen (`display-mode: standalone`, or Safari's `navigator.standalone`). */
  standalone: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
}

/** `ready`: it can be subscribed; `add-to-home-screen`: an iPhone or iPad in Safari's tab; `unsupported`: never here. */
export type PushSupport = 'ready' | 'add-to-home-screen' | 'unsupported';

const APPLE_MOBILE = /iPhone|iPad|iPod/;

/** Whether this browser can be subscribed to Web Push now. */
export function pushSupport(facts: BrowserFacts): PushSupport {
  if (APPLE_MOBILE.test(facts.userAgent) && !facts.standalone) return 'add-to-home-screen';
  return facts.serviceWorker && facts.pushManager ? 'ready' : 'unsupported';
}

const DEVICES: ReadonlyArray<[RegExp, string]> = [
  [/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Macintosh|Mac OS X/, 'Mac'], [/Windows/, 'Windows'], [/Linux|CrOS/, 'Linux'],
];
// Edge and Chrome both say Safari, Edge also says Chrome: the most specific first.
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg\//, 'Edge'], [/Firefox\/|FxiOS/, 'Firefox'], [/Chrome\/|CriOS/, 'Chrome'], [/Safari\//, 'Safari'],
];

const first = (pairs: ReadonlyArray<[RegExp, string]>, userAgent: string) => pairs.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

/** The few words a device is listed under: `iPhone · Safari`, `Mac · Chrome`; `A browser` when unknown. */
export function deviceLabel(userAgent: string): string {
  const parts = [first(DEVICES, userAgent), first(BROWSERS, userAgent)].filter((part) => part !== null);
  return parts.length === 0 ? 'A browser' : parts.join(' · ');
}

/** The VAPID public key, base64url, as the bytes `pushManager.subscribe` takes. */
export function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
