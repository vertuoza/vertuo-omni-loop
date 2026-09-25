// PRD #45, slice s3: `omni kb init | show | status` and `omni check kb`, each through `main()` on a
// fixture repository. The kit's own templates are the kit defaults throughout.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../lib/config.mjs';
import { FORM_IDS, FORMS, parseForm } from '../lib/playbook/forms.mjs';
import { fillConfig } from '../lib/playbook/resolve.mjs';
import { formTemplate } from '../lib/playbook/templates.mjs';
import { formText, makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

const CONFIG_TEXT = 'kit: 1\nrepo:\n  slug: acme/widgets\ncommands:\n  test: make check\n';
const CONFIG = { '.omni-loop/config.yml': CONFIG_TEXT };
const PLAYBOOK = '.omni-loop/knowledge/playbook';
const TESTING = `${PLAYBOOK}/testing.md`;
const DECISIONS = '.omni-loop/knowledge/adr/README.md';

/** Runs `omni <argv>` in `root`: `{ code, out, err }`. */
async function omni(root, argv, options = {}) {
  const out = [];
  const err = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) }, ...options });
  return { code, out: out.join(''), err: err.join('') };
}

/** The kit default of `form`'s slot `slot`, filled from `config` as `omni kb show` fills it. */
function kitDefault(form, slot, config = { commands: { test: 'make check' } }) {
  const body = parseForm(formTemplate(form)).form.slots.find((entry) => entry.id === slot).body.text;
  return fillConfig(body, ConfigSchema.parse({ kit: 1, ...config })).text;
}

/** Every file under `root`, as `{ <path>: text }`, `.git` left out. */
function snapshot(root, dir = '') {
  const out = {};
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.name === '.git') continue;
    if (entry.isDirectory()) Object.assign(out, snapshot(root, path));
    else out[path] = readFileSync(join(root, path), 'utf8');
  }
  return out;
}

const PLAYBOOK_FORMS = FORM_IDS.filter((id) => id !== 'decisions').map((id) => `${PLAYBOOK}/${id}.md`);
const REGISTERS = ['principles', 'rules', 'invariants'].map((name) => `.omni-loop/knowledge/product/${name}.md`);

describe('omni kb init — acceptance criterion 1', () => {
  it('writes the twelve playbook forms, adr/README.md, the front door README and the empty product registers', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await omni(root, ['kb', 'init']);
    expect(code).toBe(0);
    const written = ['.omni-loop/knowledge/README.md', ...PLAYBOOK_FORMS, DECISIONS, ...REGISTERS];
    expect(Object.keys(snapshot(root)).filter((path) => path.startsWith('.omni-loop/knowledge/')).sort()).toEqual([...written].sort());
    expect(out).toBe(`${written.map((path) => `wrote ${path}`).join('\n')}\nkb init — wrote ${written.length} file(s); 0 already there, left as they were.\n`);
    for (const id of FORM_IDS) {
      const file = id === 'decisions' ? DECISIONS : `${PLAYBOOK}/${id}.md`;
      const parsed = parseForm(readFileSync(join(root, file), 'utf8'), { file });
      expect(parsed.errors ?? [], file).toEqual([]);
      expect(parsed.form, file).toMatchObject({ id, formVersion: 1, state: 'blank', pointsTo: null, evidence: [], terraformed: null });
    }
    expect(await omni(root, ['check', 'knowledge'])).toMatchObject({ code: 0 });
  });

  it('writes each blank form from its template: title, opener, every slot heading and marker, empty bodies', async () => {
    const { root, read } = makeRepo({ git: true, files: CONFIG });
    await omni(root, ['kb', 'init']);
    for (const form of FORMS) {
      const file = form.id === 'decisions' ? DECISIONS : `${PLAYBOOK}/${form.id}.md`;
      const kit = parseForm(formTemplate(form.id)).form;
      const written = parseForm(read(file)).form;
      expect({ title: written.title, opener: written.opener }).toEqual({ title: kit.title, opener: kit.opener });
      expect(written.slots.map(({ id, heading, required, by, verified }) => ({ id, heading, required, by, verified }))).toEqual(
        kit.slots.map(({ id, heading, required }) => ({ id, heading, required, by: null, verified: null })),
      );
      expect(written.slots.every((slot) => slot.body.kind === 'empty'), file).toBe(true);
      expect(read(file)).not.toMatch(/Ported from/);
    }
    const { out } = await omni(root, ['kb', 'show', 'testing']);
    expect(out.match(/^## .*$/gm).every((line) => line.endsWith('[kit default]'))).toBe(true);
  });

  it('writes the front door README filled from the config, naming where each half lives', async () => {
    const { root, read } = makeRepo({ git: true, files: CONFIG });
    await omni(root, ['kb', 'init']);
    const readme = read('.omni-loop/knowledge/README.md');
    expect(readme).not.toMatch(/\{config:|Ported from/);
    expect(readme).toMatch(/^# Knowledge$/m);
    for (const path of ['.omni-loop/knowledge', '.omni-loop/knowledge/adr', PLAYBOOK]) expect(readme).toContain(`\`${path}\``);
  });

  it('writes decisions as a pointer when paths.adr is outside the front door’s adr/, and glossary when paths.glossary is set', async () => {
    const config = `${CONFIG_TEXT}paths:\n  adr: records/adr\n  glossary: records/glossary.md\n`;
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, 'records/adr/0001-x.md': '# 0001 — X\n', 'records/glossary.md': '# Glossary\n' } });
    expect((await omni(root, ['kb', 'init'])).code).toBe(0);
    const decisions = parseForm(read(DECISIONS)).form;
    expect(decisions).toMatchObject({ id: 'decisions', state: 'pointer', pointsTo: 'records/adr', slots: [] });
    expect(parseForm(read(`${PLAYBOOK}/glossary.md`)).form).toMatchObject({ id: 'glossary', state: 'pointer', pointsTo: 'records/glossary.md', slots: [] });
    expect((await omni(root, ['kb', 'show', 'glossary'])).out).toContain('[→ records/glossary.md]\n# Glossary\n');
    expect((await omni(root, ['check', 'kb'])).code).toBe(0);
  });

  it('writes no product register when the registers live elsewhere, and says where they are', async () => {
    const config = `${CONFIG_TEXT}paths:\n  knowledge: truth\n`;
    const { root, read } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
    await omni(root, ['kb', 'init']);
    expect(Object.keys(snapshot(root)).some((path) => path.includes('/product/'))).toBe(false);
    expect(read('.omni-loop/knowledge/README.md')).toContain('`truth`');
  });

  it('a second run writes nothing, and no existing file is ever changed', async () => {
    const mine = formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'commands', required: true, body: 'Ours.' }] });
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        [TESTING]: mine,
        '.omni-loop/knowledge/README.md': '# Our front door\n',
        '.omni-loop/knowledge/product/principles.md': '# Principles\n\nOurs.\n',
      },
    });
    const before = snapshot(root);
    const first = await omni(root, ['kb', 'init']);
    expect(first.out).not.toMatch(/wrote .*(testing|knowledge\/README|principles)\.md/);
    const after = snapshot(root);
    for (const [path, text] of Object.entries(before)) expect(after[path], path).toBe(text);

    const second = await omni(root, ['kb', 'init']);
    expect(second.code).toBe(0);
    // The front door README, the twelve playbook forms, adr/README.md and the three registers.
    expect(second.out).toBe('kb init — wrote 0 file(s); 17 already there, left as they were.\n');
    expect(snapshot(root)).toEqual(after);
  });
});

describe('omni kb show', () => {
  it('prints the kit default for every slot of a form whose file is missing, in template order', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await omni(root, ['kb', 'show', 'testing']);
    expect(code).toBe(0);
    expect(out.match(/^## .*$/gm)).toEqual([
      '## Commands  [kit default]',
      '## Where tests live  [kit default]',
      '## Choosing the level  [kit default]',
      '## Never  [kit default]',
      '## Test data  [kit default]',
    ]);
    expect(out).toContain(`${TESTING} · missing`);
    expect(out).toContain(kitDefault('testing', 'never'));
    expect(out).toContain('make check');
  });
});

describe('omni kb show — acceptance criterion 2: each section says where it came from', () => {
  const FILLED = formText({
    frontMatter: { state: 'filled' },
    slots: [
      { id: 'commands', required: true, by: 'terraform', verified: '2026-09-25', body: '`make check` runs everything.' },
      { id: 'layout', heading: 'Where tests live', required: true, body: 'Beside the code.' },
      { id: 'levels', heading: 'Choosing the level' },
      { id: 'never', required: true, body: 'See: guides/never.md' },
      { id: 'data', heading: 'Test data', body: 'TODO(human): is there a naming rule for fixture repositories?' },
    ],
  });

  it('prints the sections in template order, labelled [repo], [kit default], [→ <path>] and [hole]', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: FILLED, 'guides/never.md': '# Never\n\nA test never calls the network.\n' } });
    const { code, out, err } = await omni(root, ['kb', 'show', 'testing']);
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(out.match(/^## .*$/gm)).toEqual([
      '## Commands  [repo · verified 2026-09-25]',
      '## Where tests live  [repo]',
      '## Choosing the level  [kit default]',
      '## Never  [→ guides/never.md]',
      '## Test data  [hole]',
    ]);
    expect(out).toContain(`${TESTING} · filled`);
    expect(out).toContain('## Never  [→ guides/never.md]\n# Never\n\nA test never calls the network.\n');
    expect(out).toContain(`## Choosing the level  [kit default]\n${kitDefault('testing', 'levels')}\n`);
    expect(out).toContain(`## Test data  [hole]\n${kitDefault('testing', 'data')}\nTODO(human): is there a naming rule for fixture repositories?\n`);
  });

  it('fills a kit default naming {config:commands.test} with the fixture’s command', async () => {
    const blank = FILLED.replace('`make check` runs everything.', '');
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: blank, 'guides/never.md': 'x\n' } });
    const { out } = await omni(root, ['kb', 'show', 'testing']);
    expect(out).toContain('## Commands  [kit default]\n`make check` runs the whole suite.');
    expect(out).not.toContain('{config:');
  });

  it('prints the resolved form as JSON with --json', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: FILLED, 'guides/never.md': 'x\n' } });
    const { code, out } = await omni(root, ['kb', 'show', 'testing', '--json']);
    expect(code).toBe(0);
    const json = JSON.parse(out);
    expect(json).toMatchObject({ form: 'testing', file: TESTING, state: 'filled', title: 'Testing' });
    expect(json.sections.map(({ slot, source }) => `${slot}:${source}`)).toEqual(['commands:repo', 'layout:repo', 'levels:kit', 'never:pointer', 'data:hole']);
  });

  it('warns on a dead See: line and still exits 0', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: FILLED } });
    const { code, err } = await omni(root, ['kb', 'show', 'testing']);
    expect(code).toBe(0);
    expect(err).toBe(`warning: ${TESTING}: "## Never" See: guides/never.md does not exist\n`);
  });

  it('exits 2 naming the forms, for a form the kit does not have or none at all', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    for (const argv of [['kb', 'show', 'deploying'], ['kb', 'show'], ['kb'], ['kb', 'nope']]) {
      const { code, err } = await omni(root, argv);
      expect(code).toBe(2);
      expect(err).toMatch(/^usage: omni kb[^\n]*\n$/);
    }
    expect((await omni(root, ['kb', 'show', 'deploying'])).err).toContain('briefing, setup, architecture');
  });
});

describe('omni kb show — acceptance criterion 3: a pointer shows its target; the decisions are read live', () => {
  it('a form with state: pointer shows its whole target', async () => {
    const pointer = formText({ frontMatter: { form: 'ci', state: 'pointer', 'points-to': 'guides/ci.md' }, title: 'CI', slots: [] });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [`${PLAYBOOK}/ci.md`]: pointer, 'guides/ci.md': '# CI\n\nOne workflow gates the merge.\n' } });
    const { code, out } = await omni(root, ['kb', 'show', 'ci']);
    expect(code).toBe(0);
    expect(out).toBe(`# CI\n${PLAYBOOK}/ci.md · pointer\n\n[→ guides/ci.md]\n# CI\n\nOne workflow gates the merge.\n`);
  });

  const RECORDS = {
    'records/0001-first.md': '# 0001 — The first decision\n\nBody.\n',
    'records/0002-second.md': '# 0002 — The second decision\n',
    'records/0002-clash.md': 'Status: accepted\n\n# 0002 — A clash\n',
    'records/0004-fourth.md': '# 0004 — The fourth decision\n',
    'records/README.md': '# Records\n',
    'records/notes.txt': 'n',
  };

  it('lists every record with its title, flags a shared number, and prints the next free number', async () => {
    const config = `${CONFIG_TEXT}paths:\n  adr: records\n`;
    const pointer = formText({ frontMatter: { form: 'decisions', state: 'pointer', 'points-to': 'records', index: 'records/README.md' }, title: 'Decision records', slots: [] });
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, [DECISIONS]: pointer, ...RECORDS } });
    const { code, out } = await omni(root, ['kb', 'show', 'decisions']);
    expect(code).toBe(0);
    expect(out).toContain('[→ records]\n# Records\n');
    expect(out.slice(out.indexOf('## Records'))).toBe(
      [
        '## Records  [read live from records]',
        '0001  0001 — The first decision',
        '0002  0002 — A clash',
        '0002  0002 — The second decision',
        '0004  0004 — The fourth decision',
        '! 0002 is used by 2 records: records/0002-clash.md, records/0002-second.md',
        'Next free number: 0005',
        '',
      ].join('\n'),
    );
  });

  it('reads the records beside a decisions form that is not a pointer, and says when there are none', async () => {
    const { root, write } = makeRepo({ git: true, files: CONFIG });
    const empty = await omni(root, ['kb', 'show', 'decisions']);
    expect(empty.out).toContain('## Where they live  [kit default]\nDecision records live in `.omni-loop/knowledge/adr`.');
    expect(empty.out.slice(empty.out.indexOf('## Records'))).toBe(
      '## Records  [read live from .omni-loop/knowledge/adr]\nNo decision records yet.\nNext free number: 0001\n',
    );

    write('.omni-loop/knowledge/adr/0001-x.md', 'No heading here.\n');
    const json = JSON.parse((await omni(root, ['kb', 'show', 'decisions', '--json'])).out);
    expect(json.records).toEqual({
      dir: '.omni-loop/knowledge/adr',
      records: [{ number: '0001', file: '.omni-loop/knowledge/adr/0001-x.md', title: null }],
      shared: [],
      next: '0002',
    });
  });
});

/** The testing form, every slot filled, `slots` overriding one by id, `extra` slots after. */
function testingForm({ frontMatter = {}, slots = {}, extra = [] } = {}) {
  const base = [
    { id: 'commands', heading: 'Commands', required: true, body: '`make check` runs everything.' },
    { id: 'layout', heading: 'Where tests live', required: true, body: 'Beside the code.' },
    { id: 'levels', heading: 'Choosing the level', body: 'Unit first.' },
    { id: 'never', heading: 'Never', required: true, body: 'A test never sleeps.' },
    { id: 'data', heading: 'Test data', body: 'Small, and named for what it proves.' },
  ];
  return formText({ frontMatter: { state: 'filled', ...frontMatter }, slots: [...base.map((slot) => ({ ...slot, ...slots[slot.id] })), ...extra] });
}

/** `git hash-object` answered from `hashes` (path → hex), every other command run for real. */
function hashing(hashes) {
  return (command, args, options) => {
    if (command === 'git' && args[0] === 'hash-object') return `${hashes[args.at(-1)]}\n`;
    return execFileSync(command, args, options);
  };
}

/** The violation lines of a failed guard's report. */
const violations = (out) => out.split('\n').filter((line) => line.startsWith('  ')).map((line) => line.trim());

describe('omni check kb — acceptance criterion 4: fails naming the file', () => {
  const CI = `${PLAYBOOK}/ci.md`;
  const pointer = (frontMatter) => formText({ frontMatter: { form: 'ci', state: 'pointer', ...frontMatter }, title: 'CI', slots: [] });
  const FAILURES = [
    ['a points-to path that does not exist', { [CI]: pointer({ 'points-to': 'gone/ci.md' }) }, `${CI}: points-to gone/ci.md does not exist`],
    ['an index path that does not exist', { [CI]: pointer({ 'points-to': 'guides', index: 'guides/gone.md' }), 'guides/a.md': 'a' }, `${CI}: index guides/gone.md does not exist`],
    ['a See: path that does not exist', { [TESTING]: testingForm({ slots: { never: { body: 'See: gone/never.md#rules' } } }) }, `${TESTING}: "## Never" See: gone/never.md does not exist`],
    ['an evidence path that does not exist', { [TESTING]: testingForm({ frontMatter: { evidence: ['gone.json@abcdef1'] } }) }, `${TESTING}: evidence gone.json does not exist`],
    [
      'a slot id the template does not define',
      { [TESTING]: testingForm({ extra: [{ id: 'flaky', heading: 'Flaky tests', body: 'Retry once.' }] }) },
      `${TESTING}: slot "flaky" is not a slot of the testing form — its slots are commands, layout, levels, never, data`,
    ],
    [
      'a required slot whose marker is missing',
      { [TESTING]: testingForm({ slots: { layout: { marker: null } } }) },
      `${TESTING}: required slot "layout" has no marker — want "## Where tests live", then <!-- slot: layout · required -->`,
    ],
    ['a form-version newer than the kit’s', { [TESTING]: testingForm({ frontMatter: { 'form-version': 2 } }) }, `${TESTING}: form-version 2 is newer than this kit's 1 for the testing form — upgrade the kit`],
    ['front matter that does not parse', { [TESTING]: '---\nform: [testing\n---\n\n# Testing\n' }, new RegExp(`^${TESTING}: front matter is not YAML`)],
    ['front matter holding another key', { [TESTING]: testingForm({ frontMatter: { owner: 'me' } }) }, new RegExp(`^${TESTING}: front matter .*\\(owner\\)`)],
    ['front matter naming another form', { [TESTING]: testingForm({ frontMatter: { form: 'ci' } }) }, `${TESTING}: front matter says form: ci, but this is the testing form's file`],
  ];

  it.each(FAILURES)('fails on %s', async (_, files, line) => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...files } });
    const { code, out } = await omni(root, ['check', 'kb']);
    expect(code).toBe(1);
    expect(out).toMatch(/^check kb — a form does not hold what it claims:\n/);
    expect(violations(out)).toEqual([typeof line === 'string' ? line : expect.stringMatching(line)]);
  });

  it('asks no section of a pointer form, and lets a folder pointer without an index through', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [CI]: pointer({ 'points-to': 'guides/' }), 'guides/a.md': 'a' } });
    expect(await omni(root, ['check', 'kb'])).toMatchObject({ code: 0 });
  });
});

describe('omni check kb — acceptance criterion 4: warns, exit 0', () => {
  it('prints one warning line for each TODO(human), blank required core slot, stale evidence and missing form', async () => {
    const testing = testingForm({
      frontMatter: { evidence: ['package.json@abcdef1', 'vitest.config.mjs@1234567'] },
      slots: { data: { body: 'TODO(human): is there a naming rule for fixture repositories?\nTODO(human): who owns the fixtures?' } },
    });
    const blank = (form) => formText({ frontMatter: { form }, slots: FORMS.find((entry) => entry.id === form).slots.map(({ id, required }) => ({ id, required })) });
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        [TESTING]: testing,
        [`${PLAYBOOK}/ci.md`]: blank('ci'),
        [`${PLAYBOOK}/releasing.md`]: blank('releasing'),
        'package.json': '{}\n',
        'vitest.config.mjs': 'export default {};\n',
      },
    });
    const exec = hashing({ 'package.json': 'abcdef1234567890', 'vitest.config.mjs': '89abcdef01234567' });
    const { code, out, err } = await omni(root, ['check', 'kb'], { exec });
    expect(code).toBe(0);
    const missing = (form) => `warning: ${form === 'decisions' ? DECISIONS : `${PLAYBOOK}/${form}.md`}: missing — the kit defaults apply; \`omni kb init\` writes it`;
    expect(err.split('\n').filter(Boolean)).toEqual([
      missing('briefing'),
      missing('setup'),
      missing('architecture'),
      `warning: ${TESTING}: evidence vitest.config.mjs@1234567 is stale — the file has changed since (now 89abcde)`,
      `warning: ${TESTING}: "## Test data" TODO(human): is there a naming rule for fixture repositories?`,
      `warning: ${TESTING}: "## Test data" TODO(human): who owns the fixtures?`,
      missing('verification'),
      `warning: ${PLAYBOOK}/ci.md: required slot "workflows" is blank — the kit default applies`,
      `warning: ${PLAYBOOK}/ci.md: required slot "gating" is blank — the kit default applies`,
      missing('pull-requests'),
      missing('decisions'),
      missing('definition-of-done'),
      missing('conventions'),
      missing('bug-fixing'),
      missing('glossary'),
    ]);
    expect(out).toBe('check kb — 13 form(s): 1 filled, 2 blank, 10 missing; 15 warning(s).\n');
  });
});

describe('omni check kb — acceptance criterion 5: check all runs it', () => {
  it('stays green on a repository with no forms, and prints the kb line', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out, err } = await omni(root, ['check', 'all']);
    expect(code).toBe(0);
    expect(out).toMatch(/^check kb — 13 form\(s\): 13 missing; 13 warning\(s\)\.$/m);
    expect(err.match(/^warning: .*missing/gm)).toHaveLength(13);
  });

  it('goes red on a broken form, and stays green after omni kb init', async () => {
    const { root, write } = makeRepo({ git: true, files: CONFIG });
    expect((await omni(root, ['kb', 'init'])).code).toBe(0);
    const { code, out } = await omni(root, ['check', 'all']);
    expect(code).toBe(0);
    expect(out).toMatch(/^check kb — 13 form\(s\): 13 blank; \d+ warning\(s\)\.$/m);

    write(TESTING, testingForm({ slots: { never: { body: 'See: gone.md' } } }));
    const red = await omni(root, ['check', 'all']);
    expect(red.code).toBe(1);
    expect(red.out).toContain(`  ${TESTING}: "## Never" See: gone.md does not exist`);
  });
});
