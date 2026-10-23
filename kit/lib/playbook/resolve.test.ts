import { describe, expect, it } from 'vitest';
import { formText as fixtureFormText, makeRepo } from '../../test/fixture.ts';
import { fillConfig, resolveForm } from './resolve.ts';
import type { ResolvedForm } from './resolve.ts';
import { assertDefined } from '../../test/assert.ts';

/** `formText`'s options, typed here until `kit/test/fixture.ts` is (PRD 725, s17). */
type FormTextOptions = {
  frontMatter?: Record<string, unknown>;
  title?: string;
  opener?: string | null;
  slots?: { id: string; heading?: string; required?: boolean; by?: string | null; verified?: string | null; marker?: string | null; body?: string }[];
};
const formText = fixtureFormText as (options?: FormTextOptions) => string;

const FILE = '.omni-loop/knowledge/playbook/testing.md';

/** The kit's template for the testing form, as a fixture: its slot bodies are the kit defaults. */
const TEMPLATE = formText({
  slots: [
    { id: 'commands', heading: 'Commands', required: true, body: 'Run the whole suite with {config:commands.test}.' },
    { id: 'layout', heading: 'Where tests live', required: true, body: 'Tests sit beside the code they prove.' },
    { id: 'levels', heading: 'Choosing the level', body: 'Start from the behaviour or risk the change creates.' },
    { id: 'never', heading: 'Never', required: true, body: 'A test never depends on the order it runs in.' },
    { id: 'data', heading: 'Test data', body: 'Keep fixture data small, and name it for what it proves.' },
  ],
});

/** A repository testing form holding `slots` (id → body, plus marker fields). */
function repoForm(slots: NonNullable<FormTextOptions['slots']>, frontMatter: Record<string, unknown> = { state: 'filled' }) {
  return formText({ frontMatter, slots });
}

function resolved(files: Record<string, string>, config: Record<string, unknown> = { commands: { test: 'pnpm test' } }) {
  const { ctx } = makeRepo({ files, config });
  return resolveForm('testing', { ctx, template: TEMPLATE });
}

/** The one section of `result` for `slot`. */
const section = (result: ResolvedForm, slot: string) => result.sections.find((entry) => entry.slot === slot);

describe('resolveForm — one row of the resolution table each', () => {
  it('a filled section: the repository text, labelled [repo], [repo · by human] or [repo · verified <date>]', () => {
    const result = resolved({
      [FILE]: repoForm([
        { id: 'commands', required: true, by: 'invade', verified: '2026-09-25', body: '`pnpm test` runs everything.' },
        { id: 'layout', required: true, body: 'Beside the code, as `*.test.mjs`.' },
        { id: 'never', required: true, by: 'human', body: '- A test never calls the network.' },
      ]),
    });
    expect(section(result, 'commands')).toMatchObject({ source: 'repo', label: '[repo · verified 2026-09-25]', text: '`pnpm test` runs everything.' });
    expect(section(result, 'layout')).toMatchObject({ source: 'repo', label: '[repo]', text: 'Beside the code, as `*.test.mjs`.' });
    expect(section(result, 'never')).toMatchObject({ source: 'repo', label: '[repo · by human]', text: '- A test never calls the network.' });
  });

  it('a See: <path> line: the page it names, labelled [→ <path>]', () => {
    const result = resolved({
      [FILE]: repoForm([{ id: 'never', required: true, body: 'See: guides/never.md' }]),
      'guides/never.md': '# Never\n\nA test never calls the network.\n',
    });
    expect(section(result, 'never')).toMatchObject({ source: 'pointer', label: '[→ guides/never.md]', text: '# Never\n\nA test never calls the network.' });
    expect(result.problems).toEqual([]);
  });

  it('an empty section: the kit default for that slot, labelled [kit default]', () => {
    const result = resolved({ [FILE]: repoForm([{ id: 'levels' }]) });
    expect(section(result, 'levels')).toMatchObject({
      source: 'kit',
      label: '[kit default]',
      text: 'Start from the behaviour or risk the change creates.',
      questions: [],
    });
  });

  it('a section holding TODO(human) lines: the kit default, then each open question, labelled [hole]', () => {
    const result = resolved({ [FILE]: repoForm([{ id: 'data', body: 'TODO(human): is there a naming rule for fixture repositories?' }]) });
    expect(section(result, 'data')).toMatchObject({
      source: 'hole',
      label: '[hole]',
      text: 'Keep fixture data small, and name it for what it proves.',
      questions: ['is there a naming rule for fixture repositories?'],
    });
  });

  it('a form with state: pointer: the whole target, labelled [→ <path>] — a file’s text', () => {
    const result = resolved({
      [FILE]: formText({ frontMatter: { state: 'pointer', 'points-to': 'guides/testing.md' }, title: 'Testing lives in guides/testing.md', slots: [] }),
      'guides/testing.md': '# Testing\n\nEverything about tests.\n',
    });
    expect(result.state).toBe('pointer');
    expect(result.sections).toEqual([
      { slot: null, heading: 'Testing lives in guides/testing.md', source: 'pointer', label: '[→ guides/testing.md]', text: '# Testing\n\nEverything about tests.', questions: [] },
    ]);
  });

  it('a form with state: pointer at a folder: its index, else its Markdown file list', () => {
    const pointer = (index?: string | null) =>
      formText({ frontMatter: { state: 'pointer', 'points-to': 'guides/', ...(index ? { index } : {}) }, slots: [] });
    const files = { 'guides/index.md': 'The guides, in reading order.\n', 'guides/b.md': 'b', 'guides/a.md': 'a', 'guides/notes.txt': 'n' };

    const withIndex = resolved({ ...files, [FILE]: pointer('guides/index.md') });
    expect(withIndex.sections[0]).toMatchObject({ label: '[→ guides/]', text: 'The guides, in reading order.' });

    const listed = resolved({ ...files, [FILE]: pointer(null) });
    expect(listed.sections[0]).toMatchObject({ label: '[→ guides/]', text: 'guides/a.md\nguides/b.md\nguides/index.md' });
  });

  it('a form file that is missing: the kit default for every slot, labelled [kit default]', () => {
    const result = resolved({});
    expect(result.state).toBe('missing');
    expect(result.file).toBe(FILE);
    expect(result.title).toBe('Testing');
    expect(result.sections.map(({ slot, label }) => `${slot} ${label}`)).toEqual([
      'commands [kit default]',
      'layout [kit default]',
      'levels [kit default]',
      'never [kit default]',
      'data [kit default]',
    ]);
  });
});

describe('resolveForm — order, headings and what it reports', () => {
  it('gives the sections in the template’s order, under the template’s headings, whatever order the form keeps', () => {
    const result = resolved({
      [FILE]: repoForm([
        { id: 'data', heading: 'Data', body: 'Seeded per test.' },
        { id: 'commands', heading: 'How to run', required: true, body: '`pnpm test`' },
      ]),
    });
    expect(result.sections.map(({ slot, heading }) => `${slot}: ${heading}`)).toEqual([
      'commands: Commands',
      'layout: Where tests live',
      'levels: Choosing the level',
      'never: Never',
      'data: Test data',
    ]);
  });

  it('reports a See: or points-to path that does not exist, and shows nothing for it', () => {
    const see = resolved({ [FILE]: repoForm([{ id: 'never', required: true, body: 'See: guides/gone.md' }]) });
    expect(section(see, 'never')).toMatchObject({ source: 'pointer', text: '' });
    expect(see.problems).toEqual([`${FILE}: "## Never" See: guides/gone.md does not exist`]);

    const pointer = resolved({ [FILE]: formText({ frontMatter: { state: 'pointer', 'points-to': 'guides/gone.md' } }) });
    expect(pointer.problems).toEqual([`${FILE}: points-to guides/gone.md does not exist`]);
  });

  it('reads a form that does not parse as missing, and reports why', () => {
    const result = resolved({ [FILE]: '# Testing\n' });
    expect(result.state).toBe('invalid');
    expect(result.sections.every((entry) => entry.label === '[kit default]')).toBe(true);
    expect(result.problems).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*front matter`))]);
  });
});

describe('resolveForm — {config:<key>} in a kit default', () => {
  it('fills a key from the repository’s config', () => {
    const result = resolved({}, { commands: { test: 'pnpm vitest run' } });
    const section2 = section(result, 'commands');
    assertDefined(section2, 'the section');
    expect(section2.text).toBe('Run the whole suite with pnpm vitest run.');
    expect(result.problems).toEqual([]);
  });

  it('leaves a key the config does not hold visible, and reports it', () => {
    const template = formText({ slots: [{ id: 'commands', required: true, body: 'Run {config:commands.tests} first.' }] });
    const { ctx } = makeRepo();
    const result = resolveForm('testing', { ctx, template });
    const section2 = section(result, 'commands');
    assertDefined(section2, 'the section');
    expect(section2.text).toBe('Run {config:commands.tests} first.');
    expect(result.problems).toEqual(['kit default testing#commands: {config:commands.tests} names no config key']);
  });

  it('never fills the repository’s own text', () => {
    const result = resolved({ [FILE]: repoForm([{ id: 'commands', required: true, body: 'Literally {config:commands.test}.' }]) });
    const section2 = section(result, 'commands');
    assertDefined(section2, 'the section');
    expect(section2.text).toBe('Literally {config:commands.test}.');
  });
});

describe('fillConfig', () => {
  const config = { commands: { test: 'pnpm test', preflight: null, checks: ['pnpm lint'] }, limits: { attempts: 3 }, labels: { autoCreate: false } };

  it('fills text, numbers and booleans', () => {
    expect(fillConfig('{config:commands.test}, {config:limits.attempts} tries, create: {config:labels.autoCreate}', config)).toEqual({
      text: 'pnpm test, 3 tries, create: false',
      unresolved: [],
    });
  });

  it('leaves visible, and reports, a key that is unknown, unset, or holds no single value', () => {
    expect(fillConfig('{config:nope.x} {config:commands.preflight} {config:commands.checks} {config:commands}', config)).toEqual({
      text: '{config:nope.x} {config:commands.preflight} {config:commands.checks} {config:commands}',
      unresolved: [
        { key: 'nope.x', reason: 'names no config key' },
        { key: 'commands.preflight', reason: 'is not set in the config' },
        { key: 'commands.checks', reason: 'holds no single value' },
        { key: 'commands', reason: 'holds no single value' },
      ],
    });
  });
});

// PRD 2416, s1: the tech side of the knowledge tree, read bottom-up.
describe('resolveForm — the knowledge tree, bottom-up (PRD 2416)', () => {
  const PLAN = '.omni-loop/local/tree/plan-repo/playbook/testing.md';
  const SETTINGS = '.omni-loop/local/tree/omni-settings/playbook/testing.md';
  const filled = (slots: NonNullable<FormTextOptions['slots']>) => repoForm(slots);

  it('acceptance 1: the repository’s own section wins, tagged [repo], even when both other levels hold one', () => {
    const result = resolved({
      [FILE]: filled([{ id: 'never', required: true, body: 'Repository: never call the network.' }]),
      [PLAN]: filled([{ id: 'never', required: true, body: 'Plan: never sleep.' }]),
      [SETTINGS]: filled([{ id: 'never', required: true, body: 'Settings: never retry.' }]),
    });
    expect(section(result, 'never')).toMatchObject({ source: 'repo', label: '[repo]', text: 'Repository: never call the network.' });
    expect(result.problems).toEqual([]);
  });

  it('acceptance 2: a section the repository lacks shows the plan repository’s, else the Omni settings’, else the kit default, each tagged', () => {
    const result = resolved({
      [FILE]: filled([{ id: 'commands', required: true, body: '`pnpm test`' }]),
      [PLAN]: filled([
        { id: 'layout', required: true, body: 'Plan: beside the code.' },
        { id: 'never', required: true, by: 'human', verified: '2026-10-01', body: 'Plan: never sleep.' },
      ]),
      [SETTINGS]: filled([
        { id: 'layout', required: true, body: 'Settings: under test/.' },
        { id: 'levels', body: 'Settings: start from the risk.' },
      ]),
    });
    expect(result.sections.map(({ slot, source, label }) => `${slot} ${source} ${label}`)).toEqual([
      'commands repo [repo]',
      'layout plan-repo [plan repo]',
      'levels omni-settings [omni settings]',
      'never plan-repo [plan repo]',
      'data kit [kit default]',
    ]);
    expect(section(result, 'layout')?.text).toBe('Plan: beside the code.');
    expect(section(result, 'levels')?.text).toBe('Settings: start from the risk.');
    expect(section(result, 'never')?.text).toBe('Plan: never sleep.');
    expect(section(result, 'data')?.text).toBe('Keep fixture data small, and name it for what it proves.');
  });

  it('reads the levels for every slot of a form whose file the repository does not have', () => {
    const result = resolved({ [SETTINGS]: filled([{ id: 'data', body: 'Settings: seed per test.' }]) });
    expect(result).toMatchObject({ state: 'missing', file: FILE });
    expect(section(result, 'data')).toMatchObject({ source: 'omni-settings', label: '[omni settings]', text: 'Settings: seed per test.', questions: [] });
    expect(section(result, 'commands')).toMatchObject({ source: 'kit', label: '[kit default]', text: 'Run the whole suite with pnpm test.' });
  });

  it('a higher level’s TODO(human)-only, empty or See: section is no answer: it falls through to the next level', () => {
    const result = resolved({
      [PLAN]: filled([
        { id: 'layout', required: true, body: 'TODO(human): where do the tests live?' },
        { id: 'levels' },
        { id: 'never', required: true, body: 'See: guides/never.md' },
      ]),
      [SETTINGS]: filled([
        { id: 'layout', required: true, body: 'Settings: beside the code.' },
        { id: 'levels', body: 'Settings: start from the risk.' },
      ]),
      'guides/never.md': 'Not the plan repository’s file.\n',
    });
    expect(section(result, 'layout')).toMatchObject({ source: 'omni-settings', label: '[omni settings]', text: 'Settings: beside the code.' });
    expect(section(result, 'levels')).toMatchObject({ source: 'omni-settings', label: '[omni settings]' });
    expect(section(result, 'never')).toMatchObject({ source: 'kit', label: '[kit default]', text: 'A test never depends on the order it runs in.' });
    expect(result.problems).toEqual([]);
  });

  it('a higher level’s pointer form is no answer either, and its text beside TODO(human) lines reads as text', () => {
    const result = resolved({
      [PLAN]: formText({ frontMatter: { state: 'pointer', 'points-to': 'guides/testing.md' }, slots: [] }),
      [SETTINGS]: filled([{ id: 'data', body: 'Settings: seed per test.\nTODO(human): who owns the seed?' }]),
    });
    expect(section(result, 'commands')).toMatchObject({ source: 'kit' });
    expect(section(result, 'data')).toMatchObject({
      source: 'omni-settings',
      label: '[omni settings]',
      text: 'Settings: seed per test.\nTODO(human): who owns the seed?',
      questions: ['who owns the seed?'],
    });
  });

  it('a repository hole shows the nearest level’s text in place of the kit default, tagged [hole · <level>], with its questions', () => {
    const result = resolved({
      [FILE]: filled([{ id: 'data', body: 'TODO(human): is there a naming rule for fixture repositories?' }]),
      [SETTINGS]: filled([{ id: 'data', body: 'Settings: seed per test.' }]),
    });
    expect(section(result, 'data')).toMatchObject({
      source: 'hole',
      label: '[hole · omni settings]',
      text: 'Settings: seed per test.',
      questions: ['is there a naming rule for fixture repositories?'],
    });
  });

  it('a repository See: line or pointer form still wins over every level', () => {
    const levels = { [PLAN]: filled([{ id: 'never', required: true, body: 'Plan: never sleep.' }]) };
    const see = resolved({ ...levels, [FILE]: filled([{ id: 'never', required: true, body: 'See: guides/never.md' }]), 'guides/never.md': 'Ours.\n' });
    expect(section(see, 'never')).toMatchObject({ source: 'pointer', label: '[→ guides/never.md]', text: 'Ours.' });
    const pointer = resolved({ ...levels, [FILE]: formText({ frontMatter: { state: 'pointer', 'points-to': 'guides/never.md' }, slots: [] }), 'guides/never.md': 'Ours.\n' });
    expect(pointer.sections).toMatchObject([{ slot: null, source: 'pointer', text: 'Ours.' }]);
  });

  it('never fills a higher level’s text from the config, and reports no kit default it did not show', () => {
    const template = formText({ slots: [{ id: 'commands', required: true, body: 'Run {config:commands.tests} first.' }] });
    const { ctx } = makeRepo({ files: { [PLAN]: filled([{ id: 'commands', required: true, body: 'Plan: {config:commands.test}.' }]) } });
    const result = resolveForm('testing', { ctx, template });
    expect(section(result, 'commands')).toMatchObject({ source: 'plan-repo', text: 'Plan: {config:commands.test}.' });
    expect(result.problems).toEqual([]);
  });

  it('reports a higher level’s form that does not parse, and reads past it', () => {
    const result = resolved({ [PLAN]: '# Testing\n', [SETTINGS]: filled([{ id: 'never', required: true, body: 'Settings: never retry.' }]) });
    expect(section(result, 'never')).toMatchObject({ source: 'omni-settings', text: 'Settings: never retry.' });
    expect(result.problems).toEqual([expect.stringMatching(new RegExp(`^${PLAN}: .*front matter`))]);
  });
});

// Law BR-PRODUCT-8 (.omni-loop/knowledge/product/rules.md): when a kit default names
// {config:<key>} and the key is unknown, set to null, or holds a list or a section, the
// placeholder stays in the text exactly as written and a problem line is reported.
describe('law BR-PRODUCT-8 — a kit default never shows a guessed config value', () => {
  it('keeps an unknown, null, list or section {config:<key>} exactly as written, and reports a problem line for each', () => {
    const body = 'Unknown {config:nope.x}, null {config:commands.preflight}, list {config:commands.checks}, section {config:commands}.';
    const template = formText({ slots: [{ id: 'commands', heading: 'Commands', required: true, body }] });
    const { ctx } = makeRepo({ config: { commands: { test: 'pnpm test', preflight: null, checks: ['pnpm lint'] } } });
    const result = resolveForm('testing', { ctx, template });
    const commands = section(result, 'commands');
    assertDefined(commands, 'the commands section');
    expect(commands.text).toBe(body);
    expect(result.problems).toEqual([
      'kit default testing#commands: {config:nope.x} names no config key',
      'kit default testing#commands: {config:commands.preflight} is not set in the config',
      'kit default testing#commands: {config:commands.checks} holds no single value',
      'kit default testing#commands: {config:commands} holds no single value',
    ]);
  });
});

// Law BR-PRODUCT-9 (.omni-loop/knowledge/product/rules.md, #1471).
describe('law BR-PRODUCT-9 — a section with text beside TODO(human) lines reads as text', () => {
  it('law BR-PRODUCT-9: shows the text as written, labelled [repo], lists each TODO(human) question, and reads an HTML-comment-only section as empty', () => {
    const body = 'Fixtures live under `test/fixtures/`.\nTODO(human): is there a naming rule for fixture repositories?\n- TODO(human): who owns the seed data?';
    const result = resolved({
      [FILE]: repoForm([
        { id: 'data', body },
        { id: 'levels', body: '<!-- say how to choose the level -->\n<!-- another note -->' },
      ]),
    });
    expect(section(result, 'data')).toMatchObject({
      source: 'repo',
      label: '[repo]',
      text: body,
      questions: ['is there a naming rule for fixture repositories?', 'who owns the seed data?'],
    });
    expect(section(result, 'levels')).toMatchObject({
      source: 'kit',
      label: '[kit default]',
      text: 'Start from the behaviour or risk the change creates.',
      questions: [],
    });
  });
});
