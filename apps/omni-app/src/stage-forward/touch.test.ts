import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { parseIssue } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { STAGE_SIGNATURE_HEADER } from './stage-forward.ts';
import { forwardTouch, touchedUrl, toTouches, type Touch } from './touch.ts';

// Webhooks say what changed (PRD 902, s3): each event becomes touches from its payload alone, and each
// touch is POSTed to galaxy, signed as the stage event is.

const REPOSITORY = { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } };
const base = { installation: { id: 7 }, repository: REPOSITORY };

const push = (ref: string, files: { added?: string[]; modified?: string[]; removed?: string[] }[] = []) => ({
  ...base, ref, commits: files.map((f) => ({ added: [], modified: [], removed: [], ...f })),
});

describe('toTouches — one touch per event, from the payload alone', () => {
  it('issues: the issue', () => {
    expect(toTouches('issues', { ...base, action: 'edited', issue: { number: 902 } })).toEqual([{ repository: 'acme/widgets', issue: 902 }]);
  });

  it('issue_comment: the issue, or the pull request when the issue is one', () => {
    expect(toTouches('issue_comment', { ...base, action: 'created', issue: { number: 902 } })).toEqual([{ repository: 'acme/widgets', issue: 902 }]);
    expect(toTouches('issue_comment', { ...base, action: 'created', issue: { number: 903, pull_request: { url: 'x' } } }))
      .toEqual([{ repository: 'acme/widgets', pr: 903 }]);
  });

  it('pull_request, any action: the pull request and its head branch', () => {
    for (const action of ['opened', 'closed', 'synchronize', 'converted_to_draft', 'review_requested']) {
      expect(toTouches('pull_request', { ...base, action, pull_request: { number: 1081, head: { ref: 'feat/github-budget--s3' } } }))
        .toEqual([{ repository: 'acme/widgets', pr: 1081, branch: 'feat/github-budget--s3' }]);
    }
  });

  it('pull_request_review: the pull request and its head branch', () => {
    expect(toTouches('pull_request_review', { ...base, action: 'submitted', pull_request: { number: 903, head: { ref: 'feat/github-budget' } } }))
      .toEqual([{ repository: 'acme/widgets', pr: 903, branch: 'feat/github-budget' }]);
  });

  it('check_suite: each pull request it names, with its branch; the branch alone when it names none', () => {
    expect(toTouches('check_suite', { ...base, action: 'completed', check_suite: { head_branch: 'feat/x', pull_requests: [{ number: 4 }, { number: 5 }] } }))
      .toEqual([{ repository: 'acme/widgets', pr: 4, branch: 'feat/x' }, { repository: 'acme/widgets', pr: 5, branch: 'feat/x' }]);
    expect(toTouches('check_suite', { ...base, action: 'completed', check_suite: { head_branch: 'feat/x', pull_requests: [] } }))
      .toEqual([{ repository: 'acme/widgets', branch: 'feat/x' }]);
    expect(toTouches('check_suite', { ...base, action: 'completed', check_suite: { head_branch: null, pull_requests: [] } })).toEqual([]);
  });

  it('push into the delivery folder: one touch per PRD folder it changes, on any branch', () => {
    expect(toTouches('push', push('refs/heads/main', [
      { modified: ['.omni-loop/delivery/outbox/0902-github-budget/settled.md'] },
      { added: ['.omni-loop/delivery/inbox/0903-other/spec.md'], removed: ['.omni-loop/delivery/outbox/0902-github-budget/s1-01.md'] },
    ]))).toEqual([{ repository: 'acme/widgets', issue: 902, branch: 'main' }, { repository: 'acme/widgets', issue: 903, branch: 'main' }]);
  });

  it('push into the delivery folder outside any PRD folder: the branch alone', () => {
    expect(toTouches('push', push('refs/heads/main', [{ modified: ['.omni-loop/delivery/README.md'] }])))
      .toEqual([{ repository: 'acme/widgets', branch: 'main' }]);
  });

  it('push onto a feature or phase-0 branch: the branch', () => {
    expect(toTouches('push', push('refs/heads/feat/github-budget', [{ modified: ['apps/x.ts'] }]))).toEqual([{ repository: 'acme/widgets', branch: 'feat/github-budget' }]);
    expect(toTouches('push', push('refs/heads/docs/phase-0-github-budget', [{ modified: ['README.md'] }])))
      .toEqual([{ repository: 'acme/widgets', branch: 'docs/phase-0-github-budget' }]);
  });

  it('push anywhere else, outside the delivery folder: no touch', () => {
    expect(toTouches('push', push('refs/heads/main', [{ modified: ['apps/x.ts', '.omni-loop/config.yml'] }]))).toEqual([]);
    expect(toTouches('push', push('refs/heads/feat/github-budget--s3', [{ modified: ['apps/x.ts'] }]))).toEqual([]);
    expect(toTouches('push', push('refs/heads/fix/typo', [{ modified: ['apps/x.ts'] }]))).toEqual([]);
    expect(toTouches('push', push('refs/tags/v1', [{ modified: ['.omni-loop/delivery/outbox/0902-x/a.md'] }]))).toEqual([]);
  });

  it('no touch from any other event, nor from a payload with no repository or of another shape', () => {
    expect(toTouches('check_run', { ...base, action: 'completed', check_run: { id: 1 } })).toEqual([]);
    expect(toTouches('ping', base)).toEqual([]);
    expect(toTouches('issues', { action: 'edited', issue: { number: 902 } })).toEqual([]);
    expect(toTouches('issues', { ...base, action: 'edited', issue: { number: 'x' } })).toEqual([]);
    expect(toTouches('pull_request', { ...base, action: 'opened' })).toEqual([]);
    expect(toTouches('push', null)).toEqual([]);
  });
});

const PostSchema = z.looseObject({ method: z.string(), body: z.string(), headers: z.record(z.string(), z.string()) });

describe('forwardTouch', () => {
  const touch: Touch = { repository: 'acme/widgets', issue: parseIssue(902) };

  it('POSTs the touch to galaxy\'s /api/github/touched, signed with the stage event\'s HMAC', async () => {
    const post = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() => Promise.resolve(new Response('ok', { status: 200 })));
    await forwardTouch(touch, { url: touchedUrl('https://galaxy.example/'), secret: 'stage-secret', fetch: post });
    const call = post.mock.calls[0];
    assertDefined(call, 'the touch POST');
    expect(call[0]).toBe('https://galaxy.example/api/github/touched');
    const init = PostSchema.parse(call[1]);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ repository: 'acme/widgets', issue: 902 });
    expect(init.headers[STAGE_SIGNATURE_HEADER]).toBe(`sha256=${createHmac('sha256', 'stage-secret').update(init.body).digest('hex')}`);
  });

  it('never throws: a missing secret, a refusal or a network failure is one line in the log', async () => {
    const log = vi.fn();
    const post = vi.fn(() => Promise.resolve(new Response('no', { status: 500 })));
    await forwardTouch(touch, { url: 'u', secret: undefined, fetch: post, log });
    expect(post).not.toHaveBeenCalled();
    await forwardTouch(touch, { url: 'u', secret: 's', fetch: post, log });
    await forwardTouch(touch, { url: 'u', secret: 's', fetch: () => Promise.reject(new Error('down')), log });
    expect(log).toHaveBeenCalledTimes(3);
    expect(log.mock.calls.map(([line]) => String(line))).toEqual([
      expect.stringContaining('STAGE_EVENT_SECRET'), expect.stringContaining('500'), expect.stringContaining('down'),
    ]);
  });
});
