import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { capture, throwing } from '../run-log/capture.ts';
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

  it('refuses a GET 405, naming POST', async () => {
    const response = await serverEventRoute({ stageEvents: null }).GET(new Request('https://app.example/api/server-event'));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});

describe('serverEventRoute — one server-event line per call (PRD 1723 s6)', () => {
  const post = (body: string, signature: string) =>
    new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: signature } });
  const body = JSON.stringify(EVENT);

  it('logs ok on an accepted event, refused on a bad signature, a body that is no event or a GET, failed when Inngest is down', async () => {
    const log = capture();
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { send: () => Promise.resolve(), logger: log.logger });
    const down = serverEventRoute({ stageEvents: { secret: SECRET } }, { send: () => Promise.reject(new Error('down')), logger: log.logger });
    expect((await route.POST(post(body, sign(body)))).status).toBe(202);
    expect((await route.POST(post(body, sign(body, 'x')))).status).toBe(401);
    expect((await route.POST(post('{}', sign('{}')))).status).toBe(400);
    expect((await route.GET(new Request('https://app.example/api/server-event'))).status).toBe(405);
    expect((await down.POST(post(body, sign(body)))).status).toBe(500);
    expect(log.lines().map(({ level, event, outcome, status }) => ({ level, event, outcome, status }))).toEqual([
      { level: 'info', event: 'server-event', outcome: 'ok', status: 202 },
      { level: 'warn', event: 'server-event', outcome: 'refused', status: 401 },
      { level: 'warn', event: 'server-event', outcome: 'refused', status: 400 },
      { level: 'warn', event: 'server-event', outcome: 'refused', status: 405 },
      { level: 'error', event: 'server-event', outcome: 'failed', status: 500 },
    ]);
    expect(log.lines().every((line) => typeof line.ms === 'number')).toBe(true);
  });

  it('logs failed on a thrown error, and rethrows the very error', async () => {
    const log = capture();
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { send: () => Promise.resolve(), logger: log.logger });
    const request = post(body, sign(body));
    const thrown = new Error('the body could not be read');
    vi.spyOn(request, 'text').mockRejectedValue(thrown);
    await expect(route.POST(request)).rejects.toBe(thrown);
    expect(log.lines()).toEqual([{ level: 'error', event: 'server-event', outcome: 'failed', ms: 0, error: { name: 'Error', message: 'the body could not be read' } }]);
  });

  it('answers the same when the logger throws', async () => {
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { send: () => Promise.resolve(), logger: throwing });
    expect((await route.POST(post(body, sign(body)))).status).toBe(202);
  });

  it('says a missing secret as a JSON note line at warn, by default', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      await receiveServerEvent(requestOf(EVENT), { secret: undefined, send: () => Promise.resolve() });
      expect(write.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)).toEqual([
        {
          level: 'warn',
          event: 'note',
          fn: 'server-event',
          message: 'server event: STAGE_EVENT_SECRET is not set on this deployment, every server event is refused',
        },
      ]);
    } finally {
      write.mockRestore();
    }
  });
});
