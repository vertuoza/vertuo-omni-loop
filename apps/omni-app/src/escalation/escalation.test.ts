// The escalation record (PRD 1794, s3), against the stubbed GitHub: the real outbox check runs, and
// after its verdict is published it keeps one `<!-- omni:escalation -->` comment of what still waits
// on a person. Each repository's commits are fixture folders copied at runtime, its config rewritten to
// name a delegate and leadership, or not.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { afterEach, describe, expect, it } from 'vitest';
import { readRecord, RECORD_MARKER, type RecordLine } from 'vertuo-omni-plan/kit/lib/escalation/comments.ts';
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import { checkRunAt, commitOf, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { createOutboxCheck } from '../outbox-check/outbox-check.ts';
import { recordLines } from './record.ts';

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
