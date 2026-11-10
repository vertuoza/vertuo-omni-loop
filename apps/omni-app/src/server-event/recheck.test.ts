// The server event end to end against a stubbed GitHub (PRD 1548 s4, acceptance 8): a signed POST in,
// the recheck run on the event it sent, and the checks' jobs it refreshed run on the ledger's worker
// (PRD 2688 s7, acceptance 10). No test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InngestTestEngine } from '@inngest/test';
import { GithubDeferred } from '@omni/github';
import { RetryAfterError } from 'inngest';
import { afterAll, describe, expect, it } from 'vitest';
import type { ApprovalRecord, PinnedFile } from '../approved-check/state.ts';
import { inngest } from '../inngest-client.ts';
import type { RefreshJob } from '../jobs/ledger.ts';
import { PR_CHECK_KINDS, prCheckWorkers, type PrCheckDeps } from '../jobs/pr-checks.ts';
import { checkRunAt, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { stdoutLines } from '../run-log/capture.ts';
import { createServerEventRecheck, SERVER_EVENT_FUNCTION_ID, SERVER_EVENT_TRIGGER, type RecheckJobs } from './recheck.ts';
import { receiveServerEvent, SERVER_SIGNATURE_HEADER, type ServerEventRequest } from './server-event.ts';
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

/**
 * The ledger as the recheck sees it: the jobs it refreshed, kept; its run hands each to the checks' own handler,
 * wired to `deps` when given (none given, the run runs nothing).
 */
function ledgerOf(deps: PrCheckDeps | null = null) {
  const refreshed: RefreshJob[] = [];
  const ran: string[] = [];
  const jobs: RecheckJobs = {
    refresh: (job) => Promise.resolve(refreshed.push(job)),
    run: async () => {
      if (!deps) return;
      const { handlers } = prCheckWorkers(deps);
      for (const [n, job] of refreshed.entries()) {
        const handler = handlers[job.kind];
        if (!handler) throw new Error(`no handler for ${job.kind}`);
        await handler({ ...job, id: `job-${String(n)}`, tries: 1, claim: 'claim', claimedUntil: '2026-10-11T09:05:00.000Z' });
        ran.push(job.kind);
      }
    },
  };
  return { jobs, refreshed, ran };
}

/** A signed server event in, through the route's unit: the Inngest events it sent. */
async function post(event: 'approved' | 'voided' | 'item-opened' | 'item-settled'): Promise<ServerEventRequest[]> {
  const body = JSON.stringify({ event, dossier: DOSSIER, at: '2026-10-11T09:00:00.000Z' });
  const sent: ServerEventRequest[] = [];
  const reply = await receiveServerEvent(
    { body, headers: new Headers({ [SERVER_SIGNATURE_HEADER]: `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` }) },
    { secret: SECRET, send: (events) => Promise.resolve(sent.push(...events)) },
  );
  expect(reply.status).toBe(202);
  return sent;
}

function setUp({ body = 'Offline upload.\n\nPart of mobile-12 · https://galaxy.example/prd/x', targets = TARGETS, refuse = false, deps = null }: { body?: string; targets?: PrdTargets | null; refuse?: boolean; deps?: Omit<PrCheckDeps, 'octokitFor'> | null } = {}) {
  const github = fakeGitHub({ commits: { base1: configCommit() }, pull: { number: 446, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/offline-upload', sha: 'head9' }, labels: [], body } as never });
  const reads: string[] = [];
  const logged: string[] = [];
  const octokitFor = (installationId: number) => {
    reads.push(`installation ${installationId}`);
    if (refuse) throw new GithubDeferred(Date.parse('2026-10-11T10:05:00.000Z'));
    return github.octokit;
  };
  const ledger = ledgerOf(deps ? { ...deps, octokitFor: () => github.octokit, galaxyUrl: 'https://galaxy.example' } : null);
  const recheck = createServerEventRecheck({
    client: inngest,
    octokitFor,
    readTargets: (dossier) => {
      reads.push(`targets ${dossier}`);
      return Promise.resolve(targets);
    },
    jobs: ledger.jobs,
    log: (line) => logged.push(line),
  });
  return { github, reads, logged, recheck, ...ledger };
}

describe('server-event — an approval, a void, an item opened or settled re-posts the checks on the PRD\'s open target PRs (acceptance 8)', () => {
  it('reads the targets from the database, one GET per pull request and no list call, and refreshes the four checks\' jobs of each that names the PRD, due at once, then runs them (PRD 2688, acceptance 10)', async () => {
    for (const event of ['approved', 'voided', 'item-opened', 'item-settled'] as const) {
      const run = setUp();
      const [sent] = await post(event);
      const { result, ctx } = await new InngestTestEngine({ function: run.recheck, events: [sent as never] }).execute();
      expect(result).toEqual({ prd: 'mobile-12', rechecked: ['acme/api#446'] });
      expect(run.reads).toEqual([`targets ${DOSSIER}`, 'installation 77']);
      expect(run.github.state.requests.map((r) => r.route)).toEqual(['GET /repos/{owner}/{repo}/pulls/{pull_number}']);
      expect(run.github.state.requests.some((r) => r.route === 'GET /repos/{owner}/{repo}/pulls')).toBe(false);
      const payload = { installationId: 77, owner: 'acme', repo: 'api', repository: 'acme/api', prNumber: 446, headSha: 'head9', trigger: SERVER_EVENT_TRIGGER };
      expect(run.refreshed).toEqual(PR_CHECK_KINDS.map((kind) => ({ kind, key: 'acme/api#446', subject: 'acme/api', payload, delaySeconds: 0 })));
      expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['targets', 'pull acme/api#446', 'recheck', 'run']);
      expect(ctx.step.sendEvent).not.toHaveBeenCalled();
    }
  });

  it('runs the approved check\'s job on the head the pull request is at, with the check\'s own verdict', async () => {
    const run = setUp({ deps: { readRecord: () => Promise.resolve(RECORD) } });
    const [sent] = await post('approved');
    await new InngestTestEngine({ function: run.recheck, events: [sent as never] }).execute();
    expect(run.ran).toEqual([...PR_CHECK_KINDS]);
    const approved = run.github.state.checkRuns.filter((r) => r.name === 'omni/approved');
    expect(approved).toEqual([expect.objectContaining({ head_sha: 'head9', conclusion: 'success' })]);
  });

  it('runs the outbox check\'s job on what it grades: an item settled turns the target PR\'s outbox check green (s8)', async () => {
    const run = setUp({ deps: { readProductOutbox: () => Promise.resolve({ dossierId: DOSSIER, productId: 'p-1', productName: 'Mobile', open: [] }) } });
    const [sent] = await post('item-settled');
    await new InngestTestEngine({ function: run.recheck, events: [sent as never] }).execute();
    const outbox = run.github.state.checkRuns.filter((r) => r.name === 'outbox');
    expect(outbox).toEqual([expect.objectContaining({ head_sha: 'head9', conclusion: 'success' })]);
    expect(outputOf(checkRunAt({ checkRuns: outbox }, -1)).title).toBe('0 open · one gate on Mobile');
  });

  it('refreshes nothing for an open pull request whose body names another PRD, or none', async () => {
    for (const body of ['Part of mobile-13', 'Part of field-12', 'Closes #12', '']) {
      const run = setUp({ body });
      const [sent] = await post('approved');
      const { result } = await new InngestTestEngine({ function: run.recheck, events: [sent as never] }).execute();
      expect(result).toEqual({ prd: 'mobile-12', rechecked: [] });
      expect(run.refreshed).toEqual([]);
    }
  });

  it('reads no GitHub at all for a dossier that is no product PRD, or a PRD with no open pull request', async () => {
    for (const targets of [null, { ...TARGETS, pulls: [] }]) {
      const run = setUp({ targets });
      const [sent] = await post('voided');
      await new InngestTestEngine({ function: run.recheck, events: [sent as never] }).execute();
      expect(run.github.state.requests).toEqual([]);
      expect(run.refreshed).toEqual([]);
    }
  });

  it('re-checks nothing, and says why, when the App cannot read the server here', async () => {
    for (const [readTargets, jobs] of [[null, ledgerOf().jobs], [() => Promise.resolve(TARGETS), null]] as const) {
      const logged: string[] = [];
      const recheck = createServerEventRecheck({ client: inngest, octokitFor: () => { throw new Error('no GitHub'); }, readTargets, jobs, log: (line) => logged.push(line) });
      const [sent] = await post('approved');
      const { result } = await new InngestTestEngine({ function: recheck, events: [sent as never] }).execute();
      expect(result).toEqual({ rechecked: [] });
      expect(logged).toEqual([`server event: the approved of dossier ${DOSSIER} re-checks nothing: the App cannot read the server here`]);
    }
  });

  it('says it by default as a JSON note line at warn, today’s sentence as its message (PRD 1723 s6)', async () => {
    const recheck = createServerEventRecheck({ client: inngest, octokitFor: () => { throw new Error('no GitHub'); }, readTargets: null, jobs: null });
    const [sent] = await post('approved');
    const lines = await stdoutLines(() => new InngestTestEngine({ function: recheck, events: [sent as never] }).execute());
    expect(lines.filter((line) => line.event === 'note')).toEqual([
      { level: 'warn', event: 'note', fn: 'server-event-recheck', message: `server event: the approved of dossier ${DOSSIER} re-checks nothing: the App cannot read the server here` },
    ]);
  });

  it('waits for the GitHub budget: a deferred read is retried after its window, said in the log', async () => {
    const run = setUp({ refuse: true });
    const [sent] = await post('approved');
    const { error } = await new InngestTestEngine({ function: run.recheck, events: [sent as never] }).execute();
    expect(error).toMatchObject({ name: RetryAfterError.name });
    expect(run.logged).toEqual(['server event: acme/api#446 waits for the GitHub budget: GitHub budget below its background floor until 2026-10-11T10:05:00.000Z']);
  });

  it('is debounced per PRD, by its dossier', () => {
    const run = setUp();
    expect(run.recheck.id()).toBe(SERVER_EVENT_FUNCTION_ID);
    expect((run.recheck as unknown as { opts: { debounce: { key: string } } }).opts.debounce.key).toBe('event.data.dossier');
  });
});
