import { describe, expect, it } from 'vitest';
import { ConfigSchema } from 'vertuo-omni-plan/kit/lib/config.ts';
import { DEFAULT_CHECK_NAME, MAX_SUMMARY, publish, startCheck } from './publish.ts';

const REPO = { owner: 'vertuoza', repo: 'widget' };
const HEAD = 'abc123';

// A stubbed Octokit: records every request and answers the four routes publish uses.
function stubGitHub({ prHeadSha = HEAD, checkRunId = 77 } = {}) {
  const requests: any[] = [];
  const octokit = {
    async request(route: any, params: any) {
      requests.push({ route, ...params });
      switch (route) {
        case 'POST /repos/{owner}/{repo}/check-runs':
          return { data: { id: checkRunId, head_sha: params.head_sha } };
        case 'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}':
          return { data: { id: params.check_run_id } };
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}':
          return { data: { number: params.pull_number, head: { sha: prHeadSha } } };
        case 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments':
          return { data: { id: 501 } };
        case 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}':
          return { data: { id: params.comment_id } };
        default:
          throw new Error(`unexpected route ${route}`);
      }
    },
  };
  return { octokit, requests };
}

const routes = (requests: any) => requests.map((r: any) => r.route);

const verdict = (over = {}) => ({
  conclusion: 'failure',
  title: '1 open outbox item',
  summary: '## report',
  comment: { id: 900, body: '<!-- omni-outbox-pr -->\nbody' },
  ...over,
});

describe('startCheck — in_progress on the head SHA', () => {
  it('creates the check run under the given name, in progress, on the head SHA', async () => {
    const { octokit, requests } = stubGitHub();
    const id = await startCheck(octokit, { ...REPO, headSha: HEAD, name: 'outbox' });
    expect(id).toBe(77);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      route: 'POST /repos/{owner}/{repo}/check-runs',
      ...REPO,
      name: 'outbox',
      head_sha: HEAD,
      status: 'in_progress',
    });
  });

  it('names the check by ci.outboxContext\'s default when no name is given', async () => {
    const { octokit, requests } = stubGitHub();
    await startCheck(octokit, { ...REPO, headSha: HEAD });
    expect(DEFAULT_CHECK_NAME).toBe(ConfigSchema.parse({ kit: 1 }).ci.outboxContext);
    expect(requests[0].name).toBe(DEFAULT_CHECK_NAME);
  });
});

describe('publish — completed, and the comment rewritten in place', () => {
  it('completes the check run with the verdict', async () => {
    const { octokit, requests } = stubGitHub();
    await publish(octokit, { ...REPO, checkRunId: 77, pullNumber: 12, headSha: HEAD, verdict: verdict() });
    expect(requests[0]).toMatchObject({
      route: 'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}',
      ...REPO,
      check_run_id: 77,
      status: 'completed',
      conclusion: 'failure',
      output: { title: '1 open outbox item', summary: '## report' },
    });
    expect(requests[0].completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rewrites the marker comment in place by its id', async () => {
    const { octokit, requests } = stubGitHub();
    const result = await publish(octokit, { ...REPO, checkRunId: 77, pullNumber: 12, headSha: HEAD, verdict: verdict() });
    expect(result).toEqual({ checkRunId: 77, comment: 'updated' });
    const patch = requests.find((r) => r.route === 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}');
    expect(patch).toMatchObject({ ...REPO, comment_id: 900, body: '<!-- omni-outbox-pr -->\nbody' });
    expect(routes(requests)).not.toContain('POST /repos/{owner}/{repo}/issues/{issue_number}/comments');
  });

  it('creates the comment when there is none yet', async () => {
    const { octokit, requests } = stubGitHub();
    const result = await publish(octokit, {
      ...REPO,
      checkRunId: 77,
      pullNumber: 12,
      headSha: HEAD,
      verdict: verdict({ comment: { id: null, body: 'fresh' } }),
    });
    expect(result.comment).toBe('created');
    const post = requests.find((r) => r.route === 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments');
    expect(post).toMatchObject({ ...REPO, issue_number: 12, body: 'fresh' });
  });

  it('completes the check but leaves the comment alone when the head SHA moved on', async () => {
    const { octokit, requests } = stubGitHub({ prHeadSha: 'def456' });
    const result = await publish(octokit, { ...REPO, checkRunId: 77, pullNumber: 12, headSha: HEAD, verdict: verdict() });
    expect(result).toEqual({ checkRunId: 77, comment: 'head-moved' });
    expect(routes(requests)).toEqual([
      'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}',
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
    ]);
  });

  it('posts no comment and reads no pull request when the verdict carries none', async () => {
    const { octokit, requests } = stubGitHub();
    const result = await publish(octokit, {
      ...REPO,
      checkRunId: 77,
      pullNumber: 12,
      headSha: HEAD,
      verdict: verdict({ conclusion: 'skipped', title: 'omni-loop is not active on this PR', comment: null }),
    });
    expect(result).toEqual({ checkRunId: 77, comment: 'none' });
    expect(routes(requests)).toEqual(['PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}']);
    expect(requests[0].conclusion).toBe('skipped');
  });

  it('keeps the title to one line and the summary within GitHub\'s limit', async () => {
    const { octokit, requests } = stubGitHub();
    await publish(octokit, {
      ...REPO,
      checkRunId: 77,
      pullNumber: 12,
      headSha: HEAD,
      verdict: verdict({ title: 'first line\nsecond line', summary: 'x'.repeat(MAX_SUMMARY + 10), comment: null }),
    });
    expect(requests[0].output.title).toBe('first line');
    expect(requests[0].output.summary.length).toBeLessThanOrEqual(MAX_SUMMARY);
  });
});
