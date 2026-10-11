// PRD 1369, slice s1: the `design` form — what a screen of this product should look like, read by
// every design step through `omni kb show design`. Four slots: `product` and `system`, required,
// with no kit default (only the repository knows them, so they show as `[hole]` until filled), and
// `deliberate` and `review`, optional and empty. Its opener says the product wins over the craft
// floor and the refuse list; a repository that already writes its design system down points the
// form at it.
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
const DESIGN = '.omni-loop/knowledge/playbook/design.md';

async function omni(root: string, argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const io = { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
  const code = await main(argv, io);
  return { code, out: out.join(''), err: err.join('') };
}

const template = () => {
  const { form } = parseForm(formTemplate('design'));
  assertDefined(form, 'the design form');
  return form;
};

describe('the design form', () => {
  it('is an extended form with its four slots: product and system required, deliberate and review optional', () => {
    const design = FORMS.find((form) => form.id === 'design');
    assertDefined(design, 'design');
    expect(design).toMatchObject({ kind: 'extended', pointerOnly: false });
    expect(design.slots).toEqual([
      { id: 'product', required: true },
      { id: 'system', required: true },
      { id: 'deliberate', required: false },
      { id: 'review', required: false },
    ]);
  });

  it('opens by saying the product wins over the craft floor and the refuse list', () => {
    expect(template().opener).toMatch(/^Use this page when .*screen/);
    expect(template().opener).toContain('The product wins over the craft floor and the refuse list.');
  });

  it('leaves product and system as questions for a person, and deliberate and review empty', () => {
    const kinds = Object.fromEntries(template().slots.map((slot) => [slot.id, slot.body.kind]));
    expect(kinds).toEqual({ product: 'holes', system: 'holes', deliberate: 'empty', review: 'empty' });
  });

  it('its template, laid down as the repository’s design form, passes the playbook check, its questions as warnings', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [DESIGN]: formTemplate('design') } });
    const { code, err } = await omni(root, ['check', 'kb']);
    expect(code).toBe(0);
    const mine = err.split('\n').filter((line) => line.includes(DESIGN));
    expect(mine).toHaveLength(2);
    expect(mine.every((line) => line.includes('TODO(human)'))).toBe(true);
  });
});

describe('omni kb show design', () => {
  it('prints four sections in a repository that never filled it: product and system as holes, deliberate and review empty', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await omni(root, ['kb', 'show', 'design']);
    expect(code).toBe(0);
    expect(out.match(/^## .*$/gm)).toEqual(['## Product  [hole]', '## System  [hole]', '## Deliberate  [kit default]', '## Review  [kit default]']);
    expect(out).toMatch(/^## Product {2}\[hole\]\nTODO\(human\): Who uses this product/m);
    expect(out).toMatch(/^## System {2}\[hole\]\nTODO\(human\): Where do the design tokens/m);
    expect(out).toMatch(/## Deliberate {2}\[kit default\]\n\n## Review {2}\[kit default\]\n?$/);
    expect(out.match(/TODO\(human\)/g)).toHaveLength(2);
  });

  it('prints a repository’s own section as [repo], and the holes it left where it wrote nothing', async () => {
    const mine = formText({
      frontMatter: { form: 'design', state: 'filled' },
      title: 'Design',
      opener: 'Use this page when you build or review a screen.',
      slots: [
        { id: 'product', heading: 'Product', required: true, body: 'Site managers on a phone, outdoors, in bright light.' },
        { id: 'deliberate', heading: 'Deliberate', required: false, body: 'Dense tables on purpose: no card grid.' },
      ],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [DESIGN]: mine } });
    const { code, out } = await omni(root, ['kb', 'show', 'design']);
    expect(code).toBe(0);
    expect(out).toContain('## Product  [repo]\nSite managers on a phone, outdoors, in bright light.\n');
    expect(out).toContain('## System  [hole]\nTODO(human): Where do the design tokens');
    expect(out).toContain('## Deliberate  [repo]\nDense tables on purpose: no card grid.\n');
    expect(out).toContain('## Review  [kit default]');
  });

  it('keeps a repository’s own open question in place of the kit’s', async () => {
    const mine = formText({
      frontMatter: { form: 'design', state: 'blank' },
      title: 'Design',
      opener: 'Use this page when you build or review a screen.',
      slots: [{ id: 'system', heading: 'System', required: true, body: 'TODO(human): Is the Figma library or the code the source of truth?' }],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [DESIGN]: mine } });
    const { out } = await omni(root, ['kb', 'show', 'design']);
    expect(out).toContain('## System  [hole]\nTODO(human): Is the Figma library or the code the source of truth?\n');
    expect(out).not.toContain('Where do the design tokens');
  });

  it('resolves a section that points at the repository’s DESIGN.md', async () => {
    const mine = formText({
      frontMatter: { form: 'design', state: 'filled' },
      title: 'Design',
      opener: 'Use this page when you build or review a screen.',
      slots: [{ id: 'system', heading: 'System', required: true, body: 'See: DESIGN.md' }],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [DESIGN]: mine, 'DESIGN.md': '# Design\n\nTokens live in src/theme/tokens.ts.\n' } });
    const { code, out } = await omni(root, ['kb', 'show', 'design']);
    expect(code).toBe(0);
    expect(out).toContain('## System  [→ DESIGN.md]\n# Design\n\nTokens live in src/theme/tokens.ts.\n');
  });

  it('resolves a whole design form that points at DESIGN.md', async () => {
    const pointer = '---\nform: design\nform-version: 1\nstate: pointer\npoints-to: DESIGN.md\nevidence: []\ninvaded: null\n---\n\n# Design\n';
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [DESIGN]: pointer, 'DESIGN.md': '# Design\n\nWarm greys, one accent.\n' } });
    const { code, out } = await omni(root, ['kb', 'show', 'design']);
    expect(code).toBe(0);
    expect(out).toContain('[→ DESIGN.md]\n# Design\n\nWarm greys, one accent.');
  });
});
