// Bug #2766: the four pull-request checks gate a merge, yet they spent the installation's GitHub budget at
// `background` priority, the sync's and the sweeps', so while the budget sat below its background floor every check
// was refused unsent and its job parked `waiting` for up to an hour. A check is foreground work: it spends the
// budget above the floor, as a page a person waits on does, and only a pause (GitHub's own refusal) holds it.
// Everything else the App runs stays behind the floor.
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { GithubDeferred, githubClient, memoryGithubStore, type GithubStore } from '@omni/github';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { installationOctokitFor } from '../octokit-for.ts';
import { claimedJob, fakeGitHub, overHttp } from '../outbox-check/fake-github.ts';
import { PR_CHECK_KINDS, prCheckJob, prCheckWorkers } from './pr-checks.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const INSTALLATION = 7;
const HOUR = 3_600_000;
const GITHUB_APP = {
  id: '1',
  privateKey: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
};
/** What every answer of the stub reports: the budget back above its floor once a call went out. */
const RATE = Object.freeze({
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4900',
  'x-ratelimit-reset': String(Math.floor((Date.now() + HOUR) / 1000)),
  'x-ratelimit-resource': 'core',
});

const pull = { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' }, labels: [] };
const request = { installationId: INSTALLATION, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: pull.number, headSha: 'head1' };

/** The installation's budget, stored as an earlier answer left it: 10% of the limit left, the window not reset. */
async function belowFloor(): Promise<GithubStore> {
  const store = memoryGithubStore();
  await store.saveBudget(INSTALLATION, 'core', { limit: 5000, remaining: 500, resetAt: Date.now() + HOUR, at: Date.now() });
  return store;
}

/** The App's installation Octokit on a stubbed GitHub, every call through the shared client onto `store`. */
function liveOctokitFor(store: GithubStore) {
  const github = fakeGitHub({ commits: { base1: join(FIXTURES, 'base-active'), head1: join(FIXTURES, 'head-open') }, pull });
  vi.stubGlobal('fetch', () => {
    const token = { token: 'ghs_budget', expires_at: new Date(Date.now() + HOUR).toISOString(), permissions: {}, repository_selection: 'all' };
    return Promise.resolve(new Response(JSON.stringify(token), { status: 201, headers: { 'content-type': 'application/json' } }));
  });
  return { github, octokitFor: installationOctokitFor(GITHUB_APP, githubClient({ store, fetch: overHttp(github, RATE), log: () => undefined })) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the pull-request checks spend the GitHub budget above its background floor (bug #2766)', () => {
  it.each(PR_CHECK_KINDS)('a %s job runs while the budget is below its background floor, never parked behind it', async (kind) => {
    const { github, octokitFor } = liveOctokitFor(await belowFloor());
    const { handlers } = prCheckWorkers({ octokitFor });
    const job = prCheckJob(kind, request);
    const handler = handlers[kind];
    if (!handler) throw new Error(`no handler for ${kind}`);
    const settled = await handler(claimedJob(kind, job.payload)).then(
      (result) => result.outcome,
      (error: unknown) => (error instanceof Error && (error instanceof GithubDeferred || error.cause instanceof GithubDeferred) ? 'deferred' : 'threw'),
    );
    expect(settled).not.toBe('deferred');
    expect(github.state.requests.length).toBeGreaterThan(0);
  });

  it('the outbox check posts its verdict below the floor, as it does above it', async () => {
    const { github, octokitFor } = liveOctokitFor(await belowFloor());
    const handler = prCheckWorkers({ octokitFor }).handlers['pr-outbox'];
    if (!handler) throw new Error('no outbox handler');
    await handler(claimedJob('pr-outbox', prCheckJob('pr-outbox', request).payload));
    expect(github.state.checkRuns.at(-1)).toMatchObject({ name: 'outbox', head_sha: 'head1', status: 'completed', conclusion: 'failure' });
  });

  it('a check still holds while GitHub paused the installation: the pause binds every priority', async () => {
    const store = await belowFloor();
    await store.pause(INSTALLATION, 'core', Date.now() + HOUR, Date.now());
    const { github, octokitFor } = liveOctokitFor(store);
    const handler = prCheckWorkers({ octokitFor }).handlers['pr-outbox'];
    if (!handler) throw new Error('no outbox handler');
    await expect(handler(claimedJob('pr-outbox', prCheckJob('pr-outbox', request).payload))).rejects.toThrow(/GitHub paused until/);
    expect(github.state.requests).toEqual([]);
  });

  it('the App’s other work stays behind the floor: an installation Octokit asked for no priority is background', async () => {
    const { github, octokitFor } = liveOctokitFor(await belowFloor());
    const octokit = await octokitFor(INSTALLATION);
    await expect(octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner: 'acme', repo: 'widgets', pull_number: 12 })).rejects.toThrow(
      /below its background floor/,
    );
    expect(github.state.requests).toEqual([]);
  });
});
