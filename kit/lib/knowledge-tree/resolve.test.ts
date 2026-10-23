// PRD 2416, s1: a playbook section read through the knowledge tree, bottom-up. The resolver's own
// table (and the laws it proves) stay in `../playbook/resolve.test.ts`; these cases add the levels.
import { describe, expect, it } from 'vitest';
import { formText as fixtureFormText, makeRepo } from '../../test/fixture.ts';
import type { SlotFixture } from '../../test/fixture.ts';
import { resolveForm } from '../playbook/resolve.ts';
import type { ResolvedForm } from '../playbook/resolve.ts';

/** `formText`'s options, typed here until `kit/test/fixture.ts` is (PRD 725, s17). */
type FormTextOptions = { frontMatter?: Record<string, unknown>; title?: string; slots?: SlotFixture[] };
const formText = fixtureFormText as (options?: FormTextOptions) => string;

const FILE = '.omni-loop/knowledge/playbook/testing.md';
const PLAN = '.omni-loop/local/tree/plan-repo/playbook/testing.md';
const SETTINGS = '.omni-loop/local/tree/omni-settings/playbook/testing.md';

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

/** A filled testing form holding `slots`: the repository's own, or a level's copy. */
const filled = (slots: SlotFixture[]) => formText({ frontMatter: { state: 'filled' }, slots });

function resolved(files: Record<string, string>) {
  const { ctx } = makeRepo({ files, config: { commands: { test: 'pnpm test' } } });
  return resolveForm('testing', { ctx, template: TEMPLATE });
}

/** The one section of `result` for `slot`. */
const section = (result: ResolvedForm, slot: string) => result.sections.find((entry) => entry.slot === slot);

describe('resolveForm — the knowledge tree, bottom-up (PRD 2416)', () => {
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

  it('reads a level’s decisions form from its copy’s adr folder', () => {
    const { ctx } = makeRepo({ files: { '.omni-loop/local/tree/plan-repo/adr/README.md': filled([{ id: 'never', required: true, body: 'Plan: never sleep.' }]) } });
    const result = resolveForm('decisions', { ctx, template: TEMPLATE });
    expect(section(result, 'never')).toMatchObject({ source: 'plan-repo', label: '[plan repo]', text: 'Plan: never sleep.' });
  });
});
