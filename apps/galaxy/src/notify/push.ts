import { z } from 'zod';

// Web Push (PRD 1322 s2): one notification to one subscribed device, signed with the VAPID pair, through
// the `web-push` library, which the sender is handed so a test hands a fake. A push service answering
// 404 or 410 says the subscription is gone for good: the caller forgets that device. Any other failure
// is logged and counts as not sent; nothing is retried.

/** One subscribed device, as push_subscriptions stores it. */
export type Device = { id: string; endpoint: string; p256dh: string; auth: string };

/** What a push came to: sent, the device gone (404 or 410), or failed otherwise. */
type PushOutcome = 'sent' | 'gone' | 'failed';

/** Sends `payload` (the service worker reads it as JSON) to one device. */
export type PushSender = (device: Device, payload: string) => Promise<PushOutcome>;

/** The one call the sender makes of the `web-push` library. */
export type WebPushLib = {
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options: { vapidDetails: { subject: string; publicKey: string; privateKey: string }; TTL: number },
  ): Promise<unknown>;
};

/** How long a push service keeps a notification for a device that is offline: one day. */
const TTL_SECONDS = 24 * 60 * 60;

/** A push service's refusal, as `web-push` throws it. */
const Refused = z.object({ statusCode: z.number() });

/** A sender signing with `keys`; `subject` is the contact a push service may write to (a mailto: or
 * https: address). Never throws. */
export function pushSender(
  keys: { publicKey: string; privateKey: string },
  subject: string,
  lib: WebPushLib,
  log: (line: string) => void,
): PushSender {
  return async (device, payload) => {
    try {
      await lib.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        payload,
        { vapidDetails: { subject, ...keys }, TTL: TTL_SECONDS },
      );
      return 'sent';
    } catch (error) {
      const refused = Refused.safeParse(error);
      if (refused.success && (refused.data.statusCode === 404 || refused.data.statusCode === 410)) return 'gone';
      log(`notify: a push to device ${device.id} failed: ${refused.success ? `status ${refused.data.statusCode}` : String(error)}`);
      return 'failed';
    }
  };
}
