import type { EmailSender } from './email';
import type { Device, PushSender } from './push';

// Reaching people (PRD 1322 s2): one message to each recipient by the channels they turned on, a push
// to each of their devices and an email to their address. A channel this deployment has no keys for is
// skipped with one log line for the whole fan-out, and the other still goes out. A device its push
// service says is gone is forgotten. Never throws: a failure is the sender's log line, not the caller's.

/** One person to reach: their address when Email is on, their devices when Phone alerts is. */
export type Recipient = { user: string; email: string | null; devices: Device[] };

/** What reaches each person: the push's payload, and the email less its address. */
export type Message = { push: string; email: { subject: string; text: string; html: string } };

/** The channels this deployment has keys for (null: skipped), and how a gone device is forgotten. */
export type Channels = {
  push: PushSender | null;
  email: EmailSender | null;
  forget: (device: string) => Promise<void>;
};

/** What the fan-out came to. */
type Reached = { pushed: number; emailed: number; forgotten: number; skipped: Array<'push' | 'email'> };

/** Sends `message` to every recipient by their channels. */
export async function notifyAll(recipients: readonly Recipient[], message: Message, channels: Channels, log: (line: string) => void): Promise<Reached> {
  const reached: Reached = { pushed: 0, emailed: 0, forgotten: 0, skipped: [] };
  const devices = recipients.flatMap((r) => r.devices);
  const addresses = recipients.flatMap((r) => (r.email ? [r.email] : []));
  const { push, email } = channels;
  if (devices.length > 0 && !push) {
    reached.skipped.push('push');
    log(`notify: phone alerts skipped for ${devices.length} ${devices.length === 1 ? 'device' : 'devices'}: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set`);
  }
  if (addresses.length > 0 && !email) {
    reached.skipped.push('email');
    log(`notify: email skipped for ${addresses.length} ${addresses.length === 1 ? 'address' : 'addresses'}: RESEND_API_KEY and RESEND_FROM are not set`);
  }
  await Promise.all([
    ...(push ? devices.map(async (device) => {
      const outcome = await push(device, message.push);
      if (outcome === 'sent') reached.pushed += 1;
      if (outcome !== 'gone') return;
      try {
        await channels.forget(device.id);
        reached.forgotten += 1;
      } catch (error) {
        log(`notify: device ${device.id} is gone but could not be forgotten: ${error instanceof Error ? error.message : String(error)}`);
      }
    }) : []),
    ...(email ? addresses.map(async (to) => {
      if (await email({ to, ...message.email })) reached.emailed += 1;
    }) : []),
  ]);
  return reached;
}
