import 'server-only';
import { Resend } from 'resend';
import webpush from 'web-push';
import { serverEnv } from '../env';
import { emailSender } from './email';
import type { Channels } from './notify';
import { pushSender } from './push';

// The channels this deployment has keys for (PRD 1322 s2): Web Push with VAPID_PUBLIC_KEY and
// VAPID_PRIVATE_KEY, email through Resend with RESEND_API_KEY and RESEND_FROM. A group left unset is a
// null channel, which notifyAll skips with one log line. `subject` is the contact push services are
// given: this deployment's own address. `forget` removes a device its push service says is gone.
export function liveChannels(subject: string, forget: Channels['forget']): Channels {
  const { webPush, resend } = serverEnv();
  const log = (line: string) => { console.error(line); };
  return {
    push: webPush ? pushSender(webPush, subject, webpush, log) : null,
    email: resend ? emailSender(resend.from, new Resend(resend.key), log) : null,
    forget,
  };
}
