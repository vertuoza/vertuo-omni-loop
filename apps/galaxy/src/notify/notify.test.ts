import { describe, expect, it } from 'vitest';
import { emailSender, type EmailLib } from './email';
import { notifyAll, type Channels, type Recipient } from './notify';
import { pushSender, type WebPushLib } from './push';

// The senders (PRD 1322 s2), behind fakes of web-push and Resend: who gets what, a gone device
// forgotten, a channel without keys skipped with one log line while the other still goes out.

const KEYS = { publicKey: 'BPub', privateKey: 'priv' };
const MESSAGE = { push: '{"title":"PRD 7 waits for your approval"}', email: { subject: 'PRD 7', text: 'text', html: '<p>html</p>' } };

const IRISA: Recipient = { user: 'u-irisa', email: 'irisa@acme.test', devices: [{ id: 'd1', endpoint: 'https://push.example/1', p256dh: 'k1', auth: 'a1' }] };
const PAUL: Recipient = {
  user: 'u-paul', email: null,
  devices: [{ id: 'd2', endpoint: 'https://push.example/2', p256dh: 'k2', auth: 'a2' }, { id: 'd3', endpoint: 'https://push.example/3', p256dh: 'k3', auth: 'a3' }],
};
const SAM: Recipient = { user: 'u-sam', email: 'sam@acme.test', devices: [] };

/** A fake web-push: answers each endpoint's status (201 by default), records every call. */
function fakePush(statuses: Record<string, number | Error> = {}) {
  const calls: Array<{ endpoint: string; payload: string; subject: string; ttl: number }> = [];
  const lib: WebPushLib = {
    sendNotification(subscription, payload, options) {
      calls.push({ endpoint: subscription.endpoint, payload, subject: options.vapidDetails.subject, ttl: options.TTL });
      const status = statuses[subscription.endpoint] ?? 201;
      if (status instanceof Error) return Promise.reject(status);
      return status < 300 ? Promise.resolve({ statusCode: status }) : Promise.reject(Object.assign(new Error('refused'), { statusCode: status }));
    },
  };
  return { lib, calls };
}

/** A fake Resend: refuses the addresses in `refused`, records every call. */
function fakeResend(refused: string[] = []) {
  const calls: Array<{ from: string; to: string; subject: string }> = [];
  const lib: EmailLib = {
    emails: {
      send(payload) {
        calls.push({ from: payload.from, to: payload.to, subject: payload.subject });
        return Promise.resolve({ error: refused.includes(payload.to) ? { message: 'domain not verified' } : null });
      },
    },
  };
  return { lib, calls };
}

function channels({ push = fakePush(), resend = fakeResend(), withPush = true, withEmail = true } = {}) {
  const logs: string[] = [];
  const forgotten: string[] = [];
  const log = (line: string) => { logs.push(line); };
  const ch: Channels = {
    push: withPush ? pushSender(KEYS, 'https://omni.example', push.lib, log) : null,
    email: withEmail ? emailSender('Omni Loop <approvals@omni.example>', resend.lib, log) : null,
    forget: (device) => { forgotten.push(device); return Promise.resolve(); },
  };
  return { ch, logs, forgotten, log, push, resend };
}

describe('notifyAll', () => {
  it('pushes every device and emails every address turned on, signed with the VAPID subject', async () => {
    const w = channels();
    const reached = await notifyAll([IRISA, PAUL, SAM], MESSAGE, w.ch, w.log);
    expect(reached).toEqual({ pushed: 3, emailed: 2, forgotten: 0, skipped: [] });
    expect(w.push.calls.map((c) => c.endpoint).sort()).toEqual(['https://push.example/1', 'https://push.example/2', 'https://push.example/3']);
    expect(w.push.calls.every((c) => c.payload === MESSAGE.push && c.subject === 'https://omni.example' && c.ttl === 86_400)).toBe(true);
    expect(w.resend.calls.map((c) => c.to).sort()).toEqual(['irisa@acme.test', 'sam@acme.test']);
    expect(w.resend.calls.every((c) => c.from === 'Omni Loop <approvals@omni.example>' && c.subject === 'PRD 7')).toBe(true);
    expect(w.logs).toEqual([]);
  });

  it('forgets a device its push service answers 404 or 410, and only logs another failure', async () => {
    const w = channels({ push: fakePush({ 'https://push.example/2': 410, 'https://push.example/3': 404, 'https://push.example/1': 500 }) });
    const reached = await notifyAll([IRISA, PAUL], MESSAGE, w.ch, w.log);
    expect(reached).toEqual({ pushed: 0, emailed: 1, forgotten: 2, skipped: [] });
    expect(w.forgotten.sort()).toEqual(['d2', 'd3']);
    expect(w.logs).toEqual(['notify: a push to device d1 failed: status 500']);
  });

  it('logs a push that throws without a status, and a refused email, and carries on', async () => {
    const w = channels({ push: fakePush({ 'https://push.example/1': new Error('socket hang up') }), resend: fakeResend(['irisa@acme.test']) });
    const reached = await notifyAll([IRISA, SAM], MESSAGE, w.ch, w.log);
    expect(reached).toEqual({ pushed: 0, emailed: 1, forgotten: 0, skipped: [] });
    expect(w.logs.sort()).toEqual(['notify: a push to device d1 failed: Error: socket hang up', 'notify: an email was refused: domain not verified']);
  });

  it('skips a channel without keys with one log line, and the other still goes out', async () => {
    const noPush = channels({ withPush: false });
    expect(await notifyAll([IRISA, PAUL], MESSAGE, noPush.ch, noPush.log)).toEqual({ pushed: 0, emailed: 1, forgotten: 0, skipped: ['push'] });
    expect(noPush.logs).toEqual(['notify: phone alerts skipped for 3 devices: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set']);

    const noEmail = channels({ withEmail: false });
    expect(await notifyAll([IRISA], MESSAGE, noEmail.ch, noEmail.log)).toEqual({ pushed: 1, emailed: 0, forgotten: 0, skipped: ['email'] });
    expect(noEmail.logs).toEqual(['notify: email skipped for 1 address: RESEND_API_KEY and RESEND_FROM are not set']);
  });

  it('says nothing of a channel nobody turned on', async () => {
    const w = channels({ withPush: false, withEmail: false });
    expect(await notifyAll([{ user: 'u-off', email: null, devices: [] }], MESSAGE, w.ch, w.log)).toEqual({ pushed: 0, emailed: 0, forgotten: 0, skipped: [] });
    expect(w.logs).toEqual([]);
  });

  it('logs a device that is gone but cannot be forgotten', async () => {
    const w = channels({ push: fakePush({ 'https://push.example/1': 410 }) });
    const ch: Channels = { ...w.ch, forget: () => Promise.reject(new Error('permission denied')) };
    expect(await notifyAll([IRISA], MESSAGE, ch, w.log)).toEqual({ pushed: 0, emailed: 1, forgotten: 0, skipped: [] });
    expect(w.logs).toEqual(['notify: device d1 is gone but could not be forgotten: permission denied']);
  });
});

describe('emailSender', () => {
  it('logs an email whose client throws', async () => {
    const logs: string[] = [];
    const lib: EmailLib = { emails: { send: () => Promise.reject(new Error('network down')) } };
    expect(await emailSender('a@b.test', lib, (l) => { logs.push(l); })({ to: 'x@y.test', subject: 's', text: 't', html: 'h' })).toBe(false);
    expect(logs).toEqual(['notify: an email failed: network down']);
  });
});
