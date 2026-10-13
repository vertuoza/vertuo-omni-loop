// PRD 1679, s1: the context measure on a fixture repository — a briefing, two forms (one whose
// section points at a guide), two `paths.context` files — each count the bytes `resolveForm` prints.
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import { briefingLaws } from '../knowledge/briefing-laws.ts';
import { DECISIONS_FORM, FORM_IDS } from '../playbook/forms.ts';
import { readDecisions } from '../playbook/decisions.ts';
import { resolveForm } from '../playbook/resolve.ts';
import { formTemplate } from '../playbook/templates.ts';
import { BRIEFING, SESSION, formShowText, measureContextBudget } from './measure.ts';
import type { Measure } from './measure.ts';
import type { Context } from '../context.ts';

const PLAYBOOK = '.omni-loop/knowledge/playbook';
const GUIDE = 'guides/testing.md';
const GUIDE_TEXT = 'Run the whole suite before every push.\n'.repeat(40);

const BRIEFING_FORM = formText({
  frontMatter: { form: 'briefing', state: 'filled' },
  title: 'Briefing',
  slots: [{ id: 'never', required: true, body: 'Never merge into the default branch.' }],
});
const TESTING_FORM = formText({
  frontMatter: { form: 'testing', state: 'filled' },
  slots: [{ id: 'commands', required: true, body: `See: ${GUIDE}` }],
});
const SETUP_FORM = formText({
  frontMatter: { form: 'setup', state: 'filled' },
  title: 'Setup',
  slots: [{ id: 'install', required: true, body: 'Install the dependencies once.' }],
});

function fixture({ context = ['CLAUDE.md', 'AGENTS.md'], files = {} }: { context?: string[]; files?: Record<string, string> } = {}) {
  return makeRepo({
    config: { paths: { context } },
    files: {
      [`${PLAYBOOK}/briefing.md`]: BRIEFING_FORM,
      [`${PLAYBOOK}/testing.md`]: TESTING_FORM,
      [`${PLAYBOOK}/setup.md`]: SETUP_FORM,
      [GUIDE]: GUIDE_TEXT,
      'CLAUDE.md': '# Claude\nRead the briefing first.\n',
      'AGENTS.md': '# Agents — ünïcode counts in bytes\n',
      ...files,
    },
  });
}

/** The bytes `omni kb show <form>` prints for `form`, its last newline counted. */
function printed(ctx: Context, form: string): number {
  const resolved = resolveForm(form, { ctx, template: formTemplate(form) });
  const records = form === DECISIONS_FORM ? readDecisions({ ctx }) : null;
  const laws = form === BRIEFING ? briefingLaws(ctx).lines : null;
  return Buffer.byteLength(`${formShowText(resolved, records, laws)}\n`);
}

const byTarget = (measures: readonly Measure[]) => new Map(measures.map((one) => [one.target, one]));
const bytesOf = (measures: readonly Measure[], target: string): number => {
  const one = byTarget(measures).get(target);
  if (one === undefined || !('bytes' in one)) throw new Error(`${target} has no size: ${JSON.stringify(one)}`);
  return one.bytes;
};

describe('measureContextBudget (PRD 1679)', () => {
  it('names briefing, every other form, every context file and session, in that order', () => {
    const { ctx } = fixture();
    const targets = measureContextBudget({ ctx }).map(({ target }) => target);
    expect(targets).toEqual([
      BRIEFING,
      ...FORM_IDS.filter((form) => form !== BRIEFING).map((form) => `form:${form}`),
      'context:CLAUDE.md',
      'context:AGENTS.md',
      SESSION,
    ]);
  });

  it('measures each form as kb show prints it, the pointer expanded', () => {
    const { ctx } = fixture();
    const measures = measureContextBudget({ ctx });
    expect(bytesOf(measures, BRIEFING)).toBe(printed(ctx, BRIEFING));
    for (const form of FORM_IDS.filter((id) => id !== BRIEFING)) expect(bytesOf(measures, `form:${form}`)).toBe(printed(ctx, form));
    const testing = bytesOf(measures, 'form:testing');
    expect(testing).toBeGreaterThan(Buffer.byteLength(GUIDE_TEXT));
    expect(testing).toBeGreaterThan(Buffer.byteLength(TESTING_FORM));
  });

  it('grows a pointing form with the page it points at, not with its own file', () => {
    const small = measureContextBudget({ ctx: fixture().ctx });
    const large = measureContextBudget({ ctx: fixture({ files: { [GUIDE]: `${'x'.repeat(5000)}${GUIDE_TEXT}` } }).ctx });
    expect(bytesOf(large, 'form:testing') - bytesOf(small, 'form:testing')).toBe(5000);
    expect(bytesOf(large, BRIEFING)).toBe(bytesOf(small, BRIEFING));
  });

  it('measures a context file in bytes, not characters', () => {
    const measures = measureContextBudget({ ctx: fixture().ctx });
    expect(bytesOf(measures, 'context:AGENTS.md')).toBe(Buffer.byteLength('# Agents — ünïcode counts in bytes\n'));
    expect(bytesOf(measures, 'context:CLAUDE.md')).toBe(Buffer.byteLength('# Claude\nRead the briefing first.\n'));
  });

  it('sums briefing and every context file into session', () => {
    const measures = measureContextBudget({ ctx: fixture().ctx });
    expect(bytesOf(measures, SESSION)).toBe(bytesOf(measures, BRIEFING) + bytesOf(measures, 'context:CLAUDE.md') + bytesOf(measures, 'context:AGENTS.md'));
    const alone = measureContextBudget({ ctx: fixture({ context: [] }).ctx });
    expect(bytesOf(alone, SESSION)).toBe(bytesOf(alone, BRIEFING));
  });

  it('makes a missing context file a measurement error naming it, and session one too', () => {
    const measures = byTarget(measureContextBudget({ ctx: fixture({ context: ['CLAUDE.md', 'GONE.md'] }).ctx }));
    expect(measures.get('context:GONE.md')).toEqual({ target: 'context:GONE.md', error: 'GONE.md does not exist' });
    expect(measures.get(SESSION)).toEqual({ target: SESSION, error: 'cannot sum context:GONE.md' });
    expect(measures.get('context:CLAUDE.md')).toHaveProperty('bytes');
  });

  it('makes a folder named as a context file a measurement error', () => {
    const measures = byTarget(measureContextBudget({ ctx: fixture({ context: ['guides'] }).ctx }));
    expect(measures.get('context:guides')).toEqual({ target: 'context:guides', error: 'guides does not exist' });
  });

  it('makes a pointer that leads nowhere a measurement error naming the page', () => {
    const { ctx } = fixture({ files: { [`${PLAYBOOK}/testing.md`]: TESTING_FORM.replace(GUIDE, 'guides/gone.md') } });
    const testing = byTarget(measureContextBudget({ ctx })).get('form:testing');
    expect(testing).toHaveProperty('error');
    expect(testing && 'error' in testing ? testing.error : '').toMatch(/guides\/gone\.md does not exist/);
  });

  it('makes a briefing that leads nowhere an error of session too', () => {
    const briefing = BRIEFING_FORM.replace('Never merge into the default branch.', 'See: guides/gone.md');
    const measures = byTarget(measureContextBudget({ ctx: fixture({ files: { [`${PLAYBOOK}/briefing.md`]: briefing } }).ctx }));
    expect(measures.get(BRIEFING)).toHaveProperty('error');
    expect(measures.get(SESSION)).toEqual({ target: SESSION, error: 'cannot sum briefing' });
  });

  it('measures a form with no file at its kit default', () => {
    const { ctx } = fixture();
    expect(bytesOf(measureContextBudget({ ctx }), 'form:review')).toBe(printed(ctx, 'review'));
  });
});
