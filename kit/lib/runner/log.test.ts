// A job's log as the runner reads it (PRD 1830): the tail it sends, the pull request it links, and
// the `--timeout` it is held to.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from '../ids.ts';
import { fixIssueOf, fixOutcome, LINE_CHARS, lastPullRequest, linesAfter, logTail, parseDuration, reportBatch, runOutcome, REPORT_BYTES, REPORT_LINES, TAIL_BYTES, TAIL_LINES } from './log.ts';

describe('logTail', () => {
  it('keeps the last 200 lines', () => {
    const log = Array.from({ length: 250 }, (_, index) => `line ${String(index + 1)}`).join('\n') + '\n';
    const tail = logTail(log).split('\n');
    expect(tail).toHaveLength(TAIL_LINES);
    expect(tail[0]).toBe('line 51');
    expect(tail.at(-1)).toBe('line 250');
  });

  it('cuts long lines to 16 KB from the front, on a whole line', () => {
    const log = Array.from({ length: 100 }, (_, index) => `${String(index)} ${'x'.repeat(500)}`).join('\n');
    const tail = logTail(log);
    expect(Buffer.byteLength(tail)).toBeLessThanOrEqual(TAIL_BYTES);
    expect(tail.split('\n')[0]).toMatch(/^\d+ x+$/);
    expect(tail.endsWith(`99 ${'x'.repeat(500)}`)).toBe(true);
  });

  it('keeps a short log whole', () => {
    expect(logTail('a\nb\n')).toBe('a\nb');
    expect(logTail('')).toBe('');
  });
});

describe('lastPullRequest', () => {
  it("reads the last PR line of the job's repository, and no other repository's", () => {
    const log = [
      '10:00:00 PR: https://github.com/acme/widgets/pull/12',
      '10:00:01 › see https://github.com/acme/widgets/pull/99',
      'PR: https://github.com/acme/widgets/pull/14',
      '10:00:03 PR: https://github.com/acme/other/pull/15',
      '10:00:04 PR: https://github.com/acme/widgets-two/pull/7',
    ].join('\n');
    expect(lastPullRequest(log, 'acme/widgets')).toBe('https://github.com/acme/widgets/pull/14');
    expect(lastPullRequest('opened https://github.com/acme/widgets/pull/12', 'acme/widgets')).toBeNull();
    expect(lastPullRequest('nothing here', 'acme/widgets')).toBeNull();
  });

  it('reads the first pull request of the hand-off, the lines after the last Done line, before any PR line', () => {
    const log = [
      '10:00:00 PR: https://github.com/acme/widgets/pull/12',
      '10:00:01 PR: https://github.com/acme/widgets/pull/14',
      '10:00:02 Done: ok · 3 turns · $0.10 · 4s',
      '10:00:02 See https://github.com/acme/other/pull/3',
      '10:00:02 1. Review the change: https://github.com/acme/widgets/pull/12#issuecomment-9',
      '10:00:02 2. Then https://github.com/acme/widgets/pull/14',
    ].join('\n');
    expect(lastPullRequest(log, 'acme/widgets')).toBe('https://github.com/acme/widgets/pull/12');
    const plain = ['10:00:00 PR: https://github.com/acme/widgets/pull/12', 'Done: error · 1 turns · $0.00 · 1s', 'nothing to review'].join('\n');
    expect(lastPullRequest(plain, 'acme/widgets')).toBe('https://github.com/acme/widgets/pull/12');
  });
});

describe('parseDuration', () => {
  it('reads seconds, minutes and hours, and refuses anything else', () => {
    expect(parseDuration('3h')).toBe(3 * 3_600_000);
    expect(parseDuration('45m')).toBe(45 * 60_000);
    expect(parseDuration('90s')).toBe(90_000);
    for (const text of ['0h', '3', 'h', '1.5h', '3d', '-1h', ' 3h']) expect(parseDuration(text)).toBeNull();
  });
});

describe('linesAfter (PRD 1904)', () => {
  const log = 'one\ntwo\nthree\nfour';

  it('answers the whole lines after the cursor, never the line still being written', () => {
    expect(linesAfter(log, 0, { ended: false })).toEqual(['one', 'two', 'three']);
    expect(linesAfter(log, 2, { ended: false })).toEqual(['three']);
    expect(linesAfter(log, 3, { ended: false })).toEqual([]);
    expect(linesAfter('', 0, { ended: false })).toEqual([]);
  });

  it('answers the last line too once the job has ended', () => {
    expect(linesAfter(log, 2, { ended: true })).toEqual(['three', 'four']);
    expect(linesAfter(`${log}\n`, 2, { ended: true })).toEqual(['three', 'four']);
    expect(linesAfter('', 0, { ended: true })).toEqual([]);
  });

  it(`cuts a line longer than ${String(LINE_CHARS)} characters, so the app never refuses the report`, () => {
    const [line = ''] = linesAfter(`${'x'.repeat(LINE_CHARS + 50)}\n`, 0, { ended: false });
    expect(line).toHaveLength(LINE_CHARS);
    const [emoji = ''] = linesAfter(`${'x'.repeat(LINE_CHARS - 1)}😀\n`, 0, { ended: false });
    expect(emoji.length).toBeLessThanOrEqual(LINE_CHARS);
    expect(emoji.endsWith('x')).toBe(true);
  });
});

describe('reportBatch (PRD 1904)', () => {
  it(`takes at most ${String(REPORT_LINES)} lines`, () => {
    const lines = Array.from({ length: 4500 }, (_, index) => String(index + 1));
    expect(reportBatch(lines)).toHaveLength(REPORT_LINES);
    expect(reportBatch(lines.slice(4000))).toHaveLength(500);
    expect(reportBatch([])).toEqual([]);
  });

  it('takes at most 256 KB of lines', () => {
    const lines = Array.from({ length: 2000 }, () => 'é'.repeat(LINE_CHARS));
    const batch = reportBatch(lines);
    expect(batch.length).toBeGreaterThan(0);
    expect(batch.length).toBeLessThan(2000);
    expect(Buffer.byteLength(JSON.stringify(batch))).toBeLessThanOrEqual(REPORT_BYTES);
    expect(Buffer.byteLength(JSON.stringify(lines.slice(0, batch.length + 1)))).toBeGreaterThan(REPORT_BYTES);
  });
});

describe('runOutcome (PRD 2223)', () => {
  const prd = parsePrd(2223);

  it('reads the last non-empty line: yolo-fix is answers, yolo held, pr-care ready', () => {
    expect(runOutcome('Done: ok\n/omni:yolo-fix 2223\n', prd)).toBe('answers');
    expect(runOutcome('Done: ok\n/omni:yolo 2223', prd)).toBe('held');
    expect(runOutcome('Done: ok\n/omni:pr-care 2223\n', prd)).toBe('ready');
  });

  it('skips trailing blank lines and the runner\'s time stamp', () => {
    expect(runOutcome('x\n14:03:09 /omni:yolo-fix 2223\n\n  \n', prd)).toBe('answers');
  });

  it('skips the lines claude prints once a session hook fails after the hand-off (#2388)', () => {
    const hook = 'SessionEnd hook [node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" heartbeat --end || true] failed: Hook cancelled';
    expect(runOutcome(`09:36:39 /omni:yolo 2223\n${hook}\n`, prd)).toBe('held');
    expect(runOutcome(`09:36:39 /omni:yolo 2223\nStop hook [x] failed: exit 1\n${hook}\n`, prd)).toBe('held');
  });

  it('is null for another PRD, another line, a line that only mentions one, or no final message', () => {
    expect(runOutcome('/omni:yolo-fix 2224\n', prd)).toBeNull();
    expect(runOutcome('/omni:yolo-fix 22230\n', prd)).toBeNull();
    expect(runOutcome('/omni:plan 2223\n', prd)).toBeNull();
    expect(runOutcome('then run /omni:yolo-fix 2223 later\n', prd)).toBeNull();
    expect(runOutcome('/omni:yolo-fix 2223\nDone\n', prd)).toBeNull();
    expect(runOutcome('', prd)).toBeNull();
    expect(runOutcome('\n\n', prd)).toBeNull();
  });
});

describe('runOutcome of a yolo job (PRD 2375)', () => {
  const prd = parsePrd(2375);

  it.each(['yolo', 'yolo-fix'] as const)('is stopped for a %s job whose last line is no hand-off for its PRD', (skill) => {
    expect(runOutcome('built two sub-PRs\nDone\n', prd, skill)).toBe('stopped');
    expect(runOutcome('/omni:yolo-fix 2374\n', prd, skill)).toBe('stopped');
    expect(runOutcome('/omni:plan 2375\n', prd, skill)).toBe('stopped');
    expect(runOutcome('', prd, skill)).toBe('stopped');
  });

  it('keeps the hand-off of a yolo job, and stays null for any other job', () => {
    expect(runOutcome('/omni:yolo-fix 2375\n', prd, 'yolo')).toBe('answers');
    expect(runOutcome('/omni:yolo 2375\n', prd, 'yolo-fix')).toBe('held');
    expect(runOutcome('/omni:pr-care 2375\n', prd, 'yolo')).toBe('ready');
    expect(runOutcome('Done\n', prd)).toBeNull();
  });
});

describe('a mega bug fix that a rerun can finish', () => {
  const issue = parseIssue(381);

  it('reads the issue a job names, by number or URL, and none for a description', () => {
    expect(fixIssueOf('381')).toBe(381);
    expect(fixIssueOf('#381')).toBe(381);
    expect(fixIssueOf(' https://github.com/acme/plan/issues/381 ')).toBe(381);
    expect(fixIssueOf('https://github.com/acme/plan/pull/381')).toBeNull();
    expect(fixIssueOf('https://github.com/acme/plan/issues/381#issuecomment-1')).toBeNull();
    expect(fixIssueOf('the total is wrong on 381 invoices')).toBeNull();
    expect(fixIssueOf('#0')).toBeNull();
  });

  it('is stopped when the hand-off ends on the line that resumes the issue, the stamp and a failed hook after it ignored', () => {
    expect(fixOutcome('The fix stopped short.\n\n/omni:mega-bug-fix #381\n', issue)).toBe('stopped');
    expect(fixOutcome('x\n17:28:28 /omni:mega-bug-fix #381\nStop hook [x] failed: exit 1\n', issue)).toBe('stopped');
  });

  it('stays null for a fix that ended, another issue, or the line said in passing', () => {
    expect(fixOutcome('> Review the PRs and merge them in this order, the record PR last.\n', issue)).toBeNull();
    expect(fixOutcome('/omni:mega-bug-fix #382\n', issue)).toBeNull();
    expect(fixOutcome('/omni:mega-bug-fix #3810\n', issue)).toBeNull();
    expect(fixOutcome('/omni:mega-brainstorm the total is wrong\n', issue)).toBeNull();
    expect(fixOutcome('resume with /omni:mega-bug-fix #381 later\n', issue)).toBeNull();
    expect(fixOutcome('/omni:mega-bug-fix #381\nNothing was merged.\n', issue)).toBeNull();
    expect(fixOutcome('', issue)).toBeNull();
  });
});

describe('the yolo hand-off\'s last lines (PRD 2223)', () => {
  it('are the three lines runOutcome reads, so a change in the skill fails here', () => {
    const skill = readFileSync(new URL('../../plugin/skills/yolo/SKILL.md', import.meta.url), 'utf8');
    for (const [line, outcome] of [['/omni:pr-care <n>', 'ready'], ['/omni:yolo-fix <n>', 'answers'], ['/omni:yolo <n>', 'held']] as const) {
      expect(skill).toContain(`\n${line}\n`);
      expect(runOutcome(line.replace('<n>', '9'), parsePrd(9))).toBe(outcome);
    }
    expect(skill).toContain('`/omni:pr-care <n>`, `/omni:yolo-fix <n>` or `/omni:yolo <n>`');
  });
});
