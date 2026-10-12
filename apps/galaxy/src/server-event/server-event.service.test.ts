import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { productVoidRepository } from './server-event.repository';
import { OMNI_APP_URL, SERVER_EVENT_PATH, SERVER_SIGNATURE_HEADER, sendServerEvent, tellAppOfVoid, type ServerEvent } from './server-event.service';

vi.mock('server-only', () => ({}));

const SECRET = 'shared-secret';
const DOSSIER = '0b9f8a1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
const EVENT: ServerEvent = { event: 'approved', dossier: DOSSIER, at: '2026-10-11T09:00:00.000Z' };
const URL_ = `${OMNI_APP_URL}${SERVER_EVENT_PATH}`;

/** A fetch that records each call and answers `status`, or throws `error`. */
function fetchAnswering(status: number, error?: Error) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return error ? Promise.reject(error) : Promise.resolve(new Response('', { status }));
  };
  return { calls, fetch };
}

describe('sendServerEvent — one signed POST to the App (PRD 1548 s4)', () => {
  it('POSTs the event as JSON to the App\'s route, signed with an HMAC-SHA256 over the exact body under the shared secret', async () => {
    const http = fetchAnswering(202);
    const logged: string[] = [];
    expect(await sendServerEvent(EVENT, { url: URL_, secret: SECRET, fetch: http.fetch, log: (l) => logged.push(l) })).toBe(true);
    expect(http.calls).toHaveLength(1);
    const [{ url, init }] = http.calls as [{ url: string; init: RequestInit }];
    expect(url).toBe('https://omni-loop.vercel.app/api/server-event');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(EVENT);
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers[SERVER_SIGNATURE_HEADER]).toBe(`sha256=${createHmac('sha256', SECRET).update(init.body as string).digest('hex')}`);
    expect(logged).toEqual([]);
  });

  it('sends nothing without the secret, and says so', async () => {
    const http = fetchAnswering(202);
    const logged: string[] = [];
    expect(await sendServerEvent(EVENT, { url: URL_, secret: null, fetch: http.fetch, log: (l) => logged.push(l) })).toBe(false);
    expect(http.calls).toEqual([]);
    expect(logged).toEqual([`server event: STAGE_EVENT_SECRET is not set, the approved of dossier ${DOSSIER} is not sent to the App`]);
  });

  it('never throws: a refusal or a network failure is one line in the log', async () => {
    const logged: string[] = [];
    expect(await sendServerEvent(EVENT, { url: URL_, secret: SECRET, fetch: fetchAnswering(401).fetch, log: (l) => logged.push(l) })).toBe(false);
    expect(await sendServerEvent(EVENT, { url: URL_, secret: SECRET, fetch: fetchAnswering(0, new Error('offline')).fetch, log: (l) => logged.push(l) })).toBe(false);
    expect(logged).toEqual([
      `server event: the App answered 401 to the approved of dossier ${DOSSIER}`,
      `server event: the approved of dossier ${DOSSIER} could not be sent — offline`,
    ]);
  });
});

/** A pusher's client whose approval_voids_of_push() answers `answer`. */
const pusher = (answer: { data: unknown; error: { message: string } | null }) => {
  const calls: Array<[string, unknown]> = [];
  return { calls, db: { rpc: (fn: string, args: Record<string, unknown>) => { calls.push([fn, args]); return Promise.resolve(answer); } } };
};

describe('a push that voids a product PRD\'s approval tells the App once', () => {
  const at = () => new Date('2026-10-11T09:30:00.000Z');

  async function tell(answer: { data: unknown; error: { message: string } | null }, send = (event: ServerEvent) => Promise.resolve(Boolean(event))) {
    const sent: ServerEvent[] = [];
    const logged: string[] = [];
    const { db, calls } = pusher(answer);
    await tellAppOfVoid({ voided: productVoidRepository(db).voidedByPush, send: (event) => { sent.push(event); return send(event); }, now: at, log: (l) => logged.push(l) }, DOSSIER);
    return { sent, logged, calls };
  }

  it('sends one voided event, however many kinds the push changed, reading the voids as the pusher', async () => {
    const { sent, calls } = await tell({ data: [{ repo: null, kind: 'plan' }, { repo: null, kind: 'spec' }], error: null });
    expect(sent).toEqual([{ event: 'voided', dossier: DOSSIER, at: '2026-10-11T09:30:00.000Z' }]);
    expect(calls).toEqual([['approval_voids_of_push', { p_dossier: DOSSIER }]]);
  });

  it('sends nothing for a push that voided nothing, or a repository\'s PRD, which no target PR checks', async () => {
    expect((await tell({ data: [], error: null })).sent).toEqual([]);
    expect((await tell({ data: [{ repo: 'acme/widgets', kind: 'plan' }], error: null })).sent).toEqual([]);
  });

  it('sends nothing, said in the log, when the voids cannot be read', async () => {
    for (const answer of [{ data: null, error: { message: 'denied' } }, { data: [{ repo: 7 }], error: null }]) {
      const { sent, logged } = await tell(answer);
      expect(sent).toEqual([]);
      expect(logged).toEqual([`server event: the voids of a push of dossier ${DOSSIER} could not be read, the App is not told`]);
    }
  });

  it('never throws, even when sending does', async () => {
    const { logged } = await tell({ data: [{ repo: null }], error: null }, () => Promise.reject(new Error('boom')));
    expect(logged).toEqual([`server event: telling the App of dossier ${DOSSIER}'s void failed — boom`]);
  });
});
