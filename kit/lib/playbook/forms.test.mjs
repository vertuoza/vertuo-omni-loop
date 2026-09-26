import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.mjs';
import { FORM_IDS, FORMS, parseForm, readForm, resolvePlaybookId } from './forms.mjs';

const FILE = '.omni-loop/knowledge/playbook/testing.md';

/** `parseForm`'s errors for `text`, or `[]` when it parses. */
function errorsOf(text) {
  const parsed = parseForm(text, { file: FILE });
  return parsed.ok ? [] : parsed.errors;
}

/** The one slot `body` parses to, in an otherwise well-formed testing form. */
function bodyOf(body) {
  const parsed = parseForm(formText({ slots: [{ id: 'data', body }] }), { file: FILE });
  expect(parsed.ok).toBe(true);
  return parsed.form.slots[0].body;
}

describe('FORMS — the spec’s forms table, the contract with the templates and the commands', () => {
  it('holds the thirteen forms in the table’s order, eight core then five extended', () => {
    expect(FORM_IDS).toEqual([
      'briefing', 'setup', 'architecture', 'testing', 'verification', 'ci', 'pull-requests', 'decisions',
      'definition-of-done', 'conventions', 'releasing', 'bug-fixing', 'glossary',
    ]);
    expect(FORMS.filter((form) => form.kind === 'core').map((form) => form.id)).toEqual(FORM_IDS.slice(0, 8));
    expect(FORMS.filter((form) => form.kind === 'extended').map((form) => form.id)).toEqual(FORM_IDS.slice(8));
  });

  it('gives each form its slots in order, the required ones marked', () => {
    const table = Object.fromEntries(
      FORMS.map((form) => [form.id, form.slots.map((slot) => (slot.required ? `*${slot.id}` : slot.id)).join(' ')]),
    );
    expect(table).toEqual({
      briefing: '*never hooks next',
      setup: '*prerequisites *install run env',
      architecture: '*layout *boundaries patterns',
      testing: '*commands *layout levels *never data',
      verification: '*preflight before-push checks',
      ci: '*workflows *gating known-reds rerun',
      'pull-requests': '*body title labels reviewers',
      decisions: '*where *format numbering',
      'definition-of-done': '*done docs commits',
      conventions: 'naming formatting commits',
      releasing: '*publishes how rollback',
      'bug-fixing': '*steps guard',
      glossary: '*where',
    });
  });

  it('marks the glossary, and only the glossary, as a pointer-only form', () => {
    expect(FORMS.filter((form) => form.pointerOnly).map((form) => form.id)).toEqual(['glossary']);
  });
});

describe('parseForm — front matter', () => {
  it('parses a blank form holding exactly the six keys', () => {
    const parsed = parseForm(formText(), { file: FILE });
    expect(parsed.ok).toBe(true);
    expect(parsed.form).toMatchObject({
      id: 'testing',
      formVersion: 1,
      state: 'blank',
      pointsTo: null,
      index: null,
      evidence: [],
      invaded: null,
      oldSpellings: [],
      file: FILE,
    });
  });

  it('reads a filled form’s evidence as path and hash, and its invaded date', () => {
    const parsed = parseForm(
      formText({ frontMatter: { state: 'filled', evidence: ['package.json@50fa1bd', 'node_modules/@scope/x/a.md@1ed9907'], invaded: '2026-09-25' } }),
      { file: FILE },
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.form.evidence).toEqual([
      { path: 'package.json', hash: '50fa1bd' },
      { path: 'node_modules/@scope/x/a.md', hash: '1ed9907' },
    ]);
    expect(parsed.form.invaded).toBe('2026-09-25');
  });

  it('still reads the old spelling of the invaded date, and lists it among the old spellings', () => {
    const parsed = parseForm(formText({ frontMatter: { state: 'filled', invaded: undefined, terraformed: '2026-09-25' } }), { file: FILE });
    expect(parsed.ok).toBe(true);
    expect(parsed.form.invaded).toBe('2026-09-25');
    expect(parsed.form.oldSpellings).toEqual([{ where: 'front matter', old: 'terraformed:', now: 'invaded:' }]);
    expect(parseForm(formText({ frontMatter: { invaded: undefined, terraformed: null } }), { file: FILE }).form.invaded).toBeNull();
  });

  it('refuses both spellings of the invaded date in one form', () => {
    const errors = errorsOf(formText({ frontMatter: { invaded: '2026-09-25', terraformed: '2026-09-25' } }));
    expect(errors).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*terraformed.*invaded`))]);
  });

  it('parses a pointer form with an index, and one without', () => {
    const pointer = { form: 'decisions', state: 'pointer', 'points-to': 'records/' };
    const withIndex = parseForm(formText({ frontMatter: { ...pointer, index: 'records/index.md' }, slots: [] }), { file: FILE });
    expect(withIndex.ok).toBe(true);
    expect(withIndex.form).toMatchObject({ id: 'decisions', state: 'pointer', pointsTo: 'records/', index: 'records/index.md' });
    expect(parseForm(formText({ frontMatter: pointer }), { file: FILE }).form.index).toBeNull();
  });

  it('refuses index on a form that is not a pointer, naming the file', () => {
    const errors = errorsOf(formText({ frontMatter: { index: 'records/index.md' } }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^${FILE}: .*index`));
  });

  it('refuses another key, naming the file and the key', () => {
    const errors = errorsOf(formText({ frontMatter: { owner: 'someone' } }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^${FILE}: .*owner`));
  });

  it('refuses each missing key, naming the file and the key', () => {
    for (const key of ['form', 'form-version', 'state', 'points-to', 'evidence', 'invaded']) {
      const errors = errorsOf(formText({ frontMatter: { [key]: undefined } }));
      expect(errors, key).toHaveLength(1);
      expect(errors[0], key).toMatch(new RegExp(`^${FILE}: .*${key}`));
    }
  });

  it('refuses a state outside blank, filled and pointer, naming the file', () => {
    const errors = errorsOf(formText({ frontMatter: { state: 'partial' } }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^${FILE}: .*state`));
  });

  it('refuses a pointer form that names no path, and a path on a form that is not a pointer', () => {
    expect(errorsOf(formText({ frontMatter: { state: 'pointer' } }))).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*points-to`))]);
    expect(errorsOf(formText({ frontMatter: { 'points-to': 'x.md' } }))).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*points-to`))]);
  });

  it('refuses a form the kit does not have, a form-version that is not a positive whole number, and a malformed evidence line', () => {
    expect(errorsOf(formText({ frontMatter: { form: 'tests' } }))).toEqual([expect.stringMatching(/: .*form/)]);
    expect(errorsOf(formText({ frontMatter: { 'form-version': 0 } }))).toEqual([expect.stringMatching(/: .*form-version/)]);
    expect(errorsOf(formText({ frontMatter: { evidence: ['package.json'] } }))).toEqual([expect.stringMatching(/: .*evidence/)]);
    expect(errorsOf(formText({ frontMatter: { invaded: 'yesterday' } }))).toEqual([expect.stringMatching(/: .*invaded/)]);
  });

  it('refuses a file with no front matter, or front matter that is not YAML, naming the file', () => {
    expect(errorsOf('# Testing\n')).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*front matter`))]);
    expect(errorsOf('---\nform: [testing\n---\n# Testing\n')).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*front matter`))]);
    expect(errorsOf('---\n- a list\n---\n# Testing\n')).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*front matter`))]);
  });
});

describe('parseForm — title, opener and slots', () => {
  it('reads the title and the opener under it', () => {
    const { form } = parseForm(formText(), { file: FILE });
    expect(form.title).toBe('Testing');
    expect(form.opener).toBe('Use this page when adding, changing, or choosing tests.');
  });

  it('reads the slots in order, with their id, heading, required flag, by and verified', () => {
    const text = formText({
      slots: [
        { id: 'commands', heading: 'Commands', required: true, by: 'invade', verified: '2026-09-25', body: '`pnpm test`' },
        { id: 'layout', heading: 'Where tests live', required: true, by: 'invade' },
        { id: 'levels', heading: 'Choosing the level' },
        { id: 'never', heading: 'Never', required: true, by: 'human', body: '- A test never calls the network.' },
      ],
    });
    const { form } = parseForm(text, { file: FILE });
    expect(form.slots.map(({ id, heading, required, by, verified }) => ({ id, heading, required, by, verified }))).toEqual([
      { id: 'commands', heading: 'Commands', required: true, by: 'invade', verified: '2026-09-25' },
      { id: 'layout', heading: 'Where tests live', required: true, by: 'invade', verified: null },
      { id: 'levels', heading: 'Choosing the level', required: false, by: null, verified: null },
      { id: 'never', heading: 'Never', required: true, by: 'human', verified: null },
    ]);
  });

  it('still reads the old spelling of by: invade as by: invade, and lists it among the old spellings', () => {
    const { form } = parseForm(
      formText({ slots: [{ id: 'commands', required: true, by: 'terraform', verified: '2026-09-25' }, { id: 'never', required: true, by: 'human' }] }),
      { file: FILE },
    );
    expect(form.slots.map((slot) => slot.by)).toEqual(['invade', 'human']);
    expect(form.oldSpellings).toEqual([{ where: '"## Commands"', old: 'by: terraform', now: 'by: invade' }]);
  });

  it('refuses a marker whose by: is neither invade nor human', () => {
    const errors = errorsOf(formText({ slots: [{ id: 'levels', heading: 'Choosing the level', by: 'robot' }] }));
    expect(errors).toEqual([expect.stringMatching(new RegExp(`^${FILE}: "## Choosing the level".*marker.*by: invade\\|human`))]);
  });

  it('refuses a malformed slot marker, naming the file and the heading', () => {
    const errors = errorsOf(formText({ slots: [{ id: 'levels', heading: 'Choosing the level', marker: '<!-- slot: levels · mandatory -->' }] }));
    expect(errors).toEqual([expect.stringMatching(new RegExp(`^${FILE}: "## Choosing the level".*marker`))]);
  });

  it('refuses a slot id used twice', () => {
    const errors = errorsOf(formText({ slots: [{ id: 'levels' }, { id: 'levels', heading: 'Again' }] }));
    expect(errors).toEqual([expect.stringMatching(new RegExp(`^${FILE}: .*"levels".*twice`))]);
  });

  it('lists a heading with no marker apart, never as a slot', () => {
    const { form } = parseForm(formText({ slots: [{ id: 'levels' }, { id: 'notes', heading: 'Notes', marker: null, body: 'Free text.' }] }), { file: FILE });
    expect(form.slots.map((slot) => slot.id)).toEqual(['levels']);
    expect(form.unmarked).toEqual(['Notes']);
  });

  it('never opens a slot on a heading inside a fenced block', () => {
    const body = ['```markdown', '## Not a heading', '```'].join('\n');
    const { form } = parseForm(formText({ slots: [{ id: 'data', body }, { id: 'levels' }] }), { file: FILE });
    expect(form.slots.map((slot) => slot.id)).toEqual(['data', 'levels']);
    expect(form.unmarked).toEqual([]);
    expect(form.slots[0].body.text).toBe(body);
  });
});

describe('parseForm — a section’s body', () => {
  it('reads repository text as text', () => {
    expect(bodyOf('Beside the code, as `*.test.mjs`.\n\nFixtures sit apart.')).toEqual({
      kind: 'text',
      text: 'Beside the code, as `*.test.mjs`.\n\nFixtures sit apart.',
      see: null,
      questions: [],
    });
  });

  it('reads a lone See: line as a section pointer, with or without an anchor', () => {
    expect(bodyOf('See: guides/testing.md')).toMatchObject({ kind: 'pointer', see: { path: 'guides/testing.md', anchor: null } });
    expect(bodyOf('See: apps/web/README.md#deploy-to-production')).toMatchObject({
      kind: 'pointer',
      see: { path: 'apps/web/README.md', anchor: 'deploy-to-production' },
    });
  });

  it('reads a missing body, blank lines and comments alone as empty', () => {
    expect(bodyOf(undefined)).toEqual({ kind: 'empty', text: '', see: null, questions: [] });
    expect(bodyOf('\n\n')).toMatchObject({ kind: 'empty' });
    expect(bodyOf('<!-- what the repository uses to seed data -->')).toMatchObject({ kind: 'empty', text: '' });
  });

  it('reads TODO(human) lines alone as holes, each an open question', () => {
    expect(bodyOf('TODO(human): is there a naming rule for fixture repositories?\n- TODO(human): who owns the seed data?')).toMatchObject({
      kind: 'holes',
      questions: ['is there a naming rule for fixture repositories?', 'who owns the seed data?'],
    });
  });

  it('reads text beside an open question as text, and still lists the question', () => {
    expect(bodyOf('Fixtures sit apart.\nTODO(human): is there a naming rule?')).toMatchObject({
      kind: 'text',
      text: 'Fixtures sit apart.\nTODO(human): is there a naming rule?',
      questions: ['is there a naming rule?'],
    });
  });

  it('reads a See: line beside other text as text', () => {
    expect(bodyOf('Mostly as the guide says.\nSee: guides/testing.md')).toMatchObject({ kind: 'text', see: null });
  });
});

describe('readForm', () => {
  it('reads a form from the file the layout names, says when that file is missing, and throws for a form the kit does not have', () => {
    const { ctx, write } = makeRepo();
    expect(readForm('testing', { ctx })).toEqual({ file: FILE, exists: false });
    write(FILE, formText());
    expect(readForm('testing', { ctx })).toMatchObject({ file: FILE, exists: true, ok: true, form: { id: 'testing', file: FILE } });
    expect(() => readForm('tests', { ctx })).toThrow(/no form "tests"/);
  });
});

describe('resolvePlaybookId — a settled entry’s Became: playbook/<form>#<slot>', () => {
  const never = (body) => formText({ slots: [{ id: 'never', required: true, by: 'human', body }] });

  it('resolves when the form’s file holds the slot and its body is not blank', () => {
    const { ctx } = makeRepo({ files: { [FILE]: never('- A test never calls the network.') } });
    expect(resolvePlaybookId('playbook/testing#never', { ctx })).toEqual({ ok: true });
  });

  it('resolves the decisions form beside the decision records', () => {
    const { ctx } = makeRepo({
      files: { '.omni-loop/knowledge/adr/README.md': formText({ frontMatter: { form: 'decisions' }, slots: [{ id: 'where', body: 'Here.' }] }) },
    });
    expect(resolvePlaybookId('playbook/decisions#where', { ctx })).toEqual({ ok: true });
  });

  it('refuses a form the kit does not have, a missing form file, a missing slot and a blank body, each with a reason', () => {
    const { ctx, write } = makeRepo();
    expect(resolvePlaybookId('playbook/tests#never', { ctx })).toEqual({ ok: false, reason: expect.stringMatching(/no form "tests"/) });
    expect(resolvePlaybookId('playbook/testing#never', { ctx })).toEqual({ ok: false, reason: expect.stringContaining(`no form file at ${FILE}`) });
    write(FILE, formText({ slots: [{ id: 'levels', body: 'x' }] }));
    expect(resolvePlaybookId('playbook/testing#never', { ctx })).toEqual({ ok: false, reason: expect.stringMatching(/has no slot "never"/) });
    write(FILE, never(''));
    expect(resolvePlaybookId('playbook/testing#never', { ctx })).toEqual({ ok: false, reason: expect.stringMatching(/"never" is blank/) });
  });

  it('refuses a form file that does not parse, and an id that is not playbook/<form>#<slot>', () => {
    const { ctx } = makeRepo({ files: { [FILE]: '# Testing\n' } });
    expect(resolvePlaybookId('playbook/testing#never', { ctx })).toEqual({ ok: false, reason: expect.stringMatching(/front matter/) });
    expect(resolvePlaybookId('playbook/testing', { ctx })).toEqual({ ok: false, reason: expect.stringMatching(/playbook\/<form>#<slot>/) });
  });
});
