import { describe, expect, it } from 'vitest';
import { failedNames, finished, proveCi } from './ci.ts';
import type { CiJob, CiSide } from './ci.ts';

const TEST = 'saves once';
const RED_SHA = '1111111aaaa';
const GREEN_SHA = '2222222bbbb';

const job = (over: Partial<CiJob> = {}): CiJob => ({
  name: 'stories',
  status: 'completed',
  conclusion: 'success',
  url: 'https://github.com/acme/widgets/actions/runs/7/job/70',
  log: '',
  ...over,
});
const red = (over: Partial<CiJob> = {}): CiJob =>
  job({ conclusion: 'failure', log: `stories\tRun tests\t2026-11-02T10:00:00.000Z FAIL ${TEST}\nstories\tRun tests\t2026-11-02T10:00:01.000Z AssertionError: expected 2 to be 1\n`, ...over });
const green = (over: Partial<CiJob> = {}): CiJob => job({ log: `✓ ${TEST}\n`, ...over });
const side = (sha: string, ...jobs: CiJob[]): CiSide => ({ sha, jobs });
const prove = (reproduction: CiSide, fix: CiSide) => proveCi({ pr: 34, test: TEST, reproduction, fix });

describe('proveCi — level B (PRD 2578)', () => {
  it('proves the red and the green when a check failed naming the test, then passed on the fix commit', () => {
    const proof = prove(side(RED_SHA, red()), side(GREEN_SHA, green()));
    expect(proof).toEqual({
      ok: true,
      red: '#34 · 1111111 · job stories\nFAIL saves once\nAssertionError: expected 2 to be 1\nRun: https://github.com/acme/widgets/actions/runs/7/job/70\n',
      green: '#34 · 2222222 · job stories\n✓ saves once\nRun: https://github.com/acme/widgets/actions/runs/7/job/70\n',
    });
  });

  it('takes the lines around the test: five before, fourteen after', () => {
    const lines = Array.from({ length: 40 }, (_, index) => (index === 20 ? `FAIL ${TEST}` : `line ${index}`));
    const proof = prove(side(RED_SHA, red({ log: lines.join('\n') })), side(GREEN_SHA, green()));
    if (!proof.ok) throw new Error(proof.line);
    const shown = proof.red.split('\n').slice(1, -2);
    expect(shown[0]).toBe('line 15');
    expect(shown.at(-1)).toBe('line 34');
    expect(shown).toHaveLength(20);
  });

  it('shows the tail of a green log that does not name the test', () => {
    const lines = Array.from({ length: 30 }, (_, index) => `ok ${index}`);
    const proof = prove(side(RED_SHA, red()), side(GREEN_SHA, green({ log: lines.join('\n') })));
    if (!proof.ok) throw new Error(proof.line);
    const shown = proof.green.split('\n').slice(1, -2);
    expect(shown[0]).toBe('ok 10');
    expect(shown.at(-1)).toBe('ok 29');
  });

  it('masks a secret of the log in both excerpts', () => {
    const secret = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_');
    const proof = prove(
      side(RED_SHA, red({ log: `FAIL ${TEST} token ${secret}\n` })),
      side(GREEN_SHA, green({ log: `✓ ${TEST} Authorization: Bearer abc.def-123\n` })),
    );
    if (!proof.ok) throw new Error(proof.line);
    expect(proof.red).toContain('token [masked]');
    expect(proof.red).not.toContain('ghp_');
    expect(proof.green).toContain('Bearer [masked]');
    expect(proof.green).not.toContain('abc.def-123');
  });

  it('names a skipped job', () => {
    expect(prove(side(RED_SHA, job({ conclusion: 'skipped' })), side(GREEN_SHA, green()))).toEqual({ ok: false, line: 'job stories skipped' });
  });

  it('names a skipped job even when another check failed without naming the test', () => {
    const lint = red({ name: 'lint', log: 'eslint: 3 problems' });
    expect(prove(side(RED_SHA, lint, job({ conclusion: 'skipped' })), side(GREEN_SHA, green()))).toEqual({ ok: false, line: 'job stories skipped' });
  });

  it('says no failed log names the test', () => {
    expect(prove(side(RED_SHA, red({ log: 'something else failed' })), side(GREEN_SHA, green()))).toEqual({ ok: false, line: `no failed log names ${TEST}` });
  });

  it('says every check passed on the reproduction commit', () => {
    expect(prove(side(RED_SHA, green()), side(GREEN_SHA, green()))).toEqual({ ok: false, line: 'every check passed on 1111111' });
  });

  it('says the same job skipped, failed or did not run on the fix commit', () => {
    const repro = side(RED_SHA, red());
    expect(prove(repro, side(GREEN_SHA, job({ conclusion: 'skipped' })))).toEqual({ ok: false, line: 'job stories skipped' });
    expect(prove(repro, side(GREEN_SHA, red()))).toEqual({ ok: false, line: 'job stories did not pass on 2222222' });
    expect(prove(repro, side(GREEN_SHA, green({ name: 'lint' })))).toEqual({ ok: false, line: 'job stories did not run on 2222222' });
  });

  it('proves with the job of the fix commit that passed, among jobs of the same name', () => {
    const proof = prove(side(RED_SHA, red()), side(GREEN_SHA, job({ conclusion: 'cancelled' }), green()));
    expect(proof.ok).toBe(true);
  });
});

describe('finished and failedNames', () => {
  it('is finished only when there is a job and every one completed', () => {
    expect(finished(side(RED_SHA))).toBe(false);
    expect(finished(side(RED_SHA, green(), job({ status: 'in_progress', conclusion: '' })))).toBe(false);
    expect(finished(side(RED_SHA, green(), red()))).toBe(true);
  });

  it('names the failed jobs only', () => {
    expect(failedNames(side(RED_SHA, green({ name: 'lint' }), red()))).toEqual(['stories']);
  });
});
