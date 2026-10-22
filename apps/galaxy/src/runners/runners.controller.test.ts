import { describe, expect, it } from 'vitest';
import type { TokenCheck } from '../ask/auth';
import {
  answerQuestions, askQuestions, cancelJob, dismissQuestions, jobLines, listRunners, nextJob, prdJobs, readQuestions, registerRunner, reportHealth, reportJob, sendJob, setRunnerFleet, type RunnersDeps,
} from './runners.controller';
import { ANSWER_CHARS } from './runners.contract';
import type { JobLineRow, JobRow, QuestionsRow } from './runners.repository';
import { runnersService } from './runners.service';
import { CIA_BOX, EVE, fakeStore, jobRow, lineRows, MO, OLGA, PIA, QUESTION, questionsRow, SHARED, T0 } from './fixtures/store.fake';

// The runners' routes (PRD 1830 s1), with the real service on the fake store: the sign-in is checked
// before anything else (the kit's for a runner's routes, the session for the browser's), each answer is
// in the contract's shape, and each refusal is `{error}` in plain words with its status.

const TOKENS: Record<string, string> = { 'olga-token': OLGA, 'mo-token': MO, 'eve-token': EVE };

/** The Auth server's verdict on a token: the person it names, or none. */
const connect = (): TokenCheck => ({
  auth: {
    getUser: (jwt: string) => {
      const id = TOKENS[jwt];
      return Promise.resolve(id ? { data: { user: { id, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } });
    },
  },
});

function world({ jobs = [], lines = [], questions = [], viewer = MO, database = true, serviceRole = true }: {
  jobs?: JobRow[]; lines?: JobLineRow[]; questions?: QuestionsRow[]; viewer?: string | null; database?: boolean; serviceRole?: boolean;
} = {}) {
  const logged: string[] = [];
  let now = T0;
  const { store, state } = fakeStore({ jobs, lines, questions, now: () => now });
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
    expect((await registerRunner(post('/register', token, { name: 'x', slots: 1, repos: ['demo-org/app'], version: '1' }), w.deps)).status).toBe(401);
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
    const answered = await read(await registerRunner(post('/register', 'olga-token', { name: 'nimbus-agents', slots: 4, repos: ['demo-org/app'], version: '0.0.387' }), w.deps));
    expect(answered).toMatchObject({ status: 200, body: { name: 'nimbus-agents', fleet: null } });
  });

  it('refuses a malformed body, and a name someone else registered', async () => {
    const w = world();
    expect((await registerRunner(post('/register', 'olga-token', { name: 'x', slots: 9, repos: ['demo-org/app'], version: '1' }), w.deps)).status).toBe(400);
    expect((await registerRunner(kit('/register', 'olga-token', { method: 'POST', body: 'not json' }), w.deps)).status).toBe(400);
    expect((await registerRunner(post('/register', 'mo-token', { name: 'shared', slots: 1, repos: ['demo-org/app'], version: '1' }), w.deps)).status).toBe(403);
  });
});

describe('GET /api/runners/next', () => {
  it('answers the job claimed at once', async () => {
    const job = jobRow({ line: '/omni:yolo 1717' });
    const w = world({ jobs: [job] });
    expect(await read(await nextJob(kit(`/next?runner=${SHARED}`, 'olga-token'), w.deps)))
      .toEqual({ status: 200, body: { id: job.id, line: '/omni:yolo 1717', repo: 'demo-org/app', sentBy: 'mo', allowedSkills: [] } });
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

  it('stores the tokens a report carries, and refuses tokens out of shape', async () => {
    const job = claimed();
    const w = world({ jobs: [job] });
    const tokens = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 };
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running', tokens }), job.id, w.deps)).status).toBe(200);
    expect(w.state.jobs[0]?.tokens).toEqual(tokens);
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'running', tokens: { ...tokens, input: -1 } }), job.id, w.deps)).status).toBe(400);
    expect(w.state.jobs[0]?.tokens).toEqual(tokens);
  });

  it('stores the claims a last report says were released, and why a release failed (PRD 2175)', async () => {
    const job = claimed();
    const w = world({ jobs: [job] });
    const report = { status: 'failed', reason: 'exit code 3', released: [1908, 1909], releaseError: 'HTTP 502' };
    expect(await read(await reportJob(post(`/jobs/${job.id}`, 'olga-token', report), job.id, w.deps))).toEqual({ status: 200, body: { cancel: false } });
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', released: [1908, 1909], release_error: 'HTTP 502' });
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'failed', released: ['#1'] }), job.id, w.deps)).status).toBe(400);
  });

  it('takes what a runner released for a job already lost, and nothing else after it ended (PRD 2175)', async () => {
    const job = jobRow({ status: 'failed', reason: 'runner lost', runner_id: SHARED, claimed_at: T0.toISOString(), ended_at: T0.toISOString() });
    const w = world({ jobs: [job] });
    expect(await read(await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'failed', released: [7], releaseError: null }), job.id, w.deps)))
      .toEqual({ status: 200, body: { cancel: false } });
    expect(w.state.jobs[0]).toMatchObject({ status: 'failed', reason: 'runner lost', released: [7], release_error: null, ended_at: T0.toISOString() });
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'failed', released: [8], reason: 'exit code 1' }), job.id, w.deps)).status).toBe(409);
    expect((await reportJob(post(`/jobs/${job.id}`, 'olga-token', { status: 'done', released: [8] }), job.id, w.deps)).status).toBe(409);
    expect(w.state.jobs[0]).toMatchObject({ reason: 'runner lost', released: [7] });
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
    const answered = await read(await sendJob(browser('/jobs', { line: '/omni:yolo 1717', repo: 'demo-org/app', target: { kind: 'fleet', fleet: 'cia' } }), w.deps));
    expect(answered).toMatchObject({ status: 200, body: { job: { line: '/omni:yolo 1717', toFleet: 'cia', status: 'queued', sentByLogin: 'mo' } } });
  });

  it('refuses a sender outside the fleet, a line off the list and a repository outside the workspace', async () => {
    const w = world({ viewer: PIA });
    expect(await read(await sendJob(browser('/jobs', { line: '/omni:yolo 1717', repo: 'demo-org/app', target: { kind: 'runner', runner: CIA_BOX } }), w.deps)))
      .toEqual({ status: 403, body: { error: 'cia-box serves cia: only its players and the workspace\'s owners send to it.' } });
    expect((await sendJob(browser('/jobs', { line: '/omni:brainstorm x', repo: 'demo-org/app', target: { kind: 'any' } }), w.deps)).status).toBe(400);
    expect((await sendJob(browser('/jobs', { line: '/omni:yolo 1', repo: 'elsewhere/app', target: { kind: 'any' } }), w.deps)).status).toBe(403);
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses a browser with no session', async () => {
    const w = world({ viewer: null });
    expect(await read(await sendJob(browser('/jobs', { line: '/omni:yolo 1', repo: 'demo-org/app', target: { kind: 'any' } }), w.deps)))
      .toEqual({ status: 401, body: { error: 'Sign in first.' } });
  });
});

describe('POST /api/runners/jobs, from a service (PRD 1972)', () => {
  const send = (token: string | null, repo = 'demo-org/app') =>
    post('/jobs', token, { line: '/omni:bug-fix https://github.com/demo-org/app/issues/1', repo, target: { kind: 'any' } });

  it('queues the job of a member\'s Bearer, sent by its person', async () => {
    const w = world({ viewer: null });
    expect(await read(await sendJob(send('mo-token'), w.deps)))
      .toMatchObject({ status: 200, body: { job: { status: 'queued', sentByLogin: 'mo' } } });
    expect(w.state.jobs).toHaveLength(1);
  });

  it('refuses a non-member\'s Bearer and a repository outside every workspace with 403', async () => {
    const w = world({ viewer: null });
    expect((await sendJob(send('eve-token'), w.deps)).status).toBe(403);
    expect((await sendJob(send('mo-token', 'elsewhere/app'), w.deps)).status).toBe(403);
    expect(w.state.jobs).toEqual([]);
  });

  it('refuses a bad Bearer with 401, even beside a valid session', async () => {
    const w = world({ viewer: MO });
    expect((await sendJob(send('stolen-token'), w.deps)).status).toBe(401);
    expect(w.state.jobs).toEqual([]);
  });

  it('judges a header with no token by the header alone, never by the session', async () => {
    const w = world({ viewer: MO });
    const body = JSON.stringify({ line: '/omni:yolo 1', repo: 'demo-org/app', target: { kind: 'any' } });
    expect((await sendJob(new Request(`${URL_BASE}/jobs`, { method: 'POST', headers: { authorization: 'Bearer ' }, body }), w.deps)).status).toBe(401);
  });

  it('still queues from the session when there is no header', async () => {
    const w = world({ viewer: MO });
    expect((await sendJob(send(null), w.deps)).status).toBe(200);
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

// PRD 2251 s1: the terminal's own reads. The kit's sign-in reads the runners and a PRD's jobs of the
// workspace its repository belongs to, and a job's live lines, a member of that workspace only.
describe('GET /api/runners, from the terminal (PRD 2251)', () => {
  it('answers a member the workspace\'s runners, in the contract\'s shape', async () => {
    const response = await listRunners(kit('?repo=demo-org/app', 'mo-token'), world().deps);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await read(response)).toMatchObject({
      status: 200, body: { runners: [{ name: 'cia-box', fleet: 'cia', state: 'online', used: 0, slots: 4, repos: ['demo-org/app'] }, { name: 'other' }, { name: 'shared' }] },
    });
  });

  it('refuses a missing or bad token with 401, even beside a valid session', async () => {
    expect((await listRunners(kit('?repo=demo-org/app', null), world({ viewer: MO }).deps)).status).toBe(401);
    expect((await listRunners(kit('?repo=demo-org/app', 'stolen-token'), world({ viewer: MO }).deps)).status).toBe(401);
  });

  it('refuses a person outside the workspace with 403, and a query that names no repository with 400', async () => {
    expect((await listRunners(kit('?repo=demo-org/app', 'eve-token'), world().deps)).status).toBe(403);
    expect(await read(await listRunners(kit('', 'mo-token'), world().deps))).toEqual({ status: 400, body: { error: 'Name the repository as `repo=owner/name`.' } });
    expect((await listRunners(kit('?repo=app', 'mo-token'), world().deps)).status).toBe(400);
  });
});

describe('GET /api/runners/jobs, from the terminal (PRD 2251)', () => {
  it('answers a member the PRD\'s jobs in the repository, newest first', async () => {
    const older = jobRow({ line: '/omni:yolo 2251', queued_at: new Date(T0.getTime() - 60_000).toISOString() });
    const newer = jobRow({ line: '/omni:yolo-fix 2251' });
    const w = world({ jobs: [older, newer, jobRow({ line: '/omni:yolo 1717' })] });
    const answered = await read(await prdJobs(kit('/jobs?repo=demo-org/app&prd=2251', 'mo-token'), w.deps));
    expect(answered.status).toBe(200);
    expect((answered.body as { jobs: { id: string }[] }).jobs.map((job) => job.id)).toEqual([newer.id, older.id]);
  });

  it('refuses a missing token with 401, a person outside the workspace with 403, and a malformed query with 400', async () => {
    const w = world({ jobs: [jobRow({ line: '/omni:yolo 2251' })], viewer: MO });
    expect((await prdJobs(kit('/jobs?repo=demo-org/app&prd=2251', null), w.deps)).status).toBe(401);
    expect((await prdJobs(kit('/jobs?repo=demo-org/app&prd=2251', 'eve-token'), w.deps)).status).toBe(403);
    for (const query of ['?repo=demo-org/app', '?prd=2251', '?repo=demo-org/app&prd=x', '?repo=demo-org/app&prd=0']) {
      expect(await read(await prdJobs(kit(`/jobs${query}`, 'mo-token'), w.deps)))
        .toEqual({ status: 400, body: { error: 'Name the repository as `repo=owner/name` and the PRD as `prd=<number>`.' } });
    }
  });
});

describe('GET /api/runners/jobs/<id>/lines, from the terminal (PRD 2251)', () => {
  const running = () => jobRow({ status: 'running', runner_id: SHARED, claimed_at: T0.toISOString(), running_at: T0.toISOString() });
  const get = (id: string, token: string | null, query = '') => kit(`/jobs/${id}/lines${query}`, token);

  it('answers a member of the job\'s workspace with the kit\'s sign-in', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 1, 3), viewer: null });
    expect(await read(await jobLines(get(job.id, 'mo-token', '?after=2'), job.id, w.deps)))
      .toEqual({ status: 200, body: { status: 'running', lines: [{ seq: 3, text: 'line 3' }], more: false, first: 1, logTail: null } });
  });

  it('answers 404 to a token outside the job\'s workspace, as to a session there', async () => {
    const job = running();
    const w = world({ jobs: [job], lines: lineRows(job, 1, 3), viewer: MO });
    expect(await read(await jobLines(get(job.id, 'eve-token'), job.id, w.deps))).toEqual({ status: 404, body: { error: 'No such job.' } });
  });

  it('refuses a bad token with 401, even beside a valid session', async () => {
    const job = running();
    expect((await jobLines(get(job.id, 'stolen-token'), job.id, world({ jobs: [job], viewer: MO }).deps)).status).toBe(401);
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

// A runner's health report (PRD 2102 s1): the kit's sign-in first, then a strict report on the caller's
// own runner; a 200 stores its last health and one sample.
describe('POST /api/runners/<id>/health', () => {
  const REPORT = { cpu: 63.5, load1: 7.9, cores: 8, memUsed: 13_958_643_712, memTotal: 17_179_869_184, diskFree: 41_875_931_136, diskTotal: 249_821_655_040 };
  const health = (id: string, token: string | null, body: unknown) => reportHealth(post(`/${id}/health`, token, body), id, world().deps);

  it('stores the runner\'s last health and one sample, and answers when it took them', async () => {
    const w = world();
    expect(await read(await reportHealth(post(`/${SHARED}/health`, 'olga-token', REPORT), SHARED, w.deps))).toEqual({ status: 200, body: { at: T0.toISOString() } });
    expect(w.state.runners.find((r) => r.id === SHARED)?.health).toEqual({ ...REPORT, at: T0.toISOString() });
    expect(w.state.samples).toHaveLength(1);
  });

  it('refuses a malformed report: a negative figure, an unknown field, or no JSON', async () => {
    expect(await read(await health(SHARED, 'olga-token', { ...REPORT, memUsed: -1 }))).toMatchObject({ status: 400, body: { error: expect.stringContaining('"cpu"') as unknown } });
    expect((await health(SHARED, 'olga-token', { ...REPORT, hostname: 'box-1' })).status).toBe(400);
    expect((await reportHealth(kit(`/${SHARED}/health`, 'olga-token', { method: 'POST', body: 'not json' }), SHARED, world().deps)).status).toBe(400);
  });

  it('refuses the signed out, another owner\'s runner and an unknown one, writing nothing', async () => {
    const w = world();
    expect((await reportHealth(post(`/${SHARED}/health`, null, REPORT), SHARED, w.deps)).status).toBe(401);
    expect((await reportHealth(post(`/${SHARED}/health`, 'mo-token', REPORT), SHARED, w.deps)).status).toBe(403);
    expect((await reportHealth(post(`/${CIA_BOX}/health`, 'eve-token', REPORT), CIA_BOX, w.deps)).status).toBe(403);
    expect((await reportHealth(post('/00000000-0000-4000-8000-000001830fff/health', 'olga-token', REPORT), '00000000-0000-4000-8000-000001830fff', w.deps)).status).toBe(404);
    expect((await reportHealth(post('/nope/health', 'olga-token', REPORT), 'nope', w.deps)).status).toBe(404);
    expect(w.state.samples).toEqual([]);
    expect(w.state.runners.every((r) => r.health === null)).toBe(true);
  });
});

// A job's questions and their answers (PRD 2255 s1): a runner's token posts the questions and may read them
// back; only a person's session answers or dismisses (BR-PRODUCT-94), and the first answer wins.
describe('a job\'s questions (PRD 2255)', () => {
  const times = { claimed_at: T0.toISOString(), running_at: T0.toISOString() };
  /** A bug fix running on the shared runner, which Olga owns, sent by Olga to the fleet cia. */
  const running = () => jobRow({ status: 'running', runner_id: SHARED, line: '/omni:bug-fix #314', sent_by: OLGA, to_fleet: 'cia', ...times });
  /** The same job, ended `done` with its questions open: Need human. */
  const waiting = () => ({ ...running(), status: 'done' as const, outcome: 'human' as const, ended_at: T0.toISOString() });
  const ASK = { issue: 314, lead: 'The planning query fails for 31 tenants.', questions: [QUESTION] };
  const ANSWERS = { answers: { 'Which fix?': 'Guard the input' } };
  const NOBODY = '00000000-0000-4000-8000-0000022559f9';
  const bearer = (id: string, route: 'answers' | 'dismiss', token: string, body: unknown = {}) => post(`/jobs/${id}/${route}`, token, body);

  describe('POST /api/runners/jobs/<id>/questions', () => {
    it('stores the questions of a running job for the owner of its runner, and answers them open', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      expect(await read(await askQuestions(post(`/jobs/${job.id}/questions`, 'olga-token', ASK), job.id, w.deps))).toEqual({
        status: 200,
        body: { job: job.id, issue: 314, lead: ASK.lead, questions: [QUESTION], state: 'open', answers: null, by: null, byLogin: null, byKey: null, actingFor: null, at: null, resume: null },
      });
      expect(w.state.questions).toEqual([questionsRow({ job_id: job.id, lead: ASK.lead, questions: [QUESTION] })]);
    });

    it('refuses the signed out and a bad token before anything runs', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      for (const token of [null, 'stolen-token']) {
        expect((await askQuestions(post(`/jobs/${job.id}/questions`, token, ASK), job.id, w.deps)).status).toBe(401);
      }
      expect(w.state.questions).toEqual([]);
    });

    it('refuses a body out of shape: no JSON, an unknown field, no question, a question twice, or an issue that is none', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      const same = (body: unknown) => askQuestions(post(`/jobs/${job.id}/questions`, 'olga-token', body), job.id, w.deps);
      expect(await read(await same({ ...ASK, extra: 1 }))).toMatchObject({ status: 400, body: { error: expect.stringContaining('"issue"') as unknown } });
      expect((await same({ ...ASK, questions: [] })).status).toBe(400);
      expect((await same({ ...ASK, questions: [QUESTION, QUESTION] })).status).toBe(400);
      expect((await same({ ...ASK, issue: 0 })).status).toBe(400);
      expect((await same({ ...ASK, issue: '314' })).status).toBe(400);
      expect((await askQuestions(kit(`/jobs/${job.id}/questions`, 'olga-token', { method: 'POST', body: 'not json' }), job.id, w.deps)).status).toBe(400);
      expect(w.state.questions).toEqual([]);
    });

    it('refuses a runner that is not the job\'s, 404s an unknown job and an id that is none', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      expect((await askQuestions(post(`/jobs/${job.id}/questions`, 'mo-token', ASK), job.id, w.deps)).status).toBe(403);
      expect((await askQuestions(post(`/jobs/${NOBODY}/questions`, 'olga-token', ASK), NOBODY, w.deps)).status).toBe(404);
      expect((await askQuestions(post('/jobs/nope/questions', 'olga-token', ASK), 'nope', w.deps)).status).toBe(404);
      expect(w.state.questions).toEqual([]);
    });

    it('answers 409 for a job that is not running and for one that asked already', async () => {
      const ended = waiting();
      const job = running();
      const w = world({ jobs: [ended, job] });
      expect(await read(await askQuestions(post(`/jobs/${ended.id}/questions`, 'olga-token', ASK), ended.id, w.deps)))
        .toEqual({ status: 409, body: { error: 'This job is done: only a running job asks.' } });
      expect((await askQuestions(post(`/jobs/${job.id}/questions`, 'olga-token', ASK), job.id, w.deps)).status).toBe(200);
      expect(await read(await askQuestions(post(`/jobs/${job.id}/questions`, 'olga-token', ASK), job.id, w.deps)))
        .toEqual({ status: 409, body: { error: 'This job asked its questions already.' } });
    });

    it('answers 503 with no database, and with no service role', async () => {
      const job = running();
      expect((await askQuestions(post(`/jobs/${job.id}/questions`, 'olga-token', ASK), job.id, world({ jobs: [job], database: false }).deps)).status).toBe(503);
      expect((await askQuestions(post(`/jobs/${job.id}/questions`, 'olga-token', ASK), job.id, world({ jobs: [job], serviceRole: false }).deps)).status).toBe(503);
    });

    it('answers 500 in plain words and logs the cause when the database fails', async () => {
      const job = running();
      const w = world({ jobs: [job] });
      const broken: RunnersDeps = { ...w.deps, service: { ...w.deps.service, ask: () => Promise.reject(new Error('runner_job_questions: connection reset')) } as RunnersDeps['service'] };
      expect(await read(await askQuestions(post(`/jobs/${job.id}/questions`, 'olga-token', ASK), job.id, broken)))
        .toEqual({ status: 500, body: { error: 'The runners could not answer. Try again.' } });
      expect(w.logged).toEqual(['runners: runner_job_questions: connection reset']);
    });
  });

  describe('GET /api/runners/jobs/<id>/questions', () => {
    it('answers a member of the workspace in the browser the questions, open, with no answers yet', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })], viewer: PIA });
      const response = await readQuestions(new Request(`${URL_BASE}/jobs/${job.id}/questions`), job.id, w.deps);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await read(response)).toMatchObject({ status: 200, body: { job: job.id, state: 'open', questions: [QUESTION], answers: null } });
    });

    it('answers a runner\'s owner with the kit\'s sign-in, the answers once they are given', async () => {
      const job = waiting();
      const answered = questionsRow({ job_id: job.id, answers: ANSWERS.answers, closed_by: MO, closed_at: T0.toISOString(), resume_job: NOBODY });
      const w = world({ jobs: [job], questions: [answered], viewer: null });
      expect(await read(await readQuestions(kit(`/jobs/${job.id}/questions`, 'olga-token'), job.id, w.deps))).toMatchObject({
        status: 200, body: { state: 'answered', answers: ANSWERS.answers, by: MO, byLogin: 'mo', at: T0.toISOString(), resume: NOBODY },
      });
    });

    it('answers 404 to a member of another workspace, for a job that asked nothing, and for an id that is none', async () => {
      const job = waiting();
      const w = world({ jobs: [job, running()], questions: [questionsRow({ job_id: job.id })], viewer: EVE });
      expect(await read(await readQuestions(new Request(`${URL_BASE}/jobs/${job.id}/questions`), job.id, w.deps))).toEqual({ status: 404, body: { error: 'No such job.' } });
      expect((await readQuestions(kit(`/jobs/${job.id}/questions`, 'eve-token'), job.id, w.deps)).status).toBe(404);
      const quiet = running();
      expect((await readQuestions(new Request(`${URL_BASE}/jobs/${quiet.id}/questions`), quiet.id, world({ jobs: [quiet] }).deps)).status).toBe(404);
      expect((await readQuestions(new Request(`${URL_BASE}/jobs/nope/questions`), 'nope', world().deps)).status).toBe(404);
    });

    it('refuses the signed out, with a bad token and with no session', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })], viewer: null });
      expect(await read(await readQuestions(new Request(`${URL_BASE}/jobs/${job.id}/questions`), job.id, w.deps))).toEqual({ status: 401, body: { error: 'Sign in first.' } });
      expect((await readQuestions(kit(`/jobs/${job.id}/questions`, 'stolen-token'), job.id, w.deps)).status).toBe(401);
    });
  });

  describe('POST /api/runners/jobs/<id>/answers', () => {
    const open = () => {
      const job = waiting();
      return { job, w: world({ jobs: [job], questions: [questionsRow({ job_id: job.id })], viewer: MO }) };
    };
    const answered = (job: JobRow, w: ReturnType<typeof world>, body: unknown = ANSWERS) => answerQuestions(browser(`/jobs/${job.id}/answers`, body), job.id, w.deps);

    it('queues the resume job as the person who answered, and stores the answers', async () => {
      const { job, w } = open();
      const response = await read(await answered(job, w));
      expect(response).toMatchObject({ status: 200, body: { job: { line: `/omni:bug-fix #314 --answers ${job.id}`, status: 'queued', sentBy: MO, sentByLogin: 'mo', toFleet: 'cia' } } });
      expect(w.state.questions[0]).toMatchObject({ answers: ANSWERS.answers, closed_by: MO });
    });

    it('refuses a bearer token, a runner\'s or a person\'s, whatever session the page holds: it never answers (BR-PRODUCT-94)', async () => {
      const { job, w } = open();
      for (const token of ['olga-token', 'mo-token', 'stolen-token']) {
        expect(await read(await answerQuestions(bearer(job.id, 'answers', token, ANSWERS), job.id, w.deps)))
          .toEqual({ status: 403, body: { error: 'A token never answers: answer on the Runners page, signed in.' } });
      }
      expect(w.state.questions[0]).toMatchObject({ answers: null, closed_by: null });
      expect(w.state.jobs).toHaveLength(1);
    });

    it('refuses a body out of shape: no JSON, no answers, an answer too long, or an unknown field', async () => {
      const { job, w } = open();
      expect(await read(await answered(job, w, { answers: {} }))).toMatchObject({ status: 400, body: { error: expect.stringContaining('"answers"') as unknown } });
      expect((await answered(job, w, { answers: { 'Which fix?': 'x'.repeat(ANSWER_CHARS + 1) } })).status).toBe(400);
      expect((await answered(job, w, { ...ANSWERS, extra: 1 })).status).toBe(400);
      expect((await answered(job, w, { answers: { 'Which fix?': 3 } })).status).toBe(400);
      expect((await answerQuestions(new Request(`${URL_BASE}/jobs/${job.id}/answers`, { method: 'POST', body: 'not json' }), job.id, w.deps)).status).toBe(400);
      expect(w.state.jobs).toHaveLength(1);
    });

    it('refuses answers that miss a question or answer one that was not asked, queuing nothing', async () => {
      const { job, w } = open();
      expect((await answered(job, w, { answers: { 'Another question?': 'Guard the input' } })).status).toBe(400);
      expect((await answered(job, w, { answers: { ...ANSWERS.answers, 'Another question?': 'x' } })).status).toBe(400);
      expect(w.state.jobs).toHaveLength(1);
    });

    it('answers 404 to a member of another workspace, for a job that asked nothing and for an id that is none', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })], viewer: EVE });
      expect((await answered(job, w)).status).toBe(404);
      const quiet = waiting();
      expect((await answered(quiet, world({ jobs: [quiet], viewer: MO }))).status).toBe(404);
      expect((await answerQuestions(browser(`/jobs/${NOBODY}/answers`, ANSWERS), NOBODY, world({ viewer: MO }).deps)).status).toBe(404);
      expect((await answerQuestions(browser('/jobs/nope/answers', ANSWERS), 'nope', world({ viewer: MO }).deps)).status).toBe(404);
      expect(w.state.jobs).toHaveLength(1);
    });

    it('answers 409, naming who was first, to the second person to answer', async () => {
      const { job, w } = open();
      expect((await answered(job, w)).status).toBe(200);
      const again = answerQuestions(browser(`/jobs/${job.id}/answers`, ANSWERS), job.id, { ...w.deps, session: () => Promise.resolve(OLGA) });
      expect(await read(await again)).toEqual({ status: 409, body: { error: 'Already answered by @mo' } });
      expect(w.state.jobs).toHaveLength(2);
    });

    it('refuses the signed out with 401, and answers 503 with no database', async () => {
      const job = waiting();
      const questions = [questionsRow({ job_id: job.id })];
      expect(await read(await answered(job, world({ jobs: [job], questions, viewer: null })))).toEqual({ status: 401, body: { error: 'Sign in first.' } });
      expect((await answered(job, world({ jobs: [job], questions, database: false }))).status).toBe(503);
    });
  });

  describe('POST /api/runners/jobs/<id>/dismiss', () => {
    const dismissed = (id: string, w: ReturnType<typeof world>) => dismissQuestions(browser(`/jobs/${id}/dismiss`, {}), id, w.deps);

    it('closes the questions with no answers and queues nothing, for any member', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })], viewer: PIA });
      expect(await read(await dismissed(job.id, w))).toMatchObject({ status: 200, body: { job: job.id, state: 'dismissed', answers: null, by: PIA, byLogin: 'pia' } });
      expect(w.state.jobs).toHaveLength(1);
    });

    it('refuses a bearer token, a runner\'s or a person\'s: it never dismisses (BR-PRODUCT-94)', async () => {
      const job = waiting();
      const w = world({ jobs: [job], questions: [questionsRow({ job_id: job.id })], viewer: MO });
      for (const token of ['olga-token', 'mo-token', 'stolen-token']) {
        expect(await read(await dismissQuestions(bearer(job.id, 'dismiss', token), job.id, w.deps)))
          .toEqual({ status: 403, body: { error: 'A token never dismisses: dismiss on the Runners page, signed in.' } });
      }
      expect(w.state.questions[0]).toMatchObject({ closed_by: null, closed_at: null });
    });

    it('answers 404 to a member of another workspace and for an id that is none, 409 to a second dismiss, 401 signed out', async () => {
      const job = waiting();
      const questions = [questionsRow({ job_id: job.id })];
      expect((await dismissed(job.id, world({ jobs: [job], questions, viewer: EVE }))).status).toBe(404);
      expect((await dismissed('nope', world({ jobs: [job], questions, viewer: MO }))).status).toBe(404);
      const w = world({ jobs: [job], questions, viewer: MO });
      expect((await dismissed(job.id, w)).status).toBe(200);
      expect(await read(await dismissed(job.id, w))).toEqual({ status: 409, body: { error: 'Dismissed by @mo' } });
      expect((await dismissed(job.id, world({ jobs: [job], questions, viewer: null }))).status).toBe(401);
    });
  });
});
