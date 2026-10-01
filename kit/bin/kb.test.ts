// PRD #45, slice s3: `omni kb init | show | status` and `omni check kb`, each through `main()` on a
// fixture repository. The kit's own templates are the kit defaults throughout.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../lib/config.ts';
import { loadContext } from '../lib/context.ts';
import { readKnowledge } from '../lib/knowledge/registers.ts';
import { FORM_IDS, FORMS, parseForm } from '../lib/playbook/forms.ts';
import { fillConfig } from '../lib/playbook/resolve.ts';
import { formTemplate } from '../lib/playbook/templates.ts';
import { formText, makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

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
  const body = parseForm(formTemplate(form)).form.slots.find((entry) => entry.id === slot).body.text;
  return fillConfig(body, ConfigSchema.parse({ kit: 1, ...config })).text;
}

/** Every file under `root`, as `{ <path>: text }`, `.git` left out. */
function snapshot(root: string, dir = '') {
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
    // The front door README, the thirteen playbook forms, adr/README.md and the three registers.
    expect(second.out).toBe('kb init — wrote 0 file(s); 18 already there, left as they were.\n');
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
  return (command: string, args: readonly string[] | (string | number)[], options) => {
    if (command === 'git' && args[0] === 'hash-object') return `${hashes[args.at(-1)]}\n`;
    return execFileSync(command, args, options);
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
    const status = JSON.parse(out);
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
    expect(testing.sections.map(({ slot, source }) => `${slot}:${source}`)).toEqual(['commands:repo', 'layout:repo', 'levels:repo', 'never:repo', 'data:hole']);
    expect(status.forms.find((form) => form.form === 'verification').questions).toEqual([{ slot: 'preflight', question: 'which command is the preflight?' }]);
  });

  it('prints one line per form, then every open question and every stale evidence entry', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const { code, out } = await omni(root, ['kb', 'status'], { exec });
    expect(code).toBe(0);
    const lines = out.split('\n').map((line) => line.trim().replace(/\s+/g, ' '));
    expect(lines[0]).toBe('kb status — 14 form(s) in .omni-loop/knowledge');
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
    expect(JSON.parse(out).registers).toEqual([
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
    expect(JSON.parse(none.out).registers).toEqual([]);
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
  const kept = (id: string, serves: string | null, { proposed = false, kind = null } = {}) =>
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
    const graph = JSON.parse(out);
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

  it('exits 2 on an extra argument or an unknown flag', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    for (const argv of [['kb', 'graph', 'product'], ['kb', 'graph', '--json', 'extra'], ['kb', 'graph', '--domain']]) {
      const { code, out, err } = await omni(root, argv);
      expect(code, argv.join(' ')).toBe(2);
      expect(out).toBe('');
      expect(err).toMatch(/^(usage: omni kb graph \[--json\]|omni kb: unknown flag --domain\.)\n$/);
    }
    expect((await omni(root, ['kb'])).err).toContain('omni kb graph [--json]');
  });
});

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

  it.each(FAILURES)('fails on %s', async (_: any, files, line: string) => {
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
    const blank = (form: string) => formText({ frontMatter: { form }, slots: FORMS.find((entry) => entry.id === form).slots.map(({ id, required }) => ({ id, required })) });
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
      missing('glossary'),
    ]);
    expect(out).toBe('check kb — 14 form(s): 1 filled, 2 blank, 11 missing; 16 warning(s).\n');
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
    expect(out).toMatch(/^check kb — 14 form\(s\): 14 missing; 14 warning\(s\)\.$/m);
    expect(err.match(/^warning: .*missing/gm)).toHaveLength(14);
  });

  it('goes red on a broken form, and stays green after omni kb init', async () => {
    const { root, write } = makeRepo({ git: true, files: CONFIG });
    expect((await omni(root, ['kb', 'init'])).code).toBe(0);
    const { code, out } = await omni(root, ['check', 'all']);
    expect(code).toBe(0);
    expect(out).toMatch(/^check kb — 14 form\(s\): 14 blank; \d+ warning\(s\)\.$/m);

    write(TESTING, testingForm({ slots: { never: { body: 'See: gone.md' } } }));
    const red = await omni(root, ['check', 'all']);
    expect(red.code).toBe(1);
    expect(red.out).toContain(`  ${TESTING}: "## Never" See: gone.md does not exist`);
  });
});

describe('imported knowledge in a plan repository (PRD 522, s2)', () => {
  const K = '.omni-loop/knowledge';
  const COPY = `${K}/repos/vertuo-backend-php`;
  const READ_AT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
  const PLAN_CONFIG = {
    '.omni-loop/config.yml': [
      CONFIG_TEXT.trimEnd(),
      'plan:',
      '  guide: null',
      '  targets:',
      '    - repo: acme/vertuo-backend-php',
      '      role: back-end',
      '      knowledge: imported',
      `      readAt: ${READ_AT}`,
      '    - repo: acme/vertuo-apps',
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
    [`${COPY}/README.md`]: `# acme/vertuo-backend-php — imported\n\nRead at ${READ_AT}. A draft.\n`,
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
    expect(out).toMatch(/^check kb — 14 form\(s\): 14 missing; \d+ warning\(s\); 1 imported copy checked\.$/m);
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
  ])('omni check kb fails on a malformed copy (%s) with the own-knowledge message, prefixed by the copy', async (_: any, change: any, line: string) => {
    const files = { ...FILES, ...change };
    for (const [path, text] of Object.entries(files)) if (text === null) delete files[path];
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
    expect(violations(out)).toEqual([`${COPY}: missing — plan.targets lists acme/vertuo-backend-php as imported, so its copy lives here`]);
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
    const status = JSON.parse(out);
    expect(Object.keys(status)).toEqual(['frontDoor', 'forms', 'registers', 'targets']);
    expect(status.registers).toEqual([{ folder: `${K}/product`, laws: 2, proposals: 0 }]);
    expect(status.targets).toHaveLength(1);
    const [copy] = status.targets;
    expect(Object.keys(copy)).toEqual(['repo', 'folder', 'forms', 'registers']);
    expect(copy.repo).toBe('acme/vertuo-backend-php');
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
      `acme/vertuo-backend-php ${COPY} · 1 filled · 13 missing · 1 register folder(s)`,
    ]);
    const { root: plain } = makeRepo({ git: true, files: CONFIG });
    expect(JSON.parse((await omni(plain, ['kb', 'status', '--json'])).out).targets).toEqual([]);
    expect((await omni(plain, ['kb', 'status'])).out).not.toMatch(/Imported copies/);
  });
});
