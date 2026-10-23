// PRD #45, slice s3: `omni kb init | show | status` and `omni check kb`, each through `main()` on a
// fixture repository. The kit's own templates are the kit defaults throughout.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../lib/config.ts';
import { loadContext } from '../lib/context.ts';
import { readKnowledge } from '../lib/knowledge/registers.ts';
import { FORM_IDS, FORMS, parseForm } from '../lib/playbook/forms.ts';
import { fillConfig } from '../lib/playbook/resolve.ts';
import { formTemplate } from '../lib/playbook/templates.ts';
import { assertDefined } from '../test/assert.ts';
import { formText, makeRepo } from '../test/fixture.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';
import { realExec } from '../test/fixture.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import type { SlotFixture } from '../test/fixture.ts';
import type { StatusMap } from './commands/kb.ts';
import type { Graph } from '../lib/knowledge/graph.ts';
import type { Neighbourhood } from '../lib/knowledge/neighbourhood.ts';
import type { ResolvedForm } from '../lib/playbook/resolve.ts';

const CONFIG_TEXT = 'kit: 1\nrepo:\n  slug: acme/widgets\ncommands:\n  test: make check\n';
const CONFIG = { '.omni-loop/config.yml': CONFIG_TEXT };
const PLAYBOOK = '.omni-loop/knowledge/playbook';
const TESTING = `${PLAYBOOK}/testing.md`;
const DECISIONS = '.omni-loop/knowledge/adr/README.md';

/** Runs `omni <argv>` in `root`: `{ code, out, err }`. */
async function omni(root: string, argv: readonly string[], options = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) }, ...options });
  return { code, out: out.join(''), err: err.join('') };
}

/** The kit default of `form`'s slot `slot`, filled from `config` as `omni kb show` fills it. */
function kitDefault(form: string, slot: string, config = { commands: { test: 'make check' } }) {
  const template = parseForm(formTemplate(form)).form;
  assertDefined(template, `the ${form} template`);
  const entry = template.slots.find(({ id }) => id === slot);
  assertDefined(entry, `the ${form} template's ${slot} slot`);
  const body = entry.body.text;
  return fillConfig(body, ConfigSchema.parse({ kit: 1, ...config })).text;
}

/** Every file under `root`, as `{ <path>: text }`, `.git` left out. */
function snapshot(root: string, dir = ''): Record<string, string> {
  const out: Record<string, string> = {};
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
  it('writes the thirteen playbook forms, adr/README.md, the front door README and the empty product registers', async () => {
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
      expect(parsed.form, file).toMatchObject({ id, formVersion: 1, state: 'blank', pointsTo: null, evidence: [], invaded: null, oldSpellings: [] });
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
      assertDefined(kit, `the ${form.id} template`);
      assertDefined(written, file);
      expect({ title: written.title, opener: written.opener }).toEqual({ title: kit.title, opener: kit.opener });
      expect(written.slots.map(({ id, heading, required, by, verified }) => ({ id, heading, required, by, verified }))).toEqual(
        kit.slots.map(({ id, heading, required }) => ({ id, heading, required, by: null, verified: null })),
      );
      expect(written.slots.every((slot) => slot.body.kind === 'empty'), file).toBe(true);
      expect(read(file)).not.toMatch(/Ported from/);
    }
    const { out } = await omni(root, ['kb', 'show', 'testing']);
    const headings = out.match(/^## .*$/gm);
    assertDefined(headings, 'the headings');
    expect(headings.every((line) => line.endsWith('[kit default]'))).toBe(true);
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
    // The front door README, the fourteen playbook forms, adr/README.md and the three registers.
    expect(second.out).toBe('kb init — wrote 0 file(s); 19 already there, left as they were.\n');
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
      { id: 'commands', required: true, by: 'invade', verified: '2026-09-25', body: '`make check` runs everything.' },
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
    const json = JSON.parse(out) as ResolvedForm;
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

describe('omni kb show — the knowledge tree’s levels, each section tagged with its own (PRD 2416, s1)', () => {
  const PLAN_COPY = '.omni-loop/local/tree/plan-repo/playbook/testing.md';
  const SETTINGS_COPY = '.omni-loop/local/tree/omni-settings/playbook/testing.md';
  const filled = (slots: SlotFixture[]) => formText({ frontMatter: { state: 'filled' }, slots });
  const OURS = filled([
    { id: 'commands', required: true, body: '`make check` runs everything.' },
    { id: 'data', heading: 'Test data', body: 'TODO(human): is there a naming rule for fixture repositories?' },
  ]);
  const PLAN = filled([
    { id: 'commands', required: true, body: 'Plan: `make all`.' },
    { id: 'layout', heading: 'Where tests live', required: true, body: 'Plan: beside the code.' },
  ]);
  const SETTINGS = filled([
    { id: 'commands', required: true, body: 'Settings: `make ci`.' },
    { id: 'layout', heading: 'Where tests live', required: true, body: 'Settings: under test/.' },
    { id: 'levels', heading: 'Choosing the level', body: 'Settings: start from the risk.' },
    { id: 'data', heading: 'Test data', body: 'Settings: seed per test.' },
  ]);

  it('acceptance criteria 1 and 2: [repo] first, then [plan repo], then [omni settings], then [kit default]', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: OURS, [PLAN_COPY]: PLAN, [SETTINGS_COPY]: SETTINGS } });
    const { code, out, err } = await omni(root, ['kb', 'show', 'testing']);
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(out.match(/^## .*$/gm)).toEqual([
      '## Commands  [repo]',
      '## Where tests live  [plan repo]',
      '## Choosing the level  [omni settings]',
      '## Never  [kit default]',
      '## Test data  [hole · omni settings]',
    ]);
    expect(out).toContain('## Commands  [repo]\n`make check` runs everything.\n\n## Where tests live  [plan repo]\nPlan: beside the code.\n');
    expect(out).toContain('## Choosing the level  [omni settings]\nSettings: start from the risk.\n');
    expect(out).toContain(`## Never  [kit default]\n${kitDefault('testing', 'never')}\n`);
    expect(out).toContain('## Test data  [hole · omni settings]\nSettings: seed per test.\nTODO(human): is there a naming rule for fixture repositories?\n');
    expect(out).not.toContain('Plan: `make all`.');
    expect(out).not.toContain('Settings: `make ci`.');
  });

  it('the Omni settings answer what the plan repository leaves, and --json names each section’s level', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [SETTINGS_COPY]: SETTINGS } });
    const { code, out } = await omni(root, ['kb', 'show', 'testing', '--json']);
    expect(code).toBe(0);
    const json = JSON.parse(out) as ResolvedForm;
    expect(json).toMatchObject({ form: 'testing', file: TESTING, state: 'missing' });
    expect(json.sections.map(({ slot, source, label }) => `${slot}:${source} ${label}`)).toEqual([
      'commands:omni-settings [omni settings]',
      'layout:omni-settings [omni settings]',
      'levels:omni-settings [omni settings]',
      'never:kit [kit default]',
      'data:omni-settings [omni settings]',
    ]);
  });

  it('acceptance criterion 5: a repository with no copy prints the form byte for byte as it did, and an empty tree folder changes nothing', async () => {
    const files = { ...CONFIG, [TESTING]: OURS };
    const before = await omni(makeRepo({ git: true, files }).root, ['kb', 'show', 'testing']);
    const { root, write } = makeRepo({ git: true, files });
    write('.omni-loop/local/tree/plan-repo/README.md', 'no form here\n');
    const after = await omni(root, ['kb', 'show', 'testing']);
    expect(after).toEqual(before);
    expect(before.out).toBe(
      [
        '# Testing',
        `${TESTING} · filled`,
        '',
        '## Commands  [repo]',
        '`make check` runs everything.',
        '',
        `## Where tests live  [kit default]\n${kitDefault('testing', 'layout')}`,
        '',
        `## Choosing the level  [kit default]\n${kitDefault('testing', 'levels')}`,
        '',
        `## Never  [kit default]\n${kitDefault('testing', 'never')}`,
        '',
        `## Test data  [hole]\n${kitDefault('testing', 'data')}`,
        'TODO(human): is there a naming rule for fixture repositories?',
        '',
      ].join('\n'),
    );
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
    const json: unknown = JSON.parse((await omni(root, ['kb', 'show', 'decisions', '--json'])).out);
    expect(dig(json, 'records')).toEqual({
      dir: '.omni-loop/knowledge/adr',
      records: [{ number: '0001', file: '.omni-loop/knowledge/adr/0001-x.md', title: null, prd: null }],
      shared: [],
      next: '0002',
    });
  });
});

describe('omni kb show decisions — the latest 20 records, --all for every one (PRD 1951)', () => {
  const ADR = '.omni-loop/knowledge/adr';
  const number = (n: number) => String(n).padStart(4, '0');
  /** `count` records, `0001` to `<count>`, in the default folder, plus `extra` files. */
  const records = (count: number, extra: Record<string, string> = {}) => ({
    ...Object.fromEntries(Array.from({ length: count }, (_, i) => [`${ADR}/${number(i + 1)}-r.md`, `# ADR-${number(i + 1)} — Record ${i + 1}\n`])),
    ...extra,
  });
  const line = (n: number) => `${number(n)}  ADR-${number(n)} — Record ${n}`;
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => line(from + i));
  const listOf = (out: string) => out.slice(out.indexOf('## Records'));

  it('prints the 20 highest records in order, a live count of the older ones naming --all, then the next free number', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...records(25) } });
    const { code, out } = await omni(root, ['kb', 'show', 'decisions']);
    expect(code).toBe(0);
    expect(listOf(out)).toBe(
      [`## Records  [read live from ${ADR}]`, ...range(6, 25), '… 5 older records: omni kb show decisions --all', 'Next free number: 0026', ''].join('\n'),
    );
  });

  it('prints every record and no older line under --all, and --json carries every one', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...records(25) } });
    const all = await omni(root, ['kb', 'show', 'decisions', '--all']);
    expect(all.code).toBe(0);
    expect(listOf(all.out)).toBe([`## Records  [read live from ${ADR}]`, ...range(1, 25), 'Next free number: 0026', ''].join('\n'));
    const json: unknown = JSON.parse((await omni(root, ['kb', 'show', 'decisions', '--json'])).out);
    expect(dig(json, 'records', 'records')).toHaveLength(25);
    const both: unknown = JSON.parse((await omni(root, ['kb', 'show', 'decisions', '--json', '--all'])).out);
    expect(dig(both, 'records', 'records')).toHaveLength(25);
  });

  it('prints all of 20 records and no older line', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...records(20) } });
    const { out } = await omni(root, ['kb', 'show', 'decisions']);
    expect(listOf(out)).toBe([`## Records  [read live from ${ADR}]`, ...range(1, 20), 'Next free number: 0021', ''].join('\n'));
  });

  it('still warns of a number two older records share', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...records(25, { [`${ADR}/0002-clash.md`]: '# ADR-0002 — A clash\n' }) } });
    const { out } = await omni(root, ['kb', 'show', 'decisions']);
    expect(out).toContain(`… 6 older records: omni kb show decisions --all\n! 0002 is used by 2 records: ${ADR}/0002-clash.md, ${ADR}/0002-r.md\nNext free number: 0026\n`);
    expect(out).not.toContain(line(5));
  });

  it('refuses --all with any other form, naming it', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out, err } = await omni(root, ['kb', 'show', 'testing', '--all']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toContain('--all');
  });
});

/** The testing form, every slot filled, `slots` overriding one by id, `extra` slots after. */
function testingForm({
  frontMatter = {},
  slots = {},
  extra = [],
}: { frontMatter?: Record<string, unknown>; slots?: Record<string, Partial<SlotFixture>>; extra?: SlotFixture[] } = {}) {
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
function hashing(hashes: Record<string, string>) {
  return (command: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    if (command === 'git' && args[0] === 'hash-object') return `${hashes[String(args.at(-1))]}\n`;
    return realExec(command, args, options);
  };
}

/** The violation lines of a failed guard's report. */
const violations = (out: string) => out.split('\n').filter((line: string) => line.startsWith('  ')).map((line: string) => line.trim());

describe('omni kb status — the map, derived every time', () => {
  const FILES = {
    ...CONFIG,
    [TESTING]: testingForm({
      frontMatter: { evidence: ['package.json@abcdef1', 'vitest.config.ts@1234567', 'gone.json@7654321'] },
      slots: { data: { body: 'TODO(human): is there a naming rule for fixture repositories?' } },
    }),
    [`${PLAYBOOK}/ci.md`]: formText({ frontMatter: { form: 'ci', state: 'pointer', 'points-to': 'guides/ci.md' }, title: 'CI', slots: [] }),
    [`${PLAYBOOK}/setup.md`]: formText({
      frontMatter: { form: 'setup', state: 'filled' },
      slots: [
        { id: 'prerequisites', required: true, body: 'See: guides/setup.md' },
        { id: 'install', required: true, body: 'See: guides/setup.md#install' },
      ],
    }),
    [`${PLAYBOOK}/verification.md`]: formText({ frontMatter: { form: 'verification' }, slots: [{ id: 'preflight', required: true, body: 'TODO(human): which command is the preflight?' }] }),
    'guides/ci.md': '# CI\n',
    'guides/setup.md': '# Setup\n',
    'package.json': '{}\n',
    'vitest.config.ts': 'export default {};\n',
  };
  const exec = hashing({ 'package.json': 'abcdef1234567890', 'vitest.config.ts': '89abcdef01234567' });

  it('--json lists each form with its state, source, open questions and stale evidence', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'status', '--json'], { exec });
    expect(code).toBe(0);
    const status = JSON.parse(out) as StatusMap;
    expect(status.frontDoor).toBe('.omni-loop/knowledge');
    expect(status.forms.map(({ form, kind, state, source }) => `${form} ${kind} ${state} ${source}`)).toEqual([
      'briefing core missing kit',
      'setup core filled pointer',
      'architecture core missing kit',
      'testing core filled repo',
      'verification core blank kit',
      'ci core pointer pointer',
      'pull-requests core missing kit',
      'decisions core missing kit',
      'definition-of-done extended missing kit',
      'conventions extended missing kit',
      'releasing extended missing kit',
      'bug-fixing extended missing kit',
      'review extended missing kit',
      'design extended missing kit',
      'glossary extended missing kit',
    ]);
    const testing = status.forms.find((form) => form.form === 'testing');
    expect(testing).toMatchObject({
      file: TESTING,
      questions: [{ slot: 'data', question: 'is there a naming rule for fixture repositories?' }],
      stale: [
        { path: 'vitest.config.ts', hash: '1234567', now: '89abcdef01234567' },
        { path: 'gone.json', hash: '7654321', now: null },
      ],
    });
    assertDefined(testing, 'the testing form');
    expect(testing.sections.map(({ slot, source }) => `${slot}:${source}`)).toEqual(['commands:repo', 'layout:repo', 'levels:repo', 'never:repo', 'data:hole']);
    expect(status.forms.find((form) => form.form === 'verification')?.questions).toEqual([{ slot: 'preflight', question: 'which command is the preflight?' }]);
  });

  it('prints one line per form, then every open question and every stale evidence entry', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'status'], { exec });
    expect(code).toBe(0);
    const lines = out.split('\n').map((line) => line.trim().replace(/\s+/g, ' '));
    expect(lines[0]).toBe('kb status — 15 form(s) in .omni-loop/knowledge');
    expect(lines).toContain('briefing core missing kit default');
    expect(lines).toContain('testing core filled repo 1 open question(s) · 2 stale evidence');
    expect(lines).toContain('ci core pointer pointer');
    expect(lines.slice(lines.indexOf('Open questions: 2'))).toEqual([
      'Open questions: 2',
      `testing#data (${TESTING}): is there a naming rule for fixture repositories?`,
      `verification#preflight (${PLAYBOOK}/verification.md): which command is the preflight?`,
      'Stale evidence: 2',
      `testing (${TESTING}): vitest.config.ts@1234567 — now 89abcde`,
      `testing (${TESTING}): gone.json@7654321 — gone`,
      '',
    ]);
  });

  it('says so when there is nothing open and nothing stale', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { out } = await omni(root, ['kb', 'status']);
    expect(out).toMatch(/\nOpen questions: none\.\nStale evidence: none\.\n$/);
  });
});

describe('omni kb status — sections per level of the knowledge tree (PRD 2416, s2)', () => {
  const PLAN_COPY = '.omni-loop/local/tree/plan-repo/playbook/testing.md';
  const SETTINGS_COPY = '.omni-loop/local/tree/omni-settings/playbook/testing.md';
  const filled = (slots: SlotFixture[]) => formText({ frontMatter: { state: 'filled' }, slots });
  const OURS = filled([{ id: 'commands', required: true, body: '`make check` runs everything.' }]);
  const PLAN = filled([{ id: 'layout', heading: 'Where tests live', required: true, body: 'Plan: beside the code.' }]);
  const SETTINGS = filled([{ id: 'levels', heading: 'Choosing the level', body: 'Settings: start from the risk.' }]);

  it('counts each form’s sections per level, in the text and in --json, with every level present', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: OURS, [PLAN_COPY]: PLAN, [SETTINGS_COPY]: SETTINGS } });
    const json = JSON.parse((await omni(root, ['kb', 'status', '--json'])).out) as StatusMap;
    const testing = json.forms.find(({ form }) => form === 'testing');
    expect(testing?.levels).toEqual({ repo: 1, 'plan repo': 1, 'omni settings': 1, 'kit default': 2 });
    const lines = (await omni(root, ['kb', 'status'])).out.split('\n').map((line) => line.trim().replace(/\s+/g, ' '));
    expect(lines).toContain('testing core filled repo 1 repo, 1 plan repo, 1 omni settings, 2 kit default');
  });

  it('a repository with no other level prints the rows as before: no level column, and --json holds only the levels that answer', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: OURS } });
    const { out } = await omni(root, ['kb', 'status']);
    const lines = out.split('\n').map((line) => line.trim().replace(/\s+/g, ' '));
    expect(lines).toContain('testing core filled repo');
    expect(lines).toContain('briefing core missing kit default');
    expect(out).not.toMatch(/plan repo|omni settings/);
    const json = JSON.parse((await omni(root, ['kb', 'status', '--json'])).out) as StatusMap;
    const levels = json.forms.find(({ form }) => form === 'testing')?.levels;
    expect(Object.keys(levels ?? {})).toEqual(['repo', 'kit default']);
  });
});

describe('omni kb status — the pages that read the Omni settings (PRD 2417, s2)', () => {
  const SETTINGS_REVIEW = '.omni-loop/local/tree/omni-settings/playbook/review.md';
  const SETTINGS_DOD = '.omni-loop/local/tree/omni-settings/playbook/definition-of-done.md';
  const filled = (id: string, body: string) => formText({ frontMatter: { state: 'filled' }, slots: [{ id, required: true, body }] });

  it('names the pages whose sections read the Omni settings, after the rows, in the text and in --json', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, [SETTINGS_REVIEW]: filled('fix', 'Settings: fix it.'), [SETTINGS_DOD]: filled('done', 'Settings: done means green.') },
    });
    const { out } = await omni(root, ['kb', 'status']);
    const line = out.split('\n').find((l) => l.startsWith('reads the Omni settings:'));
    const json = JSON.parse((await omni(root, ['kb', 'status', '--json'])).out) as StatusMap;
    expect(json.readsOmniSettings).toEqual(expect.arrayContaining(['review', 'definition-of-done']));
    expect(line).toBe(`reads the Omni settings: ${(json.readsOmniSettings ?? []).join(', ')}`);
  });

  it('a repository with no Omni-settings copy prints exactly today’s rows: no line, no key', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { out } = await omni(root, ['kb', 'status']);
    expect(out).not.toContain('reads the Omni settings');
    const json = JSON.parse((await omni(root, ['kb', 'status', '--json'])).out) as Record<string, unknown>;
    expect(json).not.toHaveProperty('readsOmniSettings');
  });
});

describe('omni kb status — laws and proposals per register folder (PRD #68)', () => {
  const K = '.omni-loop/knowledge';
  const PROPOSED = 'Proposed: invade 2026-09-25\n';
  const principle = (id: string, proposed = false) => `## ${id}\n\nA decision.\n\nWhy: x\nDecided: y\nSource: PRD #68\n${proposed ? PROPOSED : ''}\n`;
  const rule = (id: string, serves: string, proposed = false) =>
    `## ${id}\n\nA rule.\n\nServes: ${serves}\nSource: PRD #68\nEnforced by: unenforced\nStated: 2026-09-25\n${proposed ? PROPOSED : ''}\n`;
  const FILES = {
    ...CONFIG,
    [`${K}/product/principles.md`]: `# Principles\n\n${principle('P-PRODUCT-1')}${principle('P-PRODUCT-2', true)}`,
    [`${K}/product/rules.md`]: `# Rules\n\n${rule('BR-PRODUCT-1', 'P-PRODUCT-1')}`,
    [`${K}/product/invariants.md`]: '# Invariants\n',
    [`${K}/domains/quote/README.md`]: '# Quote\n\nGlossary term: Quote\n',
    [`${K}/domains/quote/principles.md`]: '# Principles\n',
    [`${K}/domains/quote/rules.md`]: `# Rules\n\n${rule('BR-QUOTE-1', 'P-PRODUCT-2', true)}${rule('BR-QUOTE-2', 'P-PRODUCT-2', true)}`,
    [`${K}/domains/quote/invariants.md`]: '# Invariants\n',
  };

  it('--json carries the laws and the proposals of each register folder', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'status', '--json']);
    expect(code).toBe(0);
    expect(dig(JSON.parse(out), 'registers')).toEqual([
      { folder: `${K}/product`, laws: 2, proposals: 1 },
      { folder: `${K}/domains/quote`, laws: 0, proposals: 2 },
    ]);
  });

  it('prints one line per register folder, and says so when there is none', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { out } = await omni(root, ['kb', 'status']);
    const lines = out.split('\n').map((line) => line.trim().replace(/\s+/g, ' '));
    expect(lines.slice(lines.indexOf('Registers: 2 folder(s)'), lines.indexOf('Registers: 2 folder(s)') + 3)).toEqual([
      'Registers: 2 folder(s)',
      `${K}/product 2 law(s) · 1 proposal(s)`,
      `${K}/domains/quote 0 law(s) · 2 proposal(s)`,
    ]);
    const { root: empty } = makeRepo({ git: true, files: CONFIG });
    const none = await omni(empty, ['kb', 'status', '--json']);
    expect(dig(JSON.parse(none.out), 'registers')).toEqual([]);
    expect((await omni(empty, ['kb', 'status'])).out).toMatch(/\nRegisters: none\.\n/);
  });

  it('omni check knowledge passes, warning once per proposed entry, naming its file and id', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out, err } = await omni(root, ['check', 'knowledge']);
    expect(code).toBe(0);
    expect(out).toMatch(/3 proposed\./);
    const warnings = err.split('\n').filter((line) => line.includes('is proposed by'));
    expect(warnings).toEqual([
      `warning: ${K}/product/principles.md: P-PRODUCT-2 — is proposed by invade on 2026-09-25 — not a law until a person removes its "Proposed:" line.`,
      `warning: ${K}/domains/quote/rules.md: BR-QUOTE-1 — is proposed by invade on 2026-09-25 — not a law until a person removes its "Proposed:" line.`,
      `warning: ${K}/domains/quote/rules.md: BR-QUOTE-2 — is proposed by invade on 2026-09-25 — not a law until a person removes its "Proposed:" line.`,
    ]);
  });

  it('omni knowledge <id> prints who proposed the entry and when', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['knowledge', 'BR-QUOTE-1']);
    expect(code).toBe(0);
    expect(out).toContain('proposed by invade on 2026-09-25');
  });
});

describe('omni kb graph — the knowledge graph (PRD #149, acceptance criterion 1)', () => {
  const K = '.omni-loop/knowledge';
  const PROPOSED = 'Proposed: harvest 2026-09-26\n';
  const principle = (id: string, proposed = false) => `## ${id}\n\nA decision.\n\nWhy: x\nSource: PRD #3\n${proposed ? PROPOSED : ''}\n`;
  const kept = (id: string, serves: string | null, { proposed = false, kind = null }: { proposed?: boolean; kind?: string | null } = {}) =>
    `## ${id}\n\nA rule.\n\n${kind ? `Kind: ${kind}\n` : ''}${serves ? `Serves: ${serves}\n` : ''}Source: PRD #7\nEnforced by: unenforced\n${proposed ? PROPOSED : ''}\n`;
  const PRODUCT = {
    ...CONFIG,
    [`${K}/product/principles.md`]: `# Principles\n\n${principle('P-PRODUCT-1')}${principle('P-PRODUCT-2', true)}`,
    [`${K}/product/rules.md`]: `# Rules\n\n${kept('BR-PRODUCT-1', 'P-PRODUCT-1')}`,
    [`${K}/product/invariants.md`]: `# Invariants\n\n${kept('N-PRODUCT-1', null)}`,
  };
  const FILES = {
    ...PRODUCT,
    [`${K}/domains/quote/rules.md`]: `# Rules\n\n${kept('BR-QUOTE-1', 'P-PRODUCT-1', { proposed: true })}${kept('BR-QUOTE-2', 'P-QUOTE-3', { proposed: true })}`,
    [`${K}/cross-domain/advisor--quote.md`]: `# Advisor and quote\n\n${kept('X-ADVISOR-QUOTE-1', 'P-PRODUCT-1', { kind: 'invariant' })}`,
  };
  const squeeze = (out: string) => out.split('\n').map((line: string) => line.trim().replace(/\s+/g, ' '));

  it('--json prints one JSON document: version 1, the repository slug, the domains, the entries and the links', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out, err } = await omni(root, ['kb', 'graph', '--json']);
    expect(code).toBe(0);
    expect(err).toBe('');
    const graph = JSON.parse(out) as Graph;
    expect(graph).toMatchObject({ version: 1, repo: 'acme/widgets', loose: ['N-PRODUCT-1', 'BR-QUOTE-2'], unserved: ['P-PRODUCT-2'] });
    expect(graph.domains.map(({ name, counts }) => `${name} ${Object.values(counts).join(' ')}`)).toEqual(['product 2 1 1 3 1', 'quote 0 2 0 0 2']);
    expect(graph.entries.map(({ id }) => id)).toEqual(['P-PRODUCT-1', 'P-PRODUCT-2', 'BR-PRODUCT-1', 'N-PRODUCT-1', 'BR-QUOTE-1', 'BR-QUOTE-2', 'X-ADVISOR-QUOTE-1']);
    expect(graph.links).toEqual([
      { from: 'BR-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' },
      { from: 'BR-QUOTE-1', to: 'P-PRODUCT-1', kind: 'serves' },
      { from: 'X-ADVISOR-QUOTE-1', to: 'P-PRODUCT-1', kind: 'serves' },
    ]);
  });

  it('prints the summary: the totals, a line per domain and per cross-domain pair, the unserved principles and the loose entries', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'graph']);
    expect(code).toBe(0);
    expect(squeeze(out)).toEqual([
      'kb graph — 2 domains, 7 entries, 3 links',
      'product 2 principles · 1 rule · 1 invariant 3 laws · 1 proposed',
      'quote 0 principles · 2 rules · 0 invariants 0 laws · 2 proposed',
      'advisor--quote 0 principles · 0 rules · 1 invariant 1 law · 0 proposed',
      'unserved principles (1): P-PRODUCT-2',
      'loose entries (2): N-PRODUCT-1, BR-QUOTE-2',
      '',
    ]);
  });

  it('lines the columns up, the spec’s shape for one domain', async () => {
    const { root } = makeRepo({ git: true, files: PRODUCT });
    const { out } = await omni(root, ['kb', 'graph']);
    expect(out).toBe(
      [
        'kb graph — 1 domain, 4 entries, 1 link',
        '  product    2 principles · 1 rule · 1 invariant    3 laws · 1 proposed',
        '  unserved principles (1): P-PRODUCT-2',
        '  loose entries (1): N-PRODUCT-1',
        '',
      ].join('\n'),
    );
  });

  it('prints an empty graph and exits 0 in a repository without a knowledge folder', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const json = await omni(root, ['kb', 'graph', '--json']);
    expect(json.code).toBe(0);
    expect(JSON.parse(json.out)).toEqual({ version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] });
    const text = await omni(root, ['kb', 'graph']);
    expect(text.code).toBe(0);
    expect(text.out).toBe('kb graph — 0 domains, 0 entries, 0 links\n  unserved principles: none\n  loose entries: none\n');
  });

  it('exits 2 on a second argument or an unknown flag', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    for (const argv of [['kb', 'graph', 'BR-PRODUCT-1', 'extra'], ['kb', 'graph', '--json', 'P-PRODUCT-1', 'extra'], ['kb', 'graph', '--domain']]) {
      const { code, out, err } = await omni(root, argv);
      expect(code, argv.join(' ')).toBe(2);
      expect(out).toBe('');
      expect(err).toMatch(/^(usage: omni kb graph \[<id> \| --paths|omni kb graph: unknown flag --domain\.)/);
    }
    expect((await omni(root, ['kb'])).err).toContain('omni kb graph [<id> | --paths <file>…] [--depth <1-3>] [--json]');
  });
});

describe('omni kb graph <id> — the neighbourhood of one entry (PRD 1797, s1)', () => {
  const K = '.omni-loop/knowledge';
  const entry = (id: string, statement: string, fields: Record<string, string> = {}) =>
    `## ${id}\n\n${statement}\n\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n`;
  const rules = Array.from({ length: 8 }, (_, i) => entry(`BR-PRODUCT-${i + 2}`, `Rule ${i + 2} holds.`, { Serves: 'P-PRODUCT-1', Source: 'README.md' }));
  const FILES = {
    ...CONFIG,
    [`${K}/product/principles.md`]: `# Principles\n\n${entry('P-PRODUCT-1', 'Every change is reviewed. By a person.', { Why: 'Trust.', Source: 'README.md' })}`,
    [`${K}/product/rules.md`]: `# Rules\n\n${entry('BR-PRODUCT-1', 'One approval is needed. Always.', {
      Serves: 'P-PRODUCT-1',
      Source: 'settled.md, PRD #7',
      'Enforced by': 'kit/test/plugin.test.ts',
      Governs: '^kit/plugin/skills/(pr)/, ^kit/test/plugin\\.test\\.ts$',
      Locked: '@pierrederval, 2026-10-13',
    })}${rules.join('')}${entry('BR-PRODUCT-10', 'Pending proof.', { Source: 'README.md', 'Enforced by': 'pending #42', Locked: '@pierrederval, 2026-10-13' })}`,
    [`${K}/product/invariants.md`]: '# Invariants\n\n',
    [`${K}/adr/0006-a.md`]: '# ADR-0006 — Without a named summary check\n\n**Status:** adopted · **PRD:** #7\n\n## Context\n\nx\n',
    [`${K}/adr/0007-b.md`]: '# ADR-0007 — Another PRD\n\n**Status:** adopted · **PRD:** #8\n',
  };
  const OFFLINE_LINE = "product knowledge: offline — no cached copy of the product's Legal and Glossary; only this repository's links are shown.";

  it('prints the start line, its neighbours in aligned columns, at most 6 per edge kind, then the product line', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out, err } = await omni(root, ['kb', 'graph', 'BR-PRODUCT-1']);
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(out).toBe(
      [
        'BR-PRODUCT-1 · rule · law, locked by @pierrederval — One approval is needed.',
        '  up    serves       P-PRODUCT-1                       principle  Every change is reviewed.',
        '  down  enforced-by  test:kit/test/plugin.test.ts      test',
        '  down  governs      path:^kit/plugin/skills/(pr)/     path',
        '  down  governs      path:^kit/test/plugin\\.test\\.ts$  path',
        '  side  sibling      BR-PRODUCT-2                      rule       Rule 2 holds.',
        '  side  sibling      BR-PRODUCT-3                      rule       Rule 3 holds.',
        '  side  sibling      BR-PRODUCT-4                      rule       Rule 4 holds.',
        '  side  sibling      BR-PRODUCT-5                      rule       Rule 5 holds.',
        '  side  sibling      BR-PRODUCT-6                      rule       Rule 6 holds.',
        '  side  sibling      BR-PRODUCT-7                      rule       Rule 7 holds.',
        '  side  sibling      … and 2 more (--json lists them all)',
        '  side  same-prd     ADR-0006                          adr        Without a named summary check',
        'product knowledge: none — this repository belongs to no product.',
        '',
      ].join('\n'),
    );
  });

  it('lists the start as down serves from its principle', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { out } = await omni(root, ['kb', 'graph', 'P-PRODUCT-1']);
    expect(out.split('\n')[0]).toBe('P-PRODUCT-1 · principle — Every change is reviewed.');
    expect(out).toMatch(/\n {2}down {2}serves {2}BR-PRODUCT-1 {2}rule {2}One approval is needed\.\n/);
    expect(out).toContain('  down  serves  … and 3 more (--json lists them all)\n');
  });

  it('says a pending proof on the start line, and offline when an Omni page is set', async () => {
    const config = { '.omni-loop/config.yml': `${CONFIG_TEXT}ask:\n  url: https://omni.example\n` };
    const { root } = makeRepo({ git: true, files: { ...FILES, ...config } });
    const { code, out } = await omni(root, ['kb', 'graph', 'BR-PRODUCT-10']);
    expect(code).toBe(0);
    expect(out).toBe(['BR-PRODUCT-10 · rule · law, locked by @pierrederval · enforced by: pending #42 — Pending proof.', OFFLINE_LINE, ''].join('\n'));
    const json = JSON.parse((await omni(root, ['kb', 'graph', 'BR-PRODUCT-10', '--json'])).out) as Neighbourhood;
    expect(json.product).toEqual({ state: 'offline', key: null, cachedOn: null });
  });

  it('--json prints the whole neighbourhood as one versioned document, never cut', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out, err } = await omni(root, ['kb', 'graph', '--json', 'BR-PRODUCT-1']);
    expect(code).toBe(0);
    expect(err).toBe('');
    const built = JSON.parse(out) as Neighbourhood;
    expect(Object.keys(built)).toEqual(['version', 'shape', 'repo', 'start', 'depth', 'product', 'nodes', 'edges']);
    expect(built).toMatchObject({ version: 1, shape: 'neighbourhood', repo: 'acme/widgets', start: ['BR-PRODUCT-1'], depth: 1, product: { state: 'none', key: null, cachedOn: null } });
    expect(built.nodes[0]).toEqual({ id: 'BR-PRODUCT-1', kind: 'rule', label: 'One approval is needed.', status: 'law', file: `${K}/product/rules.md`, origin: 'repository', hop: 0 });
    expect(built.nodes.find(({ id }) => id === 'test:kit/test/plugin.test.ts')).toEqual({
      id: 'test:kit/test/plugin.test.ts',
      kind: 'test',
      label: null,
      status: null,
      file: 'kit/test/plugin.test.ts',
      origin: 'repository',
      hop: 1,
    });
    expect(built.nodes.find(({ id }) => id === 'ADR-0006')).toMatchObject({ kind: 'adr', file: `${K}/adr/0006-a.md`, label: 'Without a named summary check' });
    expect(built.edges.filter(({ kind }) => kind === 'sibling')).toHaveLength(8);
    expect(built.nodes).toHaveLength(1 + 1 + 1 + 2 + 8 + 1);
    expect(built.edges).toContainEqual({ from: 'BR-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' });
    expect(built.edges.some(({ to }) => to === 'ADR-0007')).toBe(false);
  });

  it('exits 1 on an id that names no entry, naming it', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    for (const argv of [['kb', 'graph', 'BR-PRODUCT-99'], ['kb', 'graph', 'product', '--json']]) {
      const { code, out, err } = await omni(root, argv);
      expect(code, argv.join(' ')).toBe(1);
      expect(out).toBe('');
      expect(err).toBe(`kb graph: no entry "${String(argv[2])}" in the knowledge folder.\n`);
    }
  });

  it('kb graph and kb graph --json with no start print the whole folder as before', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const text = await omni(root, ['kb', 'graph']);
    expect(text.out.split('\n')[0]).toBe('kb graph — 1 domain, 11 entries, 9 links');
    const whole = JSON.parse((await omni(root, ['kb', 'graph', '--json'])).out) as Graph;
    expect(whole.version).toBe(1);
    expect('shape' in whole).toBe(false);
    expect(whole.entries).toHaveLength(11);
  });
});

describe('omni kb graph <id> — screens and the product cache (PRD 1797, s2)', () => {
  const K = '.omni-loop/knowledge';
  const CACHE_PATH = '.omni-loop/local/product-knowledge.json';
  const entry = (id: string, statement: string, fields: Record<string, string> = {}) =>
    `## ${id}\n\n${statement}\n\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n`;
  const FILES = {
    '.omni-loop/config.yml': `${CONFIG_TEXT}ask:\n  url: https://omni.example\n`,
    [`${K}/product/principles.md`]: '# Principles\n\n',
    [`${K}/product/invariants.md`]: '# Invariants\n\n',
    [`${K}/product/rules.md`]: `# Rules\n\n${entry('BR-PRODUCT-1', 'A quote shows its total.', { Serves: 'L-OMNI-1', Source: 'README.md', Governs: '^kit/a/' })}${entry('BR-PRODUCT-2', 'Other.', { Serves: 'L-OMNI-9', Source: 'README.md' })}`,
    [`${K}/design/screens/quote.md`]: '---\nscreen: quote\nstatus: draft\nimplements: [kit/a/page.ts]\n---\n\n## Regions\n\nx\n',
  };
  const COPY = {
    product: 'omni-loop',
    readAt: '2026-10-16T08:00:00.000Z',
    legal: [{ id: 'L-OMNI-1', statement: 'Personal data stays in the EU. Always.', source: 'GDPR', owner: 'dpo' }],
    glossary: [{ term: 'Quote', meaning: 'A priced offer.', avoid: [] }],
  };

  it('with a cache, reaches the screen, the Legal entry and the term, and ends on the cached line', async () => {
    const { root } = makeRepo({ git: true, files: { ...FILES, [CACHE_PATH]: JSON.stringify(COPY) } });
    const { code, out } = await omni(root, ['kb', 'graph', 'BR-PRODUCT-1']);
    expect(code).toBe(0);
    expect(out).toContain('  up    serves     L-OMNI-1');
    expect(out).toContain('Personal data stays in the EU.');
    expect(out).toMatch(/side +screen +screen:quote +screen +draft\n/);
    expect(out).toMatch(/side +uses-term +term:Quote +term +A priced offer\.\n/);
    expect(out.endsWith('product knowledge: cached 2026-10-16 (omni-loop).\n')).toBe(true);
  });

  it('marks Legal and term nodes origin product with a null file in the JSON', async () => {
    const { root } = makeRepo({ git: true, files: { ...FILES, [CACHE_PATH]: JSON.stringify(COPY) } });
    const built = JSON.parse((await omni(root, ['kb', 'graph', 'BR-PRODUCT-1', '--json'])).out) as Neighbourhood;
    expect(built.product).toEqual({ state: 'cached', key: 'omni-loop', cachedOn: '2026-10-16' });
    const product = built.nodes.filter(({ origin }) => origin === 'product');
    expect(product.map(({ id }) => id)).toEqual(['L-OMNI-1', 'term:Quote']);
    expect(product.every(({ file }) => file === null)).toBe(true);
    expect(built.nodes.find(({ id }) => id === 'screen:quote')).toMatchObject({ file: `${K}/design/screens/quote.md`, origin: 'repository' });
  });

  it('labels a Legal entry the cache lacks, and starts a walk from a cached Legal entry', async () => {
    const { root } = makeRepo({ git: true, files: { ...FILES, [CACHE_PATH]: JSON.stringify(COPY) } });
    expect((await omni(root, ['kb', 'graph', 'BR-PRODUCT-2'])).out).toContain('not in the cached product knowledge');
    const legal = await omni(root, ['kb', 'graph', 'L-OMNI-1']);
    expect(legal.code).toBe(0);
    expect(legal.out).toMatch(/^L-OMNI-1 · legal — Personal data stays in the EU\.\n {2}down {2}serves {2}BR-PRODUCT-1/);
  });

  it('with no cache shows no Legal or term node, only the offline line', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { out } = await omni(root, ['kb', 'graph', 'BR-PRODUCT-1']);
    expect(out).not.toContain('L-OMNI-1');
    expect(out).not.toContain('term:');
    expect(out).toContain('screen:quote');
    expect(out.endsWith("product knowledge: offline — no cached copy of the product's Legal and Glossary; only this repository's links are shown.\n")).toBe(true);
    expect((await omni(root, ['kb', 'graph', 'L-OMNI-1'])).code).toBe(1);
  });

  it('reads a cache that cannot be parsed as offline, and says so', async () => {
    const { root } = makeRepo({ git: true, files: { ...FILES, [CACHE_PATH]: '{ not json' } });
    const { code, out } = await omni(root, ['kb', 'graph', 'BR-PRODUCT-1']);
    expect(code).toBe(0);
    expect(out.endsWith('product knowledge: offline — the cached product knowledge could not be read.\n')).toBe(true);
    expect(out).not.toContain('L-OMNI-1');
  });
});

describe('omni check kb — acceptance criterion 4: fails naming the file', () => {
  const CI = `${PLAYBOOK}/ci.md`;
  const pointer = (frontMatter: Record<string, unknown>) => formText({ frontMatter: { form: 'ci', state: 'pointer', ...frontMatter }, title: 'CI', slots: [] });
  const FAILURES: [string, Record<string, string>, string | RegExp][] = [
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

  it.each(FAILURES)('fails on %s', async (_: string, files: Record<string, string>, line: string | RegExp) => {
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
      frontMatter: { evidence: ['package.json@abcdef1', 'vitest.config.ts@1234567'] },
      slots: { data: { body: 'TODO(human): is there a naming rule for fixture repositories?\nTODO(human): who owns the fixtures?' } },
    });
    const blank = (form: string) => {
      const kit = FORMS.find((entry) => entry.id === form);
      assertDefined(kit, `the ${form} form`);
      return formText({ frontMatter: { form }, slots: kit.slots.map(({ id, required }) => ({ id, required })) });
    };
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        [TESTING]: testing,
        [`${PLAYBOOK}/ci.md`]: blank('ci'),
        [`${PLAYBOOK}/releasing.md`]: blank('releasing'),
        'package.json': '{}\n',
        'vitest.config.ts': 'export default {};\n',
      },
    });
    const exec = hashing({ 'package.json': 'abcdef1234567890', 'vitest.config.ts': '89abcdef01234567' });
    const { code, out, err } = await omni(root, ['check', 'kb'], { exec });
    expect(code).toBe(0);
    const missing = (form: string) => `warning: ${form === 'decisions' ? DECISIONS : `${PLAYBOOK}/${form}.md`}: missing — the kit defaults apply; \`omni kb init\` writes it`;
    expect(err.split('\n').filter(Boolean)).toEqual([
      missing('briefing'),
      missing('setup'),
      missing('architecture'),
      `warning: ${TESTING}: evidence vitest.config.ts@1234567 is stale — the file has changed since (now 89abcde)`,
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
      missing('review'),
      missing('design'),
      missing('glossary'),
    ]);
    expect(out).toBe('check kb — 15 form(s): 1 filled, 2 blank, 12 missing; 17 warning(s).\n');
  });
});

describe('omni check kb — the old spellings (PRD #68)', () => {
  it('warns once per old spelling, naming the file, and exits 0', async () => {
    const testing = formText({
      frontMatter: { state: 'filled', invaded: undefined, terraformed: '2026-09-25' },
      slots: [
        { id: 'commands', required: true, by: 'terraform', body: '`make check` runs everything.' },
        { id: 'layout', heading: 'Where tests live', required: true, body: 'Beside the code.' },
        { id: 'never', required: true, by: 'terraform', body: '- A test never calls the network.' },
      ],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [TESTING]: testing } });
    const { code, err } = await omni(root, ['check', 'kb']);
    expect(code).toBe(0);
    expect(err.split('\n').filter((line) => line.includes(TESTING))).toEqual([
      `warning: ${TESTING}: front matter says terraformed: — the old spelling; write invaded:`,
      `warning: ${TESTING}: "## Commands" says by: terraform — the old spelling; write by: invade`,
      `warning: ${TESTING}: "## Never" says by: terraform — the old spelling; write by: invade`,
    ]);
  });

  it('never meets an old spelling in a form omni kb init wrote', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect((await omni(root, ['kb', 'init'])).code).toBe(0);
    const written = Object.entries(snapshot(root)).filter(([path]) => path.startsWith('.omni-loop/knowledge/'));
    for (const [path, text] of written) expect(text, path).not.toMatch(/terraform/i);
    expect((await omni(root, ['check', 'kb'])).err).not.toMatch(/old spelling/);
  });
});

describe('omni check kb — acceptance criterion 5: check all runs it', () => {
  it('stays green on a repository with no forms, and prints the kb line', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out, err } = await omni(root, ['check', 'all']);
    expect(code).toBe(0);
    expect(out).toMatch(/^check kb — 15 form\(s\): 15 missing; 15 warning\(s\)\.$/m);
    expect(err.match(/^warning: .*missing/gm)).toHaveLength(15);
  });

  it('goes red on a broken form, and stays green after omni kb init', async () => {
    const { root, write } = makeRepo({ git: true, files: CONFIG });
    expect((await omni(root, ['kb', 'init'])).code).toBe(0);
    const { code, out } = await omni(root, ['check', 'all']);
    expect(code).toBe(0);
    expect(out).toMatch(/^check kb — 15 form\(s\): 15 blank; \d+ warning\(s\)\.$/m);

    write(TESTING, testingForm({ slots: { never: { body: 'See: gone.md' } } }));
    const red = await omni(root, ['check', 'all']);
    expect(red.code).toBe(1);
    expect(red.out).toContain(`  ${TESTING}: "## Never" See: gone.md does not exist`);
  });
});

describe('imported knowledge in a plan repository (PRD 522, s2)', () => {
  const K = '.omni-loop/knowledge';
  const COPY = `${K}/repos/nimbus-core`;
  const READ_AT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
  const PLAN_CONFIG = {
    '.omni-loop/config.yml': [
      CONFIG_TEXT.trimEnd(),
      'plan:',
      '  guide: null',
      '  targets:',
      '    - repo: acme/nimbus-core',
      '      role: back-end',
      '      knowledge: imported',
      `      readAt: ${READ_AT}`,
      '    - repo: acme/nimbus-apps',
      '      role: front-end',
      '      knowledge: own',
      '',
    ].join('\n'),
  };
  const principle = (id: string) => `## ${id}\n\nA decision.\n\nWhy: x\nDecided: y\nSource: PRD #1\n\n`;
  const rule = (id: string, serves: string, { source = 'src/Quote/QuoteRule.php', enforcedBy = 'tests/QuoteRuleTest.php', stated = 'Stated: 2026-09-29\n' } = {}) =>
    `## ${id}\n\nA rule.\n\nServes: ${serves}\nSource: ${source}\nEnforced by: ${enforcedBy}\n${stated}\n`;
  const OWN = {
    [`${K}/product/principles.md`]: `# Principles\n\n${principle('P-PRODUCT-1')}`,
    [`${K}/product/rules.md`]: `# Rules\n\n${rule('BR-PRODUCT-1', 'P-PRODUCT-1', { source: 'PRD #1', enforcedBy: 'unenforced' })}`,
    [`${K}/product/invariants.md`]: '# Invariants\n',
  };
  // The copy's evidence, its See: line and its registers' paths all name files of the target, none
  // of which exists on the plan repository's disk.
  const COPY_FILES = {
    [`${COPY}/README.md`]: `# acme/nimbus-core — imported\n\nRead at ${READ_AT}. A draft.\n`,
    [`${COPY}/playbook/testing.md`]: testingForm({
      frontMatter: { evidence: ['composer.json@abcdef1', 'phpunit.xml@1234567'] },
      slots: { never: { body: 'See: docs/testing.md' } },
    }),
    [`${COPY}/product/principles.md`]: `# Principles\n\n${principle('P-PRODUCT-1')}${principle('P-PRODUCT-2')}`,
    [`${COPY}/product/rules.md`]: `# Rules\n\n${rule('BR-PRODUCT-1', 'P-PRODUCT-2')}`,
    [`${COPY}/product/invariants.md`]: '# Invariants\n',
  };
  const FILES = { ...PLAN_CONFIG, ...OWN, ...COPY_FILES };

  it('omni check kb passes on a well-formed copy, looking none of its target paths up on disk', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out, err } = await omni(root, ['check', 'kb']);
    expect(out).not.toMatch(/does not exist/);
    expect(code).toBe(0);
    expect(out).toMatch(/^check kb — 15 form\(s\): 15 missing; \d+ warning\(s\); 1 imported copy checked\.$/m);
    expect(err).toContain(`warning: ${COPY}: ${COPY}/playbook/briefing.md: missing — the kit defaults apply; \`omni kb init\` writes it`);
    expect(err).not.toMatch(/evidence composer\.json/);
  });

  it.each([
    [
      'a form',
      { [`${COPY}/playbook/testing.md`]: testingForm({ frontMatter: { form: 'ci' } }) },
      `${COPY}: ${COPY}/playbook/testing.md: front matter says form: ci, but this is the testing form's file`,
    ],
    [
      'a register entry',
      { [`${COPY}/product/rules.md`]: `# Rules\n\n${rule('BR-PRODUCT-1', 'P-PRODUCT-2', { stated: '' })}` },
      `${COPY}: ${COPY}/product/rules.md: BR-PRODUCT-1 — is missing a "Stated: YYYY-MM-DD" line.`,
    ],
    [
      'a register layout',
      { [`${COPY}/product/invariants.md`]: null },
      `${COPY}: ${COPY}/product/invariants.md: product — is missing.`,
    ],
  ])('omni check kb fails on a malformed copy (%s) with the own-knowledge message, prefixed by the copy', async (_: string, change: Record<string, string | null>, line: string) => {
    const files = Object.fromEntries(Object.entries<string | null>({ ...FILES, ...change }).flatMap(([path, text]) => (text === null ? [] : [[path, text]])));
    const { root } = makeRepo({ git: true, files });
    const { code, out } = await omni(root, ['check', 'kb']);
    expect(code).toBe(1);
    expect(violations(out)).toEqual([line]);
  });

  it('omni check kb fails when an imported target has no copy', async () => {
    const files = Object.fromEntries(Object.entries(FILES).filter(([path]) => !path.startsWith(COPY)));
    const { root } = makeRepo({ git: true, files });
    const { code, out } = await omni(root, ['check', 'kb']);
    expect(code).toBe(1);
    expect(violations(out)).toEqual([`${COPY}: missing — plan.targets lists acme/nimbus-core as imported, so its copy lives here`]);
  });

  it('the plan repository’s own registers never read a copy, even for an id both hold', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { entries } = readKnowledge({ ctx: loadContext(root) });
    expect(entries.filter((entry) => entry.file.startsWith(`${K}/repos/`))).toEqual([]);
    expect(entries.map(({ id, file }) => `${id} ${file}`)).toEqual([`P-PRODUCT-1 ${K}/product/principles.md`, `BR-PRODUCT-1 ${K}/product/rules.md`]);
    const knowledge = await omni(root, ['check', 'knowledge']);
    expect(knowledge.out).toMatch(/1 principle\(s\), 1 rule\(s\)/);
    expect(knowledge.code).toBe(0);
    expect((await omni(root, ['knowledge', 'P-PRODUCT-2'])).code).not.toBe(0);
  });

  it('omni kb status --json lists each imported target’s forms and registers under targets', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'status', '--json']);
    expect(code).toBe(0);
    const status = JSON.parse(out) as StatusMap;
    expect(Object.keys(status)).toEqual(['frontDoor', 'forms', 'registers', 'targets', 'ungoverned']);
    expect(status.registers).toEqual([{ folder: `${K}/product`, laws: 2, proposals: 0 }]);
    expect(status.targets).toHaveLength(1);
    const [copy] = status.targets;
    assertDefined(copy, 'the copy');
    expect(Object.keys(copy)).toEqual(['repo', 'folder', 'forms', 'registers']);
    expect(copy.repo).toBe('acme/nimbus-core');
    expect(copy.folder).toBe(COPY);
    expect(copy.registers).toEqual([{ folder: `${COPY}/product`, laws: 3, proposals: 0 }]);
    expect(copy.forms.map(({ form }) => form)).toEqual(status.forms.map(({ form }) => form));
    expect(copy.forms.find(({ form }) => form === 'testing')).toMatchObject({ file: `${COPY}/playbook/testing.md`, state: 'filled', stale: [] });
    expect(copy.forms.find(({ form }) => form === 'decisions')).toMatchObject({ file: `${COPY}/adr/README.md`, state: 'missing' });
  });

  it('omni kb status prints a line per imported copy, and --json says targets: [] without a plan section', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const lines = (await omni(root, ['kb', 'status'])).out.split('\n').map((line) => line.trim().replace(/\s+/g, ' '));
    expect(lines.slice(lines.indexOf('Imported copies: 1'), lines.indexOf('Imported copies: 1') + 2)).toEqual([
      'Imported copies: 1',
      `acme/nimbus-core ${COPY} · 1 filled · 14 missing · 1 register folder(s)`,
    ]);
    const { root: plain } = makeRepo({ git: true, files: CONFIG });
    expect(dig(JSON.parse((await omni(plain, ['kb', 'status', '--json'])).out), 'targets')).toEqual([]);
    expect((await omni(plain, ['kb', 'status'])).out).not.toMatch(/Imported copies/);
  });
});

describe('omni kb laws — only what a change touches (PRD 1726, s2)', () => {
  const K = '.omni-loop/knowledge';
  const LAW_CONFIG = `${CONFIG_TEXT}laws:\n  owners: [pierrederval]\n`;
  const TEST_FILE = 'kit/lib/outbox/gate.test.ts';
  const principle = (id: string) => `## ${id}\n\nA decision.\n\nWhy: x\nDecided: y\nSource: PRD #1726\n\n`;
  const rule = (id: string, statement: string, extra: string[] = []) =>
    `## ${id}\n\n${statement}\n\nServes: P-PRODUCT-1\nSource: PRD #1726\nEnforced by: ${TEST_FILE}\nStated: 2026-10-12\n${extra.map((line) => `${line}\n`).join('')}\n`;
  const LOCK = 'Locked: @pierrederval, 2026-10-14';
  const RULES = [
    rule('BR-PRODUCT-1', 'Only a person merges into main. The agent never does.', [LOCK, 'Governs: ^kit/lib/outbox/', 'Proposed law: An agent never merges into main.']),
    rule('BR-PRODUCT-2', 'A quote total is never negative. It is clamped.', ['Governs: ^kit/lib/quote/, ^apps/quote/']),
    rule('BR-PRODUCT-3', 'A rule nobody said the files of.'),
    rule('BR-PRODUCT-4', 'The ledger keeps its history.', ['Governs: ^game/ledger\\.ts$']),
  ].join('');
  const THESIS = [
    '# Thesis',
    '',
    '## Who it is for',
    '',
    '- Product managers.',
    '',
    '## The laws',
    '',
    '- BR-PRODUCT-1 — Only a person merges into main. If broken: unreviewed code reaches every user.',
    '',
    '## What it refuses',
    '',
    '- Merging on its own.',
    '',
  ].join('\n');
  const files = (extra: Record<string, string> = {}): Record<string, string> => ({
    '.omni-loop/config.yml': LAW_CONFIG,
    [TEST_FILE]: 'test\n',
    'kit/lib/quote/total.ts': 'x\n',
    'game/ledger.ts': 'x\n',
    [`${K}/product/principles.md`]: `# Principles\n\n${principle('P-PRODUCT-1')}`,
    [`${K}/product/rules.md`]: `# Rules\n\n${RULES}`,
    [`${K}/product/invariants.md`]: '# Invariants\n',
    [`${K}/product/thesis.md`]: THESIS,
    ...extra,
  });
  const LAW_LINE =
    'law BR-PRODUCT-1 — Only a person merges into main. If broken: unreviewed code reaches every user. Changing it needs @pierrederval to approve the pull request.';
  const UNGOVERNED = '1 rule(s) say no "Governs:", so none of them is shown here (omni kb status counts them).';
  const NOTHING_APPLIES = 'Nothing applies to these files in particular.';
  const lines = (out: string) => out.split('\n').filter(Boolean);
  /** `omni <argv>` exits 2, its one line saying `text`. */
  const refused = async (root: string, argv: readonly string[], text: string) => {
    const { code, err } = await omni(root, argv);
    expect(code).toBe(2);
    expect(err).toContain(text);
  };

  it('prints one plain line per locked law and nothing else, its sentence taken from the thesis', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    const { code, out } = await omni(root, ['kb', 'laws']);
    expect(code).toBe(0);
    expect(lines(out)).toEqual([LAW_LINE]);
  });

  it('falls back to the Proposed law: sentence, then the headline, when the thesis does not say it', async () => {
    const { root } = makeRepo({ git: true, files: files({ [`${K}/product/thesis.md`]: '# Thesis\n' }) });
    expect(lines((await omni(root, ['kb', 'laws'])).out)).toEqual([
      'law BR-PRODUCT-1 — An agent never merges into main. Changing it needs @pierrederval to approve the pull request.',
    ]);
    const bare = RULES.replace('Proposed law: An agent never merges into main.\n', '');
    const { root: noSentence } = makeRepo({ git: true, files: files({ [`${K}/product/rules.md`]: `# Rules\n\n${bare}`, [`${K}/product/thesis.md`]: '# Thesis\n' }) });
    expect(lines((await omni(noSentence, ['kb', 'laws'])).out)).toEqual([
      'law BR-PRODUCT-1 — Only a person merges into main. Changing it needs @pierrederval to approve the pull request.',
    ]);
  });

  it('says so when no law is locked, and names no owner when laws.owners is empty', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect(await omni(root, ['kb', 'laws'])).toMatchObject({ code: 0, out: 'No law is locked yet.\n' });
    const { root: ownerless } = makeRepo({ git: true, files: files({ '.omni-loop/config.yml': CONFIG_TEXT }) });
    expect(lines((await omni(ownerless, ['kb', 'laws'])).out)).toEqual([LAW_LINE.replace('@pierrederval', 'its owner')]);
  });

  it('names each owner\u2019s delegate beside its owner, and never product leadership (PRD 1794)', async () => {
    const delegated = `${CONFIG_TEXT}laws:\n  owners:\n    - login: pierrederval\n      delegate: jdoe\n  leadership: [cto-login]\n`;
    const { root } = makeRepo({ git: true, files: files({ '.omni-loop/config.yml': delegated }) });
    expect(lines((await omni(root, ['kb', 'laws'])).out)).toEqual([
      LAW_LINE.replace('needs @pierrederval to approve', 'needs @pierrederval (or the delegate @jdoe) to approve'),
    ]);
    const mixed = `${CONFIG_TEXT}laws:\n  owners:\n    - login: pierrederval\n      delegate: jdoe\n    - acme/platform\n`;
    const { root: both } = makeRepo({ git: true, files: files({ '.omni-loop/config.yml': mixed }) });
    expect(lines((await omni(both, ['kb', 'laws'])).out)).toEqual([
      LAW_LINE.replace('needs @pierrederval to approve', 'needs @pierrederval (or the delegate @jdoe) or @acme/platform to approve'),
    ]);
  });

  it('--paths adds exactly the rules whose Governs: matches, never one without Governs:', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    const { code, out } = await omni(root, ['kb', 'laws', '--paths', 'kit/lib/quote/total.ts', 'game/ledger.ts']);
    expect(code).toBe(0);
    expect(lines(out)).toEqual([
      'Applies here',
      'rule BR-PRODUCT-2 — A quote total is never negative. (governs)',
      'rule BR-PRODUCT-4 — The ledger keeps its history. (governs)',
      'Global',
      LAW_LINE,
      UNGOVERNED,
    ]);
  });

  it('--paths matches as a flow area does: a regular expression, over a comma-separated list', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    expect(lines((await omni(root, ['kb', 'laws', '--paths', 'apps/quote/page.tsx,game/ledger.ts.bak'])).out)).toEqual([
      'Applies here',
      'rule BR-PRODUCT-2 — A quote total is never negative. (governs)',
      'Global',
      LAW_LINE,
      UNGOVERNED,
    ]);
  });

  it('--paths that no rule governs prints the laws and says so', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    expect(lines((await omni(root, ['kb', 'laws', '--paths', 'README.md'])).out)).toEqual(['Applies here', NOTHING_APPLIES, 'Global', LAW_LINE, UNGOVERNED]);
  });

  it('--json carries the laws, the rules asked for and the ungoverned count', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    const parsed: unknown = JSON.parse((await omni(root, ['kb', 'laws', '--paths', 'game/ledger.ts', '--json'])).out);
    expect(parsed).toEqual({
      laws: [{
        id: 'BR-PRODUCT-1',
        file: `${K}/product/rules.md`,
        sentence: 'Only a person merges into main. If broken: unreviewed code reaches every user.',
        lockedBy: 'pierrederval',
        lockedOn: '2026-10-14',
        governs: ['^kit/lib/outbox/'],
      }],
      rules: [{ id: 'BR-PRODUCT-4', kind: 'rule', file: `${K}/product/rules.md`, headline: 'The ledger keeps its history.', governs: ['^game/ledger\\.ts$'], proposed: false }],
      ungoverned: 1,
      mapped: false,
      applies: [{ kind: 'rule', id: 'BR-PRODUCT-4', file: `${K}/product/rules.md`, text: 'The ledger keeps its history.', why: ['governs'], proposed: false }],
      global: [{
        kind: 'law',
        id: 'BR-PRODUCT-1',
        file: `${K}/product/rules.md`,
        text: 'Only a person merges into main. If broken: unreviewed code reaches every user.',
        why: [],
        proposed: false,
      }],
      hidden: { laws: 0, rules: 2, adrs: 0 },
    });
  });

  it('--slice reads the slice’s territory from its plan, the files under it included', async () => {
    const plan = '# Plan\n\n| id | slice | territory | blocked by | wave |\n| --- | --- | --- | --- | --- |\n| s1 | one | `game/` | — | 1 |\n| s2 | two | `kit/lib/quote` | — | 1 |\n';
    const { root } = makeRepo({ git: true, files: files({ '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan }) });
    expect(lines((await omni(root, ['kb', 'laws', '--slice', '7', 's1'])).out)).toEqual([
      'Applies here',
      'rule BR-PRODUCT-4 — The ledger keeps its history. (governs)',
      'Global',
      LAW_LINE,
      UNGOVERNED,
    ]);
    expect(lines((await omni(root, ['kb', 'laws', '--slice', '7', 's2'])).out)[1]).toBe('rule BR-PRODUCT-2 — A quote total is never negative. (governs)');
    await refused(root, ['kb', 'laws', '--slice', '7', 's9'], 'the plan of PRD 7 has no slice s9');
    await refused(root, ['kb', 'laws', '--slice', '8', 's1'], 'PRD 8 has no plan — no inbox or shipped folder holds it');
    await refused(root, ['kb', 'laws', '--slice', '7'], '--slice takes a PRD and a slice');
  });

  it('--area lists one domain folder’s rules, with or without Governs:, for a person browsing', async () => {
    const domain = {
      [`${K}/domains/quote/README.md`]: '# Quote\n\nGlossary term: Quote\n',
      [`${K}/domains/quote/principles.md`]: '# Principles\n',
      [`${K}/domains/quote/rules.md`]: `# Rules\n\n${rule('BR-QUOTE-1', 'A quote has a customer.')}`,
      [`${K}/domains/quote/invariants.md`]: '# Invariants\n',
    };
    const { root } = makeRepo({ git: true, files: files(domain) });
    expect(lines((await omni(root, ['kb', 'laws', '--area', 'quote'])).out)).toEqual([LAW_LINE, 'rule BR-QUOTE-1 — A quote has a customer.']);
    expect(lines((await omni(root, ['kb', 'laws', '--area', 'product'])).out)).toEqual([
      LAW_LINE,
      'rule BR-PRODUCT-2 — A quote total is never negative.',
      'rule BR-PRODUCT-3 — A rule nobody said the files of.',
      'rule BR-PRODUCT-4 — The ledger keeps its history.',
    ]);
    await refused(root, ['kb', 'laws', '--area', 'billing'], 'no domain folder billing — the folders: product, quote');
    const { root: empty } = makeRepo({ git: true, files: { ...files(), [`${K}/domains/quote/README.md`]: '# Quote\n\nGlossary term: Quote\n' } });
    expect(lines((await omni(empty, ['kb', 'laws', '--area', 'quote'])).out)).toEqual([LAW_LINE, 'No rule in quote yet.']);
  });

  it('refuses two ways of asking at once, and a stray argument', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    await refused(root, ['kb', 'laws', '--paths', 'a', '--area', 'product'], 'give one of --paths, --slice and --area');
    await refused(root, ['kb', 'laws', 'stray'], 'usage: omni kb laws');
    expect(await omni(root, ['kb', 'laws', '--area', 'product', 'stray'])).toMatchObject({ code: 2 });
  });

  it('omni kb show briefing ends with the locked laws by id and where to read them, never their full text', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    const { code, out } = await omni(root, ['kb', 'show', 'briefing']);
    expect(code).toBe(0);
    const section = [
      '## The laws  [1 locked]',
      'Locked: BR-PRODUCT-1. Before you change a file, run `omni kb laws --paths <file>…` (or `--slice <prd> <slice>`) to read the laws it touches; only their owner can approve a change to one.',
    ];
    expect(out.trimEnd().split('\n').slice(-2)).toEqual(section);
    expect(out).not.toContain('If broken:');
    const json: unknown = JSON.parse((await omni(root, ['kb', 'show', 'briefing', '--json'])).out);
    expect(dig(json, 'laws')).toEqual({ source: `${K}/product/thesis.md`, lines: section });
    expect((await omni(root, ['kb', 'show', 'testing'])).out).not.toContain('## The laws');
  });

  it('the briefing reads the locks from the registers, and says so when nothing is locked', async () => {
    const { root } = makeRepo({ git: true, files: files({ [`${K}/product/thesis.md`]: '# Thesis\n' }) });
    expect((await omni(root, ['kb', 'show', 'briefing'])).out.trimEnd().split('\n').at(-2)).toBe('## The laws  [1 locked]');
    const { root: empty } = makeRepo({ git: true, files: CONFIG });
    expect((await omni(empty, ['kb', 'show', 'briefing'])).out.trimEnd().split('\n').slice(-2)).toEqual(['## The laws', 'No law is locked yet.']);
  });

  it('omni kb status counts the rules with no Governs: as a backlog', async () => {
    const { root } = makeRepo({ git: true, files: files() });
    expect(dig(JSON.parse((await omni(root, ['kb', 'status', '--json'])).out), 'ungoverned')).toBe(1);
    expect((await omni(root, ['kb', 'status'])).out).toContain('Rules with no Governs: 1 — omni kb laws --paths never shows them: give each a "Governs:" line.');
    const { root: empty } = makeRepo({ git: true, files: CONFIG });
    expect((await omni(empty, ['kb', 'status'])).out).not.toContain('Rules with no Governs');
  });

  describe('omni check knowledge grades the thesis against the locks', () => {
    const check = async (root: string) => {
      const { code, out, err } = await omni(root, ['check', 'knowledge']);
      return { code, text: `${out}${err}` };
    };

    it('passes when the thesis lists every locked law and nothing else, and the CODEOWNERS block is written', async () => {
      const { root } = makeRepo({ git: true, files: files() });
      expect(await omni(root, ['kb', 'owners'])).toMatchObject({ code: 0 });
      expect(await check(root)).toMatchObject({ code: 0 });
    });

    it('refuses a thesis that names an id that is not locked', async () => {
      const thesis = THESIS.replace('## What', '- BR-PRODUCT-2 — Totals are never negative. If broken: invoices lie.\n\n## What');
      const { code, text } = await check(makeRepo({ git: true, files: files({ [`${K}/product/thesis.md`]: thesis }) }).root);
      expect(code).toBe(1);
      expect(text).toContain(`${K}/product/thesis.md: BR-PRODUCT-2 — is listed under "The laws", but it is not a locked law`);
    });

    it('refuses a thesis that misses a locked law, and a law line that says no "If broken:"', async () => {
      const missing = await check(makeRepo({ git: true, files: files({ [`${K}/product/thesis.md`]: THESIS.replace(/- BR-PRODUCT-1.*\n/, '') }) }).root);
      expect(missing.code).toBe(1);
      expect(missing.text).toContain(`${K}/product/thesis.md: BR-PRODUCT-1 — is a locked law, but "The laws" does not list it`);
      const plain = await check(makeRepo({ git: true, files: files({ [`${K}/product/thesis.md`]: THESIS.replace(' If broken: unreviewed code reaches every user.', '') }) }).root);
      expect(plain.code).toBe(1);
      expect(plain.text).toContain(`${K}/product/thesis.md: BR-PRODUCT-1 — its line says no "If broken:"`);
    });

    it('refuses a lock with no thesis, or a thesis with no laws section', async () => {
      const none = Object.fromEntries(Object.entries(files()).filter(([path]) => path !== `${K}/product/thesis.md`));
      const absent = await check(makeRepo({ git: true, files: none }).root);
      expect(absent.code).toBe(1);
      expect(absent.text).toContain(`${K}/product/thesis.md: is missing, and BR-PRODUCT-1 is locked`);
      const bare = await check(makeRepo({ git: true, files: files({ [`${K}/product/thesis.md`]: '# Thesis\n' }) }).root);
      expect(bare.code).toBe(1);
      expect(bare.text).toContain(`${K}/product/thesis.md: has no "## The laws" section, and BR-PRODUCT-1 is locked`);
    });

    it('refuses a Governs: pattern the flow areas’ matcher cannot read', async () => {
      const globbed = files({ [`${K}/product/rules.md`]: `# Rules\n\n${RULES.replace('Governs: ^game/ledger\\.ts$', 'Governs: game/**')}` });
      const { code, text } = await check(makeRepo({ git: true, files: globbed }).root);
      expect(code).toBe(1);
      expect(text).toContain(`${K}/product/rules.md: BR-PRODUCT-4 — "Governs:" lists "game/**", which is not a regular expression over paths`);
    });
  });

  describe('omni kb owners — the CODEOWNERS block (PRD 1726, s4)', () => {
    const BLOCK = [
      '# BEGIN omni kb owners',
      '# Written by `omni kb owners` from laws.owners and the locked laws (PRD 1726): run it again, never edit these lines.',
      '# The thesis and the registers: what the product promises, and its laws.',
      `/${K}/product/thesis.md @pierrederval`,
      `/${K}/product/principles.md @pierrederval`,
      `/${K}/product/rules.md @pierrederval`,
      `/${K}/product/invariants.md @pierrederval`,
      '# The briefing: the rules every agent follows.',
      `/${PLAYBOOK}/briefing.md @pierrederval`,
      '# law BR-PRODUCT-1: its test.',
      `/${TEST_FILE} @pierrederval`,
      '# END omni kb owners',
    ].join('\n');
    const check = async (root: string) => {
      const { code, out } = await omni(root, ['check', 'knowledge']);
      return { code, out };
    };

    it('writes .github/CODEOWNERS when the repository has none: the thesis, each register file and each law’s test, owned by laws.owners', async () => {
      const { root, read } = makeRepo({ git: true, files: files() });
      const { code, out } = await omni(root, ['kb', 'owners']);
      expect(code).toBe(0);
      expect(out).toBe('kb owners — wrote .github/CODEOWNERS: 6 path(s) owned by @pierrederval; no line outside its markers changed.\n');
      expect(read('.github/CODEOWNERS')).toBe(`${BLOCK}\n`);
      expect(await omni(root, ['kb', 'owners'])).toMatchObject({ code: 0, out: 'kb owners — .github/CODEOWNERS is up to date: 6 path(s) owned by @pierrederval.\n' });
    });

    it('leaves every line outside its markers byte-identical, and replaces only its own block', async () => {
      const before = '# Team rules\r\n*.ts @acme/devs\n\n/docs/  @writer # docs\n';
      const after = '\n# Kept after the block\n/apps/ @acme/apps';
      const { root, read } = makeRepo({ git: true, files: files({ '.github/CODEOWNERS': before }) });
      await omni(root, ['kb', 'owners']);
      expect(read('.github/CODEOWNERS')).toBe(`${before}\n${BLOCK}\n`);
      const stale = BLOCK.replace('@pierrederval', '@old');
      const { root: replaced, read: readReplaced } = makeRepo({ git: true, files: files({ '.github/CODEOWNERS': `${before}${stale}${after}` }) });
      await omni(replaced, ['kb', 'owners']);
      expect(readReplaced('.github/CODEOWNERS')).toBe(`${before}${BLOCK}${after}`);
    });

    it('names the briefing and each file it points to, after the thesis and the registers (PRD 1793, s2)', async () => {
      const BRIEFING = `${PLAYBOOK}/briefing.md`;
      const briefing = (frontMatter: Record<string, unknown>, body: string) =>
        formText({ frontMatter: { form: 'briefing', state: 'filled', ...frontMatter }, title: 'Briefing', slots: [{ id: 'never', required: true, body }] });
      const seeing = files({ [BRIEFING]: briefing({}, 'See: ./docs/agents/never.md#merging'), 'docs/agents/never.md': '- Never merge.\n' });
      const { root, read } = makeRepo({ git: true, files: seeing });
      expect(await omni(root, ['kb', 'owners'])).toMatchObject({ code: 0, out: expect.stringContaining(': 7 path(s)') as unknown });
      const lines = read('.github/CODEOWNERS').split('\n');
      const at = lines.indexOf('# The briefing: the rules every agent follows.');
      expect(at).toBeGreaterThan(lines.indexOf(`/${K}/product/invariants.md @pierrederval`));
      expect(lines.slice(at, at + 4)).toEqual([
        '# The briefing: the rules every agent follows.',
        `/${BRIEFING} @pierrederval`,
        '/docs/agents/never.md @pierrederval',
        '# law BR-PRODUCT-1: its test.',
      ]);
      expect(await check(root)).toMatchObject({ code: 0 });
      const pointing = files({ [BRIEFING]: briefing({ state: 'pointer', 'points-to': 'AGENTS.md' }, ''), 'AGENTS.md': '# Agents\n' });
      const { root: pointer, read: readPointer } = makeRepo({ git: true, files: pointing });
      await omni(pointer, ['kb', 'owners']);
      expect(readPointer('.github/CODEOWNERS').split('\n')).toContain('/AGENTS.md @pierrederval');
    });

    it('writes into the CODEOWNERS GitHub reads, never shadowing a root or docs/ file with a new .github/ one', async () => {
      const { root, read } = makeRepo({ git: true, files: files({ 'docs/CODEOWNERS': '* @acme/all\n' }) });
      expect((await omni(root, ['kb', 'owners'])).out).toContain('wrote docs/CODEOWNERS');
      expect(read('docs/CODEOWNERS')).toBe(`* @acme/all\n\n${BLOCK}\n`);
      expect(existsSync(join(root, '.github/CODEOWNERS'))).toBe(false);
    });

    it('owns every domain’s and cross-domain register file, every path a law’s Enforced by: names, and each team as written', async () => {
      const domain = {
        [`${K}/domains/quote/README.md`]: '# Quote\n\nGlossary term: Quote\n',
        [`${K}/domains/quote/principles.md`]: '# Principles\n',
        [`${K}/domains/quote/rules.md`]: '# Rules\n',
        [`${K}/domains/quote/invariants.md`]: '# Invariants\n',
        [`${K}/product/rules.md`]: `# Rules\n\n${RULES.replace(`Enforced by: ${TEST_FILE}`, `Enforced by: \`${TEST_FILE}\`, game/ledger.ts#history`)}`,
        '.omni-loop/config.yml': `${CONFIG_TEXT}laws:\n  owners: [pierrederval, acme/law-keepers]\n`,
      };
      const { root, read } = makeRepo({ git: true, files: files(domain) });
      expect(await omni(root, ['kb', 'owners'])).toMatchObject({ code: 0 });
      const lines = read('.github/CODEOWNERS').split('\n');
      expect(lines).toContain(`/${K}/domains/quote/rules.md @pierrederval @acme/law-keepers`);
      expect(lines).toContain(`/${TEST_FILE} @pierrederval @acme/law-keepers`);
      expect(lines).toContain('/game/ledger.ts @pierrederval @acme/law-keepers');
      expect(lines.filter((line) => line.startsWith(`/${K}/`))).toHaveLength(8);
      expect(await check(root)).toMatchObject({ code: 0 });
    });

    it('refuses while laws.owners is empty, a stray argument, and markers that do not pair up, writing nothing', async () => {
      const { root } = makeRepo({ git: true, files: files({ '.omni-loop/config.yml': CONFIG_TEXT }) });
      await refused(root, ['kb', 'owners'], 'laws.owners is empty');
      expect(existsSync(join(root, '.github/CODEOWNERS'))).toBe(false);
      const { root: other } = makeRepo({ git: true, files: files() });
      await refused(other, ['kb', 'owners', 'stray'], 'usage: omni kb owners');
      const broken = '# END omni kb owners\n# BEGIN omni kb owners\n';
      const { root: unpaired, read } = makeRepo({ git: true, files: files({ '.github/CODEOWNERS': broken }) });
      expect(await omni(unpaired, ['kb', 'owners'])).toMatchObject({
        code: 1,
        err: 'omni kb owners: .github/CODEOWNERS: its "# BEGIN omni kb owners" and "# END omni kb owners" lines do not pair up — keep exactly one of each, in that order, or remove both.\n',
      });
      expect(read('.github/CODEOWNERS')).toBe(broken);
    });

    it('omni check knowledge goes red on a missing or stale block, and green once kb owners wrote it', async () => {
      const { root, write } = makeRepo({ git: true, files: files() });
      const missing = await check(root);
      expect(missing.code).toBe(1);
      expect(missing.out).toContain('.github/CODEOWNERS: has no "# BEGIN omni kb owners" block, and 1 law(s) are locked — run omni kb owners');
      await omni(root, ['kb', 'owners']);
      expect(await check(root)).toMatchObject({ code: 0 });
      write('.omni-loop/config.yml', `${CONFIG_TEXT}laws:\n  owners: [someone-else]\n`);
      const stale = await check(root);
      expect(stale.code).toBe(1);
      expect(stale.out).toContain('.github/CODEOWNERS: its "# BEGIN omni kb owners" block is out of date with the locked laws and laws.owners — run omni kb owners.');
      await omni(root, ['kb', 'owners']);
      expect(await check(root)).toMatchObject({ code: 0 });
    });

    it('writes each owner and each delegate on every line, never a leader, and check knowledge counts a new delegate (PRD 1794)', async () => {
      const { root, read, write } = makeRepo({ git: true, files: files() });
      await omni(root, ['kb', 'owners']);
      expect(await check(root)).toMatchObject({ code: 0 });
      write('.omni-loop/config.yml', `${CONFIG_TEXT}laws:\n  owners:\n    - login: pierrederval\n      delegate: jdoe\n  leadership: [cto-login]\n`);
      const stale = await check(root);
      expect(stale.code).toBe(1);
      expect(stale.out).toContain('.github/CODEOWNERS: its "# BEGIN omni kb owners" block is out of date with the locked laws and laws.owners — run omni kb owners.');
      expect(await omni(root, ['kb', 'owners'])).toMatchObject({
        code: 0,
        out: 'kb owners — wrote .github/CODEOWNERS: 6 path(s) owned by @pierrederval, @jdoe; no line outside its markers changed.\n',
      });
      const written = read('.github/CODEOWNERS');
      expect(written).toBe(`${BLOCK.replaceAll(' @pierrederval', ' @pierrederval @jdoe')}\n`);
      expect(written).not.toContain('cto-login');
      expect(await check(root)).toMatchObject({ code: 0 });
    });

    it('--json says which file it wrote, how many paths and for whom', async () => {
      const { root } = makeRepo({ git: true, files: files() });
      const parsed: unknown = JSON.parse((await omni(root, ['kb', 'owners', '--json'])).out);
      expect(parsed).toEqual({ file: '.github/CODEOWNERS', wrote: true, paths: 6, owners: ['pierrederval'] });
    });
  });

  describe('a domain contract (PRD 1796)', () => {
    const SCHEMA = 'kit/lib/schema/front-matter.ts';
    const CONTRACTS = `${K}/product/contracts.md`;
    const CONTRACT = `# Contracts\n\n## DC-PRODUCT-1\n\nAn outbox item has exactly one rank: human-action, high or medium.\n\nPoints to: ${SCHEMA}\nSource: PRD #1796\nStated: 2026-10-15\n`;
    const withContract = () => makeRepo({ git: true, files: files({ [CONTRACTS]: CONTRACT, [SCHEMA]: 'x\n' }) });

    it('omni check knowledge counts the contract and exits 0, then exits 1 naming the contract and the path once its file is gone', async () => {
      const { root } = withContract();
      expect(await omni(root, ['kb', 'owners'])).toMatchObject({ code: 0, out: expect.stringContaining('6 path(s)') as unknown });
      const passed = await omni(root, ['check', 'knowledge']);
      expect(passed.code).toBe(0);
      expect(passed.out).toContain('check knowledge — 1 principle(s), 4 rule(s), 0 invariant(s), 1 contract(s) across 0 domain(s)');
      rmSync(join(root, SCHEMA));
      const failed = await omni(root, ['check', 'knowledge']);
      expect(failed.code).toBe(1);
      expect(failed.out).toContain(`${CONTRACTS}: DC-PRODUCT-1 — points to "${SCHEMA}", which does not exist — fix its "Points to:" line.`);
    });

    it('omni kb laws prints no contract, with or without --paths naming the file it points to', async () => {
      const { root } = withContract();
      expect(lines((await omni(root, ['kb', 'laws'])).out)).toEqual([LAW_LINE]);
      const touched = lines((await omni(root, ['kb', 'laws', '--paths', SCHEMA, CONTRACTS])).out);
      expect(touched).toEqual(['Applies here', NOTHING_APPLIES, 'Global', LAW_LINE, UNGOVERNED]);
      expect(touched.join('\n')).not.toContain('DC-PRODUCT-1');
    });
  });
});

describe('omni kb legal | glossary (PRD 1795)', () => {
  const HOST = 'omni.test';
  const NOW = new Date('2026-10-15T08:00:00Z');
  const LOCAL = '.omni-loop/local/product-knowledge.json';
  const KNOWLEDGE_CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
  const BUSINESS = {
    state: 'ok',
    business: { name: 'Acme' },
    product: { name: 'Invoicing' },
    claims: [],
    personas: [],
    legal: [{ id: 'L-INVOICING-1', statement: 'An invoice is kept ten years.', source: 'Code de commerce', owner: 'jane' }],
    glossary: [{ term: 'Credit note', meaning: 'A document that cancels part of an invoice.', avoid: ['refund', 'rebate'] }],
  };
  const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };

  /** A page answering `status` with `body`, recording each URL. */
  function page(status: number, body: unknown = BUSINESS) {
    const urls: string[] = [];
    return {
      urls,
      fetch: (url: string) => {
        urls.push(url);
        return Promise.resolve(new Response(JSON.stringify(body), { status }));
      },
    };
  }
  const down = { fetch: () => Promise.reject(new TypeError('fetch failed')) };

  function know(root: string, argv: string[], server: { fetch: unknown }, tokens: unknown = signedIn) {
    return omni(root, argv, { env: {}, tokens, fetch: server.fetch, now: () => NOW });
  }
  const repo = () => makeRepo({ git: true, files: { '.omni-loop/config.yml': KNOWLEDGE_CONFIG } });

  it('prints one line per active entry and per term, and keeps the read as the local copy', async () => {
    const { root, read } = repo();
    const server = page(200);
    const legal = await know(root, ['kb', 'legal'], server);
    expect(legal).toEqual({ code: 0, out: 'L-INVOICING-1  An invoice is kept ten years.  (source: Code de commerce; owner: @jane)\n', err: '' });
    expect(server.urls).toEqual(['https://omni.test/api/business?repo=acme%2Fwidgets']);
    const glossary = await know(root, ['kb', 'glossary'], page(200));
    expect(glossary.out).toBe('Credit note: A document that cancels part of an invoice.  (avoid: refund, rebate)\n');
    expect(JSON.parse(read(LOCAL))).toEqual({
      product: 'Invoicing', readAt: NOW.toISOString(), legal: BUSINESS.legal, glossary: BUSINESS.glossary, personas: [],
    });
  });

  it('reads a server from before the page as empty lists', async () => {
    const { root } = repo();
    const old = { state: 'ok', business: { name: 'Acme' }, product: { name: 'Invoicing' }, claims: [], personas: [] };
    expect(await know(root, ['kb', 'legal'], page(200, old))).toEqual({ code: 0, out: '', err: '' });
  });

  it.each([
    ['a 5xx', () => page(503, { error: 'down' })],
    ['a timeout', () => down],
  ])('prints the copy under the unreachable line on %s', async (_, server) => {
    const { root } = repo();
    await know(root, ['kb', 'legal'], page(200));
    const again = await know(root, ['kb', 'glossary'], server());
    expect(again.code).toBe(0);
    expect(again.out).toBe(
      'last read 2026-10-15: the Omni page is unreachable\nCredit note: A document that cancels part of an invoice.  (avoid: refund, rebate)\n',
    );
  });

  it('prints the server reason and exits 1 on a 4xx, whatever the copy', async () => {
    const { root } = repo();
    await know(root, ['kb', 'legal'], page(200));
    const refused = await know(root, ['kb', 'legal'], page(403, { error: 'not a member of the workspace' }));
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('not a member of the workspace');
    expect(refused.out).not.toContain('L-INVOICING-1');
  });

  it('says nothing was read yet when the page is unreachable and there is no copy', async () => {
    const { root } = repo();
    expect(await know(root, ['kb', 'legal'], down)).toEqual({
      code: 1, out: 'no product knowledge: the Omni page is unreachable and nothing was read yet\n', err: '',
    });
  });

  it('exits 1 with the reason when there is no Omni page or no sign-in', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect((await know(root, ['kb', 'legal'], page(200))).code).toBe(1);
    const { root: other } = repo();
    const unsigned = await know(other, ['kb', 'glossary'], page(200), { read: () => null, write: () => {} });
    expect(unsigned).toMatchObject({ code: 1, out: 'no product knowledge: no sign-in for omni.test (omni signin)\n' });
  });
});

describe('omni kb index (PRD 2299)', () => {
  const NOW = new Date('2026-10-15T08:00:00Z');
  const LOCAL = '.omni-loop/local/product-knowledge.json';
  const CONFIG_ASK = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
  const BUSINESS = {
    state: 'ok',
    business: { name: 'Acme' },
    product: { name: 'Invoicing' },
    claims: [],
    personas: [{ name: 'Paul', stance: 'excited', trade: 't', who: 'w', usage: 'u' }, { nope: true }],
    legal: [{ id: 'L-INVOICING-1', statement: 'An invoice is kept ten years.', source: 'Code de commerce', owner: 'jane' }],
    glossary: [{ term: 'Credit note', meaning: 'Cancels an invoice.', avoid: ['refund', 'rebate'] }, { term: 'Quote', meaning: 'q', avoid: [] }],
  };
  const signedIn = { read: (host: string) => (host === 'omni.test' ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };
  const page = (status: number, body: unknown = BUSINESS) => ({ fetch: () => Promise.resolve(new Response(JSON.stringify(body), { status })) });
  const down = { fetch: () => Promise.reject(new TypeError('fetch failed')) };
  const never = { fetch: () => new Promise<Response>(() => {}) };
  const repo = (config = CONFIG_ASK, files: Record<string, string> = {}) => makeRepo({ git: true, files: { '.omni-loop/config.yml': config, ...files } });
  const index = (root: string, server: { fetch: unknown }, args: string[] = [], extra: object = {}) =>
    omni(root, ['kb', 'index', ...args], { env: {}, tokens: signedIn, fetch: server.fetch, now: () => NOW, ...extra });

  it('prints the block and keeps the personas in the local copy', async () => {
    const { root, read } = repo();
    const result = await index(root, page(200));
    expect(result).toEqual({
      code: 0,
      err: '',
      out: [
        'Knowledge of Invoicing (synced just now): words to use, laws to respect, people to build for.',
        'Words: Credit note (not: refund, rebate) · Quote',
        '       → meanings: omni kb glossary',
        'Legal: L-INVOICING-1 An invoice is kept ten years.',
        '       → sources: omni kb legal',
        'Personas: Paul (excited)',
        '       → who they are: omni business show',
        '',
      ].join('\n'),
    });
    expect((JSON.parse(read(LOCAL)) as { personas: unknown }).personas).toEqual([{ name: 'Paul', stance: 'excited' }]);
  });

  it('prints --json as { state, product, words, legal, personas, syncedAt, cut }', async () => {
    const { root } = repo();
    const { code, out } = await index(root, page(200), ['--json']);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({
      state: 'ok',
      product: 'Invoicing',
      words: [{ term: 'Credit note', avoid: ['refund', 'rebate'] }, { term: 'Quote', avoid: [] }],
      legal: [{ id: 'L-INVOICING-1', statement: 'An invoice is kept ten years.' }],
      personas: [{ name: 'Paul', stance: 'excited' }],
      syncedAt: NOW.toISOString(),
      cut: { words: 0, legal: 0, personas: 0 },
    });
  });

  it('cuts at the 3 KB cap with the count and the command', async () => {
    const { root } = repo();
    const legal = Array.from({ length: 200 }, (_, i) => ({ id: `L-X-${i}`, statement: 'x'.repeat(60), source: 's', owner: 'o' }));
    const { code, out } = await index(root, page(200, { ...BUSINESS, legal }));
    expect(code).toBe(0);
    expect(Buffer.byteLength(out)).toBeLessThanOrEqual(3072);
    expect(out).toMatch(/… \d+ more: omni kb legal/);
  });

  it.each([
    ['a 5xx', () => page(503, { error: 'down' })],
    ['an unreachable page', () => down],
  ])('prints the last copy with its age on %s, and one line with no copy', async (_, server) => {
    const { root } = repo();
    expect((await index(root, server())).out).toBe('no product knowledge: offline — agents carry on\n');
    await index(root, page(200));
    const later = await index(root, server(), [], { now: () => new Date(NOW.getTime() + 2 * 86_400_000) });
    expect(later.code).toBe(0);
    expect(later.out).toContain('Knowledge of Invoicing (synced 2 d ago, offline)');
    expect(later.out).toContain('Credit note (not: refund, rebate)');
  });

  it('exits 0 with one line for no Omni page, no sign-in, no product and no knowledge', async () => {
    const none = repo();
    expect(await index(none.root, page(200, { ...BUSINESS, product: null }))).toEqual({
      code: 0, err: '', out: 'no product knowledge: no product knowledge: acme/widgets belongs to no product on the Omni page — agents carry on\n',
    });
    const empty = repo();
    expect((await index(empty.root, page(200, { ...BUSINESS, legal: [], glossary: [], personas: [] }))).out).toBe(
      'no product knowledge: Invoicing holds no words, laws or personas yet — agents carry on\n',
    );
    const noPage = repo('kit: 1\nrepo:\n  slug: acme/widgets\n');
    expect(await index(noPage.root, page(200))).toMatchObject({ code: 0, out: 'no product knowledge: no Omni page is set here (ask.url) — agents carry on\n' });
    const unsigned = repo();
    expect(await index(unsigned.root, page(200), [], { tokens: { read: () => null, write: () => {} } })).toMatchObject({
      code: 0, out: 'no product knowledge: no sign-in (omni signin) — agents carry on\n',
    });
    const refused = repo();
    expect((await index(refused.root, page(403, { error: 'not a member' }))).out).toContain('— agents carry on');
  });

  it('prints an archived product its one line, whatever the copy', async () => {
    const { root } = repo();
    await index(root, page(200));
    const archived = await index(root, page(200, { ...BUSINESS, state: 'archived' }));
    expect(archived).toEqual({
      code: 0, err: '', out: 'no product knowledge: product Invoicing is archived: an owner restores it on its page — agents carry on\n',
    });
  });

  it('exits 0 in no kit checkout', async () => {
    const { root } = makeRepo({ git: true, files: {} });
    expect(await index(root, page(200))).toMatchObject({ code: 0, out: expect.stringContaining('— agents carry on') as unknown });
  });

  it('holds its 3-second budget against a server that never answers', async () => {
    const { root } = repo();
    const started = Date.now();
    const result = await index(root, never, [], { budgetMs: 100 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result).toEqual({ code: 0, err: '', out: 'no product knowledge: offline — agents carry on\n' });
  });

  it('still reads a copy from before the personas', async () => {
    const { root } = repo(CONFIG_ASK, {
      [LOCAL]: JSON.stringify({ product: 'Invoicing', readAt: NOW.toISOString(), legal: [], glossary: BUSINESS.glossary }),
    });
    const glossary = await omni(root, ['kb', 'glossary'], { env: {}, tokens: signedIn, fetch: down.fetch, now: () => NOW });
    expect(glossary.out).toContain('Credit note: Cancels an invoice.');
    expect((await index(root, down)).out).toContain('Credit note (not: refund, rebate)');
  });

  it('is a usage error with an argument', async () => {
    const { root } = repo();
    expect((await index(root, page(200), ['extra'])).code).toBe(2);
  });
});

describe('omni kb graph --paths and --depth (PRD 1797, s3)', () => {
  const K = '.omni-loop/knowledge';
  const entry = (id: string, statement: string, fields: Record<string, string> = {}) =>
    `## ${id}\n\n${statement}\n\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n`;
  const FILES = {
    ...CONFIG,
    [`${K}/product/principles.md`]: `# Principles\n\n${entry('P-PRODUCT-1', 'Every change is reviewed.', { Why: 'Trust.', Source: 'README.md' })}`,
    [`${K}/product/rules.md`]: `# Rules\n\n${entry('BR-PRODUCT-1', 'A plain rule about kit/a. It also sees BR-PRODUCT-2.', { Serves: 'P-PRODUCT-1', Source: 'README.md', Governs: '^kit/a/' })}${entry('BR-PRODUCT-2', 'A locked law about kit/a.', { Serves: 'P-PRODUCT-1', Source: 'README.md', Governs: '^kit/a/, ^kit/b/', Locked: '@pierrederval, 2026-10-13', 'Enforced by': 'kit/two.test.ts' })}${entry('BR-PRODUCT-3', 'Never reached by a file.', { Source: 'README.md' })}${entry('BR-PRODUCT-4', 'Governs kit/c.', { Source: 'README.md', Governs: '^kit/c/' })}`,
    [`${K}/product/invariants.md`]: '# Invariants\n\n',
  };
  const heads = (out: string) => out.split('\n').filter((line) => /^[A-Z]+-PRODUCT-\d+ · /.test(line)).map((line) => line.split(' ')[0]);

  it('prints one block per entry whose Governs: matches, laws first, then rules, then the product line', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out, err } = await omni(root, ['kb', 'graph', '--paths', 'kit/a/x.ts']);
    expect(code).toBe(0);
    expect(err).toBe('');
    expect(heads(out)).toEqual(['BR-PRODUCT-2', 'BR-PRODUCT-1']);
    expect(out.endsWith('product knowledge: none — this repository belongs to no product.\n')).toBe(true);
    expect(out).not.toContain('BR-PRODUCT-3 · ');
  });

  it('reads comma- and space-separated files as kb laws --paths does', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    for (const argv of [['--paths', 'kit/a/x.ts,kit/c/y.ts'], ['--paths', 'kit/a/x.ts', 'kit/c/y.ts']]) {
      const { out } = await omni(root, ['kb', 'graph', ...argv]);
      expect(heads(out), argv.join(' ')).toEqual(['BR-PRODUCT-2', 'BR-PRODUCT-1', 'BR-PRODUCT-4']);
    }
  });

  it('says so when no entry governs the files, and never reaches a rule with no Governs:', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'graph', '--paths', 'README.md']);
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toBe('kb graph — no entry governs those files.');
    expect(heads(out)).toEqual([]);
  });

  it('--json carries every entry reached as a start', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const built = JSON.parse((await omni(root, ['kb', 'graph', '--paths', 'kit/a/x.ts', '--json'])).out) as Neighbourhood;
    expect(built.start).toEqual(['BR-PRODUCT-2', 'BR-PRODUCT-1']);
  });

  it('--depth 2 adds the neighbours of the entries at hop 1, indented, no node printed twice', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const one = await omni(root, ['kb', 'graph', 'BR-PRODUCT-1']);
    const two = await omni(root, ['kb', 'graph', 'BR-PRODUCT-1', '--depth', '2']);
    expect(one.out).not.toContain('test:kit/two.test.ts');
    expect(two.code).toBe(0);
    expect(two.out).toMatch(/\n {4}down {2}enforced-by {2}test:kit\/two\.test\.ts/);
    for (const id of ['BR-PRODUCT-2', 'P-PRODUCT-1', 'test:kit/two.test.ts']) {
      expect(two.out.split('\n').filter((line) => line.includes(` ${id} `)), id).toHaveLength(1);
    }
    expect((await omni(root, ['kb', 'graph', 'BR-PRODUCT-1', '--depth', '3'])).code).toBe(0);
  });

  it('exits 2 with the usage line on --depth 4 or 0, --paths with an id or with no file', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    for (const argv of [['BR-PRODUCT-1', '--depth', '4'], ['BR-PRODUCT-1', '--depth', '0'], ['--paths'], ['--paths', ','], ['--depth', '2'], ['--paths', 'BR-PRODUCT-1'], ['--paths', 'kit/a/x.ts', 'BR-PRODUCT-1']]) {
      const { code, out, err } = await omni(root, ['kb', 'graph', ...argv]);
      expect(code, argv.join(' ')).toBe(2);
      expect(out).toBe('');
      expect(err, argv.join(' ')).toMatch(/usage: omni kb graph \[<id> \| --paths|--paths needs a value/);
    }
  });
});

describe('omni kb laws — applies here, then global, on a knowledge map (PRD 2346, s3)', () => {
  // A repository with `layers` and flow areas naming their domain folder, its ADRs tagged, and a copy
  // of its product's Legal entries: the spec's five made-up changes run against it.
  const MAP = snapshot(join(import.meta.dirname, '../test/fixtures/knowledge-map'));
  const LAWS = ['BR-PRODUCT-3', 'BR-PRODUCT-5', 'BR-PRODUCT-28', 'N-PRODUCT-15', 'BR-PRODUCT-12', 'N-PRODUCT-7', 'N-PRODUCT-8', 'BR-PRODUCT-59', 'BR-QUOTE-1'];
  const OWNER = 'Changing it needs @law-keeper to approve the pull request.';
  type Group = { kind: string; id: string; why: string[] };
  type Found = { applies: Group[]; global: Group[]; hidden: { laws: number; rules: number; adrs: number }; laws: { id: string }[] };
  const lines = (out: string) => out.split('\n').filter(Boolean);
  const found = async (root: string, files: string[]): Promise<Found> => JSON.parse((await omni(root, ['kb', 'laws', '--paths', ...files, '--json'])).out) as Found;
  /** The printed lines between `Applies here` and `Global`. */
  const appliesOf = (out: string) => {
    const all = lines(out);
    return all.slice(1, all.indexOf('Global'));
  };

  it('the five made-up changes of the spec each find their rule under Applies here, and none prints a locked law of another area', async () => {
    const { root } = makeRepo({ git: true, files: MAP });
    const changes = [
      { change: 'let a person edit an answer', file: 'apps/web/src/ask/ask.service.ts', finds: ['BR-PRODUCT-12'] },
      { change: 'log the workspace AI key in clear', file: 'apps/web/src/jev/jev-key.service.ts', finds: ['BR-PRODUCT-59'] },
      { change: 'an agent applies the override label', file: 'kit/plugin/skills/pr/SKILL.md', finds: ['BR-PRODUCT-3', 'BR-PRODUCT-5'] },
      { change: 'the ask hook answers for the person', file: 'kit/lib/ask/hook.ts', finds: ['N-PRODUCT-7', 'N-PRODUCT-8'] },
      { change: 'a notification tap opens another site', file: 'apps/web/src/push/sw.ts', finds: ['N-PRODUCT-18'] },
    ];
    for (const { change, file, finds } of changes) {
      const { applies, global, hidden } = await found(root, [file]);
      expect(applies.map(({ id }) => id), change).toEqual(expect.arrayContaining(finds));
      expect(global.map(({ id }) => id), change).toEqual(expect.arrayContaining(['L-GDPR-2', 'L-GDPR-5']));
      const laws = (group: Group[]) => group.filter(({ kind }) => kind === 'law').map(({ id }) => id);
      expect(laws(global), change).toEqual(['N-PRODUCT-15']);
      expect(hidden.laws, change).toBe(LAWS.length - laws(applies).length - 1);
    }
  });

  it('prints BR-PRODUCT-12 under Applies here marked domain ask, then the global entries and every Legal entry, then counts what it hides', async () => {
    const { root } = makeRepo({ git: true, files: MAP });
    const { code, out } = await omni(root, ['kb', 'laws', '--paths', 'apps/web/src/ask/ask.service.ts']);
    expect(code).toBe(0);
    expect(lines(out)).toEqual([
      'Applies here',
      `law BR-PRODUCT-12 — An answer never changes after it is given. ${OWNER} (domain ask)`,
      `law N-PRODUCT-7 — A broken hook never blocks a person's message or question. ${OWNER} (domain ask)`,
      `law N-PRODUCT-8 — The ask hooks only call the address the repository set. ${OWNER} (domain ask)`,
      'rule BR-ASK-1 — A question is asked once. (domain ask)',
      'adr ADR-0002 — The ask API answers each refusal with a standard HTTP code and a status field (domain ask)',
      'Global',
      `law N-PRODUCT-15 — Only a person merges into the main branch. ${OWNER}`,
      'rule BR-PRODUCT-90 — A theme colour is read from the design tokens.',
      'legal L-GDPR-2 — Credentials are never stored or logged in clear.',
      "legal L-GDPR-5 — A person's data is deleted on request.",
      '5 locked laws of other areas: not shown (omni kb laws prints them all).',
    ]);
  });

  it('a migration lists the db records and the rules naming db, and no rule of another domain that names no db', async () => {
    const { root } = makeRepo({ git: true, files: MAP });
    const { applies } = await found(root, ['supabase/migrations/20261001000000_links.sql']);
    expect(applies.map(({ id, why }) => [id, why.join(', ')])).toEqual([
      ['BR-PRODUCT-28', 'layer db'],
      ['BR-PRODUCT-12', 'layer db'],
      ['BR-PRODUCT-59', 'layer db'],
      ['ADR-0001', 'layer db'],
    ]);
    expect(appliesOf((await omni(root, ['kb', 'laws', '--paths', 'kit/bin/omni.ts'])).out)).toEqual([
      'adr ADR-0004 — A command refuses with one line and exit code 2 (layer cli)',
    ]);
  });

  it('--slice looks its territory up the same way', async () => {
    const plan = '# Plan\n\n| id | slice | territory | blocked by | wave |\n| --- | --- | --- | --- | --- |\n| s1 | one | `apps/web/src/push/` | — | 1 |\n';
    const { root } = makeRepo({ git: true, files: { ...MAP, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    expect(appliesOf((await omni(root, ['kb', 'laws', '--slice', '7', 's1'])).out)).toEqual([
      'invariant N-PRODUCT-18 — A notification tap only ever opens a page of the site. (domain push)',
    ]);
  });

  it('--json carries applies, global and hidden, and keeps every locked law under laws', async () => {
    const { root } = makeRepo({ git: true, files: MAP });
    const parsed = await found(root, ['apps/web/src/jev/jev-key.service.ts']);
    expect(parsed.applies).toEqual([
      { kind: 'law', id: 'BR-PRODUCT-59', file: '.omni-loop/knowledge/domains/jev/rules.md', text: "Only the owner can see the workspace's stored AI key.", why: ['domain jev'], proposed: false },
    ]);
    expect(parsed.hidden).toEqual({ laws: 7, rules: 3, adrs: 3 });
    expect(parsed.laws.map(({ id }) => id)).toEqual(LAWS);
  });

  it('a repository that maps nothing narrows nothing: every law is listed, under Global, as kb laws lists them', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...MAP, '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\ncommands:\n  test: make check\nlaws:\n  owners: [law-keeper]\n' },
    });
    const { applies, global, hidden } = await found(root, ['apps/web/src/ask/ask.service.ts']);
    expect(applies).toEqual([]);
    expect(global.filter(({ kind }) => kind === 'law').map(({ id }) => id)).toEqual(LAWS);
    expect(global.filter(({ kind }) => kind === 'legal').map(({ id }) => id)).toEqual(['L-GDPR-2', 'L-GDPR-5']);
    expect(hidden.laws).toBe(0);
    expect(lines((await omni(root, ['kb', 'laws'])).out)).toHaveLength(LAWS.length);
  });

  it('the skills that quote its output describe its two groups and the count of what it leaves out', () => {
    for (const skill of ['brainstorm', 'plan', 'do-work', 'bug-fix']) {
      const text = readFileSync(join(import.meta.dirname, `../plugin/skills/${skill}/SKILL.md`), 'utf8').replace(/\s+/g, ' ');
      const at = text.indexOf('omni.mjs kb laws --');
      expect(at, skill).toBeGreaterThan(-1);
      const passage = text.slice(at, at + 900);
      for (const words of ['**Applies here**', '**Global**', 'Legal entries', 'locked laws of other areas']) expect(passage, `${skill}: ${words}`).toContain(words);
    }
  });
});
