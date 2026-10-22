// The escalation record (PRD 1794, s3) and the hourly sweep (s4), against the stubbed GitHub: the real
// outbox check runs, and after its verdict is published it keeps one `<!-- omni:escalation -->` comment
// of what still waits on a person; the sweep reads it and asks more people. Each repository's commits
// are fixture folders copied at runtime, its config rewritten to name a delegate and leadership, or not.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { internalEvents } from 'inngest';
import { afterEach, describe, expect, it } from 'vitest';
import { readAsk, readRecord, RECORD_MARKER, type RecordLine } from 'omni-loop/kit/lib/escalation/comments.ts';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import { checkRunAt, commitOf, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { createOutboxCheck } from '../outbox-check/outbox-check.ts';
import { recordLines } from './record.ts';
import { createEscalation, ESCALATION_FUNCTION_ID, EVERY_HOUR } from './sweep.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);
const INVARIANTS = '.omni-loop/knowledge/product/invariants.md';

/** `laws.owners` with a delegate beside @ann, and leadership. */
const ESCALATING = (yaml: string) =>
  yaml.replace('  owners: [ann]', '  owners:\n    - login: ann\n      delegate: jdoe\n  leadership: [cto]');
/** The same base with neither a delegate nor leadership: it escalates nothing. */
const PLAIN = (yaml: string) => yaml;

const made: string[] = [];
const commit = (dirs: string[], config?: (yaml: string) => string) => {
  const root = commitOf(dirs.map(fixture), config);
  made.push(root);
  return root;
};
afterEach(() => {
  for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true });
});

const event = (headSha = 'head1') => ({
  name: OUTBOX_CHECK_EVENT,
  data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha, trigger: 'pull_request.synchronize' },
});

type GitHub = ReturnType<typeof fakeGitHub>;

/**
 * A feature PR on a base whose CODEOWNERS gives the knowledge folder to @ann: every head changes the
 * locked N-PRODUCT-1, held until @ann approves that head; head1 and head2 hold the high item
 * s1-01-widget-colour too.
 */
function featureGitHub(config: (yaml: string) => string = ESCALATING, heads: Record<string, string[]> = {}) {
  return fakeGitHub({
    commits: {
      base1: commit(['base-locked'], config),
      head1: commit(['head-locked-edited', 'head-open']),
      head2: commit(['head-locked-edited', 'head-open']),
      ...Object.fromEntries(Object.entries(heads).map(([sha, dirs]) => [sha, commit(dirs)])),
    },
    pull: { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' } },
    files: [{ filename: INVARIANTS, status: 'modified' }],
  });
}

/** @ann's approval of `headSha`, which clears the locked law there. */
const approve = (github: GitHub, headSha: string) => github.state.reviews.push({ user: { login: 'ann' }, state: 'APPROVED', commit_id: headSha });

async function run(github: GitHub, now: string, headSha = 'head1') {
  github.state.pull.head.sha = headSha;
  const fn = createOutboxCheck({ client: inngest, octokitFor: () => github.octokit, now: () => new Date(now), log: () => undefined });
  return new InngestTestEngine({ function: fn, events: [event(headSha)] }).execute();
}

const records = (github: GitHub) => github.state.comments.filter((comment) => comment.body.startsWith(RECORD_MARKER));

function recordOf(github: GitHub): RecordLine[] {
  const [only, ...more] = records(github);
  expect(more).toEqual([]);
  return readRecord(only?.body ?? '') ?? [];
}

// Monday 2026-10-12, 09:00 UTC; Wednesday 2026-10-14, 10:00 UTC.
const MONDAY = '2026-10-12T09:00:00Z';
const WEDNESDAY = '2026-10-14T10:00:00Z';

describe('the escalation record, after each outbox check run', () => {
  it('a first held run creates the record, one line per held thing at step 0, and mentions nobody', async () => {
    const github = featureGitHub();
    const { ctx, result } = await run(github, MONDAY);
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['in-progress', 'evaluate', 'publish', 'escalation']);
    expect(result).toMatchObject({ conclusion: 'failure', escalation: 'created' });
    expect(recordOf(github)).toEqual([
      { thing: 'N-PRODUCT-1', kind: 'law', firstHeld: MONDAY, step: 0, asked: [], nextDue: '2026-10-14T09:00:00Z' },
      { thing: 's1-01-widget-colour', kind: 'item', firstHeld: MONDAY, step: 0, asked: [], nextDue: '2026-10-14T09:00:00Z' },
    ]);
    expect(records(github)[0]?.body).not.toContain('@');
  });

  it('a later run keeps each thing’s first-held time, and drops a thing no longer held', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    approve(github, 'head2');
    expect((await run(github, WEDNESDAY, 'head2')).result).toMatchObject({ escalation: 'updated' });
    expect(recordOf(github)).toEqual([
      { thing: 's1-01-widget-colour', kind: 'item', firstHeld: MONDAY, step: 0, asked: [], nextDue: '2026-10-14T09:00:00Z' },
    ]);
  });

  it('a line the sweep moved keeps its step and who it asks: only the sweep moves a step', () => {
    const moved: RecordLine = { thing: 'N-PRODUCT-1', kind: 'law', firstHeld: MONDAY, step: 1, asked: ['jdoe'], nextDue: '2026-10-16T09:00:00Z' };
    const settings = { owners: [{ login: 'ann', delegate: 'jdoe' }], leadership: ['cto'], workingDays: 2 };
    const held = [{ thing: 'N-PRODUCT-1', kind: 'law' as const }, { thing: 'N-PRODUCT-1', kind: 'item' as const }];
    expect(recordLines([moved], { settings, held }, new Date(WEDNESDAY))).toEqual([
      moved,
      { thing: 'N-PRODUCT-1', kind: 'item', firstHeld: WEDNESDAY, step: 0, asked: [], nextDue: '2026-10-16T10:00:00Z' },
    ]);
  });

  it('a run that finds the record as it would write it leaves it alone', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    const writes = () => github.state.requests.filter((r) => r.route === 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}' && r.comment_id === records(github)[0]?.id);
    expect((await run(github, WEDNESDAY)).result).toMatchObject({ escalation: 'unchanged' });
    expect(writes()).toEqual([]);
  });

  it('a pull request with nothing held and no record gets no record', async () => {
    const github = featureGitHub(ESCALATING, { head3: ['head-locked-edited', 'head-clear'] });
    approve(github, 'head3');
    expect((await run(github, MONDAY, 'head3')).result).toMatchObject({ escalation: 'none' });
    expect(records(github)).toEqual([]);
  });

  it('once nothing holds, the record says so rather than vanishing', async () => {
    const github = featureGitHub(ESCALATING, { head3: ['head-locked-edited', 'head-clear'] });
    await run(github, MONDAY);
    approve(github, 'head3');
    await run(github, WEDNESDAY, 'head3');
    expect(recordOf(github)).toEqual([]);
    expect(records(github)[0]?.body).toContain('Nothing waits on a person.');
  });

  it('a repository with no delegate and no leadership gets no escalation comment and no extra step', async () => {
    const github = featureGitHub(PLAIN);
    const { ctx, result } = await run(github, MONDAY);
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['in-progress', 'evaluate', 'publish']);
    expect(result).toMatchObject({ conclusion: 'failure', escalation: 'none' });
    expect(records(github)).toEqual([]);
  });

  it('a record GitHub refuses to write is logged, and the check it follows stays as published', async () => {
    const github = featureGitHub();
    const logged: string[] = [];
    const refusing = {
      request: (route: string, params?: Record<string, unknown>) =>
        route === 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments' && String(params?.body).startsWith(RECORD_MARKER)
          ? Promise.reject(new Error('GitHub is down'))
          : github.octokit.request(route, params),
    };
    const fn = createOutboxCheck({ client: inngest, octokitFor: () => refusing, now: () => new Date(MONDAY), log: (line) => logged.push(line) });
    const { result, error } = await new InngestTestEngine({ function: fn, events: [event()] }).execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ conclusion: 'failure', escalation: 'failed' });
    expect(checkRunAt(github.state, -1)).toMatchObject({ status: 'completed', conclusion: 'failure' });
    expect(logged).toEqual([expect.stringContaining('escalation record of acme/widgets#12 waits for the next run: GitHub is down')]);
  });

  it('the record never changes the verdict: the check reads the same with and without it', async () => {
    const escalating = featureGitHub();
    const plain = featureGitHub(PLAIN);
    await run(escalating, MONDAY);
    await run(plain, MONDAY);
    const output = (github: GitHub) => ({ conclusion: checkRunAt(github.state, -1).conclusion, ...outputOf(checkRunAt(github.state, -1)) });
    expect(output(escalating)).toEqual(output(plain));
    expect(output(escalating).conclusion).toBe('failure');
  });
});

// The hourly sweep (PRD 1794, s4): it reads the record, moves each thing whose next step fell due,
// posts one ask comment mentioning the people newly asked, and rewrites the record. It never decides.
// Monday 09:00 first held: step 1 falls due Wednesday 09:00, step 2 Friday 09:00.
const WEDNESDAY_LATER = '2026-10-14T09:30:00Z';
const THURSDAY = '2026-10-15T09:30:00Z';
const FRIDAY = '2026-10-16T09:30:00Z';

/** The base's CODEOWNERS giving the knowledge folder to @ann and her delegate @jdoe, as `omni kb owners` writes it. */
const withDelegate = (root: string) => {
  writeFileSync(join(root, '.github', 'CODEOWNERS'), '# The locked laws’ owners.\nsrc/widget.test.ts @ann @jdoe\n.omni-loop/knowledge/product/ @ann @jdoe\n');
  return root;
};

type Params = Record<string, unknown>;

/**
 * The GitHub the sweep reads: the App lists installation 7, which holds acme/widgets, whose one pull
 * request is the feature PR the check grades, listed while `open` holds.
 */
function sweepGitHub(github: GitHub, open: { value: boolean } = { value: true }) {
  const app = {
    request: (route: string, params: Params = {}) => {
      if (route !== 'GET /app/installations') throw new Error(`fake App: unexpected route ${route}`);
      return Promise.resolve({ data: params.page === 1 ? [{ id: 7 }] : [] });
    },
  };
  const installation = {
    request: (route: string, params: Params = {}): Promise<{ data: unknown }> => {
      if (route === 'GET /installation/repositories') {
        github.state.requests.push({ route, ...params });
        return Promise.resolve({ data: { repositories: params.page === 1 ? [{ name: 'widgets', owner: { login: 'acme' } }] : [] } });
      }
      if (route === 'GET /repos/{owner}/{repo}/pulls') {
        github.state.requests.push({ route, ...params });
        const listed = open.value && params.state === 'open' && params.page === 1;
        return Promise.resolve({ data: listed ? [{ number: 12, state: 'open', base: github.state.pull.base }] : [] });
      }
      return github.octokit.request(route, params);
    },
  };
  return { app, installation };
}

const tick = () => [{ name: internalEvents.ScheduledTimer, data: { cron: EVERY_HOUR } }] as never;

async function sweep(github: GitHub, now: string, open?: { value: boolean }) {
  const { app, installation } = sweepGitHub(github, open);
  const fn = createEscalation({ client: inngest, octokitFor: () => installation, appOctokit: () => app, clock: () => new Date(now).getTime(), log: () => undefined });
  const from = github.state.requests.length;
  const outcome = await new InngestTestEngine({ function: fn, events: tick() }).execute();
  return { ...outcome, requests: github.state.requests.slice(from) };
}

const asks = (github: GitHub) => github.state.comments.filter((comment) => readAsk(comment.body).length > 0);

describe('the hourly sweep: asks more people, never decides', () => {
  it('2 working days after first held, one ask mentions the law’s delegate and the item’s owner and delegate; a second sweep posts nothing', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    expect((await sweep(github, MONDAY)).result).toMatchObject({ asked: 0 });
    expect(asks(github)).toEqual([]);

    expect((await sweep(github, WEDNESDAY_LATER)).result).toMatchObject({ asked: 1 });
    const [ask, ...more] = asks(github);
    expect(more).toEqual([]);
    expect(readAsk(ask?.body ?? '')).toEqual([{ thing: 'N-PRODUCT-1', step: 1 }, { thing: 's1-01-widget-colour', step: 1 }]);
    expect(ask?.body).toContain('@jdoe @ann: this pull request waits on a person.');
    expect(ask?.body).not.toContain('@cto');
    expect(recordOf(github)).toEqual([
      { thing: 'N-PRODUCT-1', kind: 'law', firstHeld: MONDAY, step: 1, asked: ['jdoe'], nextDue: '2026-10-16T09:00:00Z' },
      { thing: 's1-01-widget-colour', kind: 'item', firstHeld: MONDAY, step: 1, asked: ['ann', 'jdoe'], nextDue: '2026-10-16T09:00:00Z' },
    ]);

    expect((await sweep(github, THURSDAY)).result).toMatchObject({ asked: 0 });
    expect(asks(github)).toHaveLength(1);
  });

  it('4 working days after, one more ask mentions leadership alone', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    await sweep(github, WEDNESDAY_LATER);
    await sweep(github, FRIDAY);
    const last = asks(github).at(-1);
    expect(asks(github)).toHaveLength(2);
    expect(readAsk(last?.body ?? '')).toEqual([{ thing: 'N-PRODUCT-1', step: 2 }, { thing: 's1-01-widget-colour', step: 2 }]);
    expect(last?.body).toContain('@cto: this pull request waits on a person.');
    expect(recordOf(github).map(({ step, asked, nextDue }) => ({ step, asked, nextDue }))).toEqual([
      { step: 2, asked: ['jdoe', 'cto'], nextDue: null },
      { step: 2, asked: ['ann', 'jdoe', 'cto'], nextDue: null },
    ]);
    expect((await sweep(github, '2026-10-20T09:00:00Z')).result).toMatchObject({ asked: 0 });
    expect(asks(github)).toHaveLength(2);
  });

  it('a sweep that missed step 1 asks everyone not asked yet, once, at step 2', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    await sweep(github, FRIDAY);
    const [ask, ...more] = asks(github);
    expect(more).toEqual([]);
    expect(readAsk(ask?.body ?? '')).toEqual([{ thing: 'N-PRODUCT-1', step: 2 }, { thing: 's1-01-widget-colour', step: 2 }]);
    expect(ask?.body).toContain('@jdoe @cto @ann: this pull request waits on a person.');
  });

  it('an ask already posted is never posted again, even when the record was not rewritten after it', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    await sweep(github, WEDNESDAY_LATER);
    const record = records(github)[0];
    if (record === undefined) throw new Error('no record');
    record.body = record.body.replace('step 1 · asked jdoe ·', 'step 0 · asked nobody yet ·').replace('step 1 · asked ann, jdoe ·', 'step 0 · asked nobody yet ·');
    expect(recordOf(github).map(({ step }) => step)).toEqual([0, 0]);
    await sweep(github, THURSDAY);
    expect(asks(github)).toHaveLength(1);
    expect(recordOf(github).map(({ step }) => step)).toEqual([1, 1]);
  });

  it('the outbox check stays failure at every step, and the sweep makes no review, answer, adoption, label or verdict', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    const routes = new Set<string>();
    for (const now of [WEDNESDAY_LATER, FRIDAY]) {
      for (const request of (await sweep(github, now)).requests) routes.add(request.route);
      expect((await run(github, now)).result).toMatchObject({ conclusion: 'failure' });
      expect(checkRunAt(github.state, -1)).toMatchObject({ status: 'completed', conclusion: 'failure' });
    }
    const writes = [...routes].filter((route) => !route.startsWith('GET '));
    expect(writes.sort()).toEqual(['PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments']);
    expect(recordOf(github).map(({ thing }) => thing)).toEqual(['N-PRODUCT-1', 's1-01-widget-colour']);
  });

  it('a delegate’s approval of the head clears law-locked when the base CODEOWNERS lists the delegate; leadership’s leaves it red', async () => {
    const delegated = fakeGitHub({
      commits: { base1: withDelegate(commit(['base-locked'], ESCALATING)), head3: commit(['head-locked-edited', 'head-clear']) },
      pull: { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head3' } },
      files: [{ filename: INVARIANTS, status: 'modified' }],
    });
    await run(delegated, MONDAY, 'head3');
    expect(recordOf(delegated).map(({ thing }) => thing)).toEqual(['N-PRODUCT-1']);
    await sweep(delegated, WEDNESDAY_LATER);
    await sweep(delegated, FRIDAY);

    const summary = () => outputOf(checkRunAt(delegated.state, -1)).summary;
    delegated.state.reviews.push({ user: { login: 'cto' }, state: 'APPROVED', commit_id: 'head3' });
    expect((await run(delegated, FRIDAY, 'head3')).result).toMatchObject({ conclusion: 'failure' });
    expect(summary()).toContain('N-PRODUCT-1: waiting for an approving review of the head commit from @ann or @jdoe,');
    expect(recordOf(delegated).map(({ thing }) => thing)).toEqual(['N-PRODUCT-1']);

    delegated.state.reviews.push({ user: { login: 'jdoe' }, state: 'APPROVED', commit_id: 'head3' });
    await run(delegated, FRIDAY, 'head3');
    expect(summary()).toContain('Locked laws changed (N-PRODUCT-1): approved by their CODEOWNERS, @jdoe.');
    expect(recordOf(delegated)).toEqual([]);
  });

  it('an answered item and a cleared law are asked about no more', async () => {
    const github = featureGitHub(ESCALATING, { head3: ['head-locked-edited', 'head-clear'] });
    await run(github, MONDAY);
    approve(github, 'head3');
    await run(github, MONDAY, 'head3');
    expect(recordOf(github)).toEqual([]);
    expect((await sweep(github, FRIDAY)).result).toMatchObject({ asked: 0 });
    expect(asks(github)).toEqual([]);
  });

  it('a closed pull request is asked about no more: the sweep reads only open ones', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    const { result, requests } = await sweep(github, FRIDAY, { value: false });
    expect(result).toMatchObject({ asked: 0, pulls: 0 });
    expect(asks(github)).toEqual([]);
    expect(requests.filter((request) => request.route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments')).toEqual([]);
  });

  it('a repository with no delegate and no leadership is asked nothing, and no base config is read for it', async () => {
    const github = featureGitHub(PLAIN);
    await run(github, MONDAY);
    const { result, requests } = await sweep(github, FRIDAY);
    expect(result).toMatchObject({ asked: 0 });
    expect(asks(github)).toEqual([]);
    expect(requests.filter((request) => request.route === 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}')).toEqual([]);
  });

  it('a pull request GitHub refuses to read is logged, and the others are swept all the same', async () => {
    const github = featureGitHub();
    await run(github, MONDAY);
    const { app, installation } = sweepGitHub(github);
    const withBroken = {
      request: async (route: string, params: Params = {}): Promise<{ data: unknown }> => {
        if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments' && params.issue_number === 99) throw new Error('GitHub is down');
        const answer = await installation.request(route, params);
        if (route !== 'GET /repos/{owner}/{repo}/pulls' || params.page !== 1) return answer;
        return { data: [{ number: 99, state: 'open', base: github.state.pull.base }, ...(answer.data as unknown[])] };
      },
    };
    const logged: string[] = [];
    const fn = createEscalation({ client: inngest, octokitFor: () => withBroken, appOctokit: () => app, clock: () => new Date(WEDNESDAY_LATER).getTime(), log: (line) => logged.push(line) });
    const { result, error } = await new InngestTestEngine({ function: fn, events: tick() }).execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ asked: 1, pulls: 2, failed: 1 });
    expect(logged).toEqual([expect.stringContaining('escalation sweep of acme/widgets#99 waits for the next hour: GitHub is down')]);
  });

  it('runs every hour, one run at a time', () => {
    const fn = createEscalation({ client: inngest, octokitFor: () => ({ request: () => Promise.reject(new Error('unused')) }), appOctokit: null });
    expect(fn.opts).toMatchObject({ id: ESCALATION_FUNCTION_ID, triggers: [{ cron: '0 * * * *' }], concurrency: { limit: 1 } });
  });

  it('with no App client it logs one line and asks nobody', async () => {
    const logged: string[] = [];
    const fn = createEscalation({ client: inngest, octokitFor: () => ({ request: () => Promise.reject(new Error('unused')) }), appOctokit: null, log: (line) => logged.push(line) });
    const { result } = await new InngestTestEngine({ function: fn, events: tick() }).execute();
    expect(result).toEqual({ skipped: 'no app' });
    expect(logged).toHaveLength(1);
  });
});
