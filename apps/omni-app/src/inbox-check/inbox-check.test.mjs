// `inbox-check` end to end against the stubbed GitHub (PRD 675): the outbox check's fake, widened
// with the two routes only the inbox check reads (the compare's commits and the PRD issue) and the
// check run's `external_id`. No test calls GitHub.
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, INBOX_CHECK_EVENT, INBOX_EXTERNAL_ID, OUTBOX_CHECK_EVENT } from '../inngest-client.mjs';
import { fakeGitHub } from '../outbox-check/fake-github.mjs';
import { receiveWebhook } from '../webhook/webhook.mjs';
import {
  INBOX_DEBOUNCE,
  INBOX_FUNCTION_ID,
  createInboxCheck,
  createInboxFailureHandler,
  inboxCheck,
} from './inbox-check.mjs';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);
const SECRET = 'inbox-secret';
const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };

const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const FOLDER = '.omni-loop/delivery/inbox/0042-widget';
const COMPLETE_FILES = ['spec.md', 'plan.md', 'before-after.html'].map((file) => ({ filename: `${FOLDER}/${file}`, status: 'added' }));
const SIGNED = [{ sha: 'c1', commit: { message: `docs(phase-0): widget\n\n${TRAILER}` } }];
const OPEN_ISSUE = { number: 42, state: 'open', labels: [{ name: 'omni:prd' }] };

/** The outbox check's fake GitHub, plus the compare's commits, the issues route and `external_id`. */
function inboxGitHub({ base = 'inbox-base', head = 'inbox-head-complete', headRef = 'docs/phase-0-widget', files = COMPLETE_FILES, commits = SIGNED, issue = OPEN_ISSUE } = {}) {
  const pull = { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: headRef, sha: 'head1' }, labels: [] };
  const github = fakeGitHub({ commits: { base1: fixture(base), head1: fixture(head) }, pull });
  const inner = github.octokit;
  const extra = {
    'GET /repos/{owner}/{repo}/compare/{basehead}': (params) => ({ data: params.page === 1 ? { files, commits } : { files: [], commits: [] } }),
    'GET /repos/{owner}/{repo}/issues/{issue_number}': (params) => {
      if (issue?.number !== params.issue_number) throw Object.assign(new Error('Not Found'), { status: 404 });
      return { data: issue };
    },
    // The canon buttons (PRD 839): a PATCH carrying only the actions adds them to the run.
    'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}': (params) => {
      if (!params.actions) return null;
      const run = github.state.checkRuns.find((r) => r.id === params.check_run_id);
      run.actions = params.actions;
      return { data: run };
    },
  };
  github.octokit = {
    async request(route, params) {
      const answered = extra[route]?.(params);
      if (answered) {
        github.state.requests.push({ route, ...params });
        return answered;
      }
      const response = await inner.request(route, params);
      if (route === 'POST /repos/{owner}/{repo}/check-runs' && params.external_id) response.data.external_id = params.external_id;
      return response;
    },
  };
  return github;
}

const event = (name = OUTBOX_CHECK_EVENT) => ({
  name,
  data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1', trigger: 'pull_request.synchronize' },
});

async function run(github, e = event()) {
  const fn = createInboxCheck({ client: inngest, octokitFor: () => github.octokit });
  return new InngestTestEngine({ function: fn, events: [e] }).execute();
}

const failedEvent = (message) => ({ event: { name: 'inngest/function.failed', data: { event: event(), error: { message } } }, error: new Error(message) });

describe('inbox-check — a phase-0 PR gets the inbox check', () => {
  it('a complete phase-0 PR completes success, four gates ok, under the name ci.inboxContext', async () => {
    const github = inboxGitHub();
    const { ctx, result } = await run(github);
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['in-progress', 'evaluate', 'publish']);
    expect(result).toMatchObject({ name: 'inbox', conclusion: 'success', prd: 42 });
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({
      name: 'inbox',
      head_sha: 'head1',
      external_id: INBOX_EXTERNAL_ID,
      status: 'completed',
      conclusion: 'success',
    });
    expect(github.state.checkRuns[0].output.summary.match(/^- ok — /gm)).toHaveLength(4);
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
    expect(github.state.checkRuns[0].output.title).toBe('Not ok: phase-0 verdict, PRD issue');
    expect(github.state.checkRuns[0].output.summary).toContain('issue #42 is closed');
  });

  it('the canon gate grades the PR\'s spec against its repository: red, "canon ✗ 1"', async () => {
    const github = inboxGitHub();
    const grade = async ({ repo, spec }) => ({
      name: 'canon',
      ok: false,
      neutral: false,
      title: 'canon ✗ 1',
      reason: 'canon ✗ 1',
      details: [`${repo}: never#4 "Never: widgets" — the spec: "${spec.includes('a complete PRD folder') ? 'a complete PRD folder' : '?'}"`],
      canon: { state: 'red', reason: 'canon ✗ 1', claimsRead: 1, findings: [], persona: null },
    });
    const fn = createInboxCheck({ client: inngest, octokitFor: () => github.octokit, canon: { grade } });
    const { result } = await new InngestTestEngine({ function: fn, events: [event()] }).execute();
    expect(result).toMatchObject({ conclusion: 'failure' });
    expect(github.state.checkRuns[0].output.title).toBe('Not ok: canon ✗ 1');
    expect(github.state.checkRuns[0].output.summary).toContain('  - acme/widgets: never#4 "Never: widgets" — the spec: "a complete PRD folder"');
  });

  it('without a canon gate wired, the canon line is neutral and the check still succeeds', async () => {
    const github = inboxGitHub();
    await run(github);
    expect(github.state.checkRuns[0].output.summary).toContain('- neutral — canon: the canon gate is not wired here');
  });

  it('a ci.inboxContext set in the base config renames the check run', async () => {
    const github = inboxGitHub({ base: 'inbox-base-renamed' });
    await run(github);
    expect(github.state.checkRuns[0]).toMatchObject({ name: 'phase-0 shape', conclusion: 'success' });
  });

  it('snapshots only the base config and the head delivery folder', async () => {
    const github = inboxGitHub();
    await run(github);
    const blobs = github.state.requests.filter((r) => r.route.endsWith('/git/blobs/{file_sha}')).map((r) => r.file_sha);
    expect(blobs.length).toBeGreaterThan(0);
    for (const sha of blobs) expect(sha === 'base1:.omni-loop/config.yml' || sha.startsWith('head1:.omni-loop/delivery/inbox/')).toBe(true);
  });
});

describe('inbox-check — the two actions on a red canon check (PRD 839)', () => {
  const canonGate = (state) => ({
    grade: async () => ({
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
  const runWith = (github, state) =>
    new InngestTestEngine({ function: createInboxCheck({ client: inngest, octokitFor: () => github.octokit, canon: canonGate(state) }), events: [event()] }).execute();

  it('a red canon check run carries Rewrite for <persona> and Change the line', async () => {
    const github = inboxGitHub();
    const { ctx } = await runWith(github, 'red');
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['in-progress', 'evaluate', 'publish', 'actions']);
    expect(github.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure' });
    expect(github.state.checkRuns[0].actions.map((a) => [a.label, a.identifier])).toEqual([
      ['Rewrite for Marc', 'canon-rewrite'],
      ['Change the line', 'canon-claim'],
    ]);
  });

  it.each(['green', 'neutral'])('a %s canon check run carries none', async (state) => {
    const github = inboxGitHub();
    const { ctx } = await runWith(github, state);
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['in-progress', 'evaluate', 'publish']);
    expect(github.state.checkRuns[0].actions).toBeUndefined();
  });
});

describe('inbox-check — silent on every other PR', () => {
  it.each([['a feature PR', 'feat/widget'], ['a sub-PR', 'feat/widget--s1'], ['any other branch', 'fix/widget']])(
    '%s gets no inbox check run',
    async (_, headRef) => {
      const github = inboxGitHub({ headRef });
      const { ctx, result } = await run(github);
      expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['in-progress']);
      expect(result.posted).toBe(false);
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

  it('the failure handler posts nothing on a PR that is not phase-0', async () => {
    const github = inboxGitHub({ headRef: 'feat/widget' });
    const out = await createInboxFailureHandler({ octokitFor: () => github.octokit })(failedEvent('boom'));
    expect(out.posted).toBe(false);
    expect(github.state.checkRuns).toEqual([]);
  });
});

describe('inbox-check — fail closed', () => {
  it('a failure after retries completes the running check as failure, with the reason', async () => {
    const github = inboxGitHub();
    const broken = {
      request: async (route, params) => {
        if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') throw new Error('GitHub is down');
        return github.octokit.request(route, params);
      },
    };
    const fn = createInboxCheck({ client: inngest, octokitFor: () => broken });
    const { error } = await new InngestTestEngine({ function: fn, events: [event()] }).execute();
    expect(error).toBeTruthy();
    expect(github.state.checkRuns[0].status).toBe('in_progress');

    await createInboxFailureHandler({ octokitFor: () => github.octokit })(failedEvent('GitHub is down'));
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({
      status: 'completed',
      conclusion: 'failure',
      output: { title: 'omni-loop could not evaluate: GitHub is down' },
    });
  });

  it('creates the inbox check already failed when the run failed before creating one', async () => {
    const github = inboxGitHub();
    await createInboxFailureHandler({ octokitFor: () => github.octokit })(failedEvent('boom\nstack'));
    expect(github.state.checkRuns).toEqual([
      expect.objectContaining({ name: 'inbox', external_id: INBOX_EXTERNAL_ID, conclusion: 'failure', output: expect.objectContaining({ title: 'omni-loop could not evaluate: boom' }) }),
    ]);
  });

  it('when GitHub cannot say whether it is a phase-0 PR, completes an open inbox run and creates none', async () => {
    const github = inboxGitHub({ headRef: 'feat/widget' });
    const flaky = {
      request: async (route, params) => {
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') throw new Error('502');
        return github.octokit.request(route, params);
      },
    };
    const out = await createInboxFailureHandler({ octokitFor: () => flaky })(failedEvent('502'));
    expect(out).toMatchObject({ name: 'inbox', checkRunIds: [] });
    expect(github.state.checkRuns).toEqual([]);
  });
});

describe('inbox-check — the function’s configuration', () => {
  it('runs on the outbox check’s event and on its own re-run event, debounced per repository and PR', () => {
    expect(inboxCheck.id()).toBe(INBOX_FUNCTION_ID);
    expect(inboxCheck.opts.triggers).toEqual([{ event: OUTBOX_CHECK_EVENT }, { event: INBOX_CHECK_EVENT }]);
    expect(inboxCheck.opts.debounce).toBe(INBOX_DEBOUNCE);
    expect(INBOX_DEBOUNCE.key).toContain('event.data.prNumber');
    expect(inboxCheck.opts.retries).toBe(3);
    expect(typeof inboxCheck.opts.onFailure).toBe('function');
  });
});

describe('inbox-check — from a signed webhook', () => {
  async function deliver(github, event, payload) {
    const body = JSON.stringify(payload);
    const sent = [];
    await receiveWebhook({
      body,
      headers: { 'x-github-event': event, 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` },
      secret: SECRET,
      send: async (events) => sent.push(...events),
      forward: async () => {},
    });
    for (const e of sent) await run(github, e);
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
    expect(rerun.map((e) => e.name)).toEqual([INBOX_CHECK_EVENT]);
    expect(github.state.checkRuns.map((r) => [r.name, r.conclusion])).toEqual([
      ['inbox', 'success'],
      ['inbox', 'success'],
    ]);
  });
});
