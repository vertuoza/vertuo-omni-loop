import { describe, expect, it } from 'vitest';
import type { TokenCheck } from '../ask/auth';
import { cancelJob, jobLines, nextJob, registerRunner, reportJob, sendJob, setRunnerFleet, type RunnersDeps } from './runners.controller';
import type { JobLineRow, JobRow } from './runners.repository';
import { runnersService } from './runners.service';
import { CIA_BOX, EVE, fakeStore, jobRow, lineRows, MO, OLGA, PIA, SHARED, T0 } from './fixtures/store.fake';

// The runners' routes (PRD 1830 s1), with the real service on the fake store: the sign-in is checked
// before anything else (the kit's for a runner's routes, the session for the browser's), each answer is
// in the contract's shape, and each refusal is `{error}` in plain words with its status.

const TOKENS: Record<string, string> = { 'olga-token': OLGA, 'mo-token': MO };

/** The Auth server's verdict on a token: the person it names, or none. */
const connect = (): TokenCheck => ({
  auth: {
    getUser: (jwt: string) => {
      const id = TOKENS[jwt];
      return Promise.resolve(id ? { data: { user: { id, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } });
    },
  },
});

function world({ jobs = [], lines = [], viewer = MO, database = true, serviceRole = true }: {
  jobs?: JobRow[]; lines?: JobLineRow[]; viewer?: string | null; database?: boolean; serviceRole?: boolean;
} = {}) {
  const logged: string[] = [];
  let now = T0;
  const { store, state } = fakeStore({ jobs, lines, now: () => now });
  const service = runnersService(store, {
    now: () => now,
    sleep: (ms) => {
      now = new Date(now.getTime() + ms);
      return Promise.resolve();
    },
  });
  const deps: RunnersDeps = {
    connect: database ? connect : null,
    session: database ? () => Promise.resolve(viewer) : null,
    service: serviceRole ? service : null,
    log: (line) => { logged.push(line); },
  };
  return { deps, state, logged };
}

const URL_BASE = 'https://omni.test/api/runners';

function kit(path: string, token: string | null, init: RequestInit = {}) {
  return new Request(`${URL_BASE}${path}`, { ...init, headers: token ? { authorization: `Bearer ${token}` } : {} });
}

const post = (path: string, token: string | null, body: unknown) => kit(path, token, { method: 'POST', body: JSON.stringify(body) });
const browser = (path: string, body: unknown, method = 'POST') => new Request(`${URL_BASE}${path}`, { method, body: JSON.stringify(body) });

async function read(response: Response) {
  return { status: response.status, body: response.status === 204 ? null : await response.json() as unknown };
}

describe('the kit\'s sign-in', () => {
  it.each([
    ['missing', null],
    ['bad', 'stolen-token'],
  ])('refuses a %s token before anything runs', async (_, token) => {
    const w = world({ jobs: [jobRow()] });
    expect((await registerRunner(post('/register', token, { name: 'x', slots: 1, repos: ['vertuoza/app'], version: '1' }), w.deps)).status).toBe(401);
    expect((await nextJob(kit(`/next?runner=${SHARED}`, token), w.deps)).status).toBe(401);
    expect((await reportJob(post('/jobs/x', token, { status: 'running' }), 'x', w.deps)).status).toBe(401);
    expect(w.state.jobs[0]?.status).toBe('queued');
    expect(w.state.runners.map((r) => r.name)).not.toContain('x');
  });

  it('answers 503 with no database, and with no service role', async () => {
    expect((await nextJob(kit(`/next?runner=${SHARED}`, 'olga-token'), world({ database: false }).deps)).status).toBe(503);
    expect(await read(await nextJob(kit(`/next?runner=${SHARED}`, 'olga-token'), world({ serviceRole: false }).deps)))
      .toEqual({ status: 503, body: { error: 'Runners are not available here: this deployment has no service role.' } });
  });
});

describe('POST /api/runners/register', () => {
  it('registers the runner and answers its id', async () => {
    const w = world();
    const answered = await read(await registerRunner(post('/register', 'olga-token', { name: 'vertuo-agents', slots: 4, repos: ['vertuoza/app'], version: '0.0.387' }), w.deps));
    expect(answered).toMatchObject({ status: 200, body: { name: 'vertuo-agents', fleet: null } });
  });

  it('refuses a malformed body, and a name someone else registered', async () => {
    const w = world();
    expect((await registerRunner(post('/register', 'olga-token', { name: 'x', slots: 9, repos: ['vertuoza/app'], version: '1' }), w.deps)).status).toBe(400);
    expect((await registerRunner(kit('/register', 'olga-token', { method: 'POST', body: 'not json' }), w.deps)).status).toBe(400);
    expect((await registerRunner(post('/register', 'mo-token', { name: 'shared', slots: 1, repos: ['vertuoza/app'], version: '1' }), w.deps)).status).toBe(403);
  });
});

describe('GET /api/runners/next', () => {
  it('answers the job claimed at once', async () => {
    const job = jobRow({ line: '/omni:yolo 1717' });
    const w = world({ jobs: [job] });
    expect(await read(await nextJob(kit(`/next?runner=${SHARED}`, 'olga-token'), w.deps)))
      .toEqual({ status: 200, body: { id: job.id, line: '/omni:yolo 1717', repo: 'vertuoza/app', sentBy: 'mo' } });
  });

  it('answers 204 after the hold, and counts the check-in', async () => {
    const w = world();
    const response = await nextJob(kit(`/next?runner=${SHARED}`, 'olga-token'), w.deps);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(w.state.calls.filter((call) => call === `claim ${SHARED}`).length).toBeGreaterThan(1);
  });

  it('refuses a malformed runner, someone else\'s runner and an unknown one', async () => {
    const w = world();
    expect((await nextJob(kit('/next?runner=nope', 'olga-token'), w.deps)).status).toBe(400);
    expect((await nextJob(kit(`/next?runner=${SHARED}`, 'mo-token'), w.deps)).status).toBe(403);
    expect((await nextJob(kit('/next?runner=00000000-0000-4000-8000-000001830fff', 'olga-token'), w.deps)).status).toBe(404);
  });
});

describe('POST /api/runners/jobs/<id>, a runner\'s report', () => {
  const claimed = () => jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString() });

  it('takes the reports in order, and answers whether a cancel waits', async () => {
    const job = claimed();
    const w = world({ jobs: [job] });
    expect(await read(await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running', logTail: 'hello' }), job.id, w.deps)))
      .toEqual({ status: 200, body: { cancel: false } });
    w.state.jobs[0] = { ...w.state.jobs[0] as JobRow, cancel_requested: true };
    expect(await read(await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running' }), job.id, w.deps)))
      .toEqual({ status: 200, body: { cancel: true } });
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'cancelled' }), job.id, w.deps)).status).toBe(200);
  });

  it('refuses a report after the job ended, out of order', async () => {
    const job = jobRow({ status: 'done', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    expect(await read(await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running' }), job.id, w.deps)))
      .toEqual({ status: 409, body: { error: 'This job has ended: done. Stop it.' } });
  });

  it('refuses another person\'s job, a malformed report and an unknown job', async () => {
    const job = claimed();
    const w = world({ jobs: [job] });
    expect((await reportJob(post(`/jobs/${job.id}`, 'mo-token', { status: 'running' }), job.id, w.deps)).status).toBe(403);
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'claimed' }), job.id, w.deps)).status).toBe(400);
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'done', prUrl: 'javascript:alert(1)' }), job.id, w.deps)).status).toBe(400);
    expect((await reportJob(post('/jobs/nope', 'olga-token', { status: 'running' }), 'nope', w.deps)).status).toBe(404);
  });
});

describe('POST /api/runners/jobs, from the browser', () => {
  it('queues a job and answers it', async () => {
    const w = world({ viewer: MO });
    const answered = await read(await sendJob(browser('/jobs', { line: '/omni:yolo 1717', repo: 'vertuoza/app', target: { kind: 'fleet', fleet: 'cia' } }), w.deps));
    expect(answered).toMatchObject({ status: 200, body: { job: { line: '/omni:yolo 1717', toFleet: 'cia', status: 'queued', sentByLogin: 'mo' } } });
  });

  it('refuses a sender outside the fleet, a line off the list and a repository outside the workspace', async () => {
    const w = world({ viewer: PIA });
    expect(await read(await sendJob(browser('/jobs', { line: '/omni:yolo 1717', repo: 'vertuoza/app', target: { kind: 'runner', runner: CIA_BOX } }), w.deps)))
      .toEqual({ status: 403, body: { error: 'cia-box serves cia: only its players and the workspace\'s owners send to it.' } });
    expect((await sendJob(browser('/jobs', { line: '/omni:brainstorm x', repo: 'vertuoza/app', target: { kind: 'any' } }), w.deps)).status).toBe(400);
    expect((await sendJob(browser('/jobs', { line: '/omni:yolo 1', repo: 'elsewhere/app', target: { kind: 'any' } }), w.deps)).status).toBe(403);
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses a browser with no session', async () => {
    const w = world({ viewer: null });
    expect(await read(await sendJob(browser('/jobs', { line: '/omni:yolo 1', repo: 'vertuoza/app', target: { kind: 'any' } }), w.deps)))
      .toEqual({ status: 401, body: { error: 'Sign in first.' } });
  });
});

describe('POST /api/runners/jobs/<id>/cancel', () => {
  it('cancels a queued job for its sender, and refuses anyone else', async () => {
    const job = jobRow({ sent_by: MO });
    expect(await read(await cancelJob(job.id, world({ jobs: [job], viewer: PIA }).deps))).toMatchObject({ status: 403 });
    expect(await read(await cancelJob(job.id, world({ jobs: [job], viewer: MO }).deps))).toMatchObject({ status: 200, body: { job: { status: 'cancelled' } } });
    expect((await cancelJob('nope', world({ viewer: MO }).deps)).status).toBe(404);
  });
});

describe('PATCH /api/runners/<id>', () => {
  it('lets an owner set a fleet, and refuses a non-owner', async () => {
    expect(await read(await setRunnerFleet(browser(`/${SHARED}`, { fleet: 'cia' }, 'PATCH'), SHARED, world({ viewer: OLGA }).deps)))
      .toMatchObject({ status: 200, body: { runner: { id: SHARED, fleet: 'cia' } } });
    expect(await read(await setRunnerFleet(browser(`/${SHARED}`, { fleet: 'cia' }, 'PATCH'), SHARED, world({ viewer: MO }).deps)))
      .toEqual({ status: 403, body: { error: 'Only a workspace owner gives a runner to a fleet.' } });
    expect((await setRunnerFleet(browser(`/${SHARED}`, { fleet: 7 }, 'PATCH'), SHARED, world({ viewer: OLGA }).deps)).status).toBe(400);
  });
});

describe('a report\'s live lines (PRD 1904)', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });

  it('stores the lines a report carries, once each', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    const report = { status: 'running', logTail: 'tail', from: 1, lines: ['12:04:31 Bash: pnpm test', '12:04:40 Edit: src/a.ts'] };
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', report), job.id, w.deps)).status).toBe(200);
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', report), job.id, w.deps)).status).toBe(200);
    expect(w.state.lines.map((row) => [row.seq, row.text])).toEqual([[1, '12:04:31 Bash: pnpm test'], [2, '12:04:40 Edit: src/a.ts']]);
  });

  it('takes a full report: 2,000 lines of 600 characters beside a 16 KB tail', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    const lines = Array.from({ length: 2000 }, (_, i) => `12:04:31 Bash: echo "${String(i)}" ${'x'.repeat(560)}`.slice(0, 600));
    const response = await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running', logTail: 'x'.repeat(16 * 1024), from: 1, lines }), job.id, w.deps);
    expect(response.status).toBe(200);
    expect(w.state.lines).toHaveLength(2000);
  });

  it('refuses lines without from, and too many lines', async () => {
    const job = running();
    const w = world({ jobs: [job] });
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running', lines: ['a'] }), job.id, w.deps)).status).toBe(400);
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running', from: 1, lines: Array.from({ length: 2001 }, () => 'a') }), job.id, w.deps)).status).toBe(400);
    expect(w.state.lines).toEqual([]);
  });
});

describe('GET /api/runners/jobs/<id>/lines', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString(), log_tail: 'tail' });
  const get = (id: string, query = '') => new Request(`${URL_BASE}/jobs/${id}/lines${query}`);

  it('answers a member the lines after `after`, in order, with more, first and no tail', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 1, 3), viewer: PIA });
    const response = await jobLines(get(job.id, '?after=1'), job.id, w.deps);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await read(response)).toEqual({
      status: 200, body: { status: 'running', lines: [{ seq: 2, text: 'line 2' }, { seq: 3, text: 'line 3' }], more: false, first: 1, logTail: null },
    });
  });

  it('reads from the first line when `after` is not given, at most 5,000 at a time', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 1, 5_001) });
    const body = (await read(await jobLines(get(job.id), job.id, w.deps))).body as { lines: unknown[]; more: boolean; first: number };
    expect([body.lines.length, body.more, body.first]).toEqual([5_000, true, 1]);
  });

  it('answers the log tail of a job that holds no line', async () => {
    const job = running();
    expect(await read(await jobLines(get(job.id), job.id, world({ jobs: [job] }).deps)))
      .toEqual({ status: 200, body: { status: 'running', lines: [], more: false, first: null, logTail: 'tail' } });
  });

  it('answers 404 to a non-member, for an unknown job and for an id that is none', async () => {
    const job = running();
    const elsewhere = world({ jobs: [job], lines: lineRows(job, 1, 3), viewer: EVE });
    expect(await read(await jobLines(get(job.id), job.id, elsewhere.deps))).toEqual({ status: 404, body: { error: 'No such job.' } });
    expect((await jobLines(get('00000000-0000-4000-8000-000001830fff'), '00000000-0000-4000-8000-000001830fff', world({ viewer: MO }).deps)).status).toBe(404);
    expect((await jobLines(get('nope'), 'nope', world({ viewer: MO }).deps)).status).toBe(404);
  });

  it('refuses a malformed `after`, and a browser with no session', async () => {
    const job = running();
    expect((await jobLines(get(job.id, '?after=-1'), job.id, world({ jobs: [job] }).deps)).status).toBe(400);
    expect((await jobLines(get(job.id, '?after=1&x=2'), job.id, world({ jobs: [job] }).deps)).status).toBe(400);
    expect(await read(await jobLines(get(job.id), job.id, world({ jobs: [job], viewer: null }).deps))).toEqual({ status: 401, body: { error: 'Sign in first.' } });
  });
});

describe('a failure', () => {
  it('answers 500 in plain words and logs the cause', async () => {
    const w = world();
    const broken: RunnersDeps = { ...w.deps, service: { ...w.deps.service, next: () => Promise.reject(new Error('runner_claim(): connection reset')) } as RunnersDeps['service'] };
    expect(await read(await nextJob(kit(`/next?runner=${SHARED}`, 'olga-token'), broken)))
      .toEqual({ status: 500, body: { error: 'The runners could not answer. Try again.' } });
    expect(w.logged).toEqual(['runners: runner_claim(): connection reset']);
  });
});
