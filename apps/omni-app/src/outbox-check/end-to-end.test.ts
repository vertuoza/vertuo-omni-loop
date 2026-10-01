// @ts-nocheck
// In-process, from a signed webhook to a completed check, against a stubbed GitHub: PRD 28's
// acceptance criteria 1–6, which a person re-runs live once the app is registered and installed.
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest } from '../inngest-client.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { fakeGitHub } from './fake-github.ts';
import { createOutboxCheck } from './outbox-check.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);
const SECRET = 'e2e-secret';

const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };

function pullRequestDelivery(pull, action = 'synchronize') {
  return {
    event: 'pull_request',
    payload: { action, installation: { id: 7 }, repository: REPOSITORY, number: pull.number, pull_request: pull },
  };
}

function rerunDelivery(pull) {
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

/** A signed delivery through `/api/github`'s unit, then every event it sent through the real function. */
async function deliver(github, { event, payload }) {
  const body = JSON.stringify(payload);
  const sent = [];
  const response = await receiveWebhook({
    body,
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`,
    },
    secret: SECRET,
    send: async (events) => sent.push(...events),
  });
  expect(response.status).toBe(200);
  const fn = createOutboxCheck({ client: inngest, octokitFor: () => github.octokit });
  for (const e of sent) {
    const { error } = await new InngestTestEngine({ function: fn, events: [e] }).execute();
    if (error) throw error;
  }
  return sent;
}

const featurePull = (head = 'head1') => ({
  number: 12,
  base: { ref: 'main', sha: 'base1' },
  head: { ref: 'feat/widget', sha: head },
  labels: [],
});

const latest = (github) => github.state.checkRuns.at(-1);

describe('end to end — a signed webhook to a completed check', () => {
  it('1. a feature PR with an open outbox item shows the outbox check as failure, listing the item', async () => {
    const pull = featurePull();
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull));
    expect(latest(github)).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
    expect(latest(github).output.title).toBe('1 open outbox item');
    expect(latest(github).output.summary).toContain('s1-01-widget-colour.md');
    expect(github.state.comments[0].body).toContain('Which colour should the widget be?');
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
    expect(github.state.comments[0].body).toContain('No open items.');
  });

  it('3. labelled omni:outbox-go while red, the check is neutral with "Override in effect"', async () => {
    const pull = { ...featurePull(), labels: ['omni:outbox-go'] };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'labeled'));
    expect(latest(github)).toMatchObject({ conclusion: 'neutral', output: { title: 'Override in effect (omni:outbox-go)' } });
  });

  it('4. a sub-PR (base is the feature branch) shows the check skipped: not active on this PR', async () => {
    const pull = { number: 13, base: { ref: 'feat/widget', sha: 'base1' }, head: { ref: 'feat/widget--s1', sha: 'head1' } };
    const github = fakeGitHub({ commits: { base1: fixture('base-active'), head1: fixture('head-open') }, pull });
    await deliver(github, pullRequestDelivery(pull, 'opened'));
    expect(latest(github)).toMatchObject({
      name: 'outbox',
      conclusion: 'skipped',
      output: { title: 'omni-loop is not active on this PR' },
    });
    expect(github.state.comments).toHaveLength(0);
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
});
