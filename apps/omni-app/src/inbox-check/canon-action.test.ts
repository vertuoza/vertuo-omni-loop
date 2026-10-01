// `canon-action` against the stubbed GitHub (PRD 839): a click of a canon button posts one comment on
// the phase-0 PR, a second click of the same button edits it, and a click on any other PR posts
// nothing. No test calls GitHub.
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, INBOX_EXTERNAL_ID } from '../inngest-client.ts';
import { fakeGitHub } from '../outbox-check/fake-github.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { CANON_ACTION, CANON_ACTION_EVENT, canonMarker, commentMarker } from './canon-actions.ts';
import { CANON_ACTION_FUNCTION_ID, canonAction, createCanonAction } from './canon-action.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const GALAXY = 'https://galaxy.example';
const FACTS = { prd: 42, persona: 'Marc', claims: ['never#4'] };
const OTHERS = [{ id: 1, body: 'LGTM' }];

function github({ base = 'inbox-base', headRef = 'docs/phase-0-widget', comments = OTHERS } = {}) {
  const pull = { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: headRef, sha: 'head1' }, labels: [] };
  return fakeGitHub({ commits: { base1: join(FIXTURES, base) }, pull, comments });
}

const event = (action: any, facts = FACTS) => ({
  name: CANON_ACTION_EVENT,
  data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1', checkRunId: 5, action, facts },
});

function click(gh: any, action: any) {
  const fn = createCanonAction({ client: inngest, octokitFor: () => gh.octokit, galaxyUrl: GALAXY });
  return new InngestTestEngine({ function: fn, events: [event(action)] }).execute();
}

const writes = (gh: any) => gh.state.requests.filter((r: any) => r.route.startsWith('POST ') || r.route.startsWith('PATCH '));

describe('canon-action — Rewrite for <persona>', () => {
  it('posts one comment with the rework command', async () => {
    const gh = github();
    const { result }: any = await click(gh, CANON_ACTION.rewrite);
    expect(result).toMatchObject({ comment: 'created' });
    expect(gh.state.comments).toHaveLength(2);
    expect(gh.state.comments[1]!.body).toContain(commentMarker(CANON_ACTION.rewrite));
    expect(gh.state.comments[1]!.body).toContain('To rewrite the spec for Marc, run `/omni:brainstorm --rework 42`.');
  });

  it('a second click edits that comment, never a new one', async () => {
    const gh = github();
    await click(gh, CANON_ACTION.rewrite);
    const { result }: any = await click(gh, CANON_ACTION.rewrite);
    expect(result).toMatchObject({ comment: 'updated' });
    expect(gh.state.comments).toHaveLength(2);
    expect(writes(gh).map((w: any) => w.route)).toEqual([
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
    ]);
  });
});

describe('canon-action — Change the claim', () => {
  it('posts one comment linking to the claim on Settings › Business, apart from the rewrite comment', async () => {
    const gh = github();
    await click(gh, CANON_ACTION.rewrite);
    await click(gh, CANON_ACTION.claim);
    await click(gh, CANON_ACTION.claim);
    expect(gh.state.comments).toHaveLength(3);
    expect(gh.state.comments[2]!.body).toContain(commentMarker(CANON_ACTION.claim));
    expect(gh.state.comments[2]!.body).toContain('[never#4](https://galaxy.example/app/settings/business#never-4)');
  });
});

describe('canon-action — ignored elsewhere', () => {
  it.each([['a feature PR', 'feat/widget'], ['a sub-PR', 'feat/widget--s1']])('a click on %s posts nothing', async (_, headRef) => {
    const gh = github({ headRef });
    const { result }: any = await click(gh, CANON_ACTION.rewrite);
    expect(result.posted).toBe(false);
    expect(writes(gh)).toEqual([]);
  });

  it('a click on a repository without the loop posts nothing', async () => {
    const gh = github({ base: 'base-inactive' });
    await click(gh, CANON_ACTION.claim);
    expect(writes(gh)).toEqual([]);
  });
});

describe('canon-action — from a signed webhook', () => {
  it('a click on a red inbox check run posts its comment', async () => {
    const gh = github();
    const summary = `PRD 42\n\n${canonMarker({ prd: 42, canon: { state: 'red', findings: [{ claims: ['never#4'] }], persona: { name: 'Marc' } } })}`;
    const body = JSON.stringify({
      action: 'requested_action',
      installation: { id: 7 },
      repository: { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } },
      requested_action: { identifier: CANON_ACTION.claim },
      check_run: { id: 5, external_id: INBOX_EXTERNAL_ID, head_sha: 'head1', output: { summary }, pull_requests: [{ number: 12, head: { sha: 'head1' } }] },
    });
    const sent: any[] = [];
    await receiveWebhook({
      body,
      headers: { 'x-github-event': 'check_run', 'x-hub-signature-256': `sha256=${createHmac('sha256', 's').update(body).digest('hex')}` },
      secret: 's',
      send: async (events) => sent.push(...events),
      forward: async () => {},
    });
    expect(sent).toEqual([event(CANON_ACTION.claim)]);
    await click(gh, sent[0].data.action);
    expect(gh.state.comments.at(-1)!.body).toContain('#never-4');
  });
});

describe('canon-action — the function’s configuration', () => {
  it('runs on the canon action event, one click at a time per pull request, 3 retries', () => {
    expect(canonAction.id()).toBe(CANON_ACTION_FUNCTION_ID);
    expect(canonAction.opts.triggers).toEqual([{ event: CANON_ACTION_EVENT }]);
    expect(canonAction.opts.concurrency).toMatchObject({ limit: 1 });
    expect((canonAction.opts.concurrency as { key: string }).key).toContain('event.data.prNumber');
    expect(canonAction.opts.retries).toBe(3);
  });
});
