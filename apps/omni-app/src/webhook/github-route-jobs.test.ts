// `/api/github` and the ledger. The knowledge pack (PRD 2676 s2): a merge adds its job before Inngest is called, the
// jobs due run after the answer, Inngest refusing an event never loses the job, and a database failure never fails
// the delivery. The checks (PRD 2688 s7): a pull request event refreshes the four checks' jobs before anything else,
// a re-run only its own, the approved label its PRD's pull requests' `pr-approved` jobs, and the jobs due run once
// the refresh's delay has gone by, on a ledger that keeps the refresh table of the spec. The fix row stamp and the
// fleet board (PRD omni-loop-3 s3): a merged pull request adds its `fix-row-stamp` job, a loop pull request its
// `fleet-board` job, none goes to Inngest, a refused add answers 500, and the jobs due run after the answer.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { readEnv } from '../env.ts';
import { APPROVED_EXTERNAL_ID, BUDGETS_EXTERNAL_ID, INBOX_EXTERNAL_ID } from '../inngest-client.ts';
import type { ClaimedJob, Finish, FinishAnswer, JobLedger, NewJob, RefreshJob, Refreshed } from '../jobs/ledger.ts';
import { PR_CHECK_KINDS, prCheckJob, type ApprovedRerun } from '../jobs/pr-checks.ts';
import { runDue, type JobHandler } from '../jobs/worker.ts';
import { SIGNED_MARKER } from 'omni-loop/kit/lib/signature.ts';
import { githubRoute, RUN_AFTER_REFRESH_MS, type RouteJobs } from './github-route.ts';

const SECRET = 'route-secret';
const SHA = 'a'.repeat(40);
const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
const REPOSITORY = { name: 'r', full_name: 'o/r', owner: { login: 'o' }, default_branch: 'main' };

const merged = JSON.stringify({
  action: 'closed',
  number: 9,
  installation: { id: 7 },
  repository: REPOSITORY,
  pull_request: { number: 9, merged: true, merged_at: '2026-10-16T09:00:00Z', merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: 'b'.repeat(40) } },
});

/** A pull request event on `o/r#9`, at `head`. */
const pushed = (head: string, action = 'synchronize') =>
  JSON.stringify({ action, number: 9, installation: { id: 7 }, repository: REPOSITORY, pull_request: { number: 9, head: { sha: head }, base: { ref: 'main' } } });

/** GitHub's Re-run button on a check run carrying `externalId`. */
const rerun = (externalId: string | null) =>
  JSON.stringify({
    action: 'rerequested',
    installation: { id: 7 },
    repository: REPOSITORY,
    check_run: { external_id: externalId, head_sha: 'head1', pull_requests: [{ number: 9, head: { sha: 'head1' }, base: { ref: 'main' } }] },
  });

/** The approved label put on issue 12 of `o/r`. */
const labelled = JSON.stringify({ action: 'labeled', installation: { id: 7 }, repository: REPOSITORY, label: { name: 'omni:approved' }, issue: { number: 12 } });

/** Jobs that do nothing but say what was asked of them, in order. */
function recording(order: string[], over: Partial<RouteJobs> = {}): RouteJobs {
  return {
    add: (job) => {
      order.push(`add ${job.kind}`);
      return Promise.resolve(true);
    },
    queue: (job) => {
      order.push(`queue ${job.kind}`);
      return Promise.resolve(true);
    },
    refresh: (job) => {
      order.push(`refresh ${job.kind}`);
      return Promise.resolve('added');
    },
    approved: () => Promise.resolve([]),
    run: () => {
      order.push('run');
      return Promise.resolve();
    },
    ...over,
  };
}

/** The route over `jobs`; each delivery signed; the work kept alive after each answer, and the pauses it waits on. */
function route(jobs: RouteJobs | null, send: () => Promise<unknown> = () => Promise.resolve()) {
  const kept: Promise<unknown>[] = [];
  const paused: { ms: number; go: () => void }[] = [];
  const pause = (ms: number) => new Promise<void>((go) => paused.push({ ms, go }));
  const { POST } = githubRoute(readEnv({ GITHUB_WEBHOOK_SECRET: SECRET }), { send, jobs, keepAlive: (work) => kept.push(work), pause });
  const post = (event: string, body: string) =>
    POST(new Request('https://omni-loop.example/api/github', { method: 'POST', body, headers: { 'x-github-event': event, 'x-hub-signature-256': sign(body) } }));
  /** Lets every pause go by, then waits for the work after every answer. */
  const settle = async () => {
    for (const one of paused.splice(0)) one.go();
    await Promise.all(kept);
  };
  return { post, kept, paused, settle };
}

/** One delivery of `body`, its work after the answer let through: the answer, and the work kept. */
async function deliver(jobs: RouteJobs | null, send: () => Promise<unknown>, body = merged, event = 'pull_request') {
  const one = route(jobs, send);
  const response = await one.post(event, body);
  await one.settle();
  return { response, kept: one.kept, paused: one.paused };
}

describe('/api/github — the knowledge pack job (PRD 2676 s2)', () => {
  it('adds the job before Inngest is called, then runs the jobs due after the answer', async () => {
    const order: string[] = [];
    const { response, kept } = await deliver(recording(order), () => {
      order.push('send');
      return Promise.resolve();
    });
    expect(response.status).toBe(200);
    expect(order[0]).toBe('add knowledge-pack');
    expect(order.at(-1)).toBe('run');
    expect(order.indexOf('queue fix-row-stamp')).toBe(1);
    expect(order.indexOf('queue knowledge-harvest')).toBe(2);
    expect(order.indexOf('send')).toBe(3);
    expect(kept).toHaveLength(1);
  });

  it('adds one job for the merge, keyed by repository and commit, and refreshes no check', async () => {
    const added: NewJob[] = [];
    const order: string[] = [];
    await deliver(recording(order, { add: (job) => Promise.resolve(added.push(job) > 0) }), () => Promise.resolve());
    expect(added.map((job) => job.key)).toEqual([`o/r@${SHA}`]);
    expect(order.filter((line) => line.startsWith('refresh'))).toEqual([]);
  });

  it('queues one knowledge-harvest job for the merge, keyed by repository and pull request, in the lane of the repository', async () => {
    const queued: NewJob[] = [];
    await deliver(recording([], { queue: (job) => Promise.resolve(queued.push(job) > 0) }), () => Promise.resolve());
    const harvest = queued.find((job) => job.kind === 'knowledge-harvest');
    expect(harvest).toMatchObject({ subject: 'o/r', lane: 'o/r', maxTries: 4 });
    expect(queued.filter((job) => job.kind === 'knowledge-harvest')).toHaveLength(1);
  });

  it('keeps the job when Inngest refuses the event', async () => {
    const added: NewJob[] = [];
    const { response } = await deliver(recording([], { add: (job) => Promise.resolve(added.push(job) > 0) }), () => Promise.reject(new Error('inngest is out')));
    expect(response.status).toBe(502);
    expect(added).toHaveLength(1);
  });

  // The merge's fix stamp job is already held in the two below (PRD omni-loop-3 s3), so only the pack's add decides.
  it('does not fail the delivery when the database fails, and runs nothing', async () => {
    const { response, kept } = await deliver(recording([], { add: () => Promise.reject(new Error('the database refused: down')), queue: () => Promise.resolve(false) }), () => Promise.resolve());
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });

  it('runs nothing when no job was added, as for a repository no product holds', async () => {
    const { response, kept } = await deliver(recording([], { add: () => Promise.resolve(false), queue: () => Promise.resolve(false) }), () => Promise.resolve());
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });

  it('adds nothing and runs nothing where the App has no database', async () => {
    const { response, kept } = await deliver(null, () => Promise.resolve());
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });
});

describe('/api/github — the checks refresh their jobs (PRD 2688 s7)', () => {
  it('a pull request event into the default branch refreshes one job of each of the four kinds before anything is sent, then runs the jobs once they are due (acceptance 1)', async () => {
    const order: string[] = [];
    const { response } = await deliver(recording(order), () => {
      order.push('send');
      return Promise.resolve();
    }, pushed('head1'));
    expect(response.status).toBe(200);
    expect(order).toEqual([...PR_CHECK_KINDS.map((kind) => `refresh ${kind}`), 'run']);
  });

  it('waits for the refresh\'s delay before it runs the jobs', async () => {
    const order: string[] = [];
    const one = route(recording(order));
    await one.post('pull_request', pushed('head1'));
    expect(one.paused.map((pause) => pause.ms)).toEqual([RUN_AFTER_REFRESH_MS]);
    expect(RUN_AFTER_REFRESH_MS).toBeGreaterThan(5000);
    expect(order).not.toContain('run');
    await one.settle();
    expect(order.at(-1)).toBe('run');
  });

  it('a re-run asked from GitHub refreshes only that check\'s job, told by its external id (acceptance 5)', async () => {
    const asked: [string | null, string][] = [[INBOX_EXTERNAL_ID, 'pr-inbox'], [APPROVED_EXTERNAL_ID, 'pr-approved'], [BUDGETS_EXTERNAL_ID, 'pr-budgets'], [null, 'pr-outbox']];
    for (const [externalId, kind] of asked) {
      const refreshed: RefreshJob[] = [];
      await deliver(recording([], { refresh: (job) => Promise.resolve(refreshed.push(job)) }), () => Promise.resolve(), rerun(externalId), 'check_run');
      expect(refreshed.map((job) => [job.kind, job.key, job.payload.headSha])).toEqual([[kind, 'o/r#9', 'head1']]);
    }
  });

  it('a database failure does not fail the delivery, and runs nothing', async () => {
    const { response, kept } = await deliver(recording([], { refresh: () => Promise.reject(new Error('the database refused: down')) }), () => Promise.resolve(), pushed('head1'));
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });

  it('refreshes nothing and runs nothing where the App has no database', async () => {
    const { response, kept } = await deliver(null, () => Promise.resolve(), pushed('head1'));
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });

  it('the approved label refreshes the `pr-approved` job of each open pull request of the PRD, after the answer (acceptance 10)', async () => {
    const order: string[] = [];
    const asked: ApprovedRerun[] = [];
    const found = (head: string, prNumber: number) =>
      prCheckJob('pr-approved', { installationId: 7, owner: 'o', repo: 'r', repository: 'o/r', prNumber: parsePr(prNumber), headSha: head });
    const jobs = recording(order, {
      approved: (one) => {
        asked.push(one);
        order.push('approved');
        return Promise.resolve([found('h1', 9), found('h2', 10)]);
      },
    });
    const { response } = await deliver(jobs, () => Promise.resolve(), labelled, 'issues');
    expect(response.status).toBe(200);
    expect(asked).toEqual([{ installationId: 7, owner: 'o', repo: 'r', repository: 'o/r', prd: parsePrd(12), trigger: 'issues.labeled' }]);
    expect(order).toEqual(['approved', 'refresh pr-approved', 'refresh pr-approved', 'run']);
  });

  it('an approval whose pull requests cannot be read is logged, and the jobs due still run', async () => {
    const order: string[] = [];
    const jobs = recording(order, { approved: () => Promise.reject(new Error('GitHub is down')) });
    const { response } = await deliver(jobs, () => Promise.resolve(), labelled, 'issues');
    expect(response.status).toBe(200);
    expect(order).toEqual(['run']);
  });
});

/** A ledger in memory that keeps the spec's refresh table, on the clock `now`. */
function fakeLedger(now: () => number) {
  type Row = { job: ClaimedJob; state: 'queued' | 'running' | 'done' | 'skipped' | 'failed'; runAfter: number; again: boolean };
  const rows = new Map<string, Row>();
  let claims = 0;
  const refresh = ({ kind, key, subject, payload, delaySeconds }: RefreshJob): Promise<Refreshed> => {
    const due = now() + delaySeconds * 1000;
    const row = rows.get(`${kind} ${key}`);
    if (!row) {
      const job = { id: `job-${String(rows.size + 1)}`, kind, key, subject, payload, tries: 0, claim: '', claimedUntil: '' };
      rows.set(`${kind} ${key}`, { job, state: 'queued', runAfter: due, again: false });
      return Promise.resolve('added');
    }
    row.job = { ...row.job, payload };
    if (row.state === 'queued') {
      row.runAfter = due;
      return Promise.resolve('updated');
    }
    if (row.state === 'running') {
      row.again = true;
      return Promise.resolve('again');
    }
    Object.assign(row, { state: 'queued', runAfter: due });
    row.job = { ...row.job, tries: 0 };
    return Promise.resolve('requeued');
  };
  const ledger: JobLedger = {
    claim: ({ limit }) => {
      const due = [...rows.values()].filter((row) => row.state === 'queued' && row.runAfter <= now()).sort((a, b) => a.runAfter - b.runAfter).slice(0, limit);
      return Promise.resolve(due.map((row) => {
        claims += 1;
        row.state = 'running';
        row.job = { ...row.job, tries: row.job.tries + 1, claim: `claim-${String(claims)}` };
        return row.job;
      }));
    },
    finish: ({ id, outcome, retryAt }: Finish): Promise<FinishAnswer> => {
      const row = [...rows.values()].find((one) => one.job.id === id);
      if (!row) return Promise.resolve('stale');
      if (row.again) {
        Object.assign(row, { state: 'queued', runAfter: now(), again: false });
        return Promise.resolve('queued');
      }
      if (outcome === 'retry' || outcome === 'waiting' || outcome === 'later') {
        Object.assign(row, { state: 'queued', runAfter: Date.parse(retryAt ?? '') });
        return Promise.resolve('queued');
      }
      row.state = outcome;
      return Promise.resolve(outcome);
    },
  };
  /** background_job_add(): a job due now, nothing for a key the kind already holds. */
  const add = ({ kind, key, subject, payload, maxTries }: NewJob): Promise<boolean> => {
    if (rows.has(`${kind} ${key}`)) return Promise.resolve(false);
    const job = { id: `job-${String(rows.size + 1)}`, kind, key, subject, payload, tries: 0, claim: '', claimedUntil: '', ...(maxTries === undefined ? {} : { maxTries }) };
    rows.set(`${kind} ${key}`, { job, state: 'queued', runAfter: now(), again: false });
    return Promise.resolve(true);
  };
  const states = () => Object.fromEntries([...rows].map(([name, row]) => [name, row.state]));
  return { refresh, add, ledger, states };
}

describe('/api/github — the fix row stamp and the fleet board are jobs of the ledger (PRD omni-loop-3 s3)', () => {
  /** A loop pull request opened into the default branch of `o/r`. */
  const opened = JSON.stringify({
    action: 'opened',
    number: 9,
    installation: { id: 7 },
    repository: REPOSITORY,
    pull_request: { number: 9, node_id: 'PR_9', html_url: 'https://github.com/o/r/pull/9', state: 'open', user: { login: 'ada' }, body: `Closes #3\n\n${SIGNED_MARKER}`, updated_at: '2026-10-16T09:00:00Z', head: { sha: 'h' }, base: { ref: 'main' } },
  });

  /** The route over a fake ledger whose handlers say what they ran; `send` records what went to Inngest. */
  function onLedger() {
    const { refresh, add, ledger, states } = fakeLedger(() => 0);
    const ran: string[] = [];
    const sent: unknown[] = [];
    const handler: JobHandler = (job) => {
      ran.push(`${job.kind} ${job.key}`);
      return Promise.resolve({ outcome: 'done' });
    };
    const handlers = { 'fix-row-stamp': handler, 'fleet-board': handler };
    const jobs: RouteJobs = { add: () => Promise.resolve(false), queue: add, refresh, approved: () => Promise.resolve([]), run: () => runDue({ ledger, handlers, log: () => undefined }) };
    const one = route(jobs, (events?: unknown) => Promise.resolve(sent.push(events)));
    return { ran, sent, states, post: one.post, settle: one.settle };
  }

  it('a merged pull request adds its `fix-row-stamp` job, run once the delivery is answered; a redelivery adds none', async () => {
    const run = onLedger();
    expect((await run.post('pull_request', merged)).status).toBe(200);
    await run.post('pull_request', merged);
    await run.settle();
    expect(run.ran).toEqual(['fix-row-stamp o/r#9@merged@2026-10-16T09:00:00Z']);
    expect(run.states()).toMatchObject({ 'fix-row-stamp o/r#9@merged@2026-10-16T09:00:00Z': 'done' });
    expect(JSON.stringify(run.sent)).not.toContain('fix.stamp');
  });

  it('a loop pull request into the default branch adds its `fleet-board` job, and sends Inngest nothing', async () => {
    const run = onLedger();
    expect((await run.post('pull_request', opened)).status).toBe(200);
    await run.settle();
    expect(run.ran).toEqual(['fleet-board o/r#9']);
    expect(run.sent).toEqual([]);
  });

  it('answers 500 when the database refuses the add, so GitHub delivers it again, and sends Inngest nothing', async () => {
    const order: string[] = [];
    const sent: string[] = [];
    const { response } = await deliver(recording(order, { queue: () => Promise.reject(new Error('the database refused: down')) }), () => Promise.resolve(sent.push('send')), merged);
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('could not add the job: the database refused: down');
    expect(sent).toEqual([]);
  });

  it('adds nothing where the App has no database, and the delivery is answered', async () => {
    const { response, kept } = await deliver(null, () => Promise.resolve(), opened);
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });
});

describe('/api/github — a canon button\'s click is a job of the ledger (PRD omni-loop-3 s4)', () => {
  /** A click of Rewrite for <persona> on the red inbox check run of `o/r#9`. */
  const clicked = JSON.stringify({
    action: 'requested_action',
    installation: { id: 7 },
    repository: REPOSITORY,
    requested_action: { identifier: 'canon-rewrite' },
    check_run: {
      id: 5,
      external_id: INBOX_EXTERNAL_ID,
      head_sha: 'h',
      output: { summary: `<!-- omni-canon ${JSON.stringify({ prd: 12, persona: 'Marc', claims: ['never#4'] })} -->` },
      pull_requests: [{ number: 9, head: { sha: 'h' } }],
    },
  });

  it('each click adds its own `canon-action` job, in the pull request\'s lane, run once the delivery is answered; nothing goes to Inngest', async () => {
    const { add, ledger } = fakeLedger(() => 0);
    const queued: NewJob[] = [];
    const ran: string[] = [];
    const sent: unknown[] = [];
    const handlers: Record<string, JobHandler> = {
      'canon-action': (job) => {
        ran.push(`${job.kind} ${String(job.payload.action)}`);
        return Promise.resolve({ outcome: 'done' });
      },
    };
    const queue = (job: NewJob) => {
      queued.push(job);
      return add(job);
    };
    const jobs: RouteJobs = { add: () => Promise.resolve(false), queue, refresh: () => Promise.resolve('added'), approved: () => Promise.resolve([]), run: () => runDue({ ledger, handlers, log: () => undefined }) };
    const one = route(jobs, (events?: unknown) => Promise.resolve(sent.push(events)));
    expect((await one.post('check_run', clicked)).status).toBe(200);
    expect((await one.post('check_run', clicked)).status).toBe(200);
    await one.settle();
    expect(queued.map(({ kind, lane, maxTries }) => ({ kind, lane, maxTries }))).toEqual([
      { kind: 'canon-action', lane: 'o/r#9', maxTries: 4 },
      { kind: 'canon-action', lane: 'o/r#9', maxTries: 4 },
    ]);
    expect(new Set(queued.map(({ key }) => key)).size).toBe(2);
    expect(ran).toEqual(['canon-action canon-rewrite', 'canon-action canon-rewrite']);
    expect(sent).toEqual([]);
  });

  it('answers 500 when the database refuses the click\'s job, so GitHub delivers it again', async () => {
    const { response } = await deliver(recording([], { queue: () => Promise.reject(new Error('the database refused: down')) }), () => Promise.resolve(), clicked, 'check_run');
    expect(response.status).toBe(500);
  });
});

describe('/api/github — the latest state wins, on a ledger that keeps the refresh table (PRD 2688 s7)', () => {
  /** The route over a fake ledger whose four checks say which head they ran on; `during` runs inside the first run. */
  function checked(during: (post: (body: string) => Promise<unknown>) => Promise<void> = () => Promise.resolve()) {
    let clock = 0;
    const ran: string[] = [];
    const { refresh, ledger } = fakeLedger(() => clock);
    let first = true;
    const handlers = Object.fromEntries(PR_CHECK_KINDS.map((kind): [string, JobHandler] => [kind, async (job) => {
      ran.push(`${kind}@${String(job.payload.headSha)}`);
      if (first && kind === 'pr-outbox') {
        first = false;
        await during(post);
      }
      return { outcome: 'done' };
    }]));
    const jobs: RouteJobs = { add: () => Promise.resolve(false), queue: () => Promise.resolve(false), refresh, approved: () => Promise.resolve([]), run: () => runDue({ ledger, handlers, log: () => undefined }) };
    const one = route(jobs);
    const post = (body: string) => one.post('pull_request', body);
    const at = (ms: number) => {
      clock = ms;
    };
    return { ran, post, at, settle: one.settle, refresh, now: () => clock };
  }

  it('three events within 5 seconds run each check once, on the latest head commit (acceptance 2)', async () => {
    const run = checked();
    for (const [ms, head] of [[0, 'head1'], [1000, 'head2'], [2000, 'head3']] as const) {
      run.at(ms);
      await run.post(pushed(head));
    }
    run.at(2000 + RUN_AFTER_REFRESH_MS);
    await run.settle();
    expect(run.ran.sort()).toEqual(PR_CHECK_KINDS.map((kind) => `${kind}@head3`).sort());
  });

  it('an event while a check runs runs that check once more, on the latest head commit, after it finishes (acceptance 3)', async () => {
    const run = checked(async (post) => {
      await post(pushed('head2'));
    });
    await run.post(pushed('head1'));
    run.at(RUN_AFTER_REFRESH_MS);
    await run.settle();
    expect(run.ran.filter((line) => line.startsWith('pr-outbox'))).toEqual(['pr-outbox@head1', 'pr-outbox@head2']);
    run.at(2 * RUN_AFTER_REFRESH_MS);
    await run.settle();
    expect(run.ran.filter((line) => line.startsWith('pr-outbox'))).toEqual(['pr-outbox@head1', 'pr-outbox@head2']);
  });

  it('an event on a pull request whose jobs are finished queues them again, with fresh tries (acceptance 4)', async () => {
    const run = checked();
    await run.post(pushed('head1'));
    run.at(RUN_AFTER_REFRESH_MS);
    await run.settle();
    expect(await run.refresh(prCheckJob('pr-outbox', { installationId: 7, owner: 'o', repo: 'r', repository: 'o/r', prNumber: parsePr(9), headSha: 'head2' }))).toBe('requeued');
    await run.post(pushed('head3'));
    run.at(run.now() + 2 * RUN_AFTER_REFRESH_MS);
    await run.settle();
    expect(run.ran.filter((line) => line.startsWith('pr-outbox'))).toEqual(['pr-outbox@head1', 'pr-outbox@head3']);
  });
});
