import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { RefreshJob } from '../jobs/ledger.ts';
import { capture, throwing } from '../run-log/capture.ts';
import { serverEventJob } from './job.ts';
import { SERVER_EVENT_MAX_DURATION_SECONDS, receiveServerEvent, SERVER_SIGNATURE_HEADER, serverEventRoute, verifyServerEvent, type ServerEventJobs } from './server-event.ts';

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
  const sent: RefreshJob[] = [];
  const logged: string[] = [];
  return {
    sent,
    logged,
    deps: {
      secret,
      queue: (job: RefreshJob) => (fail ? Promise.reject(new Error('the database refused: down')) : Promise.resolve(sent.push(job))),
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
  it('refreshes a signed approval, void, item opened or item settled as the dossier\'s server-event job, due in 5 seconds with 4 tries, and answers 202 (PRD 1548 s8; PRD omni-loop-3 s4)', async () => {
    for (const event of ['approved', 'voided', 'item-opened', 'item-settled']) {
      const run = deps();
      const reply = await receiveServerEvent(requestOf({ ...EVENT, event }), run.deps);
      expect(reply).toEqual({ status: 202, body: 'accepted' });
      expect(run.sent).toEqual([{ kind: 'server-event', key: DOSSIER, subject: DOSSIER, payload: { ...EVENT, event }, maxTries: 4, delaySeconds: 5 }]);
    }
  });

  it('a second event for the same dossier is the same job, refreshed on its latest payload: it joins the queued one', async () => {
    const run = deps();
    await receiveServerEvent(requestOf(EVENT), run.deps);
    await receiveServerEvent(requestOf({ ...EVENT, event: 'voided' }), run.deps);
    expect(run.sent.map(({ kind, key }) => `${kind} ${key}`)).toEqual([`server-event ${DOSSIER}`, `server-event ${DOSSIER}`]);
    expect(run.sent[1]?.payload).toMatchObject({ event: 'voided' });
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

  it('answers 500 when the database refuses the job, naming it in the log', async () => {
    const run = deps({ fail: true });
    expect(await receiveServerEvent(requestOf(EVENT), run.deps)).toEqual({ status: 500, body: 'the server event could not be queued' });
    expect(run.logged).toEqual([`server event: the approved of dossier ${DOSSIER} was not queued — the database refused: down`]);
  });
});

/** A ledger that keeps what was refreshed and counts its runs; `refuse` refuses every job. */
function ledgerOf({ refuse = false } = {}) {
  const refreshed: RefreshJob[] = [];
  const runs: string[] = [];
  const jobs: ServerEventJobs = {
    refresh: (job) => (refuse ? Promise.reject(new Error('down')) : Promise.resolve(refreshed.push(job))),
    run: () => Promise.resolve(runs.push('run')),
  };
  return { jobs, refreshed, runs };
}

/** The route's work after its answers: kept, and let through on `settle`, each pause recorded. */
function afterAnswers() {
  const kept: Promise<unknown>[] = [];
  const paused: number[] = [];
  return { kept, paused, keepAlive: (work: Promise<unknown>) => kept.push(work), pause: (ms: number) => Promise.resolve(paused.push(ms)).then(() => undefined) };
}

describe('serverEventRoute — /api/server-event', () => {
  it('reads the raw body and the signature header, and answers in plain text', async () => {
    const ledger = ledgerOf();
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs: ledger.jobs, keepAlive: () => undefined });
    const body = JSON.stringify(EVENT);
    const response = await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body) } }));
    expect(response.status).toBe(202);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('accepted');
    expect(ledger.refreshed).toEqual([serverEventJob(EVENT as never)]);

    const refused = await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body, 'x') } }));
    expect(refused.status).toBe(401);
  });

  it('runs the jobs due in waitUntil once answered, after the job\'s 5 seconds and a second for the clocks; a refused event runs nothing', async () => {
    const ledger = ledgerOf();
    const after = afterAnswers();
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs: ledger.jobs, keepAlive: after.keepAlive, pause: after.pause });
    const body = JSON.stringify(EVENT);
    await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body, 'x') } }));
    expect(after.kept).toEqual([]);
    expect((await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body) } }))).status).toBe(202);
    await Promise.all(after.kept);
    expect(after.paused).toEqual([6000]);
    expect(ledger.runs).toEqual(['run']);
  });

  it('a run that fails after the answer is said in the log, and the sweep runs the job later', async () => {
    const log = capture();
    const after = afterAnswers();
    const jobs: ServerEventJobs = { refresh: () => Promise.resolve(), run: () => Promise.reject(new Error('the database refused: down')) };
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs, logger: log.logger, keepAlive: after.keepAlive, pause: after.pause });
    const body = JSON.stringify(EVENT);
    expect((await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body) } }))).status).toBe(202);
    await Promise.all(after.kept);
    expect(log.lines().filter((line) => line.event === 'note')).toEqual([expect.objectContaining({ fn: 'jobs', message: 'the run failed — the database refused: down' })]);
  });

  it('answers 500 where the App has no database, since the event cannot be queued', async () => {
    const after = afterAnswers();
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs: null, keepAlive: after.keepAlive });
    const body = JSON.stringify(EVENT);
    const response = await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body) } }));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('the server event could not be queued');
    expect(after.kept).toEqual([]);
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

  it('logs ok on an accepted event, refused on a bad signature, a body that is no event or a GET, failed when the database refuses the job', async () => {
    const log = capture();
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs: ledgerOf().jobs, logger: log.logger, keepAlive: () => undefined });
    const down = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs: ledgerOf({ refuse: true }).jobs, logger: log.logger, keepAlive: () => undefined });
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
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs: ledgerOf().jobs, logger: log.logger, keepAlive: () => undefined });
    const request = post(body, sign(body));
    const thrown = new Error('the body could not be read');
    vi.spyOn(request, 'text').mockRejectedValue(thrown);
    await expect(route.POST(request)).rejects.toBe(thrown);
    expect(log.lines()).toEqual([{ level: 'error', event: 'server-event', outcome: 'failed', ms: 0, error: { name: 'Error', message: 'the body could not be read' } }]);
  });

  it('answers the same when the logger throws', async () => {
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs: ledgerOf().jobs, logger: throwing, keepAlive: () => undefined });
    expect((await route.POST(post(body, sign(body)))).status).toBe(202);
  });

  it('says a missing secret as a JSON note line at warn, by default', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      await receiveServerEvent(requestOf(EVENT), { secret: undefined, queue: () => Promise.resolve() });
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

describe('serverEventRoute — the run within the function (bug #2756)', () => {
  it('tells the run the function ends 60 seconds after the call came in', async () => {
    const T = Date.UTC(2026, 10, 12, 15, 31, 57);
    const ends: number[] = [];
    const after = afterAnswers();
    const jobs: ServerEventJobs = {
      refresh: () => Promise.resolve(),
      run: (endsAt) => Promise.resolve(ends.push(endsAt)),
    };
    const route = serverEventRoute({ stageEvents: { secret: SECRET } }, { jobs, keepAlive: after.keepAlive, pause: after.pause, clock: () => T });
    const body = JSON.stringify(EVENT);
    await route.POST(new Request('https://app.example/api/server-event', { method: 'POST', body, headers: { [SERVER_SIGNATURE_HEADER]: sign(body) } }));
    await Promise.all(after.kept);
    expect(SERVER_EVENT_MAX_DURATION_SECONDS).toBe(60);
    expect(ends).toEqual([T + 60_000]);
  });
});
