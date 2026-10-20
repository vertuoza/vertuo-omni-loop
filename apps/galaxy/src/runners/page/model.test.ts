import { describe, expect, it } from 'vitest';
import { canCancel, canSendAgain, madeByWords, prdPageLink, prWords, senderWords, stateWords, statusTone, statusWords, targetOf } from './model';

// The Runners page's words and rules (PRD 1830 s3), pure: how long ago, where a job is sent again, and
// which jobs take Cancel or Send again.

const NOW = new Date('2026-10-13T14:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;

describe('stateWords', () => {
  it('says how long ago an offline runner was last seen, in minutes, hours or days', () => {
    expect(stateWords({ state: 'offline', lastSeenAt: ago(30_000) }, NOW)).toBe('Offline');
    expect(stateWords({ state: 'offline', lastSeenAt: ago(5 * MIN) }, NOW)).toBe('Offline, 5 min ago');
    expect(stateWords({ state: 'offline', lastSeenAt: ago(125 * MIN) }, NOW)).toBe('Offline, 2 h ago');
    expect(stateWords({ state: 'offline', lastSeenAt: ago(50 * 60 * MIN) }, NOW)).toBe('Offline, 2 d ago');
  });
});

describe('statusWords', () => {
  const job = { reason: null, exitCode: null, runningAt: null, claimedAt: null };

  it('counts a running job from when it started, else from its claim', () => {
    expect(statusWords({ ...job, status: 'running', runningAt: ago(3 * MIN), claimedAt: ago(4 * MIN) }, NOW)).toBe('Running 3 min');
    expect(statusWords({ ...job, status: 'running', claimedAt: ago(4 * MIN) }, NOW)).toBe('Running 4 min');
    expect(statusWords({ ...job, status: 'running' }, NOW)).toBe('Running');
    expect(statusWords({ ...job, status: 'claimed' }, NOW)).toBe('Starting');
  });

  it('says a failure without a reason or an exit code as Failed', () => {
    expect(statusWords({ ...job, status: 'failed' }, NOW)).toBe('Failed');
  });
});

describe('the actions', () => {
  it('cancels a queued, claimed or running job, a running one once', () => {
    for (const status of ['queued', 'claimed', 'running'] as const) expect(canCancel({ status, cancelRequested: false })).toBe(true);
    expect(canCancel({ status: 'running', cancelRequested: true })).toBe(false);
    for (const status of ['done', 'failed', 'cancelled'] as const) expect(canCancel({ status, cancelRequested: false })).toBe(false);
  });

  it('keeps Cancel on a Starting job whose cancel was already asked, so it never stays stuck (#2168)', () => {
    expect(canCancel({ status: 'claimed', cancelRequested: true })).toBe(true);
  });

  it('sends again only a failed or cancelled job', () => {
    expect((['queued', 'claimed', 'running', 'done', 'failed', 'cancelled'] as const).filter((status) => canSendAgain({ status }))).toEqual(['failed', 'cancelled']);
  });

  it('sends a job again to where it first went', () => {
    expect(targetOf({ toRunner: 'r1', toFleet: null })).toEqual({ kind: 'runner', runner: 'r1' });
    expect(targetOf({ toRunner: null, toFleet: 'comets' })).toEqual({ kind: 'fleet', fleet: 'comets' });
    expect(targetOf({ toRunner: null, toFleet: null })).toEqual({ kind: 'any' });
  });
});

describe('prWords', () => {
  it('names a pull request by its number', () => {
    expect(prWords('https://github.com/acme/widgets/pull/1838')).toBe('PR #1838');
    expect(prWords('https://github.com/acme/widgets')).toBe('Pull request');
  });
});

describe('senderWords and madeByWords', () => {
  it('name a key as the sender with its maker under it, and a person by their login (PRD 2022)', () => {
    expect(senderWords({ sentByLogin: 'ada', sentByKey: 'QA dashboard' })).toBe('API key QA dashboard');
    expect(madeByWords({ sentByLogin: 'ada', sentByKey: 'QA dashboard' })).toBe('made by @ada');
    expect(senderWords({ sentByLogin: 'ada', sentByKey: null })).toBe('@ada');
    expect(madeByWords({ sentByLogin: 'ada', sentByKey: null })).toBeNull();
    expect(senderWords({ sentByLogin: null, sentByKey: null })).toBe('A member');
    expect(madeByWords({ sentByLogin: null, sentByKey: 'QA dashboard' })).toBeNull();
  });
});

describe('a done job\'s outcome (PRD 2223)', () => {
  const job = { reason: null, exitCode: 0, runningAt: null, claimedAt: null, status: 'done' as const };

  it('reads Waiting on answers, Held or Ready, and Done without one', () => {
    expect(statusWords({ ...job, outcome: 'answers' }, NOW)).toBe('Waiting on answers');
    expect(statusWords({ ...job, outcome: 'held' }, NOW)).toBe('Held');
    expect(statusWords({ ...job, outcome: 'ready' }, NOW)).toBe('Ready');
    expect(statusWords({ ...job, outcome: null }, NOW)).toBe('Done');
    expect(statusWords(job, NOW)).toBe('Done');
  });

  it('is drawn in the yellow for answers and held, the green for ready and a plain done job', () => {
    expect(statusTone('done', 'answers')).toBe('wait');
    expect(statusTone('done', 'held')).toBe('wait');
    expect(statusTone('done', 'ready')).toBe('done');
    expect(statusTone('done', null)).toBe('done');
    expect(statusTone('failed', 'answers')).toBe('fail');
  });

  it('links the PRD page of the PRD the line names, for a done job with an outcome only', () => {
    const done = { line: '/omni:yolo 2213', repo: 'acme/widgets', status: 'done' as const, outcome: 'answers' as const };
    expect(prdPageLink(done)).toBe('/prd/at/acme/widgets/2213');
    expect(prdPageLink({ ...done, line: '/omni:yolo-fix 7' })).toBe('/prd/at/acme/widgets/7');
    expect(prdPageLink({ ...done, outcome: null })).toBeNull();
    expect(prdPageLink({ ...done, status: 'failed' })).toBeNull();
    expect(prdPageLink({ ...done, line: '/omni:yolo Issue 5' })).toBeNull();
  });
});

describe('a done job that needs a human (PRD 2255)', () => {
  const job = { reason: null, exitCode: 0, runningAt: null, claimedAt: null, status: 'done' as const };

  it('reads Need human, and Done once its questions are answered or dismissed (the board sends no outcome then)', () => {
    expect(statusWords({ ...job, outcome: 'human' }, NOW)).toBe('Need human');
    expect(statusWords({ ...job, outcome: null }, NOW)).toBe('Done');
  });

  it('is drawn in the yellow, as a job that waits on a person, and only when it is done', () => {
    expect(statusTone('done', 'human')).toBe('wait');
    expect(statusTone('failed', 'human')).toBe('fail');
    expect(statusTone('cancelled', 'human')).toBe('off');
  });

  it('links no PRD page: its number is a bug\'s issue', () => {
    expect(prdPageLink({ line: '/omni:bug-fix 314', repo: 'acme/widgets', status: 'done', outcome: 'human' })).toBeNull();
    expect(prdPageLink({ line: '/omni:yolo 2213', repo: 'acme/widgets', status: 'done', outcome: 'human' })).toBeNull();
  });
});
