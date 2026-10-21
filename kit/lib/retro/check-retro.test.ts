// PRD 2338, s1: the retros' outcomes, graded — each one sound, and, for the retro a retro PR carries,
// one for every kept lesson.
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import { parsePrd } from '../ids.ts';
import { gradeRetros } from './check-retro.ts';

const D = '.omni-loop/delivery';
const TESTING = '.omni-loop/knowledge/playbook/testing.md';
const FORM = formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'never', required: true, by: 'human', body: '- A test never calls the network.' }, { id: 'levels', body: '' }] });
const RED = 'repeated-red:check';
const CHURN = 'churn:a.ts';

type Run = { run?: string; issues?: Record<string, number>; outcomes?: Record<string, unknown> };

/** A `retro.json` for PRD `prd`, its runs as given, each issue `{ number, url, state }` as the app writes it. */
function retro(prd: number, ...runs: Run[]): string {
  const records = runs.map(({ run = 'merge', issues = {}, outcomes }) => ({
    run,
    findings: [],
    lessons: [{ text: 'A lesson.', findings: Object.keys(issues) }],
    issues: Object.fromEntries(Object.entries(issues).map(([id, number]) => [id, { number, url: `https://github.com/acme/widgets/issues/${String(number)}`, state: 'open' }])),
    ...(outcomes ? { outcomes } : {}),
  }));
  return `${JSON.stringify({ prd, runs: records }, null, 2)}\n`;
}

function grade(files: Record<string, string>, retroPrd: number | null = null) {
  const { ctx } = makeRepo({ files: { [TESTING]: FORM, ...files } });
  return gradeRetros({ ctx, retro: retroPrd === null ? null : parsePrd(retroPrd) });
}

describe('gradeRetros', () => {
  it('passes a repository with no retro', () => {
    expect(grade({})).toEqual({ violations: [], retros: 0, outcomes: 0, kept: null });
  });

  it('passes a retro from before PRD 2338, which keeps lessons and gives none an outcome', () => {
    const files = { [`${D}/shipped/0042-a/retro.json`]: retro(42, { issues: { [RED]: 101 } }) };
    expect(grade(files)).toEqual({ violations: [], retros: 1, outcomes: 0, kept: null });
  });

  it('passes outcomes that resolve, in the inbox and in shipped, counting them', () => {
    const files = {
      [`${D}/inbox/0007-b/retro.json`]: retro(7, { issues: { [RED]: 11 }, outcomes: { [RED]: { became: 'playbook/testing#never' } } }),
      [`${D}/shipped/0042-a/retro.json`]: retro(42, { issues: { [CHURN]: 12 }, outcomes: { [CHURN]: { staysHere: 'playbook/testing#never already says it' } } }),
    };
    expect(grade(files)).toEqual({ violations: [], retros: 2, outcomes: 2, kept: null });
  });

  it('refuses a became naming a blank slot, a missing slot or a form the kit has not, naming the file, the PRD, the lesson, its issue and why', () => {
    const file = `${D}/shipped/0042-a/retro.json`;
    const outcomes = { [RED]: { became: 'playbook/testing#levels' }, [CHURN]: { became: 'playbook/testing#flaky' }, other: { became: 'playbook/tests#never' } };
    const { violations } = grade({ [file]: retro(42, { issues: { [RED]: 101, [CHURN]: 102 }, outcomes }) });
    expect(violations).toEqual([
      `${file}: PRD 42, lesson \`${RED}\` (#101): became playbook/testing#levels does not resolve — ${TESTING}: slot "levels" is blank`,
      `${file}: PRD 42, lesson \`${CHURN}\` (#102): became playbook/testing#flaky does not resolve — ${TESTING} has no slot "flaky"`,
      `${file}: PRD 42, lesson \`other\`: became playbook/tests#never does not resolve — the kit has no form "tests"`,
    ]);
  });

  it('refuses a became when the form file is missing', () => {
    const file = `${D}/shipped/0042-a/retro.json`;
    const { ctx } = makeRepo({ files: { [file]: retro(42, { issues: { [RED]: 101 }, outcomes: { [RED]: { became: 'playbook/testing#never' } } }) } });
    expect(gradeRetros({ ctx, retro: null }).violations).toEqual([
      `${file}: PRD 42, lesson \`${RED}\` (#101): became playbook/testing#never does not resolve — no form file at ${TESTING}`,
    ]);
  });

  it('refuses a staysHere with no reason, and a value that is no outcome', () => {
    const file = `${D}/shipped/0042-a/retro.json`;
    const outcomes = { [RED]: { staysHere: '  ' }, [CHURN]: { became: 'playbook/testing#never', staysHere: 'both' } };
    expect(grade({ [file]: retro(42, { issues: { [RED]: 101, [CHURN]: 102 }, outcomes }) }).violations).toEqual([
      `${file}: PRD 42, lesson \`${RED}\` (#101): stays here with no reason`,
      `${file}: PRD 42, lesson \`${CHURN}\` (#102): the outcome is neither { became } nor { staysHere }`,
    ]);
  });

  it('grades the outcomes of every run, the day-14 run included', () => {
    const file = `${D}/shipped/0042-a/retro.json`;
    const text = retro(42, { issues: { [RED]: 101 }, outcomes: { [RED]: { became: 'playbook/testing#never' } } }, { run: 'day-14', issues: { [CHURN]: 102 }, outcomes: { [CHURN]: { staysHere: '' } } });
    expect(grade({ [file]: text })).toEqual({ violations: [`${file}: PRD 42, lesson \`${CHURN}\` (#102): stays here with no reason`], retros: 1, outcomes: 2, kept: null });
  });

  it('refuses a retro.json that is not JSON, or not a retro record, naming what is wrong', () => {
    const a = `${D}/shipped/0042-a/retro.json`;
    const b = `${D}/shipped/0043-b/retro.json`;
    const c = `${D}/shipped/0044-c/retro.json`;
    const { violations, retros } = grade({
      [a]: '{ "prd": 42,',
      [b]: JSON.stringify({ prd: 43, runs: [{ run: 'merge', outcomes: [] }] }),
      [c]: JSON.stringify({ runs: [] }),
    });
    expect(retros).toBe(3);
    expect(violations).toHaveLength(3);
    expect(violations[0]).toMatch(new RegExp(`^${a}: not JSON — `));
    expect(violations[1]).toMatch(new RegExp(`^${b}: not a retro record — runs\\.0\\.outcomes: `));
    expect(violations[2]).toMatch(new RegExp(`^${c}: not a retro record — prd: `));
  });

  it('reads only the retro.json of a PRD folder, never one elsewhere in the delivery folder', () => {
    const files = { [`${D}/inbox/concepts/0003-c/retro.json`]: '{', [`${D}/shipped/notes/retro.json`]: '{', [`${D}/retro.json`]: '{' };
    expect(grade(files)).toEqual({ violations: [], retros: 0, outcomes: 0, kept: null });
  });

  describe('with --retro, the retro PR’s own PRD', () => {
    const file = `${D}/shipped/0042-a/retro.json`;

    it('passes when every kept lesson has an outcome, counting them', () => {
      const text = retro(42, { issues: { [RED]: 101, [CHURN]: 102 }, outcomes: { [RED]: { became: 'playbook/testing#never' }, [CHURN]: { staysHere: 'not about how to work here' } } });
      expect(grade({ [file]: text }, 42)).toEqual({ violations: [], retros: 1, outcomes: 2, kept: 2 });
    });

    it('refuses each kept lesson that has no outcome, naming the PRD, the lesson and its issue', () => {
      const text = retro(42, { issues: { [RED]: 101, [CHURN]: 102 }, outcomes: { [RED]: { became: 'playbook/testing#never' } } });
      expect(grade({ [file]: text }, 42).violations).toEqual([
        `${file}: PRD 42, lesson \`${CHURN}\` (#102): kept, with no outcome — it becomes a rule (became: playbook/<form>#<slot>) or stays here (staysHere: <why>)`,
      ]);
    });

    it('counts a lesson the day-14 run kept, and an outcome a later run records for a lesson an earlier run kept', () => {
      const settled = retro(42, { issues: { [RED]: 101 } }, { run: 'day-14', issues: { [CHURN]: 102 }, outcomes: { [RED]: { became: 'playbook/testing#never' }, [CHURN]: { staysHere: 'why' } } });
      expect(grade({ [file]: settled }, 42)).toEqual({ violations: [], retros: 1, outcomes: 2, kept: 2 });
      const open = retro(42, { issues: { [RED]: 101 }, outcomes: { [RED]: { became: 'playbook/testing#never' } } }, { run: 'day-14', issues: { [CHURN]: 102 } });
      expect(grade({ [file]: open }, 42).violations).toEqual([expect.stringContaining(`lesson \`${CHURN}\` (#102): kept, with no outcome`)]);
    });

    it('counts a lesson both runs kept once', () => {
      const text = retro(42, { issues: { [RED]: 101 } }, { run: 'day-14', issues: { [RED]: 101 }, outcomes: { [RED]: { staysHere: 'why' } } });
      expect(grade({ [file]: text }, 42)).toMatchObject({ violations: [], kept: 1 });
    });

    it('passes a retro that keeps no lesson', () => {
      expect(grade({ [file]: retro(42, { issues: {} }) }, 42)).toEqual({ violations: [], retros: 1, outcomes: 0, kept: 0 });
    });

    it('asks nothing of another PRD’s retro', () => {
      const files = { [file]: retro(42, { issues: { [RED]: 101 }, outcomes: { [RED]: { staysHere: 'why' } } }), [`${D}/shipped/0007-b/retro.json`]: retro(7, { issues: { [RED]: 11 } }) };
      expect(grade(files, 42)).toEqual({ violations: [], retros: 2, outcomes: 1, kept: 1 });
    });

    it('refuses a PRD with no folder, and a folder with no retro.json', () => {
      expect(grade({}, 42).violations).toEqual([`PRD 42: no folder in ${D}/inbox or ${D}/shipped — its retro cannot be read`]);
      expect(grade({ [`${D}/shipped/0042-a/spec.md`]: 'x' }, 42).violations).toEqual([`${file}: missing — PRD 42's retro PR holds its retro here`]);
    });

    it('refuses a retro it cannot read, once', () => {
      expect(grade({ [file]: '{' }, 42).violations).toEqual([expect.stringMatching(new RegExp(`^${file}: not JSON — `))]);
    });
  });
});
