// The server event end to end against a stubbed GitHub (PRD 1548 s4, acceptance 8): a signed POST in,
// the `server-event` job it refreshed run as the worker hands it over (PRD omni-loop-3 s4), and the checks' jobs
// that job refreshed run on the ledger's worker (PRD 2688 s7, acceptance 10). No test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GithubDeferred } from '@omni/github';
import { afterAll, describe, expect, it } from 'vitest';
import type { ApprovalRecord, PinnedFile } from '../approved-check/state.ts';
import type { ClaimedJob, Finish, JobLedger, RefreshJob } from '../jobs/ledger.ts';
import { liveWorkers, PR_CHECK_KINDS, prCheckWorkers, serverEventRecheck, type PrCheckDeps } from '../jobs/pr-checks.ts';
import { runDue, type JobResult } from '../jobs/worker.ts';
import { checkRunAt, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import { stdoutLines } from '../run-log/capture.ts';
import { SERVER_EVENT_KIND, SERVER_EVENT_TRIGGER, serverEventHandler, type ServerEventDeps } from './job.ts';
import { receiveServerEvent, SERVER_SIGNATURE_HEADER } from './server-event.ts';
import type { PrdTargets } from './targets.ts';

const SECRET = 'shared-secret';
const DOSSIER = '0b9f8a1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b';

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

/** A commit holding only the loop's config. */
function configCommit(): string {
  const folder = mkdtempSync(join(tmpdir(), 'omni-server-event-'));
  folders.push(folder);
  mkdirSync(join(folder, '.omni-loop'));
  writeFileSync(join(folder, '.omni-loop', 'config.yml'), 'kit: 1\nrepo:\n  slug: acme/api\n');
  return folder;
}

const hash = (c: string) => c.repeat(64);
const pin = (kind: string, sha: string): PinnedFile => ({ kind, path: `${kind}.md`, sha256: hash(sha), versionId: `v-${kind}`, content: `${kind} text` });
const PINS = [pin('spec', 'a'), pin('plan', 'b')];
const RECORD: ApprovalRecord = {
  dossierId: DOSSIER,
  approval: { approver: { login: 'pm', member: true }, approvedAt: '2026-10-11T08:00:00.000Z', files: PINS, voids: [] },
  latest: PINS.map(({ kind, sha256, versionId, content }) => ({ kind, sha256, versionId, commitSha: null, content })),
};

const TARGETS: PrdTargets = { prdId: 'mobile-12', installationId: 77, pulls: [{ repository: 'acme/api', number: 446 }] };

/** `job` as the ledger hands it to the worker: claimed, on its first try. */
const claimed = (job: RefreshJob, n = 0): ClaimedJob => ({
  id: `job-${String(n)}`,
  claim: 'claim',
  claimedUntil: '2026-10-11T09:05:00.000Z',
  tries: 1,
  progress: {},
  lane: job.lane ?? null,
  maxTries: job.maxTries ?? 5,
  kind: job.kind,
  key: job.key,
  subject: job.subject,
  payload: job.payload,
});

/**
 * The ledger as the server event's job sees it: the checks' jobs it refreshed, kept; `runChecks` hands each to the
 * checks' own handler, wired to `deps` when given (none given, it runs nothing).
 */
function ledgerOf(deps: PrCheckDeps | null = null) {
  const refreshed: RefreshJob[] = [];
  const ran: string[] = [];
  const refresh = (job: RefreshJob) => Promise.resolve(refreshed.push(job));
  const runChecks = async () => {
    if (!deps) return;
    const { handlers } = prCheckWorkers(deps);
    for (const [n, job] of refreshed.entries()) {
      const handler = handlers[job.kind];
      if (!handler) throw new Error(`no handler for ${job.kind}`);
      await handler(claimed(job, n));
      ran.push(job.kind);
    }
  };
  return { refreshChecks: serverEventRecheck({ refresh }), refreshed, ran, runChecks };
}

/** A signed server event in, through the route's unit: the job it refreshed. */
async function post(event: 'approved' | 'voided' | 'item-opened' | 'item-settled'): Promise<RefreshJob> {
  const body = JSON.stringify({ event, dossier: DOSSIER, at: '2026-10-11T09:00:00.000Z' });
  const queued: RefreshJob[] = [];
  const reply = await receiveServerEvent(
    { body, headers: new Headers({ [SERVER_SIGNATURE_HEADER]: `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` }) },
    { secret: SECRET, queue: (job) => Promise.resolve(queued.push(job)) },
  );
  expect(reply.status).toBe(202);
  const [job] = queued;
  if (!job) throw new Error('no job was queued');
  return job;
}

/** A GitHub that is never reached. */
const noGitHub: ServerEventDeps['octokitFor'] = () => {
  throw new Error('no GitHub');
};

/** GitHub's answer to a pull request it refuses, as Octokit throws it: its status and its message. */
function refusal(status: number): Error & { status: number } {
  const message = status === 404 ? 'Not Found - https://docs.github.com/rest/pulls/pulls#get-a-pull-request' : 'Service Unavailable';
  return Object.assign(new Error(message), { status });
}

function setUp({ body = 'Offline upload.\n\nPart of mobile-12 · https://galaxy.example/prd/x', targets = TARGETS, refuse = false, deps = null, refused = {} }: { body?: string; targets?: PrdTargets | null; refuse?: boolean; deps?: Omit<PrCheckDeps, 'octokitFor'> | null; refused?: Record<number, number> } = {}) {
  const github = fakeGitHub({ commits: { base1: configCommit() }, pull: { number: 446, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/offline-upload', sha: 'head9' }, labels: [], body } as never });
  const reads: string[] = [];
  const logged: string[] = [];
  /** The fake, save the pull requests `refused` names, which GitHub answers with that status. */
  const octokit: GitHubClient = {
    request: (route, params) => {
      const status = refused[Number(params?.pull_number)];
      return status === undefined ? github.octokit.request(route, params) : Promise.reject(refusal(status));
    },
  };
  const octokitFor = (installationId: number) => {
    reads.push(`installation ${installationId}`);
    if (refuse) throw new GithubDeferred(Date.parse('2026-10-11T10:05:00.000Z'));
    return octokit;
  };
  const ledger = ledgerOf(deps ? { ...deps, octokitFor: () => github.octokit, galaxyUrl: 'https://galaxy.example' } : null);
  const handler = serverEventHandler({
    octokitFor,
    readTargets: (dossier) => {
      reads.push(`targets ${dossier}`);
      return Promise.resolve(targets);
    },
    recheck: ledger.refreshChecks,
    log: (line) => logged.push(line),
  });
  /** Runs the server event's job, then the checks' jobs it refreshed, as the worker runs every job due. */
  const recheck = async (job: RefreshJob): Promise<JobResult> => {
    const result = await handler(claimed(job));
    await ledger.runChecks();
    return result;
  };
  return { github, reads, logged, handler, recheck, ...ledger };
}

describe('server-event — an approval, a void, an item opened or settled re-posts the checks on the PRD\'s open target PRs (acceptance 8)', () => {
  it('reads the targets from the database, one GET per pull request and no list call, and refreshes the four checks\' jobs of each that names the PRD, due at once, then runs them (PRD 2688, acceptance 10)', async () => {
    for (const event of ['approved', 'voided', 'item-opened', 'item-settled'] as const) {
      const run = setUp();
      expect(await run.recheck(await post(event))).toEqual({ outcome: 'done' });
      expect(run.reads).toEqual([`targets ${DOSSIER}`, 'installation 77']);
      expect(run.github.state.requests.map((r) => r.route)).toEqual(['GET /repos/{owner}/{repo}/pulls/{pull_number}']);
      expect(run.github.state.requests.some((r) => r.route === 'GET /repos/{owner}/{repo}/pulls')).toBe(false);
      const payload = { installationId: 77, owner: 'acme', repo: 'api', repository: 'acme/api', prNumber: 446, headSha: 'head9', trigger: SERVER_EVENT_TRIGGER };
      expect(run.refreshed).toEqual(PR_CHECK_KINDS.map((kind) => ({ kind, key: 'acme/api#446', subject: 'acme/api', payload, delaySeconds: 0 })));
    }
  });

  it('runs the approved check\'s job on the head the pull request is at, with the check\'s own verdict', async () => {
    const run = setUp({ deps: { readRecord: () => Promise.resolve(RECORD) } });
    await run.recheck(await post('approved'));
    expect(run.ran).toEqual([...PR_CHECK_KINDS]);
    const approved = run.github.state.checkRuns.filter((r) => r.name === 'omni/approved');
    expect(approved).toEqual([expect.objectContaining({ head_sha: 'head9', conclusion: 'success' })]);
  });

  it('changes no approval: it reads the record galaxy kept, and writes nothing on GitHub but check runs (BL-APPROVALS-1)', async () => {
    const reads: string[] = [];
    const run = setUp({ deps: { readRecord: (repository) => Promise.resolve(reads.push(`read ${repository}`)).then(() => RECORD) } });
    await run.recheck(await post('approved'));
    expect(reads).toEqual([`read acme/api`]);
    const written = run.github.state.requests.filter((r) => !r.route.startsWith('GET ')).map((r) => r.route);
    expect(written.length).toBeGreaterThan(0);
    expect(written.every((route) => route.includes('/check-runs'))).toBe(true);
  });

  it('runs the outbox check\'s job on what it grades: an item settled turns the target PR\'s outbox check green (s8)', async () => {
    const run = setUp({ deps: { readProductOutbox: () => Promise.resolve({ dossierId: DOSSIER, productId: 'p-1', productName: 'Mobile', open: [] }) } });
    await run.recheck(await post('item-settled'));
    const outbox = run.github.state.checkRuns.filter((r) => r.name === 'outbox');
    expect(outbox).toEqual([expect.objectContaining({ head_sha: 'head9', conclusion: 'success' })]);
    expect(outputOf(checkRunAt({ checkRuns: outbox }, -1)).title).toBe('0 open · one gate on Mobile');
  });

  it('refreshes nothing for an open pull request whose body names another PRD, or none', async () => {
    for (const body of ['Part of mobile-13', 'Part of field-12', 'Closes #12', '']) {
      const run = setUp({ body });
      expect(await run.recheck(await post('approved'))).toEqual({ outcome: 'skipped', reason: 'no open pull request names mobile-12' });
      expect(run.refreshed).toEqual([]);
    }
  });

  it('reads no GitHub at all for a dossier that is no product PRD, or a PRD with no open pull request', async () => {
    for (const targets of [null, { ...TARGETS, pulls: [] }]) {
      const run = setUp({ targets });
      expect(await run.recheck(await post('voided'))).toMatchObject({ outcome: 'skipped' });
      expect(run.github.state.requests).toEqual([]);
      expect(run.refreshed).toEqual([]);
    }
  });

  it('re-checks nothing, and says why, when the App cannot read the server here', async () => {
    const logged: string[] = [];
    const handler = serverEventHandler({ octokitFor: noGitHub, readTargets: null, recheck: ledgerOf().refreshChecks, log: (line) => logged.push(line) });
    expect(await handler(claimed(await post('approved')))).toEqual({ outcome: 'skipped', reason: 'the App cannot read the server here' });
    expect(logged).toEqual([`server event: the approved of dossier ${DOSSIER} re-checks nothing: the App cannot read the server here`]);
  });

  it('says it by default as a JSON note line at warn, today’s sentence as its message (PRD 1723 s6)', async () => {
    const handler = serverEventHandler({ octokitFor: noGitHub, readTargets: null, recheck: ledgerOf().refreshChecks });
    const job = claimed(await post('approved'));
    const lines = await stdoutLines(() => handler(job));
    expect(lines.filter((line) => line.event === 'note')).toEqual([
      { level: 'warn', event: 'note', fn: 'server-event-recheck', message: `server event: the approved of dossier ${DOSSIER} re-checks nothing: the App cannot read the server here` },
    ]);
  });

  it('waits for the GitHub budget: a deferred read makes the job `waiting` on the worker, its try given back, said in the log', async () => {
    const run = setUp({ refuse: true });
    const job = claimed(await post('approved'));
    const finished: Finish[] = [];
    let handed = false;
    const ledger: JobLedger = {
      claim: () => {
        if (handed) return Promise.resolve([]);
        handed = true;
        return Promise.resolve([job]);
      },
      finish: (finish) => {
        finished.push(finish);
        return Promise.resolve('queued');
      },
    };
    const summary = await runDue({ ledger, handlers: { [SERVER_EVENT_KIND]: run.handler }, log: () => undefined });
    expect(summary).toMatchObject({ ran: 1, waiting: 1 });
    expect(finished).toEqual([expect.objectContaining({ outcome: 'waiting' })]);
    expect(run.logged).toEqual(['server event: acme/api#446 waits for the GitHub budget: GitHub budget below its background floor until 2026-10-11T10:05:00.000Z']);
    expect(run.refreshed).toEqual([]);
  });
});

describe('server-event — a target pull request GitHub answers Not Found (bug #2764)', () => {
  const TWO: PrdTargets = { ...TARGETS, pulls: [{ repository: 'acme/api', number: 445 }, { repository: 'acme/api', number: 446 }] };

  it('leaves out a pull request GitHub answers 404 or 410, re-checks the others, and says which in the log', async () => {
    for (const status of [404, 410]) {
      const run = setUp({ targets: TWO, refused: { 445: status } });
      expect(await run.recheck(await post('item-settled'))).toEqual({ outcome: 'done' });
      expect(run.refreshed.map((job) => job.key)).toEqual(PR_CHECK_KINDS.map(() => 'acme/api#446'));
      expect(run.logged).toEqual([`server event: acme/api#445 is left out: GitHub answers ${String(status)}, it is gone or the App cannot read it`]);
    }
  });

  it('ends skipped, saying why, when GitHub answers 404 for every target pull request: it spends no try', async () => {
    const run = setUp({ targets: TWO, refused: { 445: 404, 446: 404 } });
    expect(await run.recheck(await post('approved'))).toEqual({ outcome: 'skipped', reason: 'no open pull request names mobile-12 (2 left out: GitHub answers 404 or 410 for them)' });
    expect(run.refreshed).toEqual([]);
  });

  it('keeps a 5xx a retry: the job throws, so the worker tries it again', async () => {
    for (const status of [500, 502, 503]) {
      const run = setUp({ targets: TWO, refused: { 445: status } });
      await expect(run.recheck(await post('approved'))).rejects.toMatchObject({ status });
      expect(run.refreshed).toEqual([]);
    }
  });
});

describe('server-event — the job (PRD omni-loop-3 s4)', () => {
  it('is one job per dossier, refreshed so a burst of events re-checks once, from the last, with 4 tries, in no lane', async () => {
    const job = await post('approved');
    expect(job).toEqual({ kind: SERVER_EVENT_KIND, key: DOSSIER, subject: DOSSIER, payload: { event: 'approved', dossier: DOSSIER, at: '2026-10-11T09:00:00.000Z' }, maxTries: 4, delaySeconds: 5 });
    expect(job.lane).toBeUndefined();
  });

  it('has a handler in the worker every runner of the ledger runs', () => {
    const { handlers } = liveWorkers({ supabase: { url: 'https://db.example', key: 'service-key' } }, () => Promise.reject(new Error('unused')));
    expect(typeof handlers[SERVER_EVENT_KIND]).toBe('function');
  });
});
