import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { flatCtx } from '../../test/flat-layout.ts';
import type { Context } from '../context.ts';
import { lawsFor } from '../laws.ts';
import { makeMarkers } from '../markers.ts';
import { parseFrontMatterLines } from '../front-matter.ts';
import {
  FUN_LINE_MAX_LENGTH,
  FUN_SECTIONS,
  OPTION_LETTERS,
  OPTIONS_HEADING,
  PERSON_STEPS_HEADING,
  PLAIN_SECTIONS,
  RANK_ORDER,
  RANK_VALUES,
  REQUIRED_SECTIONS,
  bearsOnFloorsHigh,
  floorRank,
  funLineProblems,
  isBelowFloor,
  optionLettersInOrder,
  outboxItemFiles,
  parseOutboxItem,
  parseOutboxOptions,
  plainWordsProblems,
  resolveBearsOn,
} from './outbox.ts';
import type { ParsedOutboxItem } from './outbox.ts';
import { parseSettledEntries } from './settle.ts';
import type { OutboxItem, Rank } from '../types.ts';

/** A parse result read either way: a test checks `ok` first, then reads the side it expects. */
type EitherSide = { ok: boolean; item: OutboxItem; errors: string[] };
const view = (result: ParsedOutboxItem) => result as EitherSide;

/**
 * The laws every non-fixture test in this file injects. `floorsHigh` reproduces upstream's own
 * `bearsOnFloorsHigh` regex (equivalent to registers.mjs's `ID_SHAPE`) so the pure floorRank/
 * isBelowFloor cases below need no filesystem. `resolve` forwards to the real `lawsFor` (Task 4)
 * against `root`, which the resolveBearsOn fixture tests set before calling it — see
 * `kit/porting/outbox--outbox.md`.
 */
let root: string | undefined;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});
const laws = {
  source: 'knowledge',
  floorsHigh: (b: string) => /^(N\d+|(?:P|BR|N)-[A-Z0-9]+-\d+|X-[A-Z0-9]+-[A-Z0-9]+-\d+)$/.test(b),
  resolve: (b: string) => lawsFor(flatCtx(root) as unknown as Context).resolve(b),
};

const VALID_ITEM = [
  '---',
  'id: s2-01-example-item',
  'prd: 985',
  'slice: s2',
  'rank: medium',
  'bears-on: none',
  'raised: 2026-09-22',
  'wave: 2',
  '---',
  '',
  '## The question, in plain words',
  '',
  'Should the front matter look like a full markup format, or a simple list of labels and values?',
  '',
  '## The decision, in plain words',
  '',
  'We chose the simple list, because it is the smallest thing anyone can read back without doubt.',
  '',
  '## What I had to decide',
  '',
  'Whether the front matter uses YAML or a plain key: value block.',
  '',
  '## What I did meanwhile',
  '',
  'A plain key: value block — the smallest thing that reads back unambiguously.',
  '',
  '## What it costs to change later',
  '',
  'Swapping to full YAML would touch every item file already written; a mechanical rewrite.',
  '',
  '## What I could not know',
  '',
  '(author) Whether a future slice will need nested front-matter values.',
  '',
].join('\n');

/**
 * The same item, written the way every item was written before PRD #1071 — no plain-words
 * sections at all. This is exactly what a settled entry embeds when it was settled before this
 * slice existed: `settled.md` is append-only, so this shape never goes away.
 */
const OLD_FORMAT_ITEM_TEXT = [
  '---',
  'id: s2-01-example-item',
  'prd: 985',
  'slice: s2',
  'rank: medium',
  'bears-on: none',
  'raised: 2026-09-22',
  'wave: 2',
  '---',
  '',
  '## What I had to decide',
  '',
  'Whether the front matter uses YAML or a plain key: value block.',
  '',
  '## What I did meanwhile',
  '',
  'A plain key: value block — the smallest thing that reads back unambiguously.',
  '',
  '## What it costs to change later',
  '',
  'Swapping to full YAML would touch every item file already written; a mechanical rewrite.',
  '',
  '## What I could not know',
  '',
  '(author) Whether a future slice will need nested front-matter values.',
  '',
].join('\n');

function withSections(overrides: Record<string, string | undefined> = {}) {
  const sections: Record<string, string | undefined> = {
    'The question, in plain words': 'A plain question the guard should accept.',
    'The decision, in plain words': 'A plain decision the guard should accept.',
    'What I had to decide': 'Something to decide.',
    'What I did meanwhile': 'Something done.',
    'What it costs to change later': 'Something it costs.',
    'What I could not know': '(author) Something unknown.',
    ...overrides,
  };
  return [
    ...PLAIN_SECTIONS,
    ...FUN_SECTIONS,
    OPTIONS_HEADING,
    PERSON_STEPS_HEADING,
    ...REQUIRED_SECTIONS,
  ]
    .filter((heading) => sections[heading] !== undefined)
    .map((heading) => `## ${heading}\n\n${sections[heading]}\n`)
    .join('\n');
}

function itemText({ frontMatter = {}, body }: { frontMatter?: Record<string, string | undefined>; body?: string } = {}) {
  const fm = {
    id: 's2-01-example-item',
    prd: '985',
    slice: 's2',
    rank: 'medium',
    'bears-on': 'none',
    raised: '2026-09-22',
    wave: '2',
    ...frontMatter,
  };
  const fmLines = Object.entries(fm)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
  return ['---', ...fmLines, '---', '', body ?? withSections()].join('\n');
}

describe('parseFrontMatterLines', () => {
  it('reads plain key: value lines', () => {
    const { data, errors } = parseFrontMatterLines('id: abc\nrank: high\n');
    expect(errors).toEqual([]);
    expect(data).toEqual({ id: 'abc', rank: 'high' });
  });

  it('strips a quoted value', () => {
    const { data } = parseFrontMatterLines('id: "abc def"\n');
    expect(data.id).toBe('abc def');
  });

  it('reports a line with no colon', () => {
    const { errors } = parseFrontMatterLines('this has no colon\n');
    expect(errors).toEqual([expect.stringContaining('this has no colon')]);
  });
});

describe('parseOutboxItem — the happy path', () => {
  it('parses a well-formed item into a typed object', () => {
    const result = parseOutboxItem(VALID_ITEM, { file: 'docs/outbox/985/s2-01-example-item.md' });
    expect(result.ok).toBe(true);
    expect(view(result).item).toEqual({
      id: 's2-01-example-item',
      prd: 985,
      slice: 's2',
      rank: 'medium',
      bearsOn: 'none',
      raised: '2026-09-22',
      wave: 2,
      sections: {
        questionPlain:
          'Should the front matter look like a full markup format, or a simple list of labels and values?',
        decisionPlain:
          'We chose the simple list, because it is the smallest thing anyone can read back without doubt.',
        whatIHadToDecide: 'Whether the front matter uses YAML or a plain key: value block.',
        whatIDidMeanwhile:
          'A plain key: value block — the smallest thing that reads back unambiguously.',
        whatItCostsToChangeLater:
          'Swapping to full YAML would touch every item file already written; a mechanical rewrite.',
        whatICouldNotKnow: '(author) Whether a future slice will need nested front-matter values.',
      },
      file: 'docs/outbox/985/s2-01-example-item.md',
    });
  });

  it('coerces prd and wave to numbers', () => {
    const result = parseOutboxItem(itemText());
    expect(result.ok).toBe(true);
    expect(view(result).item.prd).toBe(985);
    expect(view(result).item.wave).toBe(2);
  });
});

describe('parseOutboxItem — malformed front matter', () => {
  it('fails when there is no front-matter block at all', () => {
    const result = parseOutboxItem('## What I had to decide\n\nno front matter here\n');
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('front-matter block'))).toBe(true);
  });

  it('fails on an unknown rank value', () => {
    const result = parseOutboxItem(itemText({ frontMatter: { rank: 'urgent' } }));
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('rank'))).toBe(true);
  });

  it('fails when a required field is missing', () => {
    const result = parseOutboxItem(itemText({ frontMatter: { wave: undefined } }));
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('wave'))).toBe(true);
  });

  it('fails on an unknown front-matter key', () => {
    const result = parseOutboxItem(itemText({ frontMatter: { bogus: 'x' } }));
    expect(result.ok).toBe(false);
  });

  it('fails on a non-date "raised" value', () => {
    const result = parseOutboxItem(itemText({ frontMatter: { raised: 'yesterday' } }));
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('raised'))).toBe(true);
  });

  it('prefixes every error with the file when one is given', () => {
    const result = parseOutboxItem(itemText({ frontMatter: { rank: 'urgent' } }), {
      file: 'docs/outbox/985/s2-01-bad.md',
    });
    expect(result.ok).toBe(false);
    expect(view(result).errors.every((e: string) => e.startsWith('docs/outbox/985/s2-01-bad.md:'))).toBe(true);
  });
});

describe('parseOutboxItem — the four sections', () => {
  it('fails and names the section when "What I could not know" is missing', () => {
    const result = parseOutboxItem(
      itemText({ body: withSections({ 'What I could not know': undefined }) }),
    );
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('What I could not know'))).toBe(true);
  });

  it('fails and names every missing section when several are missing', () => {
    const result = parseOutboxItem(
      itemText({
        body: withSections({
          'What it costs to change later': undefined,
          'What I could not know': undefined,
        }),
      }),
    );
    expect(result.ok).toBe(false);
    const missingMessage = view(result).errors.find((e: string) => e.includes('missing section'));
    expect(missingMessage).toContain('What it costs to change later');
    expect(missingMessage).toContain('What I could not know');
  });

  it('fails when the sections are out of order', () => {
    const body = [
      '## What I did meanwhile',
      '',
      'x',
      '',
      '## What I had to decide',
      '',
      'y',
      '',
      '## What it costs to change later',
      '',
      'z',
      '',
      '## What I could not know',
      '',
      '(author) w',
      '',
    ].join('\n');
    const result = parseOutboxItem(itemText({ body }));
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('out of order'))).toBe(true);
  });

  it('fails when an unexpected heading appears', () => {
    const result = parseOutboxItem(
      itemText({ body: `${withSections()}\n## Something else\n\ntext\n` }),
    );
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('unexpected heading'))).toBe(true);
  });

  it('fails when a required section has no content', () => {
    const result = parseOutboxItem(
      itemText({ body: withSections({ 'What I could not know': '' }) }),
    );
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('no content'))).toBe(true);
  });
});

describe('parseOutboxItem — the two plain-words sections (PRD #1071)', () => {
  it('exposes them as sections.questionPlain and sections.decisionPlain, first, before the four', () => {
    const result = parseOutboxItem(itemText());
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.questionPlain).toBe('A plain question the guard should accept.');
    expect(view(result).item.sections.decisionPlain).toBe('A plain decision the guard should accept.');
  });

  it('reads a settled entry’s embedded item written before this slice — neither section, and it still parses', () => {
    const result = parseOutboxItem(OLD_FORMAT_ITEM_TEXT);
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.questionPlain).toBeUndefined();
    expect(view(result).item.sections.decisionPlain).toBeUndefined();
    expect(view(result).item.sections.whatIHadToDecide).toBe(
      'Whether the front matter uses YAML or a plain key: value block.',
    );
  });

  it('refuses an item carrying only one of the two plain sections', () => {
    const result = parseOutboxItem(
      itemText({ body: withSections({ 'The decision, in plain words': undefined }) }),
    );
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('without'))).toBe(true);
  });
});

describe('parseOutboxItem — the options section (PRD #1166, slice s4)', () => {
  it('exposes "A. …" / "B. …" lines as sections.options, right after the plain sections', () => {
    const result = parseOutboxItem(
      itemText({
        body: withSections({
          [OPTIONS_HEADING]: 'A. Ship it now, the option built.\nB. Wait for the next release.',
        }),
      }),
    );
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.options).toEqual([
      { letter: 'A', text: 'Ship it now, the option built.' },
      { letter: 'B', text: 'Wait for the next release.' },
    ]);
    expect(view(result).item.sections.personSteps).toBeUndefined();
  });

  it('exposes "## What a person must do" as sections.personSteps, and no options', () => {
    const result = parseOutboxItem(
      itemText({
        frontMatter: { rank: 'human-action' },
        body: withSections({
          [PERSON_STEPS_HEADING]: 'Add the missing secret to the console, then re-run the job.',
        }),
      }),
    );
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.personSteps).toBe(
      'Add the missing secret to the console, then re-run the job.',
    );
    expect(view(result).item.sections.options).toBeUndefined();
  });

  it('tolerates absence — neither heading — exactly like a settled entry written before this slice', () => {
    const result = parseOutboxItem(itemText());
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.options).toBeUndefined();
    expect(view(result).item.sections.personSteps).toBeUndefined();
  });

  it('refuses an item carrying both the options and the person-steps heading', () => {
    const result = parseOutboxItem(
      itemText({
        body: withSections({
          [OPTIONS_HEADING]: 'A. Built.\nB. Alternative.',
          [PERSON_STEPS_HEADING]: 'Do the thing.',
        }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('at most one'))).toBe(true);
  });

  it('refuses a malformed option line, naming it', () => {
    const result = parseOutboxItem(
      itemText({
        body: withSections({
          [OPTIONS_HEADING]: 'A. Ship it now.\nsomething that is not a lettered option',
        }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(
      view(result).errors.some((e: string) => e.includes('not a lettered option') || e.includes('option line')),
    ).toBe(true);
  });

  it('fails when the options section comes before the decision, in plain words', () => {
    const body = [
      '## The question, in plain words',
      '',
      'q',
      '',
      '## The options, in plain words',
      '',
      'A. Built.',
      'B. Alternative.',
      '',
      '## The decision, in plain words',
      '',
      'd',
      '',
      '## What I had to decide',
      '',
      'x',
      '',
      '## What I did meanwhile',
      '',
      'y',
      '',
      '## What it costs to change later',
      '',
      'z',
      '',
      '## What I could not know',
      '',
      '(author) w',
      '',
    ].join('\n');
    const result = parseOutboxItem(itemText({ body }));
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('out of order'))).toBe(true);
  });
});

describe('parseOutboxItem — the intro and the punchline (PRD #50, slice s1)', () => {
  const INTRO = 'A form with no fields is just a very polite wall.';
  const PUNCHLINE = 'The wall votes yes. The wall always votes yes.';
  const FILE = 'docs/outbox/985/s2-01-example-item.md';

  it('exposes the pair as sections.introFun and sections.punchlineFun, right after the plain sections', () => {
    const result = parseOutboxItem(
      itemText({
        body: withSections({
          [FUN_SECTIONS[0]]: INTRO,
          [FUN_SECTIONS[1]]: PUNCHLINE,
          [OPTIONS_HEADING]: 'A. Ship it now, the option built.\nB. Wait for the next release.',
        }),
      }),
      { file: FILE },
    );
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.introFun).toBe(INTRO);
    expect(view(result).item.sections.punchlineFun).toBe(PUNCHLINE);
    expect(view(result).item.sections.questionPlain).toBe('A plain question the guard should accept.');
    expect(view(result).item.sections.options).toHaveLength(2);
  });

  it('accepts the pair before the person steps of a human-action item', () => {
    const result = parseOutboxItem(
      itemText({
        frontMatter: { rank: 'human-action' },
        body: withSections({
          [FUN_SECTIONS[0]]: INTRO,
          [FUN_SECTIONS[1]]: PUNCHLINE,
          [PERSON_STEPS_HEADING]: 'Add the missing secret to the console, then re-run the job.',
        }),
      }),
    );
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.introFun).toBe(INTRO);
    expect(view(result).item.sections.personSteps).toMatch(/missing secret/);
  });

  it('parses an item carrying neither exactly as before', () => {
    const result = parseOutboxItem(VALID_ITEM);
    expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
    expect(view(result).item.sections.introFun).toBeUndefined();
    expect(view(result).item.sections.punchlineFun).toBeUndefined();
    expect(Object.keys(view(result).item.sections)).not.toContain('introFun');
  });

  it('refuses the intro without the punchline, naming the file', () => {
    const result = parseOutboxItem(itemText({ body: withSections({ [FUN_SECTIONS[0]]: INTRO }) }), {
      file: FILE,
    });
    expect(result.ok).toBe(false);
    expect(
      view(result).errors.some((e: string) =>
          e.startsWith(`${FILE}:`) &&
          e.includes('The intro, for fun') &&
          e.includes('without') &&
          e.includes('The punchline, for fun'),
      ),
    ).toBe(true);
  });

  it('refuses the punchline without the intro, naming the file', () => {
    const result = parseOutboxItem(
      itemText({ body: withSections({ [FUN_SECTIONS[1]]: PUNCHLINE }) }),
      { file: FILE },
    );
    expect(result.ok).toBe(false);
    expect(
      view(result).errors.some((e: string) => e.startsWith(`${FILE}:`) && e.includes('without "## The intro, for fun"'),
      ),
    ).toBe(true);
  });

  it('refuses the pair after the options, naming the file', () => {
    const body = [
      '## The question, in plain words',
      '',
      'q',
      '',
      '## The decision, in plain words',
      '',
      'd',
      '',
      '## The options, in plain words',
      '',
      'A. Built.',
      'B. Alternative.',
      '',
      '## The intro, for fun',
      '',
      INTRO,
      '',
      '## The punchline, for fun',
      '',
      PUNCHLINE,
      '',
      withSections({
        'The question, in plain words': undefined,
        'The decision, in plain words': undefined,
      }),
    ].join('\n');
    const result = parseOutboxItem(itemText({ body }), { file: FILE });
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.startsWith(`${FILE}:`) && e.includes('out of order'))).toBe(
      true,
    );
  });

  it('refuses the pair between the question and the decision', () => {
    const body = [
      '## The question, in plain words',
      '',
      'q',
      '',
      '## The intro, for fun',
      '',
      INTRO,
      '',
      '## The punchline, for fun',
      '',
      PUNCHLINE,
      '',
      '## The decision, in plain words',
      '',
      'd',
      '',
      withSections({
        'The question, in plain words': undefined,
        'The decision, in plain words': undefined,
      }),
    ].join('\n');
    const result = parseOutboxItem(itemText({ body }), { file: FILE });
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('out of order'))).toBe(true);
  });

  it('refuses the punchline before the intro', () => {
    const body = [
      '## The question, in plain words',
      '',
      'q',
      '',
      '## The decision, in plain words',
      '',
      'd',
      '',
      '## The punchline, for fun',
      '',
      PUNCHLINE,
      '',
      '## The intro, for fun',
      '',
      INTRO,
      '',
      withSections({
        'The question, in plain words': undefined,
        'The decision, in plain words': undefined,
      }),
    ].join('\n');
    const result = parseOutboxItem(itemText({ body }), { file: FILE });
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('out of order'))).toBe(true);
  });

  it('refuses the pair in an item with no plain-words sections to sit after, naming the file', () => {
    const result = parseOutboxItem(
      itemText({
        body: withSections({
          'The question, in plain words': undefined,
          'The decision, in plain words': undefined,
          [FUN_SECTIONS[0]]: INTRO,
          [FUN_SECTIONS[1]]: PUNCHLINE,
        }),
      }),
      { file: FILE },
    );
    expect(result.ok).toBe(false);
    expect(
      view(result).errors.some((e: string) => e.startsWith(`${FILE}:`) && e.includes('right after the two plain-words sections'),
      ),
    ).toBe(true);
  });

  it('refuses an empty intro', () => {
    const result = parseOutboxItem(
      itemText({ body: withSections({ [FUN_SECTIONS[0]]: '', [FUN_SECTIONS[1]]: PUNCHLINE }) }),
    );
    expect(result.ok).toBe(false);
    expect(view(result).errors.some((e: string) => e.includes('"## The intro, for fun" has no content'))).toBe(
      true,
    );
  });
});

describe('a settled ledger written before PRD #50 still parses', () => {
  const markers = makeMarkers('omni-outbox');

  /** One settled entry, in the shape `settle.mjs` has always written, embedding `embedded`. */
  function settledEntry(id: string, verdict: string, embedded: string) {
    return [
      markers.settledOpen(id),
      '',
      `## ${id} — ${verdict}`,
      '',
      `- Verdict: ${verdict}`,
      '- Approved by: someone',
      '- Approved at: 2026-09-22',
      '- Closed: yes',
      '',
      '### The answer, as it was given',
      '',
      '```text',
      'Fine.',
      '```',
      '',
      '### The item, as it was raised',
      '',
      '```text',
      embedded,
      '```',
      '',
      markers.settledClose(id),
      '',
    ].join('\n');
  }

  const LEDGER = [
    '# Settled outbox items — PRD 985',
    '',
    settledEntry('s2-01-example-item', 'agreed', OLD_FORMAT_ITEM_TEXT),
    settledEntry(
      's2-02-example-item',
      'adopted',
      itemText({
        frontMatter: { id: 's2-02-example-item' },
        body: withSections({ [OPTIONS_HEADING]: 'A. Built.\nB. Alternative.' }),
      }),
    ),
    settledEntry(
      's2-03-example-item',
      'agreed',
      itemText({
        frontMatter: { id: 's2-03-example-item', rank: 'human-action' },
        body: withSections({ [PERSON_STEPS_HEADING]: 'Grant the missing scope.' }),
      }),
    ),
  ].join('\n');

  it('reads every entry’s embedded item, with no intro and no punchline', () => {
    const entries = parseSettledEntries(LEDGER, markers);
    expect(entries.map((entry) => entry.id)).toEqual([
      's2-01-example-item',
      's2-02-example-item',
      's2-03-example-item',
    ]);
    for (const entry of entries) {
      const result = parseOutboxItem(entry.itemText, { file: null });
      expect(result.ok, result.ok ? '' : view(result).errors.join('\n')).toBe(true);
      expect(view(result).item.id).toBe(entry.id);
      expect(view(result).item.sections.introFun).toBeUndefined();
      expect(view(result).item.sections.punchlineFun).toBeUndefined();
    }
  });
});

describe('parseOutboxOptions — the pure line parser', () => {
  it('parses one option per non-blank line', () => {
    expect(parseOutboxOptions('A. Built.\nB. Alternative.\nC. A third way.')).toEqual({
      options: [
        { letter: 'A', text: 'Built.' },
        { letter: 'B', text: 'Alternative.' },
        { letter: 'C', text: 'A third way.' },
      ],
      errors: [],
    });
  });

  it('reports a line with no letter and period', () => {
    const { errors } = parseOutboxOptions('A. Built.\njust some prose');
    expect(errors).toEqual([expect.stringContaining('just some prose')]);
  });

  it('uppercases the letter it reads', () => {
    expect(parseOutboxOptions('a. built.').options).toEqual([{ letter: 'A', text: 'built.' }]);
  });
});

describe('optionLettersInOrder', () => {
  it('accepts A, B, C, D in order', () => {
    expect(optionLettersInOrder(OPTION_LETTERS.map((letter) => ({ letter })))).toBe(true);
  });

  it('accepts a shorter run starting at A', () => {
    expect(optionLettersInOrder([{ letter: 'A' }, { letter: 'B' }])).toBe(true);
  });

  it('refuses a run that skips a letter', () => {
    expect(optionLettersInOrder([{ letter: 'A' }, { letter: 'C' }])).toBe(false);
  });

  it('refuses a run that does not start at A', () => {
    expect(optionLettersInOrder([{ letter: 'B' }, { letter: 'C' }])).toBe(false);
  });

  it('accepts an empty list', () => {
    expect(optionLettersInOrder([])).toBe(true);
  });
});

describe('plainWordsProblems — the pure rule check-outbox calls on every open item', () => {
  it('passes a plain sentence with a comma and a question mark', () => {
    expect(plainWordsProblems('Should we use the customer’s country, or the company’s?')).toEqual(
      [],
    );
  });

  it('refuses backticks', () => {
    const problems = plainWordsProblems('We read it from `scripts/outbox.mjs`.');
    expect(problems.some((p) => p.includes('code span'))).toBe(true);
  });

  it('refuses a file path, naming it', () => {
    const problems = plainWordsProblems('The answer lives in docs/outbox/README.md, unquoted.');
    expect(
      problems.some((p) => p.includes('file path') && p.includes('docs/outbox/README.md')),
    ).toBe(true);
  });

  it('does not mistake a plain English "and/or" for a file path', () => {
    expect(plainWordsProblems('Use the tenant and/or the contact, whichever is set.')).toEqual([]);
  });

  it('refuses a register or ADR id', () => {
    expect(plainWordsProblems('This bears on N3 directly.').some((p) => p.includes('N3'))).toBe(
      true,
    );
    expect(
      plainWordsProblems('This is really about BR-QUOTE-4.').some((p) => p.includes('BR-QUOTE-4')),
    ).toBe(true);
    expect(
      plainWordsProblems('It would supersede ADR-0069.').some((p) => p.includes('ADR-0069')),
    ).toBe(true);
  });

  it('refuses a camelCase word', () => {
    const problems = plainWordsProblems('We default the companyName when nothing is given.');
    expect(problems.some((p) => p.includes('companyName'))).toBe(true);
  });

  it('refuses a SCREAMING_CASE word', () => {
    const problems = plainWordsProblems('We cap it at LOOKUP_LIMIT_MAX for every call.');
    expect(problems.some((p) => p.includes('LOOKUP_LIMIT_MAX'))).toBe(true);
  });

  it('refuses more than two sentences', () => {
    const problems = plainWordsProblems('One. Two. Three.');
    expect(problems.some((p) => p.includes('sentences long'))).toBe(true);
  });

  it('passes exactly two sentences', () => {
    expect(plainWordsProblems('One sentence. Two sentences.')).toEqual([]);
  });

  it('names every rule that fires at once, not just the first', () => {
    const problems = plainWordsProblems('See `scripts/outbox.mjs` for the companyName rule (N3).');
    expect(problems).toHaveLength(4);
  });
});

describe('funLineProblems — the rules an intro or a punchline is held to', () => {
  it('passes a plain sentence', () => {
    expect(funLineProblems('A planet with no forms is just a very expensive rock.')).toEqual([]);
  });

  it(`passes a line of exactly ${FUN_LINE_MAX_LENGTH} characters`, () => {
    expect(funLineProblems('a'.repeat(FUN_LINE_MAX_LENGTH))).toEqual([]);
  });

  it(`refuses a line over ${FUN_LINE_MAX_LENGTH} characters, naming its length`, () => {
    const problems = funLineProblems('a'.repeat(FUN_LINE_MAX_LENGTH + 1));
    expect(problems).toEqual([
      expect.stringMatching(new RegExp(`is ${FUN_LINE_MAX_LENGTH + 1} characters long`)),
    ]);
    expect(problems[0]).toContain(String(FUN_LINE_MAX_LENGTH));
  });

  it('counts a character outside the basic plane once, not twice', () => {
    expect(funLineProblems(`${'a'.repeat(FUN_LINE_MAX_LENGTH - 1)}🚀`)).toEqual([]);
  });

  it('refuses a backticked code name, with the same words the plain-words rules use', () => {
    const problems = funLineProblems('Nobody reads `defaultTimeoutMs` for fun.');
    expect(problems.some((p) => p.includes('code span') && p.includes('defaultTimeoutMs'))).toBe(
      true,
    );
  });

  it('names every rule that fires at once', () => {
    const problems = funLineProblems(`See \`x\` in scripts/outbox.mjs. ${'a'.repeat(FUN_LINE_MAX_LENGTH)}`);
    expect(problems.some((p) => p.includes('code span'))).toBe(true);
    expect(problems.some((p) => p.includes('file path'))).toBe(true);
    expect(problems.some((p) => p.includes('characters long'))).toBe(true);
  });
});

describe('floorRank — the register sets the floor, judgement may only raise', () => {
  it('floors a medium proposal to high when bears-on is an invariant', () => {
    expect(floorRank('N3', 'medium', laws)).toBe('high');
  });

  it('floors a medium proposal to high when bears-on is a business rule', () => {
    expect(floorRank('BR-QUOTE-4', 'medium', laws)).toBe('high');
  });

  it('floors a medium proposal to high when bears-on is a principle, a domain invariant or a cross-domain entry', () => {
    expect(floorRank('P-ADVISOR-1', 'medium', laws)).toBe('high');
    expect(floorRank('N-FOLDER-2', 'medium', laws)).toBe('high');
    expect(floorRank('X-ADVISOR-CREDITS-1', 'medium', laws)).toBe('high');
  });

  it('leaves a high proposal at high when the floor is already high', () => {
    expect(floorRank('N3', 'high', laws)).toBe('high');
  });

  it('never lowers a human-action proposal, even against a high floor', () => {
    expect(floorRank('N3', 'human-action', laws)).toBe('human-action');
  });

  it('sets no floor for an ADR id — the proposal passes through', () => {
    expect(floorRank('ADR-0069', 'medium', laws)).toBe('medium');
    expect(floorRank('ADR-0069', 'high', laws)).toBe('high');
  });

  it('sets no floor for "none" — the proposal passes through', () => {
    expect(floorRank('none', 'medium', laws)).toBe('medium');
  });

  it('sets no floor for an id shape nothing recognizes — the proposal passes through', () => {
    expect(floorRank('whatever', 'medium', laws)).toBe('medium');
  });

  describe('property: judgement may only escalate, never de-escalate', () => {
    const bearsOnSamples = [
      'none',
      'N1',
      'N2',
      'N8',
      'N42',
      'BR-QUOTE-1',
      'BR-QUOTE-4',
      'BR-TENANT-1',
      'BR-ACCESS-99',
      'P-ADVISOR-1',
      'P-PRODUCT-3',
      'N-FOLDER-2',
      'X-ADVISOR-CREDITS-1',
      'ADR-0001',
      'ADR-0069',
      'ADR-9999',
      'unresolvable-token',
      'BR-lowercase-1',
    ];

    it.each(
      bearsOnSamples.flatMap((bearsOn) => RANK_VALUES.map((proposed): [string, Rank] => [bearsOn, proposed])),
    )(
      'floorRank(%s, %s) never returns a rank less severe than proposed, and is idempotent',
      (bearsOn, proposed) => {
        const result = floorRank(bearsOn, proposed, laws);

        // Never de-escalated: the result is at least as severe as what was proposed.
        expect(RANK_ORDER[result]).toBeGreaterThanOrEqual(RANK_ORDER[proposed]);

        // Applying the floor again changes nothing further — a settled rank stays settled.
        expect(floorRank(bearsOn, result, laws)).toBe(result);

        // isBelowFloor agrees with floorRank on whether anything moved.
        expect(isBelowFloor(bearsOn, proposed, laws)).toBe(result !== proposed);
      },
    );

    it.each(bearsOnSamples.filter((bearsOn) => bearsOnFloorsHigh(bearsOn, laws)))(
      'a decision bearing on %s never settles below high, whatever was proposed',
      (bearsOn) => {
        for (const proposed of RANK_VALUES) {
          expect(RANK_ORDER[floorRank(bearsOn, proposed, laws)]).toBeGreaterThanOrEqual(
            RANK_ORDER.high,
          );
        }
      },
    );
  });
});

describe('resolveBearsOn', () => {
  it('resolves "none"', () => {
    expect(resolveBearsOn('none', laws)).toEqual({ ok: true });
  });

  it('refuses a shape nothing recognizes', () => {
    const result = resolveBearsOn('whatever', laws);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not none, an ADR-NNNN or a knowledge id/);
  });

  describe('against a fixture repo root', () => {
    it('resolves an ADR id when the file exists under docs/adr', () => {
      root = mkdtempSync(join(tmpdir(), 'outbox-adr-'));
      mkdirSync(join(root, 'docs/adr'), { recursive: true });
      writeFileSync(join(root, 'docs/adr/0069-a-prd-ships-as-one-pr.md'), '# 0069\n');

      expect(resolveBearsOn('ADR-0069', laws)).toEqual({ ok: true });
    });

    it('refuses an ADR id with no matching file', () => {
      root = mkdtempSync(join(tmpdir(), 'outbox-adr-'));
      mkdirSync(join(root, 'docs/adr'), { recursive: true });

      const result = resolveBearsOn('ADR-0001', laws);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/no decision record ADR-0001/);
    });

    it('refuses an ADR id when docs/adr does not exist at all', () => {
      root = mkdtempSync(join(tmpdir(), 'outbox-adr-'));

      const result = resolveBearsOn('ADR-0001', laws);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/no decision record ADR-0001/);
    });

    it('resolves a knowledge id through laws.resolve, against a fixture knowledge folder', () => {
      root = mkdtempSync(join(tmpdir(), 'outbox-knowledge-'));
      mkdirSync(join(root, 'docs/knowledge/product'), { recursive: true });
      writeFileSync(
        join(root, 'docs/knowledge/product/invariants.md'),
        '# Invariants\n\n## N1\n\nx\n\nSource: PRD #3\n',
      );

      expect(resolveBearsOn('N1', laws)).toEqual({ ok: true });
    });

    it('refuses an id-shaped token nothing in the fixture knowledge folder claims', () => {
      root = mkdtempSync(join(tmpdir(), 'outbox-knowledge-'));

      const result = resolveBearsOn('N999', laws);
      expect(result.ok).toBe(false);
    });
  });
});

describe('outboxItemFiles', () => {
  let root: string | undefined;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('returns [] when docs/outbox does not exist', () => {
    root = mkdtempSync(join(tmpdir(), 'outbox-files-'));
    expect(outboxItemFiles({ ctx: flatCtx(root) })).toEqual([]);
  });

  it('lists item files under a PRD directory, sorted, skipping settled.md and top-level files', () => {
    root = mkdtempSync(join(tmpdir(), 'outbox-files-'));
    mkdirSync(join(root, 'docs/outbox/985'), { recursive: true });
    writeFileSync(join(root, 'docs/outbox/README.md'), '# Outbox\n');
    writeFileSync(join(root, 'docs/outbox/985/s2-02-second.md'), 'b');
    writeFileSync(join(root, 'docs/outbox/985/s2-01-first.md'), 'a');
    writeFileSync(join(root, 'docs/outbox/985/settled.md'), 'settled');

    expect(outboxItemFiles({ ctx: flatCtx(root) })).toEqual([
      'docs/outbox/985/s2-01-first.md',
      'docs/outbox/985/s2-02-second.md',
    ]);
  });

  it('lists open items in flight and in shipped folders, never settled.md or accounts', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/s1-01-x.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/settled.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/accounts/s1.md': 'x',
        '.omni-loop/delivery/shipped/0007-b/outbox/s2-01-y.md': 'x',
      },
    });
    expect(outboxItemFiles({ ctx })).toEqual([
      '.omni-loop/delivery/outbox/0042-a/s1-01-x.md',
      '.omni-loop/delivery/shipped/0007-b/outbox/s2-01-y.md',
    ]);
  });
});
