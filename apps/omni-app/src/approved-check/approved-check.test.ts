// `approved-check` end to end against the stubbed GitHub (PRD 1548 s3): a signed webhook in, the `pr-approved`
// job it refreshed run through the real handler (PRD 2688), the record read from a fake. No test calls GitHub
// or Supabase.
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GithubDeferred } from '@omni/github';
import { afterAll, describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { APPROVED_EXTERNAL_ID } from '../inngest-client.ts';
import type { RefreshJob } from '../jobs/ledger.ts';
import type { JobHandler } from '../jobs/worker.ts';
import { checkRunAt, claimedJob, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { attestationUrl } from './approved-check.ts';
import { APPROVED_KIND, approvedHandler } from './approved-job.ts';
import type { RecordReader } from './record.ts';
import type { ApprovalRecord, PinnedFile } from './state.ts';

const SECRET = 'approved-secret';
const GALAXY = 'https://galaxy.example';
const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' }, default_branch: 'main' };
const NOW = new Date('2026-10-11T10:00:00.000Z');

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

/** A commit holding only the loop's config, `config` as written; none at all when null. */
function commitWith(config: string | null): string {
  const folder = mkdtempSync(join(tmpdir(), 'omni-approved-'));
  folders.push(folder);
  if (config !== null) {
    mkdirSync(join(folder, '.omni-loop'));
    writeFileSync(join(folder, '.omni-loop', 'config.yml'), config);
  }
  return folder;
}
const ACTIVE = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

const hash = (c: string) => c.repeat(64);
const pin = (kind: string, sha: string): PinnedFile => ({ kind, path: `${kind}.md`, sha256: hash(sha), versionId: `v-${kind}`, content: `${kind} text` });
const PINS = [pin('spec', 'a'), pin('plan', 'b'), pin('before-after', 'c'), pin('voice', 'd'), pin('scenario', 'e')];
const RECORD: ApprovalRecord = {
  dossierId: 'd-12',
  approval: { approver: { login: 'pm', member: true }, approvedAt: '2026-10-11T08:00:00.000Z', files: PINS, voids: [] },
  latest: PINS.map(({ kind, sha256, versionId, content }) => ({ kind, sha256, versionId, commitSha: null, content })),
};

const pullOf = (body: string | undefined) => ({ number: parsePr(446), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/offline-upload', sha: 'head1' }, labels: [], ...(body === undefined ? {} : { body }) });

/** One try of the job through `handler`: how it ended, or what it threw. */
async function exec(handler: JobHandler, payload: Record<string, unknown> = PAYLOAD) {
  try {
    return { result: await handler(claimedJob(APPROVED_KIND, payload)), error: undefined };
  } catch (error) {
    return { result: undefined, error };
  }
}

/** A run: the stubbed GitHub, the record's reads, and the log. */
function setUp({ body = 'Offline upload.\n\nPart of mobile-12 · https://galaxy.example/prd/d-12', config = ACTIVE, record = RECORD }: { body?: string; config?: string | null; record?: ApprovalRecord | null | Error } = {}) {
  // The head holds no PRD folder: a body naming no product PRD is then no ◆ PRD's either (PRD 1612).
  const github = fakeGitHub({ commits: { base1: commitWith(config), head1: commitWith(null) }, pull: pullOf(body) });
  const reads: string[] = [];
  const readRecord: RecordReader = (repository, prd) => {
    reads.push(`${repository} ${prd.id}`);
    return record instanceof Error ? Promise.reject(record) : Promise.resolve(record);
  };
  const logged: string[] = [];
  const handler = approvedHandler({ octokitFor: () => github.octokit, readRecord, galaxyUrl: GALAXY, now: () => NOW, log: (line) => logged.push(line) });
  return { github, reads, logged, handler };
}

/** A signed delivery through `/api/github`'s unit, then every `pr-approved` job it refreshed through the handler. */
async function deliver(run: ReturnType<typeof setUp>, event: string, payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const sent: RefreshJob[] = [];
  const response = await receiveWebhook({
    body: raw,
    headers: { 'x-github-event': event, 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}` },
    secret: SECRET,
    forward: () => Promise.resolve(),
    refreshJobs: (jobs) => Promise.resolve(sent.push(...jobs)),
  });
  expect(response.status).toBe(200);
  const results = [];
  for (const job of sent.filter((one) => one.kind === APPROVED_KIND)) results.push(await exec(run.handler, job.payload));
  return { sent, results };
}

const pullRequest = (action: string) => ({ action, installation: { id: 7 }, repository: REPOSITORY, number: 446, pull_request: pullOf(undefined) });

/** The one check run posted, with the parameters it was created with. */
function posted(run: ReturnType<typeof setUp>) {
  expect(run.github.state.checkRuns).toHaveLength(1);
  const created = run.github.state.requests.find((request) => request.route === 'POST /repos/{owner}/{repo}/check-runs');
  return { run: checkRunAt(run.github.state, 0), output: outputOf(checkRunAt(run.github.state, 0)), created };
}

describe('approved-check — a target feature PR of a product PRD (acceptance 6)', () => {
  it('posts omni/approved, building, on a pull request opened or synchronized whose body says Part of mobile-12, with Details on the attestation', async () => {
    for (const action of ['opened', 'synchronize']) {
      const run = setUp();
      const { results } = await deliver(run, 'pull_request', pullRequest(action));
      expect(results.map((r) => r.result)).toEqual([{ outcome: 'done' }]);
      const { run: check, output, created } = posted(run);
      expect(check).toMatchObject({ name: 'omni/approved', head_sha: 'head1', status: 'completed', conclusion: 'success' });
      expect(output.title).toBe('building · 5 of 5 pinned');
      expect(created).toMatchObject({ external_id: APPROVED_EXTERNAL_ID, details_url: 'https://galaxy.example/prd/d-12#attestation' });
      expect(run.reads).toEqual(['acme/widgets mobile-12']);
    }
  });

  it('posts failure, drifted, after a push changed a pinned file', async () => {
    const latest = RECORD.latest.map((v) => (v.kind === 'plan' ? { ...v, sha256: hash('f'), commitSha: '9f8e7d6c5b', content: 'a new plan' } : v));
    const run = setUp({ record: { ...RECORD, latest } });
    await deliver(run, 'pull_request', pullRequest('synchronize'));
    expect(posted(run).run).toMatchObject({ conclusion: 'failure', output: { title: 'drifted · ≠ plan.md in 9f8e7d6 · content' } });
  });

  it('posts neutral, held, never failure, when the record cannot be read, and logs why', async () => {
    const run = setUp({ record: new Error('fetch failed') });
    await deliver(run, 'pull_request', pullRequest('synchronize'));
    const { run: check, created } = posted(run);
    expect(check).toMatchObject({ conclusion: 'neutral', output: { title: 'held · server unreachable since 2026-10-11 10:00 UTC · held, not failed' } });
    expect(created).not.toHaveProperty('details_url');
    expect(run.logged).toEqual(['approved check of acme/widgets for mobile-12 is held: fetch failed']);
  });

  it('holds every check when the App cannot read the server here', async () => {
    const github = fakeGitHub({ commits: { base1: commitWith(ACTIVE) }, pull: pullOf('Part of mobile-12') });
    const handler = approvedHandler({ octokitFor: () => github.octokit, readRecord: null, galaxyUrl: GALAXY, now: () => NOW, log: () => undefined });
    await exec(handler);
    expect(checkRunAt(github.state, 0)).toMatchObject({ conclusion: 'neutral', output: { title: expect.stringMatching(/^held/) as unknown } });
  });

  it('runs again on a re-run of its own check run, and only it', async () => {
    const run = setUp();
    const payload = { action: 'rerequested', installation: { id: 7 }, repository: REPOSITORY, check_run: { external_id: APPROVED_EXTERNAL_ID, head_sha: 'head1', pull_requests: [{ number: 446, head: { sha: 'head1' }, base: { ref: 'main' } }] } };
    const { sent } = await deliver(run, 'check_run', payload);
    expect(sent.map((job) => job.kind)).toEqual([APPROVED_KIND]);
    expect(posted(run).run).toMatchObject({ conclusion: 'success' });
  });
});

const PAYLOAD = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 446, headSha: 'head1', trigger: 'pull_request.edited' };
const runOn = (run: ReturnType<typeof setUp>) => exec(run.handler);

describe('approved-check — the pull requests that get no check (acceptance 8)', () => {
  it('posts nothing, and reads no record, on a body naming no product PRD: the job ends skipped', async () => {
    // `Part of acme/plans#12` is a ◆ PRD's target PR since PRD 1612: ./repo-prd.test.ts checks it.
    for (const body of ['Closes #12', '']) {
      const run = setUp({ body });
      const { result } = await runOn(run);
      expect(result).toMatchObject({ outcome: 'skipped' });
      expect(run.github.state.checkRuns).toEqual([]);
      expect(run.reads).toEqual([]);
    }
  });

  it('posts nothing on a base without the loop, or whose ci.approvedContext is null', async () => {
    for (const config of [null, `${ACTIVE}ci:\n  approvedContext: null\n`]) {
      const run = setUp({ config });
      expect((await runOn(run)).result).toMatchObject({ outcome: 'skipped' });
      expect(run.github.state.checkRuns).toEqual([]);
    }
  });

  it('posts under the name ci.approvedContext gives', async () => {
    const run = setUp({ config: `${ACTIVE}ci:\n  approvedContext: approved\n` });
    await runOn(run);
    expect(posted(run).run).toMatchObject({ name: 'approved' });
  });
});

describe('approved-check — the GitHub budget (PRD 902)', () => {
  it('throws the budget\'s refusal as it is, for the worker to wait on, posting nothing meanwhile', async () => {
    const until = NOW.getTime() + 60_000;
    const refusal = new GithubDeferred(until);
    const handler = approvedHandler({ octokitFor: () => { throw refusal; }, readRecord: () => Promise.resolve(RECORD), galaxyUrl: GALAXY, log: () => undefined });
    const { error } = await exec(handler);
    expect(error).toBe(refusal);
  });

  it('lets any other failure through to the retries', async () => {
    const handler = approvedHandler({ octokitFor: () => { throw new Error('boom'); }, readRecord: null, galaxyUrl: GALAXY });
    const { error } = await exec(handler);
    expect(error).toMatchObject({ message: 'boom' });
  });
});

describe('approved-check — its Details', () => {
  it('links the PRD page\'s attestation, on galaxy\'s host however it ends, and nothing without a dossier', () => {
    expect(attestationUrl('https://galaxy.example/', 'd-1')).toBe('https://galaxy.example/prd/d-1#attestation');
    expect(attestationUrl(GALAXY, null)).toBeNull();
  });
});
