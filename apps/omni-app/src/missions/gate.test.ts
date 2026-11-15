import { describe, expect, it } from 'vitest';
import { reviewMarker } from 'omni-loop/kit/lib/review/verdict.ts';
import { checksOf, judge, latestVerdict, type CheckRun, type PullRead } from './gate.ts';

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const BRANCH = 'mission/12-faster-quotes';

const run = (id: number, name: string, conclusion: string | null, over: Partial<CheckRun> = {}): CheckRun => ({ id, name, status: conclusion === null ? 'in_progress' : 'completed', conclusion, title: null, ...over });
const pass = (round = 1, commit: string | null = HEAD) => ({ body: `${reviewMarker(round, 'pass')}\n**Round ${String(round)} of 2: pass**`, commit });
const changes = (round = 1, commit: string | null = HEAD) => ({ body: `${reviewMarker(round, 'changes')}\n**Round ${String(round)} of 2: 2 findings**`, commit });

/** A feature pull request into the mission branch that passes the gate. */
const pull = (over: Partial<PullRead> = {}): PullRead => ({
  number: 45,
  url: 'https://github.com/acme/widgets/pull/45',
  title: 'feat(quotes): a faster quote page',
  state: 'open',
  draft: false,
  merged: false,
  base: BRANCH,
  defaultBranch: 'main',
  head: HEAD,
  runs: [run(1, 'test', 'success'), run(2, 'lint', 'success')],
  statuses: [],
  reviews: [changes(1, OLD), pass(2)],
  items: { ranks: ['medium'] },
  ...over,
});

const lacksOf = (read: PullRead): string[] => {
  const gate = judge(read, BRANCH);
  return gate.decision === 'waits' ? gate.lacks : [];
};

describe('the merge gate of a mission branch (PRD 2896 s4, criterion 6)', () => {
  it('merges when every check is green, the Reviewer passed the head and no high or human-action item is open', () => {
    expect(judge(pull(), BRANCH)).toEqual({ decision: 'merge' });
  });

  it('waits on a red check, naming it', () => {
    expect(judge(pull({ runs: [run(1, 'test', 'failure'), run(2, 'lint', 'success')] }), BRANCH)).toEqual({ decision: 'waits', lacks: ['test failed'] });
    expect(lacksOf(pull({ runs: [run(1, 'test', 'timed_out')] }))).toEqual(['test failed']);
  });

  it('waits without the Reviewer\'s pass on the head', () => {
    expect(lacksOf(pull({ reviews: [] }))).toEqual(['the Reviewer has not reviewed it']);
    expect(lacksOf(pull({ reviews: [changes(1)] }))).toEqual(['the Reviewer asked for changes in round 1']);
    expect(lacksOf(pull({ reviews: [pass(1, OLD)] }))).toEqual(['the Reviewer passed an older commit, not its head']);
    expect(lacksOf(pull({ reviews: [pass(1), changes(2)] }))).toEqual(['the Reviewer asked for changes in round 2']);
    // A person's review, carrying no marker, is never the Reviewer's.
    expect(lacksOf(pull({ reviews: [{ body: 'LGTM, pass', commit: HEAD }] }))).toEqual(['the Reviewer has not reviewed it']);
  });

  it('waits while a high or human-action item is open, or one cannot be read', () => {
    expect(lacksOf(pull({ items: { ranks: ['high', 'medium'] } }))).toEqual(['1 high item open']);
    expect(lacksOf(pull({ items: { ranks: ['human-action', 'high', 'high'] } }))).toEqual(['1 human-action item open', '2 high items open']);
    expect(lacksOf(pull({ items: { ranks: [null] } }))).toEqual(['1 unreadable item in its outbox']);
    expect(lacksOf(pull({ items: { notRead: 'its head has no .omni-loop/config.yml' } }))).toEqual(['its outbox not judged: its head has no .omni-loop/config.yml']);
    expect(judge(pull({ items: { ranks: [] } }), BRANCH)).toEqual({ decision: 'merge' });
  });

  it('lists everything it lacks at once', () => {
    expect(lacksOf(pull({ draft: true, runs: [run(1, 'test', null)], reviews: [], items: { ranks: ['high'] } }))).toEqual([
      '#45 is a draft',
      'test not finished',
      'the Reviewer has not reviewed it',
      '1 high item open',
    ]);
  });

  it('has joined already when the pull request was merged into the mission branch', () => {
    expect(judge(pull({ merged: true, state: 'closed' }), BRANCH)).toEqual({ decision: 'joined' });
    expect(lacksOf(pull({ merged: true, state: 'closed', base: 'main' }))).toEqual(['#45 was merged into main, not mission/12-faster-quotes']);
  });

  it('never merges into another branch than its mission\'s, the default branch least of all (N-PRODUCT-15)', () => {
    expect(lacksOf(pull({ base: 'main' }))).toEqual(['#45 targets main, not mission/12-faster-quotes']);
    expect(lacksOf(pull({ base: 'mission/13-other' }))).toEqual(['#45 targets mission/13-other, not mission/12-faster-quotes']);
    expect(judge(pull({ base: BRANCH, defaultBranch: BRANCH }), BRANCH).decision).toBe('waits');
    expect(lacksOf(pull({ state: 'closed' }))).toEqual(['#45 is closed']);
  });
});

describe('a check that did not decide is never a pass (BL-GATE-1)', () => {
  it('reads a neutral, skipped or cancelled end as not judged, with its reason', () => {
    expect(lacksOf(pull({ runs: [run(1, 'outbox', 'neutral', { title: 'not measured: the budget file is missing' })] }))).toEqual(['outbox not judged: not measured: the budget file is missing']);
    expect(lacksOf(pull({ runs: [run(1, 'test', 'skipped')] }))).toEqual(['test not judged: skipped']);
    expect(lacksOf(pull({ runs: [run(1, 'test', 'cancelled')] }))).toEqual(['test not judged: cancelled']);
  });

  it('reads a check still queued or running as not finished', () => {
    expect(lacksOf(pull({ runs: [run(1, 'test', null, { status: 'queued' })] }))).toEqual(['test not finished']);
    expect(lacksOf(pull({ statuses: [{ context: 'Vercel', state: 'pending', description: null }] }))).toEqual(['Vercel not finished']);
  });

  it('waits when no check ran on the head at all', () => {
    expect(lacksOf(pull({ runs: [], statuses: [] }))).toEqual(['no check has run on its head']);
  });

  it('reads commit statuses too', () => {
    expect(lacksOf(pull({ statuses: [{ context: 'Vercel', state: 'success', description: null }] }))).toEqual([]);
    expect(lacksOf(pull({ statuses: [{ context: 'Vercel', state: 'error', description: 'Deployment failed' }] }))).toEqual(['Vercel failed']);
  });
});

describe('checksOf: one check per name, judged by the run that decided', () => {
  it('passes over a run a draft\'s push skipped for the one the ready pull request ran', () => {
    expect(checksOf([run(1, 'test', 'skipped'), run(5, 'test', 'success')], [])).toEqual([{ name: 'test', state: 'pass', why: null }]);
    expect(checksOf([run(5, 'test', 'success'), run(9, 'test', 'skipped')], [])).toEqual([{ name: 'test', state: 'pass', why: null }]);
  });

  it('reads the latest run that decided: a re-run that passed after a failure passes, a failure after a pass fails', () => {
    expect(checksOf([run(1, 'test', 'failure'), run(2, 'test', 'success')], [])[0]?.state).toBe('pass');
    expect(checksOf([run(1, 'test', 'success'), run(2, 'test', 'failure')], [])[0]?.state).toBe('fail');
  });

  it('is not finished while its latest run has not completed, whatever ran before', () => {
    expect(checksOf([run(1, 'test', 'success'), run(2, 'test', null)], [])[0]?.state).toBe('not-finished');
  });

  it('keeps a check that only ever skipped as not judged', () => {
    expect(checksOf([run(1, 'fallow', 'skipped'), run(2, 'fallow', 'skipped')], [])).toEqual([{ name: 'fallow', state: 'not-judged', why: 'skipped' }]);
  });

  it('lists them in name order', () => {
    expect(checksOf([run(1, 'test', 'success'), run(2, 'lint', 'success')], [{ context: 'Vercel', state: 'success', description: null }]).map(({ name }) => name)).toEqual(['Vercel', 'lint', 'test']);
  });
});

describe('latestVerdict: the Reviewer\'s latest round', () => {
  it('is the highest round, the last listed of it, with the commit it is on', () => {
    expect(latestVerdict([changes(1, OLD), pass(2, HEAD)])).toEqual({ round: 2, verdict: 'pass', commit: HEAD });
    expect(latestVerdict([pass(2, OLD), changes(1, HEAD)])).toEqual({ round: 2, verdict: 'pass', commit: OLD });
    expect(latestVerdict([pass(1, OLD), pass(1, HEAD)])).toEqual({ round: 1, verdict: 'pass', commit: HEAD });
    expect(latestVerdict([{ body: null, commit: HEAD }])).toBeNull();
  });
});
