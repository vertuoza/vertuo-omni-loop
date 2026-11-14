// PRD 790, slice s3: the `review` form — the rubric `/omni:pr-care` judges each review thread
// against. Three slots, `fix`, `push-back` and `ask`, whose kit defaults are the spec's; `omni kb
// show review` prints them wherever a repository has no review form, and a repository's own
// section wins over its default. PRD 2871, s1: a fourth, optional, `look-for`: what the Reviewer
// looks for, the kit default's six items in order of harm.
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { formText as fixtureFormText, makeRepo } from '../../test/fixture.ts';
import { FORMS, parseForm } from './forms.ts';
import { formTemplate } from './templates.ts';
import { assertDefined } from '../../test/assert.ts';

/** `formText`'s options, typed here until `kit/test/fixture.ts` is (PRD 725, s17). */
type FormTextOptions = {
  frontMatter?: Record<string, unknown>;
  title?: string;
  opener?: string | null;
  slots?: { id: string; heading?: string; required?: boolean; by?: string | null; verified?: string | null; marker?: string | null; body?: string }[];
};
const formText = fixtureFormText as (options?: FormTextOptions) => string;

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const REVIEW = '.omni-loop/knowledge/playbook/review.md';

async function omni(root: string, argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const io = { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
  const code = await main(argv, io);
  return { code, out: out.join(''), err: err.join('') };
}

const slotText = (id: string) => {
  const { form } = parseForm(formTemplate('review'));
  assertDefined(form, 'the review form');
  const slot = form.slots.find((candidate) => candidate.id === id);
  assertDefined(slot, `the ${id} slot`);
  return slot.body.text;
};

describe('the review form', () => {
  it('is an extended form with its slots fix, push-back and ask, each required, then look-for, optional', () => {
    const review = FORMS.find((form) => form.id === 'review');
    assertDefined(review, 'review');
    expect(review).toMatchObject({ kind: 'extended', pointerOnly: false });
    expect(review.slots).toEqual([
      { id: 'fix', required: true },
      { id: 'push-back', required: true },
      { id: 'ask', required: true },
      { id: 'look-for', required: false },
    ]);
  });

  it('carries the spec’s kit default in each slot', () => {
    for (const phrase of ['a bug, a security problem, data loss', 'duplicated code', 'a missing or weak test', 'convention or law', 'misleading']) {
      expect(slotText('fix'), phrase).toContain(phrase);
    }
    for (const phrase of ['naming taste', 'no linter enforces', 'while you’re here', 'no defect named', 'the spec already answers']) {
      expect(slotText('push-back'), phrase).toContain(phrase);
    }
    for (const phrase of ['product decision', 'contradicts the spec']) {
      expect(slotText('ask'), phrase).toContain(phrase);
    }
    for (const phrase of ['**Correctness:**', '**Security and data:**', '**Tests that prove it:**', '**Scope:**', '**Laws and conventions:**', '**Design and complexity:**', 'never removes one']) {
      expect(slotText('look-for'), phrase).toContain(phrase);
    }
  });

  it('its template, laid down as the repository’s review form, passes the playbook check', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [REVIEW]: formTemplate('review') } });
    const { code, err } = await omni(root, ['check', 'kb']);
    expect(code).toBe(0);
    expect(err.split('\n').filter((line) => line.includes(REVIEW))).toEqual([]);
  });
});

describe('omni kb show review', () => {
  it('prints the fix, push-back, ask and look-for slots at their kit default when the repository has no review form', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await omni(root, ['kb', 'show', 'review']);
    expect(code).toBe(0);
    expect(out.match(/^## .*$/gm)).toEqual(['## Fix  [kit default]', '## Push back  [kit default]', '## Ask  [kit default]', '## Look for  [kit default]']);
    expect(out).toContain('1. **Correctness:** the diff does what the spec says');
    expect(out).toContain('duplicated code');
    expect(out).toContain('naming taste');
    expect(out).toContain('product decision');
  });

  it('prints a repository’s own section in place of the default, and the default where it left one out', async () => {
    const mine = formText({
      frontMatter: { form: 'review', state: 'filled' },
      title: 'Review',
      opener: 'Use this page when a reviewer’s comment on a pull request needs an answer.',
      slots: [{ id: 'fix', heading: 'Fix', required: true, body: '- A misleading name, including naming taste.' }],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [REVIEW]: mine } });
    const { code, out } = await omni(root, ['kb', 'show', 'review']);
    expect(code).toBe(0);
    expect(out).toContain('## Fix  [repo]\n- A misleading name, including naming taste.\n');
    expect(out).toContain('## Push back  [kit default]');
    expect(out).toContain('## Ask  [kit default]');
    expect(out).toContain('## Look for  [kit default]');
  });

  it('prints look-for with the kit default when the repository left it blank', async () => {
    const mine = formText({
      frontMatter: { form: 'review', state: 'filled' },
      title: 'Review',
      opener: 'Use this page when a reviewer’s comment on a pull request needs an answer.',
      slots: [
        { id: 'fix', heading: 'Fix', required: true, body: 'Ours.' },
        { id: 'push-back', heading: 'Push back', required: true, body: 'Ours.' },
        { id: 'ask', heading: 'Ask', required: true, body: 'Ours.' },
        { id: 'look-for', heading: 'Look for', required: false, body: '' },
      ],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [REVIEW]: mine } });
    const { code, out } = await omni(root, ['kb', 'show', 'review']);
    expect(code).toBe(0);
    expect(out).toContain('## Look for  [kit default]\n');
    expect(out).toContain('6. **Design and complexity:**');
  });

  it('passes the playbook check for a review form written before look-for, which has no such section', async () => {
    const before = formText({
      frontMatter: { form: 'review', state: 'filled' },
      title: 'Review',
      opener: 'Use this page when a reviewer’s comment on a pull request needs an answer.',
      slots: [
        { id: 'fix', heading: 'Fix', required: true, body: 'Ours.' },
        { id: 'push-back', heading: 'Push back', required: true, body: 'Ours.' },
        { id: 'ask', heading: 'Ask', required: true, body: 'Ours.' },
      ],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [REVIEW]: before } });
    const { code, err } = await omni(root, ['check', 'kb']);
    expect(code).toBe(0);
    expect(err.split('\n').filter((line) => line.includes(REVIEW))).toEqual([]);
  });
});
