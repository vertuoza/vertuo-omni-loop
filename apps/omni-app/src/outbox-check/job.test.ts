// PRD 2688 s2: the `outbox` check as the `pr-outbox` job. The handler is the Inngest function's body, so the
// verdicts are the ones outbox-check.test.ts proves; here the same fixtures run through the worker.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GithubDeferred } from '@omni/github';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob, Finish, FinishAnswer, JobLedger } from '../jobs/ledger.ts';
import { runDue } from '../jobs/worker.ts';
import { fakeGitHub } from './fake-github.ts';
import { OUTBOX_KIND, outboxFailureHook, outboxHandler } from './job.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);

type Params = Record<string, unknown>;

const payload = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1' };

function featureGitHub(over = {}) {
  return fakeGitHub({
    commits: { base1: fixture('base-active'), head1: fixture('head-open') },
    pull: { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' } },
    ...over,
  });
}

/** A ledger handing out one job of the kind, on the given try, and keeping what the worker finished it as. */
function ledgerOf(tries: number) {
  const queue: ClaimedJob[] = [
    { id: 'job-1', kind: OUTBOX_KIND, key: 'acme/widgets#12', subject: 'acme/widgets', payload, tries, claim: 'claim-1', claimedUntil: '2027-01-14T09:05:00.000Z' },
  ];
  const finished: Finish[] = [];
  const ledger: JobLedger = {
    claim: () => Promise.resolve(queue.splice(0, 1)),
    finish: (input): Promise<FinishAnswer> => {
      finished.push(input);
      return Promise.resolve(input.outcome === 'retry' || input.outcome === 'waiting' ? 'queued' : input.outcome);
    },
  };
  return { ledger, finished };
}

const quiet = () => undefined;

/** Runs the one job through the worker with the check's handler and failure hook over `octokit`. */
function work(tries: number, octokit: ReturnType<typeof featureGitHub>['octokit'] | { request: (route: string, params?: Params) => Promise<unknown> }) {
  const { ledger, finished } = ledgerOf(tries);
  const octokitFor = () => octokit as ReturnType<typeof featureGitHub>['octokit'];
  const summary = runDue({
    ledger,
    handlers: { [OUTBOX_KIND]: outboxHandler({ octokitFor, log: quiet }) },
    failures: { [OUTBOX_KIND]: outboxFailureHook({ octokitFor, log: quiet }) },
    log: quiet,
  });
  return { summary, finished };
}

/** GitHub as it is, but the compare endpoint throws: the check starts, then its evaluation fails. */
function failingGitHub() {
  const github = featureGitHub();
  const octokit = { request: (route: string, params?: Params) => (route === 'GET /repos/{owner}/{repo}/compare/{basehead}' ? Promise.reject(new Error('GitHub is down')) : github.octokit.request(route, params)) };
  return { github, octokit };
}

describe('pr-outbox — the handler is the check, moved over', () => {
  it('posts the verdict of the Inngest function on the same fixtures and ends the job done', async () => {
    const github = featureGitHub();
    const { summary, finished } = work(1, github.octokit);
    expect(await summary).toMatchObject({ ran: 1, done: 1 });
    expect(finished).toEqual([{ id: 'job-1', claim: 'claim-1', outcome: 'done', reason: null, retryAt: null }]);
    expect(github.state.checkRuns).toEqual([expect.objectContaining({ head_sha: 'head1', status: 'completed', conclusion: 'failure' })]);
    expect(github.state.requests.filter((r) => r.route.includes('check-runs')).map((r) => r.status)).toEqual(['in_progress', 'completed']);
  });

  it('a repository without the loop\'s config ends the job skipped and posts nothing', async () => {
    const github = featureGitHub({ commits: { base1: fixture('base-inactive'), head1: fixture('head-open') } });
    const { summary, finished } = work(1, github.octokit);
    expect(await summary).toMatchObject({ ran: 1, skipped: 1 });
    expect(finished[0]).toMatchObject({ outcome: 'skipped', reason: 'omni-loop is not active on this repo' });
    expect(github.state.checkRuns).toEqual([]);
    expect(github.state.comments).toEqual([]);
  });

  it('GitHub\'s budget low is waiting, the try given back', async () => {
    const refused = { request: () => Promise.reject(Object.assign(new Error('low'), { status: 500, cause: new GithubDeferred(Date.parse('2027-01-14T09:30:00Z')) })) };
    const { summary, finished } = work(1, refused);
    expect(await summary).toMatchObject({ ran: 1, waiting: 1 });
    expect(finished[0]).toMatchObject({ outcome: 'waiting' });
  });
});

describe('pr-outbox — the laws hold through the job', () => {
  /** The check run the job completes for a feature PR at `head`, the range changing `files`, the pull labelled `labels`. */
  async function jobCheck(head: string, over: { files?: { filename: string; status: string }[]; labels?: string[] } = {}) {
    const pull = { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' }, labels: over.labels ?? [] };
    const github = featureGitHub({ commits: { base1: fixture('base-active'), head1: fixture(head) }, files: over.files ?? [], pull });
    await work(1, github.octokit).summary;
    return github.state.checkRuns.at(-1);
  }

  it('law BR-PRODUCT-6: an unexplained risky change turns the job\'s check red, as do open questions and unfinished rework', async () => {
    expect(await jobCheck('head-clear')).toMatchObject({ conclusion: 'success' });
    expect(await jobCheck('head-clear', { files: [{ filename: 'src/widget.test.ts', status: 'removed' }] })).toMatchObject({ conclusion: 'failure', output: { title: '1 unaccounted risky change' } });
    expect(await jobCheck('head-open')).toMatchObject({ conclusion: 'failure', output: { title: '1 open outbox item' } });
    expect(await jobCheck('head-drift')).toMatchObject({ conclusion: 'failure', output: { title: 'unreworked drift' } });
  });

  it('law N-PRODUCT-4: the job takes its rules from the base, so a head that renames the override label switches nothing off', async () => {
    expect(await jobCheck('head-renames-label', { labels: ['ship-it'] })).toMatchObject({ conclusion: 'failure' });
    expect(await jobCheck('head-renames-label', { labels: ['omni:outbox-go'] })).toMatchObject({ conclusion: 'neutral' });
  });
});

describe('pr-outbox — failure, never stuck', () => {
  it('a try that throws is retried and completes nothing yet', async () => {
    const { github, octokit } = failingGitHub();
    const { summary, finished } = work(2, octokit);
    expect(await summary).toMatchObject({ retry: 1, failed: 0 });
    expect(finished[0]).toMatchObject({ outcome: 'retry', reason: 'GitHub is down' });
    expect(github.state.checkRuns).toEqual([expect.objectContaining({ status: 'in_progress' })]);
  });

  it('the 5th that throws ends the job failed and completes the check run as failure', async () => {
    const { github, octokit } = failingGitHub();
    const { summary, finished } = work(5, octokit);
    expect(await summary).toMatchObject({ failed: 1 });
    expect(finished[0]).toMatchObject({ outcome: 'failed', reason: 'GitHub is down' });
    expect(github.state.checkRuns).toHaveLength(1);
    expect(github.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure', output: { title: 'omni-loop could not evaluate: GitHub is down' } });
  });

  it('the failure hook posts nothing on a repository without the loop\'s config', async () => {
    const github = featureGitHub({ commits: { base1: fixture('base-inactive'), head1: fixture('head-open') } });
    await outboxFailureHook({ octokitFor: () => github.octokit, log: quiet })(
      { id: 'job-1', kind: OUTBOX_KIND, key: 'acme/widgets#12', subject: 'acme/widgets', payload, tries: 5, claim: 'c', claimedUntil: '2027-01-14T09:05:00.000Z' },
      'boom',
    );
    expect(github.state.checkRuns).toEqual([]);
  });

  it('a malformed payload fails by the name of its field', async () => {
    const handler = outboxHandler({ octokitFor: () => featureGitHub().octokit, log: quiet });
    await expect(handler({ id: 'j', kind: OUTBOX_KIND, key: 'k', subject: 's', payload: { ...payload, prNumber: 'x' }, tries: 1, claim: 'c', claimedUntil: '' })).rejects.toThrow(/pr-outbox job is malformed: prNumber/);
  });
});
