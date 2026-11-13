import { describe, expect, it } from 'vitest';
import type { BoardSave, Job, Runner } from '../runners.contract';
import { cameBackWords, keepsWords, lossOf, lostThrice, resumeWords } from './loss';

// What the Runners page says of a job its runner lost and of the resume that carries it on (PRD 2809, s7), as words:
// pure, each line tested without a page. Times are UTC.

const NOW = new Date('2027-01-20T12:00:00Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
let seq = 0;
const job = (over: Partial<Job> = {}): Job => {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-0000000028${String(seq).padStart(2, '0')}`, line: '/omni:wave 2803', repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: null, sentByLogin: null,
    sentByKey: null, status: 'queued', runner: null, cancelRequested: false, logTail: '', prUrl: null, exitCode: null, reason: null, queuedAt: at(-30), claimedAt: null, runningAt: null, endedAt: null, ...over,
  };
};
const BOX1 = '00000000-0000-4000-8000-00000000b001';
const BOX3 = '00000000-0000-4000-8000-00000000b003';
const runners: Pick<Runner, 'id' | 'name'>[] = [{ id: BOX1, name: 'box-1' }, { id: BOX3, name: 'box-3' }];
const lost = (over: Partial<Job> = {}) => job({ status: 'failed', reason: 'runner lost', runner: BOX1, endedAt: at(-10), ...over });
const save = (over: Partial<BoardSave> = {}): BoardSave => ({ job: 'x', runner: 'box-1', kind: 'portable', savedAt: at(-11), keepUntil: at(7 * 24 * 60), bytes: 2048, branches: 2, files: 3, ...over });

describe('a lost job', () => {
  it('reads Lost · resuming with who went silent, when, and the attempt after it with its wait, linking the resume', () => {
    const first = lost();
    const resume = job({ resumes: first.id, attempt: 2, resumeAfter: at(1) });
    expect(lossOf(first, [first, resume], runners, NOW)).toEqual({ words: 'Lost · resuming', why: 'box-1 went silent at 11:50 · attempt 2 of 3 in 1 min', resume: resume.id, times: [] });
  });

  it('drops the wait once it is over, and reads the second attempt of the next loss with its own wait', () => {
    const first = lost();
    const second = lost({ resumes: first.id, attempt: 2, endedAt: at(-3) });
    const third = job({ resumes: second.id, attempt: 3, resumeAfter: at(5) });
    expect(lossOf(first, [first, second, third], runners, NOW)?.why).toBe('box-1 went silent at 11:50 · attempt 2 of 3');
    expect(lossOf(second, [first, second, third], runners, NOW)?.why).toBe('box-1 went silent at 11:57 · attempt 3 of 3 in 5 min');
  });

  it('says under a minute when the wait is nearly over', () => {
    const first = lost();
    const resume = job({ resumes: first.id, attempt: 2, resumeAfter: new Date(NOW.getTime() + 20_000).toISOString() });
    expect(lossOf(first, [first, resume], runners, NOW)?.why).toBe('box-1 went silent at 11:50 · attempt 2 of 3 in under 1 min');
  });

  it('reads the three reasons a runner can lose a job alike, and any other failure not at all', () => {
    for (const reason of ['the worktree could not be made', 'the tmux session could not be started']) {
      const first = lost({ reason });
      expect(lossOf(first, [first, job({ resumes: first.id, attempt: 2 })], runners, NOW)?.words).toBe('Lost · resuming');
    }
    const failed = lost({ reason: 'the skill failed' });
    expect(lossOf(failed, [failed, job({ resumes: failed.id, attempt: 2 })], runners, NOW)).toBeNull();
  });

  it('reads plain when no resume was queued (a skill outside the resumable ones)', () => {
    const only = lost();
    expect(lossOf(only, [only], runners, NOW)).toBeNull();
    expect(lostThrice(only)).toBe(false);
  });

  it('reads Lost 3 times after the third loss, with the losses\' times oldest first', () => {
    const first = lost({ endedAt: at(-40) });
    const second = lost({ resumes: first.id, attempt: 2, endedAt: at(-30) });
    const third = lost({ resumes: second.id, attempt: 3, endedAt: at(-10) });
    expect(lossOf(third, [third, second, first], runners, NOW)).toEqual({ words: 'Lost 3 times', why: 'Lost at 11:20 · 11:30 · 11:50', resume: null, times: ['11:20', '11:30', '11:50'] });
    expect(lostThrice(third)).toBe(true);
    expect(lostThrice(second)).toBe(false);
  });

  it('lists the losses it can see when an earlier one has left the board', () => {
    const third = lost({ resumes: '00000000-0000-4000-8000-0000000fffff', attempt: 3, endedAt: at(-10) });
    expect(lossOf(third, [third], runners, NOW)?.why).toBe('Lost at 11:50');
  });

  it('names a runner it does not know as A runner', () => {
    const first = lost({ runner: null });
    expect(lossOf(first, [first, job({ resumes: first.id, attempt: 2 })], runners, NOW)?.why).toMatch(/^A runner went silent/);
  });
});

describe('the resume', () => {
  it('reads after a loss with the lost job, then its attempt on a line of its own', () => {
    const first = lost();
    const resume = job({ resumes: first.id, attempt: 2 });
    expect(resumeWords(resume)).toEqual({ after: `after a loss · job ${first.id.slice(0, 8)}`, attempt: 'attempt 2 of 3' });
    expect(resumeWords(first)).toBeNull();
  });

  it('reads one line of what came back once it started: the save it resumed from, with its branches', () => {
    const first = lost();
    const resume = job({ resumes: first.id, attempt: 2, status: 'running', runner: BOX3 });
    expect(cameBackWords(resume, [first, resume], [save({ job: first.id, savedAt: at(-11), branches: 2 })], runners)).toBe('Resumed from the 11:49 save · 2 branches');
    expect(cameBackWords(resume, [first, resume], [save({ job: first.id, branches: 1 })], runners)).toBe('Resumed from the 11:49 save · 1 branch');
  });

  it('reads Started over when nothing was unsaved, and nothing before it started', () => {
    const first = lost();
    const resume = job({ resumes: first.id, attempt: 2, status: 'running', runner: BOX3 });
    expect(cameBackWords(resume, [first, resume], [], runners)).toBe('Started over: nothing was unsaved');
    expect(cameBackWords({ ...resume, status: 'queued' }, [first, resume], [], runners)).toBeNull();
    expect(cameBackWords(first, [first], [], runners)).toBeNull();
  });

  it('reads the files that stayed on a runner when a local save is not where the resume runs, and the save when it is', () => {
    const first = lost();
    const resume = job({ resumes: first.id, attempt: 2, status: 'done', runner: BOX3 });
    const local = save({ job: first.id, kind: 'local', files: 3 });
    expect(cameBackWords(resume, [first, resume], [local], runners)).toBe('3 files stayed on box-1');
    expect(cameBackWords({ ...resume, runner: BOX1 }, [first, resume], [local], runners)).toBe('Resumed from the 11:49 save · 2 branches');
  });

  it('reads the saves of the whole chain, the third attempt\'s too', () => {
    const first = lost();
    const second = lost({ resumes: first.id, attempt: 2 });
    const third = job({ resumes: second.id, attempt: 3, status: 'running', runner: BOX3 });
    const saves = [save({ job: first.id, savedAt: at(-50), branches: 1 }), save({ job: second.id, savedAt: at(-11), branches: 2 })];
    expect(cameBackWords(third, [first, second, third], saves, runners)).toBe('Resumed from the 11:49 save · 3 branches');
  });
});

describe('a runner keeping a save', () => {
  it('reads what it keeps and until when: the sizes added, the last save\'s day and time', () => {
    const saves = [
      save({ job: 'a', kind: 'local', bytes: 1_048_576, keepUntil: at(60) }),
      save({ job: 'b', kind: 'local', bytes: 3 * 1_048_576, keepUntil: at(120), savedAt: at(-5) }),
      save({ job: 'c', kind: 'portable', bytes: 9_999_999 }),
      save({ job: 'd', kind: 'local', runner: 'box-3', bytes: 5 }),
    ];
    expect(keepsWords('box-1', saves)).toBe('Keeps 4.0 MB until Wed 14:00');
    expect(keepsWords('box-2', saves)).toBeNull();
  });

  it('writes sizes in the page\'s short words', () => {
    expect(keepsWords('box-1', [save({ kind: 'local', bytes: 900 })])).toMatch(/^Keeps 900 B until /);
    expect(keepsWords('box-1', [save({ kind: 'local', bytes: 5 * 1024 })])).toMatch(/^Keeps 5 KB until /);
    expect(keepsWords('box-1', [save({ kind: 'local', bytes: 2.5 * 1024 ** 3 })])).toMatch(/^Keeps 2.5 GB until /);
  });
});
