// `canon-action` against the stubbed GitHub (PRD 839), as a job of the ledger (PRD omni-loop-3 s4): a click of a
// canon button posts one comment on the phase-0 PR, a second click of the same button edits it, and a click on any
// other PR posts nothing. Each run is a claimed job, as the worker hands it over. No test calls GitHub.
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { INBOX_EXTERNAL_ID, type CanonActionRequestData } from '../inngest-client.ts';
import type { ClaimedJob, NewJob } from '../jobs/ledger.ts';
import { liveWorkers } from '../jobs/pr-checks.ts';
import { fakeGitHub } from '../outbox-check/fake-github.ts';
import { receiveWebhook } from '../webhook/webhook.ts';
import { CANON_ACTION, canonMarker, commentMarker } from './canon-actions.ts';
import { CANON_ACTION_KIND, canonActionHandler, canonActionJob } from './canon-action.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const GALAXY = 'https://galaxy.example';
const FACTS = { prd: 42, persona: 'Marc', claims: ['never#4'] };
const OTHERS = [{ id: 1, body: 'LGTM' }];

function github({ base = 'inbox-base', headRef = 'docs/phase-0-widget', comments = OTHERS } = {}) {
  const pull = { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: headRef, sha: 'head1' }, labels: [] };
  return fakeGitHub({ commits: { base1: join(FIXTURES, base) }, pull, comments });
}

type GitHub = ReturnType<typeof github>;

const clickOf = (action: string, facts = FACTS): CanonActionRequestData => ({
  installationId: 7,
  owner: 'acme',
  repo: 'widgets',
  repository: 'acme/widgets',
  prNumber: parsePr(12),
  headSha: 'head1',
  checkRunId: 5,
  action,
  facts: { ...facts, prd: parsePrd(facts.prd) },
});

/** `job` as the ledger hands it to the worker: claimed, on its first try. */
const claimed = (job: NewJob): ClaimedJob => ({
  id: 'job-1',
  claim: 'claim-1',
  claimedUntil: '2026-10-11T09:05:00.000Z',
  tries: 1,
  progress: {},
  lane: job.lane ?? null,
  maxTries: job.maxTries ?? 5,
  kind: job.kind,
  key: job.key,
  subject: job.subject,
  payload: job.payload,
});

/** Runs `job` through the kind's handler, against `gh`: how it ended. */
const runJob = (gh: GitHub, job: NewJob) => canonActionHandler({ octokitFor: () => Promise.resolve(gh.octokit), galaxyUrl: GALAXY })(claimed(job));

/** One click of `action`, carried by delivery `delivery`, run as its job. */
const click = (gh: GitHub, action: string, delivery = 'd-1') => runJob(gh, canonActionJob(delivery, clickOf(action)));

const writes = (gh: GitHub) => gh.state.requests.filter((r) => r.route.startsWith('POST ') || r.route.startsWith('PATCH '));

/** The comment at `index` (from the end when negative): the test fails when there is none. */
function commentAt(gh: GitHub, index: number) {
  const comment = gh.state.comments.at(index);
  assertDefined(comment, `the comment at ${index}`);
  return comment;
}

describe('canon-action — Rewrite for <persona>', () => {
  it('posts one comment with the rework command', async () => {
    const gh = github();
    expect(await click(gh, CANON_ACTION.rewrite)).toEqual({ outcome: 'done' });
    expect(gh.state.comments).toHaveLength(2);
    expect(commentAt(gh, 1).body).toContain(commentMarker(CANON_ACTION.rewrite));
    expect(commentAt(gh, 1).body).toContain('To rewrite the spec for Marc, run `/omni:brainstorm --rework 42`.');
  });

  it('a second click edits that comment, never a new one', async () => {
    const gh = github();
    await click(gh, CANON_ACTION.rewrite);
    expect(await click(gh, CANON_ACTION.rewrite, 'd-2')).toEqual({ outcome: 'done' });
    expect(gh.state.comments).toHaveLength(2);
    expect(writes(gh).map((w) => w.route)).toEqual([
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
    ]);
  });
});

describe('canon-action — Change the line', () => {
  it('posts one comment linking to the claim on Settings › Business, apart from the rewrite comment', async () => {
    const gh = github();
    await click(gh, CANON_ACTION.rewrite);
    await click(gh, CANON_ACTION.claim);
    await click(gh, CANON_ACTION.claim);
    expect(gh.state.comments).toHaveLength(3);
    expect(commentAt(gh, 2).body).toContain(commentMarker(CANON_ACTION.claim));
    expect(commentAt(gh, 2).body).toContain('[never#4](https://galaxy.example/app/settings/business#never-4)');
  });
});

describe('canon-action — ignored elsewhere', () => {
  it.each([['a feature PR', 'feat/widget'], ['a sub-PR', 'feat/widget--s1']])('a click on %s posts nothing', async (_, headRef) => {
    const gh = github({ headRef });
    expect(await click(gh, CANON_ACTION.rewrite)).toEqual({ outcome: 'skipped', reason: 'not a phase-0 PR of a repository with omni-loop' });
    expect(writes(gh)).toEqual([]);
  });

  it('a click on a repository without the loop posts nothing', async () => {
    const gh = github({ base: 'base-inactive' });
    expect(await click(gh, CANON_ACTION.claim)).toMatchObject({ outcome: 'skipped' });
    expect(writes(gh)).toEqual([]);
  });

  it('a button that is no canon button posts nothing, saying why', async () => {
    const gh = github();
    expect(await click(gh, 'ship-anyway')).toEqual({ outcome: 'skipped', reason: 'not a canon button: ship-anyway' });
    expect(gh.state.requests).toEqual([]);
  });
});

describe('canon-action — from a signed webhook', () => {
  it('a click on a red inbox check run adds its canon-action job, keyed by the delivery, which posts its comment; nothing goes to Inngest', async () => {
    const gh = github();
    const summary = `PRD 42\n\n${canonMarker({ prd: parsePrd(42), canon: { state: 'red', findings: [{ claims: ['never#4'] }], persona: { name: 'Marc' } } })}`;
    const body = JSON.stringify({
      action: 'requested_action',
      installation: { id: 7 },
      repository: { name: 'widgets', full_name: 'acme/widgets', owner: { login: 'acme' } },
      requested_action: { identifier: CANON_ACTION.claim },
      check_run: { id: 5, external_id: INBOX_EXTERNAL_ID, head_sha: 'head1', output: { summary }, pull_requests: [{ number: 12, head: { sha: 'head1' } }] },
    });
    const queued: NewJob[] = [];
    const sent: unknown[] = [];
    const response = await receiveWebhook({
      body,
      headers: { 'x-github-event': 'check_run', 'x-github-delivery': 'delivery-1', 'x-hub-signature-256': `sha256=${createHmac('sha256', 's').update(body).digest('hex')}` },
      secret: 's',
      send: (events) => Promise.resolve(sent.push(...events)),
      queueJobs: (jobs) => Promise.resolve(queued.push(...jobs)),
      forward: () => Promise.resolve(),
    });
    expect(response).toEqual({ status: 200, body: 'sent 0 · 1 jobs' });
    expect(sent).toEqual([]);
    expect(queued).toEqual([canonActionJob('delivery-1', clickOf(CANON_ACTION.claim))]);
    const [first] = queued;
    assertDefined(first, 'the job the click added');
    expect(await runJob(gh, first)).toEqual({ outcome: 'done' });
    expect(commentAt(gh, -1).body).toContain('#never-4');
  });
});

describe('canon-action — the job (PRD omni-loop-3 s4)', () => {
  it('is keyed by the delivery, in the lane of its pull request, with 4 tries, and carries no token', () => {
    expect(canonActionJob('delivery-1', { ...clickOf(CANON_ACTION.rewrite), repository: 'Acme/Widgets' })).toEqual({
      kind: 'canon-action',
      key: 'delivery-1',
      subject: 'acme/widgets',
      payload: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'Acme/Widgets', prNumber: 12, headSha: 'head1', checkRunId: 5, action: CANON_ACTION.rewrite, facts: FACTS },
      lane: 'acme/widgets#12',
      maxTries: 4,
    });
  });

  it('two clicks on one pull request are two jobs in one lane, so they never run together; a click on another pull request runs beside them', () => {
    const first = canonActionJob('d-1', clickOf(CANON_ACTION.rewrite));
    const second = canonActionJob('d-2', clickOf(CANON_ACTION.claim));
    const elsewhere = canonActionJob('d-3', { ...clickOf(CANON_ACTION.claim), prNumber: parsePr(13) });
    expect(first.key).not.toBe(second.key);
    expect(second.lane).toBe(first.lane);
    expect(elsewhere.lane).not.toBe(first.lane);
  });

  it('has a handler in the worker every runner of the ledger runs', () => {
    const { handlers } = liveWorkers({ supabase: { url: 'https://db.example', key: 'service-key' } }, () => Promise.reject(new Error('unused')));
    expect(typeof handlers[CANON_ACTION_KIND]).toBe('function');
  });

  it('throws, for the worker to retry, when GitHub refuses', async () => {
    const handler = canonActionHandler({ octokitFor: () => Promise.reject(new Error('GitHub is down')), galaxyUrl: GALAXY });
    await expect(handler(claimed(canonActionJob('d-1', clickOf(CANON_ACTION.rewrite))))).rejects.toThrow('GitHub is down');
  });
});
