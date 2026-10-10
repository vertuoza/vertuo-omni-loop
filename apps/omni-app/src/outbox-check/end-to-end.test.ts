// In-process, from a signed webhook to a completed check, against a stubbed GitHub: PRD 28's
// acceptance criteria 1–6, which a person re-runs live once the app is registered and installed. The
// check reads the stub through the app's own installation Octokit, built on the shared budget-aware
// client (PRD 902, s5), so every call spends installation 7's budget, and a paused budget refuses it.
import { parsePr, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { githubClient, memoryGithubStore, type GithubStore } from '@omni/github';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { type AppEvent, inngest } from '../inngest-client.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { installationOctokitFor } from '../octokit-for.ts';
import { checkRunAt, fakeGitHub, outputOf, overHttp } from './fake-github.ts';
import { createOutboxCheck } from './outbox-check.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);
const SECRET = 'e2e-secret';

const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };
const INSTALLATION = 7;

/** The GitHub App the check signs its installation token with: a key made for this file. */
const GITHUB_APP = {
  id: '1',
  privateKey: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
};

/** What every answer of the stub reports of installation 7's budget. */
const HOUR = 3_600_000;
const RATE = Object.freeze({
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4900',
  'x-ratelimit-reset': String(Math.floor((Date.now() + HOUR) / 1000)),
  'x-ratelimit-resource': 'core',
});

/** A pull request as a delivery carries it. */
type Pull = { number: PrNumber; base: { ref: string; sha: string }; head: { ref: string; sha: string }; labels?: string[]; body?: string };
/** A delivery to `/api/github`: its event and its payload. */
type Delivery = { event: string; payload: Record<string, unknown> };
type GitHub = ReturnType<typeof fakeGitHub>;

function pullRequestDelivery(pull: Pull, action = 'synchronize'): Delivery {
  return {
    event: 'pull_request',
    payload: { action, installation: { id: 7 }, repository: REPOSITORY, number: pull.number, pull_request: pull },
  };
}

function rerunDelivery(pull: Pull): Delivery {
  return {
    event: 'check_run',
    payload: {
      action: 'rerequested',
      installation: { id: 7 },
      repository: REPOSITORY,
      check_run: { head_sha: pull.head.sha, pull_requests: [{ number: pull.number, head: { sha: pull.head.sha } }] },
    },
  };
}

/** What a run of the check was handed and what it left: the budget's store, the plain calls and the log. */
type Run = { store: GithubStore; plain: string[]; logged: string[] };

/**
 * The app's installation Octokit on the stub, every call through the shared client, onto `store`.
 * Its token is minted with a plain call (the App's budget, not the installation's), recorded in `plain`.
 */
function appOctokitFor(github: GitHub, { store, plain, logged }: Run) {
  vi.stubGlobal('fetch', (url: string) => {
    plain.push(new URL(url).pathname);
    const token = { token: 'ghs_e2e', expires_at: new Date(Date.now() + HOUR).toISOString(), permissions: {}, repository_selection: 'all' };
    return Promise.resolve(new Response(JSON.stringify(token), { status: 201, headers: { 'content-type': 'application/json' } }));
  });
  return installationOctokitFor(GITHUB_APP, githubClient({ store, fetch: overHttp(github, RATE), log: (line) => logged.push(line) }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fresh run: an empty store, no plain call, nothing logged. */
const freshRun = (): Run => ({ store: memoryGithubStore(), plain: [], logged: [] });

/** A signed delivery through `/api/github`'s unit, then every event it sent through the real function. */
async function deliver(github: GitHub, delivery: Delivery, run: Run = freshRun()) {
  const { sent, errors } = await attempt(github, delivery, run);
  expect(errors).toEqual([]);
  return sent;
}

/** `deliver`, handing back each run's error instead of failing on it. */
async function attempt(github: GitHub, { event, payload }: Delivery, run: Run) {
  const body = JSON.stringify(payload);
  const sent: AppEvent[] = [];
  const response = await receiveWebhook({
    body,
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`,
    },
    secret: SECRET,
    forward: () => Promise.resolve(),
    send: (events) => Promise.resolve(sent.push(...events)),
  });
  expect(response.status).toBe(200);
  const fn = createOutboxCheck({ client: inngest, octokitFor: appOctokitFor(github, run), log: (line) => run.logged.push(line) });
  const errors: unknown[] = [];
  for (const e of sent) {
    const { error } = await new InngestTestEngine({ function: fn, events: [e] }).execute();
    if (error) errors.push(error);
  }
  return { sent, errors };
}

const featurePull = (head = 'head1') => ({
  number: parsePr(12),
  base: { ref: 'main', sha: 'base1' },
  head: { ref: 'feat/widget', sha: head },
  labels: [],
});

const latest = (github: GitHub) => checkRunAt(github.state, -1);

/** The first comment on the pull request: the test fails when there is none. */
function firstComment(github: GitHub) {
  const comment = github.state.comments[0];
  assertDefined(comment, 'a comment on the pull request');
  return comment;
}

describe('end to end — a signed webhook to a completed check', () => {
  it('1. a feature PR with an open outbox item shows the outbox check as failure, listing the item', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull));
    expect(latest(github)).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
    expect(outputOf(latest(github)).title).toBe('1 open outbox item');
    expect(outputOf(latest(github)).summary).toContain('s1-01-widget-colour.md');
    expect(firstComment(github).body).toContain('Which colour should the widget be?');
  });

  it('2. after the item is settled and pushed, the same PR’s check is success', async () => {
    const github = fakeGitHub({
      commits: { base1: fixture('base-active'), head1: fixture('head-open'), head2: fixture('head-clear') },
      pull: featurePull(),
    });
    await deliver(github, pullRequestDelivery(featurePull('head1')));
    github.state.pull.head.sha = 'head2';
    await deliver(github, pullRequestDelivery(featurePull('head2')));
    expect(latest(github)).toMatchObject({ head_sha: 'head2', conclusion: 'success', output: { title: 'Outbox clear' } });
    expect(github.state.comments).toHaveLength(1);
    expect(firstComment(github).body).toContain('No open items.');
  });

  it('3. labelled omni:outbox-go while red, the check is neutral with "Override in effect"', async () => {
    const pull = { ...featurePull(), labels: ['omni:outbox-go'] };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'labeled'));
    expect(latest(github)).toMatchObject({ conclusion: 'neutral', output: { title: 'Override in effect (omni:outbox-go)' } });
  });

  it('4. a sub-PR (base is the feature branch) shows the check skipped: not active on this PR', async () => {
    const pull = { number: parsePr(13), base: { ref: 'feat/widget', sha: 'base1' }, head: { ref: 'feat/widget--s1', sha: 'head1' } };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({
      name: 'outbox',
      conclusion: 'skipped',
      output: { title: 'omni-loop is not active on this PR' },
    });
    expect(github.state.comments).toHaveLength(0);
  });

  it('9. a target feature PR (body "Part of <plan repo>#<prd>") passes, linking the plan PR that grades its PRD (issue 1202)', async () => {
    const pull = { ...featurePull(), head: { ref: 'feat/gadget', sha: 'head1' }, body: 'Part of acme/plan#8\n\nThe widgets half of PRD 8.' };
    const github = fakeGitHub({
      commits: { base1: fixture('base-active'), head1: fixture('head-open') },
      pull,
      others: { 'acme/plan': [{ number: 36, body: 'Closes #80' }, { number: 37, body: 'Closes #8\n\nThe plan PR.' }] },
    });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({ name: 'outbox', status: 'completed', conclusion: 'success' });
    expect(outputOf(latest(github)).title).toBe("PRD 8 is graded on acme/plan's plan PR");
    expect(outputOf(latest(github)).summary).toContain('https://github.com/acme/plan/pull/37');
    expect(github.state.comments).toHaveLength(0);
  });

  it('10. a target feature PR whose plan repository the App cannot read still passes, linking the PRD issue', async () => {
    const pull = { ...featurePull(), head: { ref: 'feat/gadget', sha: 'head1' }, body: 'Part of acme/plan#8' };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({ conclusion: 'success' });
    expect(outputOf(latest(github)).summary).toContain('https://github.com/acme/plan/issues/8');
  });

  it('11. a fix PR that removes a law\'s test fails, naming the law, until its folder\'s outbox answers it (PRD 1342)', async () => {
    const pull = { ...featurePull(), head: { ref: 'fix/77-crash', sha: 'head1' } };
    const files = [{ filename: 'src/widget.test.ts', status: 'removed' }];
    const github = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-fix'), head2: fixture('head-laws-fix-open') }, pull, files });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
    expect(outputOf(latest(github)).title).toBe('2 unaccounted changes to a law — N-PRODUCT-1');
    expect(outputOf(latest(github)).summary).toContain('.omni-loop/delivery/bugs/0077-crash/outbox/');

    github.state.pull.head.sha = 'head2';
    await deliver(github, pullRequestDelivery({ ...pull, head: { ref: 'fix/77-crash', sha: 'head2' } }));
    expect(latest(github)).toMatchObject({ head_sha: 'head2', conclusion: 'failure', output: { title: '1 open outbox item — N-PRODUCT-1' } });
    expect(firstComment(github).body).toContain('The fix removes the old test');
  });

  it('12. a fix PR that touches no law passes, and a knowledge PR passes listing its laws (PRD 1342)', async () => {
    const fix = { ...featurePull(), head: { ref: 'fix/77-crash', sha: 'head1' } };
    const clear = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-fix') }, pull: fix, files: [{ filename: 'src/widget.ts', status: 'modified' }] });
    await deliver(clear, pullRequestDelivery(fix, 'opened'));
    expect(latest(clear)).toMatchObject({ conclusion: 'success', output: { title: 'Outbox clear' } });

    const knowledge = { ...featurePull(), head: { ref: 'docs/knowledge-widget', sha: 'head1' } };
    const files = [{ filename: '.omni-loop/knowledge/product/invariants.md', status: 'modified' }];
    const github = fakeGitHub({ commits: { base1: fixture('base-laws'), head1: fixture('head-laws-feature-demoted') }, pull: knowledge, files });
    await deliver(github, pullRequestDelivery(knowledge, 'opened'));
    expect(latest(github)).toMatchObject({ conclusion: 'success', output: { title: 'Knowledge PR: 1 law touched' } });
    expect(outputOf(latest(github)).summary).toContain('N-PRODUCT-1: A widget is never shown without its colour.');
  });

  it('5. a repository with no .omni-loop/config.yml gets no outbox check at all (PRD 359)', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-inactive'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    await deliver(github, rerunDelivery(pull));
    expect(github.state.checkRuns).toEqual([]);
    expect(github.state.comments).toEqual([]);
    const routes = github.state.requests.map((r) => r.route);
    expect(routes.filter((route) => route.includes('check-runs') || route.includes('/comments'))).toEqual([]);
    expect(routes).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
  });

  it('6. pressing Re-run re-evaluates without a new commit', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull));
    github.state.pull.labels = ['omni:outbox-go'];
    const sent = await deliver(github, rerunDelivery(pull));
    expect(sent).toHaveLength(1);
    expect(github.state.checkRuns).toHaveLength(2);
    expect(latest(github)).toMatchObject({ head_sha: 'head1', conclusion: 'neutral' });
  });

  it('7. every call the check makes goes through the shared client, spending the installation’s budget', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    const run = freshRun();
    await deliver(github, pullRequestDelivery(pull), run);
    expect(github.state.requests.length).toBeGreaterThan(0);
    expect(await run.store.budget(INSTALLATION, 'core')).toMatchObject({ limit: 5000, remaining: 4900, pausedUntil: null });
    expect(run.plain).toEqual([`/app/installations/${INSTALLATION}/access_tokens`]);
  });

  it('8. a paused budget refuses the check: nothing is sent to GitHub, nothing is posted, one line is logged', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    const run = freshRun();
    const until = Date.now() + HOUR;
    await run.store.pause(INSTALLATION, 'core', until, Date.now());
    const { errors } = await attempt(github, pullRequestDelivery(pull), run);
    expect(errors).toHaveLength(1);
    expect(github.state.requests).toEqual([]);
    expect(github.state.checkRuns).toEqual([]);
    expect(github.state.comments).toEqual([]);
    expect(run.logged).toEqual([expect.stringContaining(`GitHub paused until ${new Date(until).toISOString()}`)]);
  });
});
