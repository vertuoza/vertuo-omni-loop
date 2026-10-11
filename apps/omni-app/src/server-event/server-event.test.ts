import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { receiveServerEvent, SERVER_EVENT, SERVER_SIGNATURE_HEADER, serverEventRoute, verifyServerEvent, type ServerEventRequest } from './server-event.ts';

const SECRET = 'shared-secret';
const DOSSIER = '0b9f8a1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
const EVENT = { event: 'approved', dossier: DOSSIER, at: '2026-10-11T09:00:00.000Z' };

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

/** A request whose body is `value` as JSON (or as written when a string), signed unless told otherwise. */
function requestOf(value: unknown, { signature }: { signature?: string | null } = {}) {
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  const headers = new Headers();
  const signed = signature === undefined ? sign(body) : signature;
  if (signed !== null) headers.set(SERVER_SIGNATURE_HEADER, signed);
  return { body, headers };
}

function deps({ unset = false, fail = false } = {}) {
  const secret = unset ? undefined : SECRET;
  const sent: ServerEventRequest[] = [];
  const logged: string[] = [];
  return {
    sent,
    logged,
    deps: {
      secret,
      send: (events: ServerEventRequest[]) => (fail ? Promise.reject(new Error('inngest is down')) : Promise.resolve(sent.push(...events))),
      log: (line: string) => logged.push(line),
    },
  };
}

describe('verifyServerEvent', () => {
  it('accepts only sha256=<hex> of the exact body under the secret', () => {
    const body = JSON.stringify(EVENT);
    expect(verifyServerEvent(SECRET, body, sign(body))).toBe(true);
    expect(verifyServerEvent(SECRET, `${body} `, sign(body))).toBe(false);
    expect(verifyServerEvent(SECRET, body, sign(body, 'another'))).toBe(false);
    expect(verifyServerEvent(SECRET, body, sign(body).slice('sha256='.length))).toBe(false);
    expect(verifyServerEvent(SECRET, body, 'sha256=abc')).toBe(false);
    expect(verifyServerEvent(SECRET, body, null)).toBe(false);
  });
});

describe('receiveServerEvent — one signed POST from galaxy (PRD 1548 s4)', () => {
  it('sends a signed approval, void, item opened or item settled on as one Inngest event, and answers 202 (PRD 1548 s8)', async () => {
    for (const event of ['approved', 'voided', 'item-opened', 'item-settled']) {
      const run = deps();
      const reply = await receiveServerEvent(requestOf({ ...EVENT, event }), run.deps);
      expect(reply).toEqual({ status: 202, body: 'accepted' });
      expect(run.sent).toEqual([{ name: SERVER_EVENT, data: { ...EVENT, event } }]);
    }
  });

  it('refuses a bad or a missing signature 401, sending nothing', async () => {
    for (const signature of [sign(JSON.stringify(EVENT), 'not-the-secret'), null, 'sha256=']) {
      const run = deps();
      expect(await receiveServerEvent(requestOf(EVENT, { signature }), run.deps)).toEqual({ status: 401, body: 'bad signature' });
      expect(run.sent).toEqual([]);
    }
  });

  it('refuses every event 401 while the secret is not set, and says so in the log', async () => {
    const run = deps({ unset: true });
    expect(await receiveServerEvent(requestOf(EVENT), run.deps)).toEqual({ status: 401, body: 'server events are not accepted here' });
    expect(run.sent).toEqual([]);
    expect(run.logged).toEqual(['server event: STAGE_EVENT_SECRET is not set on this deployment, every server event is refused']);
  });

  it('refuses a signed body that is not JSON, or not a server event, 400', async () => {
    const run = deps();
    expect(await receiveServerEvent(requestOf('{not json'), run.deps)).toEqual({ status: 400, body: 'the body is not JSON' });
    for (const body of [{ ...EVENT, event: 'merged' }, { ...EVENT, dossier: 'd-12' }, { ...EVENT, at: 'yesterday' }, { event: 'approved' }, [EVENT]]) {
      expect(await receiveServerEvent(requestOf(body), run.deps)).toEqual({ status: 400, body: 'the body is not a server event' });
    }
    expect(run.sent).toEqual([]);
  });

  it('answers 500 when the event cannot be sent on, naming it in the log', async () => {
    const run = deps({ fail: true });
    expect(await receiveServerEvent(requestOf(EVENT), run.deps)).toEqual({ status: 500, body: 'the server event could not be sent on' });
    expect(run.logged).toEqual([`server event: the approved of dossier ${DOSSIER} was not sent on — inngest is down`]);
  });
});

describe('serverEventRoute — /api/server-event', () => {
  it('reads the raw body and the signature header, and answers in plain text', async () => {
    const sent: ServerEventRequest[] = [];
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { send: (events) => Promise.resolve(sent.push(...events)) });
    const body = JSON.stringify(EVENT);
    const response = await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body) } }));
    expect(response.status).toBe(202);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('accepted');
    expect(sent).toHaveLength(1);

    const refused = await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body, 'x') } }));
    expect(refused.status).toBe(401);
  });

  it('refuses a GET 405, naming POST', () => {
    const response = serverEventRoute({ stageEvents: null }).GET();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});
