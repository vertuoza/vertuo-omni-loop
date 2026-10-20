import { describe, expect, it } from 'vitest';
import { checkRunnerLine, LINE_MAX, RUNNABLE_SKILLS } from 'vertuo-omni-plan/kit/lib/runner/line.ts';
import {
  AnswerRequestSchema, AskRequestSchema, checkLine, HealthReportSchema, JOB_OUTCOMES, JobLinesQuerySchema, JobQuestionsSchema, JobReplySchema, JobUpdateSchema,
  RegisterRequestSchema, RUNNER_SKILLS, SendRequestSchema, TargetSchema,
} from './runners.contract';

// The line check (PRD 1830 s1): a runner runs only `/omni:<skill> <args>` lines of 200 characters at
// most, skill included, whose skill is on the list and whose arguments are letters, digits, spaces and
// `._/:#-`.

describe('the line check', () => {
  it.each(RUNNER_SKILLS)('lets /omni:%s through, with its arguments', (skill) => {
    expect(checkLine(`/omni:${skill} 1830 s1 --in-wave`)).toEqual({ ok: true, skill, args: '1830 s1 --in-wave' });
  });

  it('lists exactly the skills `omni runner` runs, so the app never queues a line a runner refuses', () => {
    expect([...RUNNER_SKILLS]).toEqual([...RUNNABLE_SKILLS]);
  });

  it('lets /omni:mega-bug-fix through with a plan repository issue’s URL', () => {
    expect(checkLine('/omni:mega-bug-fix https://github.com/acme/plan/issues/612')).toEqual({ ok: true, skill: 'mega-bug-fix', args: 'https://github.com/acme/plan/issues/612' });
  });

  it('lets a line with no arguments through', () => {
    expect(checkLine('/omni:wave')).toEqual({ ok: true, skill: 'wave', args: '' });
  });

  it('takes every character the list allows', () => {
    expect(checkLine('/omni:bug-fix acme/widgets#12 v1.2_3:x').ok).toBe(true);
  });

  it.each([
    ['an unlisted skill', '/omni:enforce 1400', 'not a skill a runner runs'],
    ['a conversational skill', '/omni:brainstorm a new idea', 'not a skill a runner runs'],
    ['the loop, which never ends', '/omni:drive 1717', 'not a skill a runner runs'],
    ['another plugin\'s skill', '/vercel:deploy prod', 'reads `/omni:<skill> <arguments>`'],
    ['no slash', 'omni:yolo 1717', 'reads `/omni:<skill> <arguments>`'],
  ])('refuses %s', (_, line, reason) => {
    const check = checkLine(line);
    expect(check.ok).toBe(false);
    expect(check.ok ? '' : check.reason).toContain(reason);
  });

  it.each([
    ['a command chained on', '/omni:yolo 1717; rm -rf ~'],
    ['a subshell', '/omni:yolo $(whoami)'],
    ['backticks', '/omni:yolo `id`'],
    ['a pipe', '/omni:yolo 1717 | sh'],
    ['a redirection', '/omni:yolo 1717 > /etc/passwd'],
    ['quotes', '/omni:yolo "1717"'],
    ['a new line', '/omni:yolo 1717\nrm -rf ~'],
    ['an ampersand', '/omni:yolo 1717 && echo'],
  ])('refuses shell characters: %s', (_, line) => {
    expect(checkLine(line).ok).toBe(false);
  });

  it('takes a line of 200 characters, the skill included, and refuses 201', () => {
    const line = `/omni:yolo ${'a'.repeat(189)}`;
    expect(line).toHaveLength(200);
    expect(checkLine(line).ok).toBe(true);
    expect(checkLine(`${line}a`)).toEqual({ ok: false, reason: 'A line is 200 characters at most, the skill included.' });
  });

  it('agrees with the runner’s own check at its limit, for every skill, so the app never queues a line a runner refuses', () => {
    for (const skill of RUNNER_SKILLS) {
      const longest = `/omni:${skill} ${'a'.repeat(LINE_MAX - `/omni:${skill} `.length)}`;
      expect(longest).toHaveLength(LINE_MAX);
      expect([checkLine(longest).ok, checkRunnerLine(longest).ok], skill).toEqual([true, true]);
      expect([checkLine(`${longest}a`).ok, checkRunnerLine(`${longest}a`).ok], skill).toEqual([false, false]);
    }
  });
});

describe('the requests', () => {
  it('registers a runner with 1 to 8 slots and at least one repository', () => {
    const runner = { name: 'vertuo-agents', slots: 4, repos: ['vertuoza/vertuo-omni-loop'], version: '0.0.387' };
    expect(RegisterRequestSchema.parse(runner)).toEqual(runner);
    for (const slots of [0, 9, 1.5]) expect(RegisterRequestSchema.safeParse({ ...runner, slots }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...runner, repos: [] }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...runner, name: 'two words' }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...runner, owner: 'someone' }).success).toBe(false);
  });

  it('sends to any runner, a fleet or one runner, and nowhere else', () => {
    expect(TargetSchema.parse({ kind: 'any' })).toEqual({ kind: 'any' });
    expect(TargetSchema.parse({ kind: 'fleet', fleet: 'cia' })).toEqual({ kind: 'fleet', fleet: 'cia' });
    expect(TargetSchema.safeParse({ kind: 'runner', runner: 'not-an-id' }).success).toBe(false);
    expect(TargetSchema.safeParse({ kind: 'fleet', fleet: 'cia', runner: '00000000-0000-4000-8000-000000000001' }).success).toBe(false);
    expect(SendRequestSchema.safeParse({ line: '/omni:yolo 1', repo: 'not a repo', target: { kind: 'any' } }).success).toBe(false);
  });

  it('reports a status a runner may set, with a pull request link from GitHub only', () => {
    expect(JobUpdateSchema.parse({ status: 'done', prUrl: 'https://github.com/acme/widgets/pull/12', exitCode: 0 }).status).toBe('done');
    expect(JobUpdateSchema.safeParse({ status: 'claimed' }).success).toBe(false);
    expect(JobUpdateSchema.safeParse({ status: 'queued' }).success).toBe(false);
    expect(JobUpdateSchema.safeParse({ status: 'done', prUrl: 'https://evil.test/acme/widgets/pull/12' }).success).toBe(false);
  });
});

describe('a report\'s live lines (PRD 1904)', () => {
  const lines = (count: number, chars = 20) => Array.from({ length: count }, () => 'x'.repeat(chars));

  it('takes from and lines together, or neither', () => {
    expect(JobUpdateSchema.parse({ status: 'running', from: 1201, lines: ['12:04:31 Bash: pnpm test'] })).toMatchObject({ from: 1201, lines: ['12:04:31 Bash: pnpm test'] });
    expect(JobUpdateSchema.parse({ status: 'running', logTail: 'tail' })).toEqual({ status: 'running', logTail: 'tail' });
    expect(JobUpdateSchema.safeParse({ status: 'running', from: 1 }).success).toBe(false);
    expect(JobUpdateSchema.safeParse({ status: 'running', lines: ['a'] }).success).toBe(false);
  });

  it('numbers the first line from 1', () => {
    for (const from of [0, -1, 1.5]) expect(JobUpdateSchema.safeParse({ status: 'running', from, lines: ['a'] }).success).toBe(false);
  });

  it('takes 2,000 lines of 600 characters, and refuses 2,001 lines or a line of 601', () => {
    expect(JobUpdateSchema.safeParse({ status: 'running', from: 1, lines: lines(2000, 600) }).success).toBe(true);
    expect(JobUpdateSchema.safeParse({ status: 'running', from: 1, lines: lines(2001) }).success).toBe(false);
    expect(JobUpdateSchema.safeParse({ status: 'running', from: 1, lines: [...lines(1), 'x'.repeat(601)] }).success).toBe(false);
  });

  it('reads the lines after a sequence number, from the first by default', () => {
    expect(JobLinesQuerySchema.parse({})).toEqual({ after: 0 });
    expect(JobLinesQuerySchema.parse({ after: '1200' })).toEqual({ after: 1200 });
    for (const after of ['-1', 'x', '1.5']) expect(JobLinesQuerySchema.safeParse({ after }).success).toBe(false);
  });
});

// A runner's health report (PRD 2102 s1): numbers only, each non-negative or null, strict; `paused` and
// `limits` come from a runner that pauses, and a runner that does not sends neither.
describe('the health report', () => {
  const report = {
    cpu: 63.5, load1: 7.9, cores: 8, memUsed: 13_958_643_712, memTotal: 17_179_869_184, diskFree: 41_875_931_136, diskTotal: 249_821_655_040,
  };

  it('takes a sample alone, and one with why the runner is paused and its limits', () => {
    expect(HealthReportSchema.parse(report)).toEqual(report);
    const paused = { ...report, paused: 'memory 91%', limits: { maxMemory: 85, minDiskGb: 10, maxLoad: 1.5 } };
    expect(HealthReportSchema.parse(paused)).toEqual(paused);
    expect(HealthReportSchema.safeParse({ ...report, paused: null, limits: { maxMemory: 100, minDiskGb: 0, maxLoad: 0.1 } }).success).toBe(true);
  });

  it('takes every figure the runner could not read as null', () => {
    const blind = { cpu: null, load1: null, cores: null, memUsed: null, memTotal: null, diskFree: null, diskTotal: null };
    expect(HealthReportSchema.safeParse(blind).success).toBe(true);
  });

  it.each([
    ['a negative figure', { memUsed: -1 }],
    ['a CPU above 100 %', { cpu: 100.1 }],
    ['bytes that are no whole number', { diskFree: 1.5 }],
    ['a figure that is no number', { load1: '7.9' }],
    ['a missing figure', { cores: undefined }],
    ['an unknown field', { hostname: 'box-1' }],
    ['a reason of 81 characters', { paused: 'x'.repeat(81) }],
    ['an empty reason', { paused: '' }],
    ['a memory limit above 100 %', { limits: { maxMemory: 101, minDiskGb: 10, maxLoad: 1.5 } }],
    ['a load limit of 0', { limits: { maxMemory: 85, minDiskGb: 10, maxLoad: 0 } }],
    ['a limit missing', { limits: { maxMemory: 85, minDiskGb: 10 } }],
    ['an unknown limit', { limits: { maxMemory: 85, minDiskGb: 10, maxLoad: 1.5, maxSwap: 2 } }],
  ])('refuses %s', (_, change) => {
    expect(HealthReportSchema.safeParse({ ...report, ...change }).success).toBe(false);
  });

  it('refuses a number JSON cannot carry', () => {
    for (const odd of [Number.POSITIVE_INFINITY, Number.NaN]) expect(HealthReportSchema.safeParse({ ...report, load1: odd }).success).toBe(false);
  });
});

// The tokens (PRD 2102 s4): a job's report may carry the four counts of its worktree, and a health report
// the machine's counts of the last 5 hours and of today (each null when the runner could not read it). A
// report from a runner older than this PRD carries neither and stays valid.
describe('the tokens a report carries', () => {
  const counts = { input: 81_234, output: 402_118, cacheRead: 9_120_443, cacheWrite: 611_002 };
  const sample = { cpu: 1, load1: 1, cores: 8, memUsed: 1, memTotal: 2, diskFree: 3, diskTotal: 4 };

  it('takes a job report with its tokens, and without them', () => {
    expect(JobUpdateSchema.parse({ status: 'running', tokens: counts })).toEqual({ status: 'running', tokens: counts });
    expect(JobUpdateSchema.parse({ status: 'running' })).toEqual({ status: 'running' });
    expect(JobUpdateSchema.safeParse({ status: 'done', tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }).success).toBe(true);
  });

  it.each([
    ['a count missing', { input: 1, output: 1, cacheRead: 1 }],
    ['a negative count', { ...counts, output: -1 }],
    ['a count that is no whole number', { ...counts, input: 1.5 }],
    ['a count that is no number', { ...counts, cacheRead: '9' }],
    ['a count that is null', { ...counts, cacheWrite: null }],
    ['an unknown count', { ...counts, reasoning: 3 }],
  ])('refuses a job report with %s', (_, tokens) => {
    expect(JobUpdateSchema.safeParse({ status: 'running', tokens }).success).toBe(false);
  });

  it('refuses a job report whose tokens are null', () => {
    expect(JobUpdateSchema.safeParse({ status: 'running', tokens: null }).success).toBe(false);
  });

  it('takes a health report with the machine\'s tokens, a window it could not read as null, and none at all', () => {
    const both = { ...sample, tokens: { last5h: counts, today: { ...counts, input: 120_113 } } };
    expect(HealthReportSchema.parse(both)).toEqual(both);
    const half = { ...sample, tokens: { last5h: null, today: counts } };
    expect(HealthReportSchema.parse(half)).toEqual(half);
    expect(HealthReportSchema.parse(sample)).toEqual(sample);
  });

  it.each([
    ['a window missing', { last5h: counts }],
    ['an unknown window', { last5h: counts, today: counts, week: counts }],
    ['a count out of shape', { last5h: { ...counts, input: -1 }, today: counts }],
  ])('refuses a health report with %s', (_, tokens) => {
    expect(HealthReportSchema.safeParse({ ...sample, tokens }).success).toBe(false);
  });
});

// The released claims (PRD 2175 s2): a job's last report may say which sub-PRs its runner released, and
// why a release failed; both are optional, so a runner from before this PRD reports as it did.
describe('the claims a report says were released', () => {
  it('takes a report with the numbers released and why a release failed, with either alone, and with neither', () => {
    const full = { status: 'failed', reason: 'exit code 3', released: [1908, 1909], releaseError: 'HTTP 502' };
    expect(JobUpdateSchema.parse(full)).toEqual(full);
    expect(JobUpdateSchema.parse({ status: 'done', released: [], releaseError: null })).toEqual({ status: 'done', released: [], releaseError: null });
    expect(JobUpdateSchema.safeParse({ status: 'done', releaseError: 'gh: not signed in' }).success).toBe(true);
    expect(JobUpdateSchema.parse({ status: 'done' })).toEqual({ status: 'done' });
  });

  it('takes 50 numbers and 200 characters, the most a runner sends', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => i + 1);
    expect(JobUpdateSchema.safeParse({ status: 'done', released: fifty, releaseError: 'x'.repeat(200) }).success).toBe(true);
  });

  it.each([
    ['51 numbers', { released: Array.from({ length: 51 }, (_, i) => i + 1) }],
    ['a number that is no pull request', { released: [0] }],
    ['a number with a fraction', { released: [1.5] }],
    ['a number as text', { released: ['1908'] }],
    ['released as null', { released: null }],
    ['a reason over 200 characters', { releaseError: 'x'.repeat(201) }],
  ])('refuses a report with %s', (_, more) => {
    expect(JobUpdateSchema.safeParse({ status: 'done', ...more }).success).toBe(false);
  });
});

// The outcome (PRD 2223 s1): a done yolo job's report says what its hand-off ended on; an unknown word is refused.
describe('the outcome a report carries', () => {
  it.each(['answers', 'held', 'ready', null])('takes %s', (outcome) => {
    expect(JobUpdateSchema.parse({ status: 'done', exitCode: 0, outcome })).toEqual({ status: 'done', exitCode: 0, outcome });
  });

  it('takes a report without one, as a runner from before this PRD sends', () => {
    expect(JobUpdateSchema.parse({ status: 'done' })).toEqual({ status: 'done' });
  });

  it.each(['done', 'waiting', '', 'ANSWERS', 1])('refuses %j', (outcome) => {
    expect(JobUpdateSchema.safeParse({ status: 'done', outcome }).success).toBe(false);
  });
});

// PRD 2255 s1: `human` is the server's word. A done job that ends with its questions open reads it; a runner's
// report never says it, so a job cannot read Need human with nothing to answer.
describe('the outcome human (PRD 2255)', () => {
  it('is one of the outcomes a job reads', () => {
    expect([...JOB_OUTCOMES]).toEqual(['answers', 'held', 'ready', 'human']);
    const job = { id: '00000000-0000-4000-8000-000001830201', line: '/omni:bug-fix 314', repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: '00000000-0000-4000-8000-0000018300b1', sentByLogin: 'mo', sentByKey: null, status: 'done', runner: null, cancelRequested: false, logTail: '', prUrl: null, exitCode: 0, reason: null, outcome: 'human', queuedAt: 't', claimedAt: null, runningAt: null, endedAt: 't' };
    expect(JobReplySchema.parse({ job }).job.outcome).toBe('human');
  });

  it('is refused in a runner\'s report', () => {
    expect(JobUpdateSchema.safeParse({ status: 'done', exitCode: 0, outcome: 'human' }).success).toBe(false);
  });
});

// The questions a job asks (PRD 2255 s1): `omni ask`'s file shape, 1 to 4 questions, each with a header and
// 2 to 4 options of a label and a description, beside the issue the job works on and a lead.
describe('the questions a job asks (PRD 2255)', () => {
  const option = (label: string) => ({ label, description: `What ${label} changes` });
  const question = (header: string, more: object = {}) => ({
    question: `Which fix for ${header}?`, header, options: [option('Make project nullable'), option('Design it first')], multiSelect: false, ...more,
  });
  const ask = { issue: 314, lead: 'The planning query fails for 31 tenants.', questions: [question('Planning')] };

  it('takes one question, and four', () => {
    expect(AskRequestSchema.parse(ask)).toEqual(ask);
    const four = { ...ask, questions: ['A', 'B', 'C', 'D'].map((header) => question(header)) };
    expect(AskRequestSchema.parse(four).questions).toHaveLength(4);
  });

  it.each([
    ['no question', { questions: [] }],
    ['five questions', { questions: ['A', 'B', 'C', 'D', 'E'].map((header) => question(header)) }],
    ['two questions asking the same thing', { questions: [question('A'), question('A')] }],
    ['no issue', { issue: undefined }],
    ['an issue that is no number', { issue: '314' }],
    ['an issue of 0', { issue: 0 }],
    ['no lead', { lead: '' }],
    ['a lead of 4,001 characters', { lead: 'x'.repeat(4_001) }],
    ['an unknown field', { context: { skill: 'bug-fix' } }],
  ])('refuses %s', (_, more) => {
    expect(AskRequestSchema.safeParse({ ...ask, ...more }).success).toBe(false);
  });

  it.each([
    ['no header', question('', {})],
    ['one option', question('A', { options: [option('Only')] })],
    ['five options', question('A', { options: ['a', 'b', 'c', 'd', 'e'].map(option) })],
    ['an option with no label', question('A', { options: [option('x'), { label: '', description: 'd' }] })],
    ['an option with no description field', question('A', { options: [option('x'), { label: 'y' }] })],
    ['no multiSelect', { question: 'Which?', header: 'A', options: [option('x'), option('y')] }],
    ['an unknown field on an option', question('A', { options: [option('x'), { ...option('y'), preview: 'z' }] })],
  ])('refuses a question with %s', (_, bad) => {
    expect(AskRequestSchema.safeParse({ ...ask, questions: [bad] }).success).toBe(false);
  });

  it('takes a question a person may pick several options of', () => {
    expect(AskRequestSchema.parse({ ...ask, questions: [question('A', { multiSelect: true })] }).questions[0]?.multiSelect).toBe(true);
  });

  it('reads a job\'s questions back as open, answered or dismissed, with who closed them', () => {
    const read = {
      job: '00000000-0000-4000-8000-000001830201', issue: 314, lead: ask.lead, questions: ask.questions, state: 'open',
      answers: null, by: null, byLogin: null, at: null, resume: null,
    };
    expect(JobQuestionsSchema.parse(read)).toEqual(read);
    const answered = { ...read, state: 'answered', answers: { 'Which fix for Planning?': 'Make project nullable' }, by: '00000000-0000-4000-8000-0000018300b1', byLogin: 'mo', at: 't', resume: '00000000-0000-4000-8000-000001830202' };
    expect(JobQuestionsSchema.parse(answered).state).toBe('answered');
    expect(JobQuestionsSchema.safeParse({ ...read, state: 'closed' }).success).toBe(false);
  });
});

describe('the answers (PRD 2255)', () => {
  it('takes one answer per question, of 2,000 characters at most', () => {
    expect(AnswerRequestSchema.parse({ answers: { 'Which fix?': 'Make project nullable' } })).toEqual({ answers: { 'Which fix?': 'Make project nullable' } });
    expect(AnswerRequestSchema.safeParse({ answers: { 'Which fix?': 'x'.repeat(2_000) } }).success).toBe(true);
    expect(AnswerRequestSchema.safeParse({ answers: { 'Which fix?': 'x'.repeat(2_001) } }).success).toBe(false);
  });

  it.each([
    ['no answer at all', { answers: {} }],
    ['an empty answer', { answers: { 'Which fix?': '' } }],
    ['an answer that is no text', { answers: { 'Which fix?': 3 } }],
    ['five answers', { answers: { a: '1', b: '2', c: '3', d: '4', e: '5' } }],
    ['a field beside the answers', { answers: { 'Which fix?': 'x' }, via: 'page' }],
    ['no answers field', {}],
  ])('refuses %s', (_, body) => {
    expect(AnswerRequestSchema.safeParse(body).success).toBe(false);
  });
});
