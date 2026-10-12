import type { AlertChannels, PushSupport } from '../push/device';
import { saveChannels, subscribeThisDevice, unsubscribeThisDevice, type Done, type PushBrowser } from '../push/client';

// The two alert switches on your own profile (PRD 1322 s9), pressed: what each press does, in order,
// apart from React so it runs on a fake browser. Phone alerts on subscribes this device, then saves the
// switch; off unsubscribes it, then saves the switch. An iPhone not on the home screen, or a browser
// with no Web Push, is told why and nothing is saved. Email saves its switch alone.

export const ALERTS_LINE = {
  intro: 'How you are told a PRD waits for your approval. Both are off until you turn them on.',
  phone: 'Phone alerts on this device',
  homeScreen: 'On an iPhone, add this page to your home screen first: tap Share, then Add to Home Screen, open it from there and turn this on.',
  unsupported: 'This browser can’t receive phone alerts.',
  noKeys: 'Phone alerts are not set up on this deployment.',
  noEmail: 'Email · your GitHub sign-in has no address',
} as const;

/** Email's label: your address, or why it cannot be turned on. */
export function emailLabel(email: string | null): string {
  return email === null ? ALERTS_LINE.noEmail : `Email · ${email}`;
}

/** Why Phone alerts cannot be had here, under the switch, or null: no key on this deployment, an
 * iPhone not on the home screen, a browser with no Web Push. `support` is null until the page runs. */
export function phoneHint(publicKey: string | null, support: PushSupport | null): string | null {
  if (publicKey === null) return ALERTS_LINE.noKeys;
  if (support === 'add-to-home-screen') return ALERTS_LINE.homeScreen;
  return support === 'unsupported' ? ALERTS_LINE.unsupported : null;
}

/** What the switches hold: both channels, and whether this device is subscribed. */
export interface AlertsHeld {
  channels: AlertChannels;
  device: boolean;
}

/** Phone alerts turned `on` (or off) on this device. */
export async function turnPhone(on: boolean, held: AlertsHeld, browser: PushBrowser, publicKey: string, support: PushSupport): Promise<Done<AlertsHeld>> {
  if (on && support === 'add-to-home-screen') return { ok: false, message: ALERTS_LINE.homeScreen };
  if (on && support === 'unsupported') return { ok: false, message: ALERTS_LINE.unsupported };
  const device = on ? await subscribeThisDevice(browser, publicKey) : await unsubscribeThisDevice(browser);
  if (!device.ok) return device;
  const saved = await saveChannels(browser, { ...held.channels, push: on });
  return saved.ok ? { ok: true, value: { channels: saved.value, device: on } } : saved;
}

/** Email turned `on` (or off). */
export async function turnEmail(on: boolean, held: AlertsHeld, browser: Pick<PushBrowser, 'fetch'>): Promise<Done<AlertsHeld>> {
  const saved = await saveChannels(browser, { ...held.channels, email: on });
  return saved.ok ? { ok: true, value: { ...held, channels: saved.value } } : saved;
}
