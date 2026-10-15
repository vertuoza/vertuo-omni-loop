// Issue 1970: an outbox check whose run failed while the installation's GitHub budget was below its
// background floor stayed `in_progress` for good. Its failure handler met the same floor, swallowed
// the refusal and wrote nothing. It now waits for the budget, as the check's own steps do (PRD 902):
// the refusal becomes a retry at the time the budget allows, and the open check run is completed then.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { InngestTestEngine } from '@inngest/test';
import { RetryAfterError } from 'inngest';
import { describe, expect, it } from 'vitest';
import { GithubDeferred, GithubPaused } from '@omni/github';
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import { fakeGitHub } from './fake-github.ts';
import { createFailureHandler, createOutboxCheck } from './outbox-check.ts';

type Params = Record<string, unknown>;

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);

const UNTIL = Date.parse('2026-10-14T18:47:01.000Z');

const event = () => ({
  name: OUTBOX_CHECK_EVENT,
  data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1', trigger: 'pull_request.synchronize' },
});

const failed = (message: string) => ({
  event: { name: 'inngest/function.failed', data: { event: event(), error: { message } } },
  error: new Error(message),
});

function featureGitHub() {
  return fakeGitHub({
    commits: { base1: fixture('base-active'), head1: fixture('head-open') },
    pull: { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' } },
  });
}

/** Every call refused by the budget, unsent, the refusal wrapped as Octokit wraps it. */
const refusedBy = (refusal: Error) => ({
  request: (_route: string, _params?: Params) => Promise.reject(Object.assign(new Error(refusal.message), { status: 500, cause: refusal })),
});

/** A feature PR whose check the in-progress step opened, then whose evaluation failed. */
async function openCheck() {
  const github = featureGitHub();
  const failing = { request: (route: string, params?: Params) =>
    route === 'GET /repos/{owner}/{repo}/compare/{basehead}' ? Promise.reject(new Error('boom')) : github.octokit.request(route, params) };
  await new InngestTestEngine({ function: createOutboxCheck({ client: inngest, octokitFor: () => failing }), events: [event()] }).execute();
  expect(github.state.checkRuns).toEqual([expect.objectContaining({ status: 'in_progress' })]);
  return github;
}

describe('outbox-check — the failure handler waits for the GitHub budget (issue 1970)', () => {
  for (const [what, refusal] of [['below its background floor', new GithubDeferred(UNTIL)], ['paused', new GithubPaused(UNTIL)]] as const) {
    it(`retries once the budget allows it when the budget is ${what}, rather than writing nothing`, async () => {
      const github = await openCheck();
      const run = createFailureHandler({ octokitFor: () => refusedBy(refusal) })(failed('boom'));
      await expect(run).rejects.toBeInstanceOf(RetryAfterError);
      await expect(run).rejects.toMatchObject({ retryAfter: new Date(UNTIL).toISOString() });
      expect(github.state.checkRuns).toEqual([expect.objectContaining({ status: 'in_progress' })]);
    });
  }

  it('completes the open check as failure once the budget allows it', async () => {
    const github = await openCheck();
    await createFailureHandler({ octokitFor: () => github.octokit })(failed('boom'));
    expect(github.state.checkRuns).toEqual([expect.objectContaining({ status: 'completed', conclusion: 'failure' })]);
  });
});
