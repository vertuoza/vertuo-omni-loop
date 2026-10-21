import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { OutboxStand } from '../dossier/page/stage';
import { answeredAll, prdOfLine, shouldContinue, type JobSeen } from './continue';

// Whether a PRD continues once its answers are in (PRD 2270, s1): the five conditions of the spec, each
// failing alone, queue nothing; all of them holding, the job that waited is the one continued.

const PRD = parsePrd(2270);

/** Every asked item answered: two asked, two counted replies. */
const ANSWERED: OutboxStand = { asked: 2, answered: 2, answers: [{ number: 1, letter: 'A' }, { number: 2, letter: 'B' }] };

let seq = 0;
/** A job of PRD 2270, done on Waiting on answers, unless told otherwise. */
function job(more: Partial<JobSeen> = {}): JobSeen {
  seq += 1;
  return { id: `job-${String(seq)}`, line: '/omni:yolo 2270', status: 'done', outcome: 'answers', continues: null, queued_at: '2026-10-20T09:00:00.000Z', ...more };
}

const waited = job({ id: 'waited', queued_at: '2026-10-20T10:00:00.000Z' });
const earlier = job({ id: 'earlier', status: 'done', outcome: 'held', queued_at: '2026-10-20T08:00:00.000Z' });

/** The input that continues: answered, the switch on, the newest job waited and nothing else runs. */
const continuing = { prd: PRD, stand: ANSWERED, jobs: [earlier, waited], switchOn: true };

describe('shouldContinue', () => {
  it('continues the newest job, done on Waiting on answers, once every asked item has a counted reply and the switch is on', () => {
    expect(shouldContinue(continuing)).toEqual({ continue: true, job: waited });
  });

  it('queues nothing while an asked item has no counted reply: unanswered, held, or from someone GitHub does not list', () => {
    // A held reply, or one from an author who does not count, is left out of `answered` by outboxStand.
    const decision = shouldContinue({ ...continuing, stand: { asked: 2, answered: 1, answers: [{ number: 1, letter: 'A' }] } });
    expect(decision).toEqual({ continue: false, why: '1 of 2 asked items answered' });
  });

  it('queues nothing when the outbox or its replies were not read, or nothing was asked', () => {
    expect(shouldContinue({ ...continuing, stand: null })).toEqual({ continue: false, why: 'the outbox or its replies were not read, or nothing was asked' });
  });

  it('queues nothing when the newest job of the PRD did not end on Waiting on answers', () => {
    for (const ended of [{ outcome: 'held' as const }, { outcome: 'ready' as const }, { outcome: null }, { status: 'failed' as const }, { status: 'cancelled' as const }]) {
      const newest = job({ ...ended, queued_at: '2026-10-20T11:00:00.000Z' });
      expect(shouldContinue({ ...continuing, jobs: [waited, newest] })).toMatchObject({ continue: false, why: `its newest runner job, ${newest.id}, did not end on Waiting on answers` });
    }
  });

  it('queues nothing when the PRD has no runner job in the repository', () => {
    expect(shouldContinue({ ...continuing, jobs: [] })).toEqual({ continue: false, why: 'no runner job of PRD 2270 here' });
    expect(shouldContinue({ ...continuing, jobs: [job({ line: '/omni:yolo 2271' })] })).toMatchObject({ continue: false, why: 'no runner job of PRD 2270 here' });
  });

  it('queues nothing while a job of the PRD is queued, claimed or running', () => {
    for (const status of ['queued', 'claimed', 'running'] as const) {
      const busy = job({ line: '/omni:pr-care 2270', status, outcome: null, queued_at: '2026-10-20T07:00:00.000Z' });
      expect(shouldContinue({ ...continuing, jobs: [waited, busy] })).toEqual({ continue: false, why: `a job of PRD 2270 is ${status}` });
    }
  });

  it('reads a job of another PRD as none of its business', () => {
    const other = job({ line: '/omni:yolo 2271', status: 'running', outcome: null, queued_at: '2026-10-20T12:00:00.000Z' });
    expect(shouldContinue({ ...continuing, jobs: [waited, other] })).toEqual({ continue: true, job: waited });
  });

  it('queues nothing for a job already continued', () => {
    const fix = job({ line: '/omni:yolo-fix 2270', continues: 'waited', status: 'failed', outcome: null, queued_at: '2026-10-20T09:30:00.000Z' });
    expect(shouldContinue({ ...continuing, jobs: [waited, fix] })).toEqual({ continue: false, why: 'job waited was continued already' });
  });

  it('continues a fix that ended on new questions, once those are answered', () => {
    const fix = job({ id: 'fix', line: '/omni:yolo-fix 2270', continues: 'waited', queued_at: '2026-10-20T11:00:00.000Z' });
    expect(shouldContinue({ ...continuing, jobs: [waited, fix] })).toEqual({ continue: true, job: fix });
  });

  it('queues nothing with the repository\'s switch off', () => {
    expect(shouldContinue({ ...continuing, switchOn: false })).toEqual({ continue: false, why: 'Fix on a runner once answered is off for this repository' });
  });
});

describe('answeredAll', () => {
  it('holds only when something was asked and every asked item has a counted reply', () => {
    expect(answeredAll(ANSWERED)).toBe(true);
    expect(answeredAll({ asked: 2, answered: 1, answers: [] })).toBe(false);
    expect(answeredAll({ asked: 0, answered: 0, answers: [] })).toBe(false);
    expect(answeredAll(null)).toBe(false);
  });
});

describe('prdOfLine', () => {
  it('reads the PRD a line of a PRD\'s skill names first', () => {
    expect(prdOfLine('/omni:yolo 2270')).toBe(2270);
    expect(prdOfLine('/omni:yolo-fix 2270')).toBe(2270);
    expect(prdOfLine('/omni:do-work 2270 s1')).toBe(2270);
    expect(prdOfLine('/omni:pitch 2270 --for customers')).toBe(2270);
  });

  it('reads none from a fix\'s line, a product PRD\'s, a line with no number, or a line off the list', () => {
    expect(prdOfLine('/omni:bug-fix 2270')).toBeNull();
    expect(prdOfLine('/omni:yolo mobile-12')).toBeNull();
    expect(prdOfLine('/omni:yolo')).toBeNull();
    expect(prdOfLine('/omni:yolo 22x')).toBeNull();
    expect(prdOfLine('/omni:drive 2270')).toBeNull();
  });
});
