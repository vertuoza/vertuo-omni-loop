import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.mjs';
import { fillConfig, resolveForm } from './resolve.mjs';

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
function repoForm(slots, frontMatter = { state: 'filled' }) {
  return formText({ frontMatter, slots });
}

function resolved(files, config = { commands: { test: 'pnpm test' } }) {
  const { ctx } = makeRepo({ files, config });
  return resolveForm('testing', { ctx, template: TEMPLATE });
}

/** The one section of `result` for `slot`. */
const section = (result, slot) => result.sections.find((entry) => entry.slot === slot);

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
    const pointer = (index) =>
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
    expect(section(result, 'commands').text).toBe('Run the whole suite with pnpm vitest run.');
    expect(result.problems).toEqual([]);
  });

  it('leaves a key the config does not hold visible, and reports it', () => {
    const template = formText({ slots: [{ id: 'commands', required: true, body: 'Run {config:commands.tests} first.' }] });
    const { ctx } = makeRepo();
    const result = resolveForm('testing', { ctx, template });
    expect(section(result, 'commands').text).toBe('Run {config:commands.tests} first.');
    expect(result.problems).toEqual(['kit default testing#commands: {config:commands.tests} names no config key']);
  });

  it('never fills the repository’s own text', () => {
    const result = resolved({ [FILE]: repoForm([{ id: 'commands', required: true, body: 'Literally {config:commands.test}.' }]) });
    expect(section(result, 'commands').text).toBe('Literally {config:commands.test}.');
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
