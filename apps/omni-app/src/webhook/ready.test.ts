// What refreshes the ready check's job (PRD 2898 s7): every handled pull request action, as the other checks,
// a re-run of its own check run, and a check suite completed on the head of a pull request into the default
// branch, since the evidence it reads is that head's CI.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { RefreshJob } from '../jobs/ledger.ts';
import { prCheckJob } from '../jobs/pr-checks.ts';
import { READY_KIND } from '../ready-check/job.ts';
import { READY_EXTERNAL_ID } from '../ready-check/output.ts';
import { receiveWebhook, toCheckJobs, toReadyRefreshes } from './webhook.ts';

const SECRET = 'ready-secret';
const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' }, default_branch: 'main' };
const HEAD = 'a1'.repeat(20);

const pull = (number: number, base = 'main', sha: string | null = HEAD) => ({ number, head: { sha }, base: { ref: base } });
const suitePayload = (pulls = [pull(31)], over: Record<string, unknown> = {}) => ({
  action: 'completed',
  installation: { id: 7 },
  repository: REPOSITORY,
  check_suite: { id: 5, head_branch: 'feat/ready', head_sha: HEAD, status: 'completed', conclusion: 'success', pull_requests: pulls },
  ...over,
});

const readyJob = (prNumber: number, trigger: string, headSha = HEAD) =>
  prCheckJob(READY_KIND, { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: prNumber as never, headSha, trigger });

describe('the ready check\'s refreshes (PRD 2898 s7)', () => {
  it('turns a check suite completed on a pull request\'s head into that pull request\'s ready job, red or green', () => {
    expect(toReadyRefreshes('check_suite', suitePayload())).toEqual([readyJob(31, 'check_suite.completed')]);
    expect(toReadyRefreshes('check_suite', suitePayload([pull(31), pull(32, 'main', null)], {}))).toEqual([readyJob(31, 'check_suite.completed'), readyJob(32, 'check_suite.completed')]);
    const red = suitePayload();
    red.check_suite.conclusion = 'failure';
    expect(toReadyRefreshes('check_suite', red)).toEqual([readyJob(31, 'check_suite.completed')]);
  });

  it('turns a suite of a sub-PR into its feature branch, another action, another event or a delivery missing its installation into none', () => {
    expect(toReadyRefreshes('check_suite', suitePayload([pull(40, 'feat/ready')]))).toEqual([]);
    expect(toReadyRefreshes('check_suite', suitePayload([]))).toEqual([]);
    expect(toReadyRefreshes('check_suite', { ...suitePayload(), action: 'requested' })).toEqual([]);
    expect(toReadyRefreshes('check_run', suitePayload())).toEqual([]);
    expect(toReadyRefreshes('check_suite', { ...suitePayload(), installation: null })).toEqual([]);
  });

  it('refreshes only the ready job on a re-run of its own check run, told by its external id', () => {
    const payload = { action: 'rerequested', installation: { id: 7 }, repository: REPOSITORY, check_run: { id: 9, head_sha: HEAD, external_id: READY_EXTERNAL_ID, pull_requests: [pull(31)] } };
    expect(toCheckJobs('check_run', payload)).toEqual([readyJob(31, 'check_run.rerequested')]);
  });

  it('hands a signed delivery of a completed suite to refreshJobs', async () => {
    const body = JSON.stringify(suitePayload());
    const refreshed: RefreshJob[] = [];
    const response = await receiveWebhook({
      body,
      headers: { 'x-github-event': 'check_suite', 'x-hub-signature-256': `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}` },
      secret: SECRET,
      forward: () => Promise.resolve(),
      refreshJobs: (jobs) => Promise.resolve(refreshed.push(...jobs)),
    });
    expect(response).toEqual({ status: 200, body: 'sent 0 · 1 jobs' });
    expect(refreshed).toEqual([readyJob(31, 'check_suite.completed')]);
  });
});
