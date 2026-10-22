// PRD 2338, s1: a kept lesson's outcome — the schema `retro.json` keeps it by, the one line that
// renders it, and what makes one unsound.
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import { LessonOutcomeSchema, LessonOutcomesSchema, outcomeLine, outcomeProblem } from './outcome.ts';

const TESTING = '.omni-loop/knowledge/playbook/testing.md';
const testingForm = (body: string) => formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'never', required: true, by: 'human', body }] });

describe('LessonOutcomeSchema', () => {
  it('takes a became or a staysHere, each as written', () => {
    expect(LessonOutcomeSchema.parse({ became: 'playbook/testing#never' })).toEqual({ became: 'playbook/testing#never' });
    expect(LessonOutcomeSchema.parse({ staysHere: 'the testing form already says it' })).toEqual({ staysHere: 'the testing form already says it' });
  });

  it('refuses both at once, neither, another key, or a value that is not text', () => {
    for (const value of [
      { became: 'playbook/testing#never', staysHere: 'why' },
      {},
      { became: 'playbook/testing#never', why: 'x' },
      { became: 3 },
      { staysHere: null },
      'playbook/testing#never',
      null,
    ]) {
      expect(LessonOutcomeSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
    }
  });

  it('keeps the outcomes of a run by the finding each lesson was kept for', () => {
    const outcomes = { 'repeated-red:check': { became: 'playbook/testing#never' }, 'churn:a.ts': { staysHere: 'not about how to work here' } };
    expect(LessonOutcomesSchema.parse(outcomes)).toEqual(outcomes);
    expect(LessonOutcomesSchema.safeParse({ 'churn:a.ts': { why: 'x' } }).success).toBe(false);
  });
});

describe('outcomeLine', () => {
  it('renders a became as the slot it names, in code', () => {
    expect(outcomeLine({ became: 'playbook/testing#never' })).toBe('- **Became:** `playbook/testing#never`');
  });

  it('renders a staysHere as its reason, on one line', () => {
    expect(outcomeLine({ staysHere: 'playbook/conventions#naming already says it' })).toBe('- **Stays here:** playbook/conventions#naming already says it');
    expect(outcomeLine({ staysHere: '  not about\n  how to work   here \n' })).toBe('- **Stays here:** not about how to work here');
  });
});

describe('outcomeProblem', () => {
  it('passes a became naming a filled slot, and a staysHere with a reason', () => {
    const { ctx } = makeRepo({ files: { [TESTING]: testingForm('- A test never calls the network.') } });
    expect(outcomeProblem({ became: 'playbook/testing#never' }, { ctx })).toBeNull();
    expect(outcomeProblem({ staysHere: 'a rule already says it' }, { ctx })).toBeNull();
  });

  it('refuses a became naming a blank slot, a missing slot, a missing form file or a form the kit has not, saying why', () => {
    const blank = makeRepo({ files: { [TESTING]: testingForm('') } });
    expect(outcomeProblem({ became: 'playbook/testing#never' }, blank)).toBe(`became playbook/testing#never does not resolve — ${TESTING}: slot "never" is blank`);
    expect(outcomeProblem({ became: 'playbook/testing#levels' }, blank)).toBe(`became playbook/testing#levels does not resolve — ${TESTING} has no slot "levels"`);
    const none = makeRepo();
    expect(outcomeProblem({ became: 'playbook/testing#never' }, none)).toBe(`became playbook/testing#never does not resolve — no form file at ${TESTING}`);
    expect(outcomeProblem({ became: 'playbook/tests#never' }, none)).toBe('became playbook/tests#never does not resolve — the kit has no form "tests"');
  });

  it('refuses a became that names no playbook slot, a law included', () => {
    const { ctx } = makeRepo();
    expect(outcomeProblem({ became: 'BR-PRODUCT-3' }, { ctx })).toBe('became BR-PRODUCT-3 does not resolve — BR-PRODUCT-3: not playbook/<form>#<slot>');
    expect(outcomeProblem({ became: '' }, { ctx })).toBe('became names no playbook slot');
  });

  it('refuses a staysHere with no reason, blank or empty', () => {
    const { ctx } = makeRepo();
    expect(outcomeProblem({ staysHere: '' }, { ctx })).toBe('stays here with no reason');
    expect(outcomeProblem({ staysHere: ' \n\t ' }, { ctx })).toBe('stays here with no reason');
  });

  it('refuses a value that is no outcome', () => {
    const { ctx } = makeRepo();
    for (const value of [{ became: 'playbook/testing#never', staysHere: 'why' }, {}, { why: 'x' }, 'became', null]) {
      expect(outcomeProblem(value, { ctx }), JSON.stringify(value)).toBe('the outcome is neither { became } nor { staysHere }');
    }
  });
});
