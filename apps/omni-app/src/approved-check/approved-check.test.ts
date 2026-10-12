// `approved-check` end to end against the stubbed GitHub (PRD 1548 s3): a signed webhook in, the real
// function run on every event it sent, the record read from a fake. No test calls GitHub or Supabase.
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InngestTestEngine } from '@inngest/test';
import { GithubDeferred } from '@omni/github';
import { RetryAfterError } from 'inngest';
import { afterAll, describe, expect, it } from 'vitest';
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { APPROVED_CHECK_EVENT, APPROVED_EXTERNAL_ID, type AppEvent, inngest } from '../inngest-client.ts';
import { checkRunAt, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { APPROVED_FUNCTION_ID, attestationUrl, createApprovedCheck } from './approved-check.ts';
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

const A_NUMBER: unknown = expect.any(Number);

const pullOf = (body: string | undefined) => ({ number: parsePr(446), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/offline-upload', sha: 'head1' }, labels: [], ...(body === undefined ? {} : { body }) });

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
  const fn = createApprovedCheck({ client: inngest, octokitFor: () => github.octokit, readRecord, galaxyUrl: GALAXY, now: () => NOW, log: (line) => logged.push(line) });
  return { github, reads, logged, fn };
}

/** A signed delivery through `/api/github`'s unit, then every event it sent through the approved check. */
async function deliver(run: ReturnType<typeof setUp>, event: string, payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const sent: AppEvent[] = [];
  const response = await receiveWebhook({
    body: raw,
    headers: { 'x-github-event': event, 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}` },
    secret: SECRET,
    forward: () => Promise.resolve(),
    send: (events) => Promise.resolve(sent.push(...events)),
  });
  expect(response.status).toBe(200);
  const results = [];
  for (const e of sent) results.push(await new InngestTestEngine({ function: run.fn, events: [e] }).execute());
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
      expect(results.map((r) => r.result)).toEqual([{ checkRunId: A_NUMBER, name: 'omni/approved', prd: 'mobile-12', state: 'building', conclusion: 'success' }]);
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
    const fn = createApprovedCheck({ client: inngest, octokitFor: () => github.octokit, readRecord: null, galaxyUrl: GALAXY, now: () => NOW, log: () => undefined });
    const { result } = await new InngestTestEngine({ function: fn, events: [{ name: APPROVED_CHECK_EVENT, data: event }] }).execute();
    expect(result).toMatchObject({ state: 'held', conclusion: 'neutral' });
  });

  it('runs again on a re-run of its own check run', async () => {
    const run = setUp();
    const payload = { action: 'rerequested', installation: { id: 7 }, repository: REPOSITORY, check_run: { external_id: APPROVED_EXTERNAL_ID, head_sha: 'head1', pull_requests: [{ number: 446, head: { sha: 'head1' }, base: { ref: 'main' } }] } };
    const { sent } = await deliver(run, 'check_run', payload);
    expect(sent.map((e) => e.name)).toEqual([APPROVED_CHECK_EVENT]);
    expect(posted(run).run).toMatchObject({ conclusion: 'success' });
  });
});

const event = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 446, headSha: 'head1', trigger: 'pull_request.edited' };
const runOn = (run: ReturnType<typeof setUp>) => new InngestTestEngine({ function: run.fn, events: [{ name: APPROVED_CHECK_EVENT, data: event }] }).execute();

describe('approved-check — the pull requests that get no check (acceptance 8)', () => {
  it('posts nothing, and reads no record, on a body naming no product PRD', async () => {
    // `Part of acme/plans#12` is a ◆ PRD's target PR since PRD 1612: ./repo-prd.test.ts checks it.
    for (const body of ['Closes #12', '']) {
      const run = setUp({ body });
      const { result } = await runOn(run);
      expect(result).toMatchObject({ posted: false });
      expect(run.github.state.checkRuns).toEqual([]);
      expect(run.reads).toEqual([]);
    }
  });

  it('posts nothing on a base without the loop, or whose ci.approvedContext is null', async () => {
    for (const config of [null, `${ACTIVE}ci:\n  approvedContext: null\n`]) {
      const run = setUp({ config });
      expect((await runOn(run)).result).toMatchObject({ posted: false });
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
  it('retries a step the budget defers once its window ends, posting nothing meanwhile', async () => {
    const until = NOW.getTime() + 60_000;
    const logged: string[] = [];
    const fn = createApprovedCheck({ client: inngest, octokitFor: () => { throw new GithubDeferred(until); }, readRecord: () => Promise.resolve(RECORD), galaxyUrl: GALAXY, log: (line) => logged.push(line) });
    const { error } = await new InngestTestEngine({ function: fn, events: [{ name: APPROVED_CHECK_EVENT, data: event }] }).execute();
    expect(error).toMatchObject({ name: RetryAfterError.name });
    expect(logged).toEqual([`approved check of acme/widgets#446 waits for the GitHub budget: GitHub budget below its background floor until ${new Date(until).toISOString()}`]);
  });

  it('lets any other failure through to the retries', async () => {
    const fn = createApprovedCheck({ client: inngest, octokitFor: () => { throw new Error('boom'); }, readRecord: null, galaxyUrl: GALAXY });
    const { error } = await new InngestTestEngine({ function: fn, events: [{ name: APPROVED_CHECK_EVENT, data: event }] }).execute();
    expect(error).toMatchObject({ message: 'boom' });
    expect(error).not.toMatchObject({ name: RetryAfterError.name });
  });
});

describe('approved-check — its id and its Details', () => {
  it('is served as approved-check, on the outbox check event and its own', () => {
    const { fn } = setUp();
    expect(fn.id()).toBe(APPROVED_FUNCTION_ID);
  });

  it('links the PRD page\'s attestation, on galaxy\'s host however it ends, and nothing without a dossier', () => {
    expect(attestationUrl('https://galaxy.example/', 'd-1')).toBe('https://galaxy.example/prd/d-1#attestation');
    expect(attestationUrl(GALAXY, null)).toBeNull();
  });
});
