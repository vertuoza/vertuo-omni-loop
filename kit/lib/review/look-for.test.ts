// PRD 2871, s1: what the Reviewer looks for — the kit default's six items in order of harm, then the
// repository's own `look-for` section, which adds to the default and never removes from it.
import { describe, expect, it } from 'vitest';
import { formText as fixtureFormText, makeRepo } from '../../test/fixture.ts';
import { lookFor, lookForItems } from './look-for.ts';

/** `formText`'s options, typed here until `kit/test/fixture.ts` is (PRD 725, s17). */
type FormTextOptions = {
  frontMatter?: Record<string, unknown>;
  title?: string;
  opener?: string | null;
  slots?: { id: string; heading?: string; required?: boolean; body?: string }[];
};
const formText = fixtureFormText as (options?: FormTextOptions) => string;

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const REVIEW = '.omni-loop/knowledge/playbook/review.md';
const DEFAULT_NAMES = ['Correctness', 'Security and data', 'Tests that prove it', 'Scope', 'Laws and conventions', 'Design and complexity'];

/** The bold name an item opens on: `**Correctness:** …` reads `Correctness`. */
const nameOf = (text: string) => /^\*\*(.+?):\*\*/.exec(text)?.[1] ?? text;

/** A repository whose review form's `look-for` section is `body`. */
const repoWith = (body: string) =>
  makeRepo({
    files: {
      ...CONFIG,
      [REVIEW]: formText({
        frontMatter: { form: 'review', state: 'filled' },
        title: 'Review',
        slots: [{ id: 'look-for', heading: 'Look for', required: false, body }],
      }),
    },
  });

describe('lookFor — the kit default', () => {
  it('is six items, in order of harm, where the repository writes no review form', () => {
    const items = lookFor({ ctx: makeRepo({ files: CONFIG }).ctx });
    expect(items.map(({ text }) => nameOf(text))).toEqual(DEFAULT_NAMES);
    expect(items.every(({ source }) => source === 'kit')).toBe(true);
    expect(items[0]?.text).toMatch(/the diff does what the spec says; edge cases, error paths, concurrency, data loss/);
    expect(items[2]?.text).toMatch(/no test loosened, skipped or deleted to go green/);
    expect(items[5]?.text).toMatch(/only as a defect, never as taste/);
  });

  it('is the same six where the repository left its look-for section blank', () => {
    expect(lookFor({ ctx: repoWith('').ctx }).map(({ text }) => nameOf(text))).toEqual(DEFAULT_NAMES);
  });
});

describe('lookFor — a repository’s own section extends the default', () => {
  it('follows the six with each item the repository adds, in its order', () => {
    const { ctx } = repoWith('- **Migrations:** every migration says how it is rolled back.\n- A new route has a rate limit.');
    const items = lookFor({ ctx });
    expect(items.map(({ text }) => nameOf(text))).toEqual([...DEFAULT_NAMES, 'Migrations', 'A new route has a rate limit.']);
    expect(items.slice(6).map(({ source }) => source)).toEqual(['repo', 'repo']);
  });

  it('never loses a default item, even when the repository’s section names only one of them', () => {
    const { ctx } = repoWith('1. **Correctness:** the diff does what the spec says; edge cases, error paths, concurrency, data loss.');
    expect(lookFor({ ctx }).map(({ text }) => nameOf(text))).toEqual(DEFAULT_NAMES);
  });
});

describe('lookForItems — list items, read from a section', () => {
  const KIT = 'In order of harm:\n\n1. **One:** first.\n2. **Two:** second,\n   on two lines.\n';

  it('reads each numbered or bulleted item, a wrapped one joined into one line, and leaves the prose out', () => {
    expect(lookForItems(KIT, null)).toEqual([
      { text: '**One:** first.', source: 'kit' },
      { text: '**Two:** second, on two lines.', source: 'kit' },
    ]);
  });

  it('drops an added item that repeats a default one, whatever its spacing, case or list mark', () => {
    const own = { text: '- **two:**   second, on two lines.\n* Three.', source: 'repo' };
    expect(lookForItems(KIT, own).map(({ text }) => text)).toEqual(['**One:** first.', '**Two:** second, on two lines.', 'Three.']);
  });

  it('adds nothing for a section that holds no list item', () => {
    expect(lookForItems(KIT, { text: 'The kit’s six come first.', source: 'omni-settings' })).toHaveLength(2);
  });
});
