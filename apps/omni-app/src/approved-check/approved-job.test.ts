// `omni/approved` as a job of the ledger (PRD 2688 s4): the handler and the failure hook of the `pr-approved` kind
// on the stubbed GitHub, with the verdicts of `approved-check`'s own tests. No test calls GitHub or Supabase.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GithubDeferred } from '@omni/github';
import { afterAll, describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { APPROVED_EXTERNAL_ID } from '../inngest-client.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import { runDue } from '../jobs/worker.ts';
import { checkRunAt, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { APPROVED_KIND, approvedFailure, approvedHandler } from './approved-job.ts';
import type { RecordReader } from './record.ts';
import type { ApprovalRecord, PinnedFile } from './state.ts';

const GALAXY = 'https://galaxy.example';
const NOW = new Date('2026-10-11T10:00:00.000Z');
const ACTIVE = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

/** A commit holding only the loop's config, `config` as written; none at all when null. */
function commitWith(config: string | null): string {
  const folder = mkdtempSync(join(tmpdir(), 'omni-approved-job-'));
  folders.push(folder);
  if (config !== null) {
    mkdirSync(join(folder, '.omni-loop'));
    writeFileSync(join(folder, '.omni-loop', 'config.yml'), config);
  }
  return folder;
}

const hash = (c: string) => c.repeat(64);
const pin = (kind: string, sha: string): PinnedFile => ({ kind, path: `${kind}.md`, sha256: hash(sha), versionId: `v-${kind}`, content: `${kind} text` });
const PINS = [pin('spec', 'a'), pin('plan', 'b'), pin('before-after', 'c'), pin('voice', 'd'), pin('scenario', 'e')];
const RECORD: ApprovalRecord = {
  dossierId: 'd-12',
  approval: { approver: { login: 'pm', member: true }, approvedAt: '2026-10-11T08:00:00.000Z', files: PINS, voids: [] },
  latest: PINS.map(({ kind, sha256, versionId, content }) => ({ kind, sha256, versionId, commitSha: null, content })),
};

const pullOf = (body: string) => ({ number: parsePr(446), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/offline-upload', sha: 'head1' }, labels: [], body });
const PRODUCT_BODY = 'Offline upload.\n\nPart of mobile-12 · https://galaxy.example/prd/d-12';

function setUp({ body = PRODUCT_BODY, config = ACTIVE }: { body?: string; config?: string | null } = {}) {
  // The head holds no PRD folder: a body naming no product PRD is then no ◆ PRD's either (PRD 1612).
  const github = fakeGitHub({ commits: { base1: commitWith(config), head1: commitWith(null) }, pull: pullOf(body) });
  const readRecord: RecordReader = () => Promise.resolve(RECORD);
  return { github, readRecord };
}

const payload = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 446, headSha: 'head1' };
const jobOf = (data: Record<string, unknown> = payload, tries = 1): ClaimedJob => ({
  id: 'job-1',
  kind: APPROVED_KIND,
  key: 'acme/widgets#446',
  subject: 'acme/widgets',
  payload: data,
  tries,
  claim: 'claim-1',
  claimedUntil: '2026-10-11T10:05:00.000Z',
});

describe('pr-approved — the handler (acceptance 6)', () => {
  it('posts the check run as the Inngest function does and ends done', async () => {
    const { github, readRecord } = setUp();
    const handler = approvedHandler({ octokitFor: () => github.octokit, readRecord, galaxyUrl: GALAXY, now: () => NOW, log: () => undefined });
    expect(await handler(jobOf())).toEqual({ outcome: 'done' });
    expect(github.state.checkRuns).toHaveLength(1);
    expect(checkRunAt(github.state, 0)).toMatchObject({ name: 'omni/approved', head_sha: 'head1', status: 'completed', conclusion: 'success' });
    expect(outputOf(checkRunAt(github.state, 0)).title).toBe('building · 5 of 5 pinned');
    expect(github.state.requests.find((request) => request.route === 'POST /repos/{owner}/{repo}/check-runs')).toMatchObject({
      external_id: APPROVED_EXTERNAL_ID,
      details_url: 'https://galaxy.example/prd/d-12#attestation',
    });
  });

  it('posts a second, newer check run when it runs twice, and is harmless', async () => {
    const { github, readRecord } = setUp();
    const handler = approvedHandler({ octokitFor: () => github.octokit, readRecord, galaxyUrl: GALAXY, now: () => NOW, log: () => undefined });
    await handler(jobOf());
    await handler(jobOf());
    expect(github.state.checkRuns.map((run) => run.conclusion)).toEqual(['success', 'success']);
  });

  it('ends skipped, posting nothing, on a base without the loop, a check turned off, or a body naming no PRD (acceptance 9)', async () => {
    for (const set of [{ config: null }, { config: `${ACTIVE}ci:\n  approvedContext: null\n` }, { body: 'Closes #12' }]) {
      const { github, readRecord } = setUp(set);
      const handler = approvedHandler({ octokitFor: () => github.octokit, readRecord, galaxyUrl: GALAXY, now: () => NOW, log: () => undefined });
      expect(await handler(jobOf())).toMatchObject({ outcome: 'skipped' });
      expect(github.state.checkRuns).toEqual([]);
    }
  });

  it('lets the GitHub budget through, for the worker to give the try back as waiting', async () => {
    const until = NOW.getTime() + 60_000;
    const handler = approvedHandler({ octokitFor: () => { throw new GithubDeferred(until); }, readRecord: null, galaxyUrl: GALAXY, log: () => undefined });
    await expect(handler(jobOf())).rejects.toBeInstanceOf(GithubDeferred);
  });

  it('refuses a payload that is not a pull request of a repository, naming the field', async () => {
    const { github, readRecord } = setUp();
    const handler = approvedHandler({ octokitFor: () => github.octokit, readRecord, galaxyUrl: GALAXY, log: () => undefined });
    await expect(handler(jobOf({ ...payload, headSha: undefined }))).rejects.toThrow('The pr-approved job is malformed: headSha');
  });
});

describe('pr-approved — the failure hook (acceptance 7)', () => {
  it('completes the check run as failure with the reason, under external_id, on the PRD pull request', async () => {
    const { github } = setUp();
    await approvedFailure({ octokitFor: () => github.octokit })(jobOf(payload, 5), 'GitHub answered 502');
    expect(github.state.checkRuns).toHaveLength(1);
    expect(checkRunAt(github.state, 0)).toMatchObject({ name: 'omni/approved', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
    expect(outputOf(checkRunAt(github.state, 0)).title).toBe('omni-loop could not evaluate: GitHub answered 502');
    expect(github.state.requests.find((request) => request.route === 'POST /repos/{owner}/{repo}/check-runs')).toMatchObject({ external_id: APPROVED_EXTERNAL_ID });
  });

  it('posts nothing on a base without the loop, a check turned off, or a pull request of no PRD (acceptance 9)', async () => {
    for (const set of [{ config: null }, { config: `${ACTIVE}ci:\n  approvedContext: null\n` }, { body: 'Closes #12' }]) {
      const { github } = setUp(set);
      await approvedFailure({ octokitFor: () => github.octokit })(jobOf(payload, 5), 'boom');
      expect(github.state.checkRuns).toEqual([]);
    }
  });

  it('still fails the check when GitHub cannot say what the pull request is: it could not decide, and says so', async () => {
    const { github } = setUp();
    let pulls = 0;
    const octokit = {
      request: (route: string, params: unknown) => {
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}' && (pulls += 1) > 1) return Promise.reject(new Error('GitHub is down'));
        return github.octokit.request(route as never, params as never);
      },
    } as unknown as typeof github.octokit;
    await approvedFailure({ octokitFor: () => octokit })(jobOf(payload, 5), 'GitHub is down');
    expect(checkRunAt(github.state, 0)).toMatchObject({ conclusion: 'failure' });
  });

  it('lets the GitHub budget through', async () => {
    const until = NOW.getTime() + 60_000;
    await expect(approvedFailure({ octokitFor: () => { throw new GithubDeferred(until); } })(jobOf(payload, 5), 'boom')).rejects.toBeInstanceOf(GithubDeferred);
  });
});

describe('pr-approved — on the worker', () => {
  it('ends failed on the 5th throw and fails the check run once, never left without a verdict', async () => {
    const { github } = setUp();
    let throws = 0;
    const throwing = { ...github.octokit, request: (route: string, params: unknown) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}' && throws < 5) {
        throws += 1;
        return Promise.reject(new Error('GitHub answered 502'));
      }
      return github.octokit.request(route as never, params as never);
    } } as unknown as typeof github.octokit;
    const finished: { outcome: string }[] = [];
    const ledger = {
      claim: (() => { let given = false; return () => { if (given) return Promise.resolve([]); given = true; return Promise.resolve([jobOf(payload, 5)]); }; })(),
      finish: (input: { outcome: string }) => { finished.push(input); return Promise.resolve('failed' as const); },
    };
    const lines: string[] = [];
    const summary = await runDue({
      ledger: ledger as never,
      handlers: { [APPROVED_KIND]: approvedHandler({ octokitFor: () => throwing, readRecord: null, galaxyUrl: GALAXY, log: () => undefined }) },
      failures: { [APPROVED_KIND]: approvedFailure({ octokitFor: () => github.octokit }) },
      log: (line) => lines.push(line),
    });
    expect(summary).toMatchObject({ ran: 1, failed: 1 });
    expect(finished.map((one) => one.outcome)).toEqual(['failed']);
    expect(checkRunAt(github.state, 0)).toMatchObject({ name: 'omni/approved', conclusion: 'failure' });
  });
});
