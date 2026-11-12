// `inbox-check` end to end against the stubbed GitHub (PRD 675), through its `pr-inbox` job of the ledger
// (PRD 2688): the outbox check's fake, widened with the two routes only the inbox check reads (the compare's
// commits and the PRD issue) and the check run's `external_id`. No test calls GitHub.
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { INBOX_EXTERNAL_ID } from '../inngest-client.ts';
import type { RefreshJob } from '../jobs/ledger.ts';
import { checkRunAt, claimedJob, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import type { CanonGrader } from './evaluate-inbox.ts';
import { PR_INBOX_KIND, inboxFailureHook, inboxHandler } from './inbox-check.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);
const SECRET = 'inbox-secret';
const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };

const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const FOLDER = '.omni-loop/delivery/inbox/0042-widget';
const COMPLETE_FILES = ['spec.md', 'plan.md', 'before-after.html'].map((file) => ({ filename: `${FOLDER}/${file}`, status: 'added' }));
const SIGNED = [{ sha: 'c1', commit: { message: `docs(phase-0): widget\n\n${TRAILER}` } }];
const OPEN_ISSUE = { number: 42, state: 'open', labels: [{ name: 'omni:prd' }] };

/** A request's parameters, as a unit hands them to `octokit.request`. */
type Params = Record<string, unknown>;
/** A route only the inbox check reads: its answer, or `null` to leave the request to the outbox check's fake. */
type Extra = (params: Params) => { data: unknown } | null;

/** The buttons a check run carries, as the tests read them. */
const ActionsSchema = z.array(z.looseObject({ label: z.string(), identifier: z.string() }));

/** The outbox check's fake GitHub, plus the compare's commits, the issues route and `external_id`. */
function inboxGitHub({
  base = 'inbox-base',
  head = 'inbox-head-complete',
  headRef = 'docs/phase-0-widget',
  files = COMPLETE_FILES,
  commits = SIGNED,
  issue = OPEN_ISSUE,
  issues = [issue],
}: { base?: string; head?: string; headRef?: string; files?: typeof COMPLETE_FILES; commits?: typeof SIGNED; issue?: typeof OPEN_ISSUE; issues?: (typeof OPEN_ISSUE)[] } = {}) {
  const pull = { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: headRef, sha: 'head1' }, labels: [] };
  const github = fakeGitHub({ commits: { base1: fixture(base), head1: fixture(head) }, pull });
  const inner = github.octokit;
  const extra: Partial<Record<string, Extra>> = {
    'GET /repos/{owner}/{repo}/compare/{basehead}': (params) => ({ data: params.page === 1 ? { files, commits } : { files: [], commits: [] } }),
    'GET /repos/{owner}/{repo}/issues/{issue_number}': (params) => {
      const found = issues.find((candidate) => candidate.number === params.issue_number);
      if (!found) throw Object.assign(new Error('Not Found'), { status: 404 });
      return { data: found };
    },
    // The canon buttons (PRD 839): a PATCH carrying only the actions adds them to the run.
    'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}': (params) => {
      if (!params.actions) return null;
      const run = github.state.checkRuns.find((r) => r.id === params.check_run_id);
      assertDefined(run, `the check run ${String(params.check_run_id)}`);
      run.actions = params.actions;
      return { data: run };
    },
  };
  github.octokit = {
    async request(route, params = {}) {
      const answered = extra[route]?.(params);
      if (answered) {
        github.state.requests.push({ route, ...params });
        return answered;
      }
      const response = await inner.request(route, params);
      // The run the fake answers is the one it keeps: the last it created.
      if (route === 'POST /repos/{owner}/{repo}/check-runs' && params.external_id) checkRunAt(github.state, -1).external_id = params.external_id;
      return response;
    },
  };
  return github;
}

/** The buttons the check run at `index` carries: the test fails when it carries something else. */
const actionsOf = (github: ReturnType<typeof inboxGitHub>, index: number) => ActionsSchema.parse(checkRunAt(github.state, index).actions);


const PAYLOAD = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1', trigger: 'pull_request.synchronize' };

/** One try of the `pr-inbox` job over the stub, the canon gate `canon` wired or none: how it ended. */
function run(github: ReturnType<typeof inboxGitHub>, payload: Record<string, unknown> = PAYLOAD, canon: CanonGrader | null = null) {
  return inboxHandler({ octokitFor: () => github.octokit, canon })(claimedJob(PR_INBOX_KIND, payload));
}

/** The job's failure hook over `octokit`, the job having failed on its 5th try with `message`. */
const failed = (octokit: ReturnType<typeof inboxGitHub>['octokit'], message: string) => inboxFailureHook({ octokitFor: () => octokit })(claimedJob(PR_INBOX_KIND, PAYLOAD, 5), message);

describe('inbox-check — a roadmap\'s phase-0 PR (issue 1198)', () => {
  const IN = '.omni-loop/delivery/inbox';
  const files = [
    ...['0010-alpha', '0011-beta'].flatMap((folder) => ['spec.md', 'before-after.html'].map((file) => ({ filename: `${IN}/${folder}/${file}`, status: 'added' }))),
    { filename: `${IN}/roadmaps/0009-crew/roadmap.md`, status: 'added' },
  ];
  const rowIssue = (number: number) => ({ number, state: 'open', labels: [{ name: 'omni:prd' }] });

  it('reads every row\'s issue and completes success, naming the roadmap', async () => {
    const github = inboxGitHub({ head: 'inbox-head-roadmap', headRef: 'docs/phase-0-roadmap-crew', files, issues: [rowIssue(10), rowIssue(11)] });
    expect(await run(github)).toEqual({ outcome: 'done' });
    expect(checkRunAt(github.state, 0)).toMatchObject({ name: 'inbox', conclusion: 'success' });
    const issueReads = github.state.requests.filter((request) => request.route === 'GET /repos/{owner}/{repo}/issues/{issue_number}');
    expect(issueReads.map((request) => request.issue_number).sort()).toEqual([10, 11]);
    expect(outputOf(checkRunAt(github.state, 0)).title).toBe('Roadmap 9 complete: 2 PRDs in 2 waves, every gate ok · canon neutral');
  });

  it('a row whose issue is missing completes failure, naming it', async () => {
    const github = inboxGitHub({ head: 'inbox-head-roadmap', headRef: 'docs/phase-0-roadmap-crew', files, issues: [rowIssue(10)] });
    await run(github);
    expect(github.state.checkRuns[0]).toMatchObject({ conclusion: 'failure', output: { title: 'Not ok: PRD issue (PRD 11)' } });
  });
});

describe('inbox-check — a phase-0 PR gets the inbox check', () => {
  it('a complete phase-0 PR completes success, four gates ok, under the name ci.inboxContext', async () => {
    const github = inboxGitHub();
    expect(await run(github)).toEqual({ outcome: 'done' });
    expect(github.state.requests.filter((r) => r.route.includes('check-runs')).map((r) => r.status)).toEqual(['in_progress', 'completed']);
    expect(outputOf(checkRunAt(github.state, 0)).summary).toContain('PRD 42');
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({
      name: 'inbox',
      head_sha: 'head1',
      external_id: INBOX_EXTERNAL_ID,
      status: 'completed',
      conclusion: 'success',
    });
    expect(outputOf(checkRunAt(github.state, 0)).summary.match(/^- ok — /gm)).toHaveLength(4);
    expect(github.state.comments).toEqual([]);
  });

  it('an incomplete phase-0 PR completes failure, naming the gate', async () => {
    const github = inboxGitHub({ head: 'inbox-head-no-plan', files: COMPLETE_FILES.filter((f) => !f.filename.endsWith('plan.md')) });
    await run(github);
    expect(github.state.checkRuns[0]).toMatchObject({ conclusion: 'failure', output: { title: 'Not ok: phase-0 verdict, plan' } });
  });

  it('an unsigned commit and a closed issue each fail their gate', async () => {
    const github = inboxGitHub({ commits: [{ sha: 'c9', commit: { message: 'docs: no trailer' } }], issue: { ...OPEN_ISSUE, state: 'closed' } });
    await run(github);
    expect(outputOf(checkRunAt(github.state, 0)).title).toBe('Not ok: phase-0 verdict, PRD issue');
    expect(outputOf(checkRunAt(github.state, 0)).summary).toContain('issue #42 is closed');
  });

  it('the canon gate grades the PR\'s spec against its repository: red, "canon ✗ 1"', async () => {
    const github = inboxGitHub();
    const grade: CanonGrader['grade'] = ({ repo, spec }) => Promise.resolve({
      name: 'canon',
      ok: false,
      neutral: false,
      title: 'canon ✗ 1',
      reason: 'canon ✗ 1',
      details: [`${repo}: never#4 "Never: widgets" — the spec: "${spec.includes('a complete PRD folder') ? 'a complete PRD folder' : '?'}"`],
      canon: { state: 'red', reason: 'canon ✗ 1', claimsRead: 1, findings: [], persona: null },
    });
    await run(github, PAYLOAD, { grade });
    expect(checkRunAt(github.state, 0)).toMatchObject({ conclusion: 'failure' });
    expect(outputOf(checkRunAt(github.state, 0)).title).toBe('Not ok: canon ✗ 1');
    expect(outputOf(checkRunAt(github.state, 0)).summary).toContain('  - acme/widgets: never#4 "Never: widgets" — the spec: "a complete PRD folder"');
  });

  it('without a canon gate wired, the canon line is neutral and the check still succeeds', async () => {
    const github = inboxGitHub();
    await run(github);
    expect(outputOf(checkRunAt(github.state, 0)).summary).toContain('- neutral — canon: the canon gate is not wired here');
  });

  it('a ci.inboxContext set in the base config renames the check run', async () => {
    const github = inboxGitHub({ base: 'inbox-base-renamed' });
    await run(github);
    expect(github.state.checkRuns[0]).toMatchObject({ name: 'phase-0 shape', conclusion: 'success' });
  });

  it('snapshots only the base config and the head delivery folder', async () => {
    const github = inboxGitHub();
    await run(github);
    const blobs = github.state.requests.filter((r) => r.route.endsWith('/git/blobs/{file_sha}')).map((r) => String(r.file_sha));
    expect(blobs.length).toBeGreaterThan(0);
    for (const sha of blobs) expect(sha === 'base1:.omni-loop/config.yml' || sha.startsWith('head1:.omni-loop/delivery/inbox/')).toBe(true);
  });
});

describe('inbox-check — the two actions on a red canon check (PRD 839)', () => {
  const canonGate = (state: string): CanonGrader => ({
    grade: () => Promise.resolve({
      name: 'canon',
      ok: state !== 'red',
      neutral: state === 'neutral',
      title: state === 'red' ? 'canon ✗ 1' : undefined,
      reason: state === 'red' ? 'canon ✗ 1' : state === 'green' ? 'canon ✓ · 1 claim read' : 'no business',
      details: [],
      canon: {
        state,
        reason: '',
        claimsRead: 1,
        findings: state === 'red' ? [{ quote: 'a complete PRD folder', claims: ['never#4'], why: 'a group' }] : [],
        persona: state === 'red' ? { name: 'Marc', line: 'Not for me.' } : null,
      },
    }),
  });
  const runWith = (github: ReturnType<typeof inboxGitHub>, state: string) => run(github, PAYLOAD, canonGate(state));

  it('a red canon check run carries Rewrite for <persona> and Change the line', async () => {
    const github = inboxGitHub();
    await runWith(github, 'red');
    expect(github.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure' });
    expect(actionsOf(github, 0).map((a) => [a.label, a.identifier])).toEqual([
      ['Rewrite for Marc', 'canon-rewrite'],
      ['Change the line', 'canon-claim'],
    ]);
  });

  it.each(['green', 'neutral'])('a %s canon check run carries none', async (state) => {
    const github = inboxGitHub();
    await runWith(github, state);
    expect(checkRunAt(github.state, 0).actions).toBeUndefined();
  });
});

describe('inbox-check — silent on every other PR', () => {
  it.each([['a feature PR', 'feat/widget'], ['a sub-PR', 'feat/widget--s1'], ['any other branch', 'fix/widget']])(
    '%s gets no inbox check run',
    async (_, headRef) => {
      const github = inboxGitHub({ headRef });
      expect(await run(github)).toMatchObject({ outcome: 'skipped' });
      expect(github.state.checkRuns).toEqual([]);
    },
  );

  it('a repository without .omni-loop/config.yml on its base gets no inbox check run', async () => {
    const github = inboxGitHub({ base: 'base-inactive' });
    await run(github);
    expect(github.state.checkRuns).toEqual([]);
    const writes = github.state.requests.filter((r) => r.route.startsWith('POST ') || r.route.startsWith('PATCH '));
    expect(writes).toEqual([]);
  });

  it('the failure hook posts nothing on a PR that is not phase-0', async () => {
    const github = inboxGitHub({ headRef: 'feat/widget' });
    await failed(github.octokit, 'boom');
    expect(github.state.checkRuns).toEqual([]);
  });
});

describe('inbox-check — fail closed', () => {
  it('a failure after its tries completes the running check as failure, with the reason', async () => {
    const github = inboxGitHub();
    const broken = {
      request: (route: string, params?: Params) => {
        if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') return Promise.reject(new Error('GitHub is down'));
        return github.octokit.request(route, params);
      },
    };
    await expect(inboxHandler({ octokitFor: () => broken })(claimedJob(PR_INBOX_KIND, PAYLOAD))).rejects.toThrow('GitHub is down');
    expect(checkRunAt(github.state, 0).status).toBe('in_progress');

    await failed(github.octokit, 'GitHub is down');
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({
      status: 'completed',
      conclusion: 'failure',
      output: { title: 'omni-loop could not evaluate: GitHub is down' },
    });
  });

  it('creates the inbox check already failed when the job failed before creating one', async () => {
    const github = inboxGitHub();
    await failed(github.octokit, 'boom\nstack');
    expect(github.state.checkRuns).toHaveLength(1);
    expect(checkRunAt(github.state, 0)).toMatchObject({ name: 'inbox', external_id: INBOX_EXTERNAL_ID, conclusion: 'failure', output: { title: 'omni-loop could not evaluate: boom' } });
  });

  it('when GitHub cannot say whether it is a phase-0 PR, completes an open inbox run and creates none', async () => {
    const github = inboxGitHub({ headRef: 'feat/widget' });
    const flaky = {
      request: (route: string, params?: Params) => {
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') return Promise.reject(new Error('502'));
        return github.octokit.request(route, params);
      },
    };
    await failed(flaky, '502');
    expect(github.state.checkRuns).toEqual([]);
  });
});

describe('inbox-check — from a signed webhook', () => {
  /** The delivery received: the `pr-inbox` jobs it refreshed, each run through the handler. */
  async function deliver(github: ReturnType<typeof inboxGitHub>, event: string, payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    const sent: RefreshJob[] = [];
    await receiveWebhook({
      body,
      headers: { 'x-github-event': event, 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` },
      secret: SECRET,
      refreshJobs: (jobs) => Promise.resolve(sent.push(...jobs)),
      forward: () => Promise.resolve(),
    });
    for (const job of sent.filter((one) => one.kind === PR_INBOX_KIND)) await run(github, job.payload);
    return sent;
  }

  it('a phase-0 PR opened, then its inbox run re-run, each complete the inbox check', async () => {
    const github = inboxGitHub();
    const pull = { number: 12, head: { sha: 'head1', ref: 'docs/phase-0-widget' }, base: { ref: 'main' } };
    await deliver(github, 'pull_request', { action: 'opened', installation: { id: 7 }, repository: REPOSITORY, number: 12, pull_request: pull });
    const rerun = await deliver(github, 'check_run', {
      action: 'rerequested',
      installation: { id: 7 },
      repository: REPOSITORY,
      check_run: { name: 'inbox', external_id: INBOX_EXTERNAL_ID, head_sha: 'head1', pull_requests: [{ number: 12, head: { sha: 'head1' } }] },
    });
    expect(rerun.map((job) => job.kind)).toEqual([PR_INBOX_KIND]);
    expect(github.state.checkRuns.map((r) => [r.name, r.conclusion])).toEqual([
      ['inbox', 'success'],
      ['inbox', 'success'],
    ]);
  });
});

describe('inbox-check — the pr-inbox job (PRD 2688 s3)', () => {
  const job = (payload: Record<string, unknown> = { installationId: 7, owner: 'acme', repo: 'widgets', prNumber: 12, headSha: 'head1' }) => ({
    id: 'job-1',
    kind: PR_INBOX_KIND,
    key: 'acme/widgets#12',
    subject: 'acme/widgets',
    payload,
    tries: 1,
    claim: 'claim-1',
    claimedUntil: '2027-01-01T00:00:00Z',
  });

  it('a complete phase-0 PR ends done with the check run the function posts: same verdict, same name', async () => {
    const github = inboxGitHub();
    const result = await inboxHandler({ octokitFor: () => github.octokit })(job());
    expect(result).toEqual({ outcome: 'done' });
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({ name: 'inbox', head_sha: 'head1', external_id: INBOX_EXTERNAL_ID, status: 'completed', conclusion: 'success' });
    expect(github.state.comments).toEqual([]);
  });

  it('an incomplete phase-0 PR completes failure, naming the gate', async () => {
    const github = inboxGitHub({ head: 'inbox-head-no-plan', files: COMPLETE_FILES.filter((f) => !f.filename.endsWith('plan.md')) });
    expect(await inboxHandler({ octokitFor: () => github.octokit })(job())).toEqual({ outcome: 'done' });
    expect(github.state.checkRuns[0]).toMatchObject({ conclusion: 'failure', output: { title: 'Not ok: phase-0 verdict, plan' } });
  });

  it('a red canon check run carries its buttons', async () => {
    const github = inboxGitHub();
    const grade: CanonGrader['grade'] = () => Promise.resolve({
      name: 'canon',
      ok: false,
      neutral: false,
      title: 'canon ✗ 1',
      reason: 'canon ✗ 1',
      details: [],
      canon: { state: 'red', reason: 'canon ✗ 1', claimsRead: 1, findings: [], persona: null },
    });
    await inboxHandler({ octokitFor: () => github.octokit, canon: { grade } })(job());
    expect(actionsOf(github, 0).length).toBeGreaterThan(0);
  });

  it.each([['a feature PR', 'feat/widget'], ['any other branch', 'fix/widget']])('%s ends skipped and posts nothing', async (_, headRef) => {
    const github = inboxGitHub({ headRef });
    const result = await inboxHandler({ octokitFor: () => github.octokit })(job());
    expect(result).toMatchObject({ outcome: 'skipped' });
    expect(github.state.checkRuns).toEqual([]);
  });

  it('a repository without the loop\'s config ends skipped and writes nothing', async () => {
    const github = inboxGitHub({ base: 'base-inactive' });
    expect(await inboxHandler({ octokitFor: () => github.octokit })(job())).toMatchObject({ outcome: 'skipped' });
    expect(github.state.requests.filter((r) => r.route.startsWith('POST ') || r.route.startsWith('PATCH '))).toEqual([]);
  });

  it('a malformed payload throws, naming the field', async () => {
    const github = inboxGitHub();
    await expect(inboxHandler({ octokitFor: () => github.octokit })(job({ owner: 'acme' }))).rejects.toThrow(/pr-inbox job is malformed: installationId/);
  });

  it('GitHub failing mid-run throws, so the worker retries, and the hook then completes the running check as failure', async () => {
    const github = inboxGitHub();
    const broken = {
      request: (route: string, params?: Params) => {
        if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') return Promise.reject(new Error('GitHub is down'));
        return github.octokit.request(route, params);
      },
    };
    await expect(inboxHandler({ octokitFor: () => broken })(job())).rejects.toThrow('GitHub is down');
    expect(checkRunAt(github.state, 0).status).toBe('in_progress');

    await inboxFailureHook({ octokitFor: () => github.octokit })(job(), 'GitHub is down');
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure', output: { title: 'omni-loop could not evaluate: GitHub is down' } });
  });

  it('the failure hook creates the check already failed when no run was started, and posts nothing on a PR that is not phase-0', async () => {
    const github = inboxGitHub();
    await inboxFailureHook({ octokitFor: () => github.octokit })(job(), 'boom');
    expect(checkRunAt(github.state, 0)).toMatchObject({ name: 'inbox', conclusion: 'failure', output: { title: 'omni-loop could not evaluate: boom' } });

    const other = inboxGitHub({ headRef: 'feat/widget' });
    await inboxFailureHook({ octokitFor: () => other.octokit })(job(), 'boom');
    expect(other.state.checkRuns).toEqual([]);
  });
});
