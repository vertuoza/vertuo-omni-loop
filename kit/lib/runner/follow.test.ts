// `milestones` (PRD 2251, s3): each kind of milestone from a job and its lines, each printed once, in
// order, and each ending.
import { describe, expect, it } from 'vitest';
import { exitCodeOf, isEnded, milestones } from './follow.ts';
import type { FollowJob, MergedCount, Seen } from './follow.ts';

const PAGE = 'https://omni.test/prd/2251';
const job = (over: Partial<FollowJob> = {}): FollowJob => ({ status: 'queued', repo: 'a/b', runner: null, outcome: null, reason: null, exitCode: null, ...over });

/** One step: the new lines, and what to hand the next. */
function step(previous: Seen | null, over: Partial<FollowJob>, lines: string[] = [], merged: MergedCount = null) {
  return milestones(previous, job(over), lines, merged, PAGE);
}

describe('milestones', () => {
  it('prints queued once, then claimed by the runner once', () => {
    const first = step(null, {});
    expect(first.lines).toEqual(['queued']);
    const again = step(first.seen, {});
    expect(again.lines).toEqual([]);
    const claimed = step(again.seen, { status: 'claimed', runner: 'box-1' });
    expect(claimed.lines).toEqual(['claimed by box-1']);
    expect(step(claimed.seen, { status: 'running', runner: 'box-1' }).lines).toEqual([]);
  });

  it('prints queued then claimed when the first read finds the job already claimed', () => {
    expect(step(null, { status: 'running', runner: 'box-1' }).lines).toEqual(['queued', 'claimed by box-1']);
  });

  it('prints waiting for approval once while the lines show the wait, and again for a later wait', () => {
    let seen = step(null, { status: 'running', runner: 'r' }).seen;
    const wait = step(seen, { status: 'running', runner: 'r' }, ['12:00:01 ◌ PRD 2251 · waiting for Irisa or Paul']);
    expect(wait.lines).toEqual(['waiting for approval']);
    seen = wait.seen;
    const still = step(seen, { status: 'running', runner: 'r' }, ['12:00:30 ◌ PRD 2251 · waiting for Irisa or Paul']);
    expect(still.lines).toEqual([]);
    const approved = step(still.seen, { status: 'running', runner: 'r' }, ['✓ PRD 2251 approved by irisa · 12:01 · 4 files pinned']);
    expect(approved.lines).toEqual([]);
    expect(step(approved.seen, { status: 'running', runner: 'r' }, ['◌ PRD 2251 · waiting for Paul']).lines).toEqual(['waiting for approval']);
  });

  it('prints each PR line once, even seen twice in one read or in two', () => {
    const base = step(null, { status: 'running', runner: 'r' }).seen;
    const first = step(base, { status: 'running', runner: 'r' }, ['10:00:00 PR: https://github.com/a/b/pull/1', '10:00:01 PR: https://github.com/a/b/pull/1', 'PR: https://github.com/a/b/pull/2']);
    expect(first.lines).toEqual(['PR: https://github.com/a/b/pull/1', 'PR: https://github.com/a/b/pull/2']);
    const second = step(first.seen, { status: 'running', runner: 'r' }, ['PR: https://github.com/a/b/pull/2', 'Bash: git push']);
    expect(second.lines).toEqual([]);
  });

  it('prints only the PR lines the job wrote of its own repository, never a step output or another repository (bug 2567)', () => {
    const base = step(null, { status: 'running', runner: 'r' }).seen;
    const read = step(base, { status: 'running', runner: 'r' }, [
      '10:00:00 ✗ FAIL kit/bin/runner.test.ts',
      '  PR: https://github.com/a/b/pull/42',
      '10:00:01 PR: https://github.com/acme/widgets/pull/42',
      'PR: https://github.com/a/bb/pull/3',
      '10:00:02 PR: https://github.com/a/b/pull/7',
    ]);
    expect(read.lines).toEqual(['PR: https://github.com/a/b/pull/7']);
  });

  it('prints the board count only when it goes up, never down, and not without a total', () => {
    let seen = step(null, { status: 'running', runner: 'r' }).seen;
    const up = step(seen, { status: 'running', runner: 'r' }, [], { merged: 1, total: 2 });
    expect(up.lines).toEqual(['1/2 slices merged']);
    seen = up.seen;
    expect(step(seen, { status: 'running', runner: 'r' }, [], { merged: 1, total: 2 }).lines).toEqual([]);
    expect(step(seen, { status: 'running', runner: 'r' }, [], { merged: 0, total: 2 }).lines).toEqual([]);
    expect(step(seen, { status: 'running', runner: 'r' }, [], null).lines).toEqual([]);
    expect(step(seen, { status: 'running', runner: 'r' }, [], { merged: 2, total: 2 }).lines).toEqual(['2/2 slices merged']);
    expect(step(null, { status: 'running', runner: 'r' }, [], { merged: 0, total: 0 }).lines).toEqual(['queued', 'claimed by r']);
  });

  it.each([
    [{ status: 'done', outcome: 'answers' }, 'Waiting on answers'],
    [{ status: 'done', outcome: 'held' }, 'Held'],
    [{ status: 'done', outcome: 'ready' }, 'Ready'],
    [{ status: 'done', outcome: null }, 'Done'],
    [{ status: 'done', outcome: 'stopped' }, 'Stopped mid-way'],
    [{ status: 'failed', reason: 'timeout' }, 'Failed: timeout'],
    [{ status: 'failed', reason: null, exitCode: 2 }, 'Failed: exit code 2'],
    [{ status: 'failed', reason: null }, 'Failed: no reason given'],
    [{ status: 'failed', reason: 'runner lost' }, 'Runner lost'],
    [{ status: 'cancelled' }, 'Cancelled'],
  ] as const)('ends %j on %s with the page link, once', (over, words) => {
    const seen = step(null, { status: 'running', runner: 'r' }).seen;
    const done = step(seen, over);
    expect(done.lines).toEqual([`${words} · ${PAGE}`]);
    expect(step(done.seen, over).lines).toEqual([]);
  });

  it('ends a stopped job on its slice count and the line to send again (PRD 2375)', () => {
    const stopped = job({ status: 'done', runner: 'r', outcome: 'stopped', line: '/omni:yolo 2338' });
    const last = milestones(null, stopped, [], { merged: 0, total: 5 }, PAGE);
    expect(last.lines).toEqual(['queued', 'claimed by r', `Stopped mid-way · 0 / 5 slices merged · ${PAGE}`, "send it again: omni runner send '/omni:yolo 2338'"]);
    expect(milestones(last.seen, stopped, [], { merged: 0, total: 5 }, PAGE).lines).toEqual([]);
    expect(milestones(null, stopped, [], null, null).lines.at(-2)).toBe('Stopped mid-way');
    expect(milestones(null, stopped, [], { merged: 0, total: 0 }, null).lines.at(-2)).toBe('Stopped mid-way');
  });

  it('ends without a link when the PRD has no page', () => {
    expect(milestones(null, job({ status: 'done' }), [], null, null).lines).toEqual(['queued', 'Done']);
  });

  it('puts the lines\' milestones before the ending', () => {
    const seen = step(null, { status: 'running', runner: 'r' }).seen;
    const last = step(seen, { status: 'done', runner: 'r', outcome: 'ready' }, ['PR: https://github.com/a/b/pull/3'], { merged: 2, total: 2 });
    expect(last.lines).toEqual(['PR: https://github.com/a/b/pull/3', '2/2 slices merged', `Ready · ${PAGE}`]);
  });

  it('knows an ended job and its exit code', () => {
    expect(['queued', 'claimed', 'running'].some((status) => isEnded({ status: status as FollowJob['status'] }))).toBe(false);
    expect(isEnded({ status: 'done' })).toBe(true);
    expect(exitCodeOf({ status: 'done' })).toBe(0);
    expect(exitCodeOf({ status: 'done', outcome: 'held' })).toBe(0);
    expect(exitCodeOf({ status: 'done', outcome: 'stopped' })).toBe(1);
    for (const status of ['failed', 'cancelled'] as const) expect(exitCodeOf({ status })).toBe(1);
  });
});
