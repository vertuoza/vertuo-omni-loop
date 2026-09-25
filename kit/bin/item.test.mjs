import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { adoptItem } from '../lib/outbox/settle.mjs';
import { main } from './omni.mjs';

// `adoptItem`'s own two failure conditions (a rendered item that fails to parse, or one whose rank
// is not `medium`) are both already excluded by the time `item new --adopt` calls it: the same
// `checkItemText` grading runs first on the identical text, and this branch is only ever reached
// when `decision.rank === 'medium'`. Wrapping the real implementation lets one test force the
// ledger-refusal branch anyway — a `settle.mjs` internal detail (a malformed `settled.md`, say)
// that has nothing to do with the item text itself — without touching any other test's behavior.
vi.mock('../lib/outbox/settle.mjs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, adoptItem: vi.fn(actual.adoptItem) };
});

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

const FIELDS = {
  slug: 'default-timeout',
  wave: 4,
  questionPlain: 'How long should we wait before giving up on a slow call?',
  decisionPlain: 'We wait five seconds, which is generous without being unbounded.',
  decide: 'How long a slow call gets before it is treated as stuck.',
  meanwhile: 'Five seconds, a constant with no migration to undo it.',
  cost: 'One constant.',
  gaps: ['whether five seconds is measured against a real incident'],
  options: [
    'Wait five seconds, the option built.',
    'Wait one second, so a stuck call is caught sooner.',
  ],
};

function writeJson(dir, fields) {
  const path = join(dir, 'item.json');
  writeFileSync(path, JSON.stringify(fields));
  return path;
}

describe('omni item new', () => {
  it('writes a medium item as an open file with no --adopt', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(0);
    const printed = s.out.join('').trim();
    expect(printed).toBe('.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md');
    expect(existsSync(join(root, printed))).toBe(true);
    const text = readTextFile(join(root, printed));
    expect(text).toMatch(/rank: medium/);
    expect(text).toMatch(/bears-on: none/);
    expect(text).toMatch(/wave: 4/);
    expect(text).toMatch(/A\. Wait five seconds, the option built\./);
  });

  it('defaults raised to today in UTC when the JSON carries none', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    const s = io();
    await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    const file = s.out.join('').trim();
    const text = readTextFile(join(root, file));
    const today = new Date().toISOString().slice(0, 10);
    expect(text).toMatch(new RegExp(`raised: ${today}`));
  });

  it('uses a raised date given in the JSON instead of defaulting', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, raised: '2026-01-01' });
    const s = io();
    await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    const file = s.out.join('').trim();
    const text = readTextFile(join(root, file));
    expect(text).toMatch(/raised: 2026-01-01/);
  });

  it('picks the next free number when one is already spent', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md': 'anything, never parsed by this test',
      },
    });
    const json = writeJson(root, FIELDS);
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('').trim()).toBe('.omni-loop/delivery/outbox/0042-a/s7-02-default-timeout.md');
  });

  it('the number is a running counter per slice, even when the slug differs from the spent one', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md': 'anything, never parsed by this test',
      },
    });
    const json = writeJson(root, { ...FIELDS, slug: 'a-completely-different-slug' });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('').trim()).toBe('.omni-loop/delivery/outbox/0042-a/s7-02-a-completely-different-slug.md');
  });

  it('a high item (hardToRevert) still writes an open file even with --adopt', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, hardToRevert: true });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt'],
      { cwd: root, ...s },
    );
    expect(code).toBe(0);
    const file = s.out.join('').trim();
    expect(existsSync(join(root, file))).toBe(true);
    const text = readTextFile(join(root, file));
    expect(text).toMatch(/rank: high/);
  });

  it('--adopt on a medium item writes no open file and appends to settled.md', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt'],
      { cwd: root, ...s },
    );
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/adopted straight to/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md'))).toBe(false);
    const settled = readTextFile(join(root, '.omni-loop/delivery/outbox/0042-a/settled.md'));
    expect(settled).toMatch(/s7-01-default-timeout — adopted/);
    expect(settled).toMatch(/Verdict: adopted/);
  });

  it('a second --adopt run for the same slice picks the next free number, not a repeat', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    const s1 = io();
    await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt'], { cwd: root, ...s1 });
    const s2 = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt'], { cwd: root, ...s2 });
    expect(code).toBe(0);
    expect(s2.out.join('')).toMatch(/s7-02-default-timeout/);
  });

  it('an adoption the ledger refuses writes nothing, names the refusal, and exits 1', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    adoptItem.mockReturnValueOnce({ ok: false, errors: ['the ledger refused this adoption, for the test'] });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt'],
      { cwd: root, ...s },
    );
    expect(code).toBe(1);
    expect(s.err.join('')).toMatch(/nothing was written:/);
    expect(s.err.join('')).toMatch(/the ledger refused this adoption, for the test/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md'))).toBe(false);
  });

  it('needsHumanAction writes a human-action item, prints its path, and exits 1 (blocked)', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const { options, ...withoutOptions } = FIELDS;
    const json = writeJson(root, {
      ...withoutOptions,
      needsHumanAction: true,
      personSteps: 'Ask an admin to grant the missing scope on the shared service account.',
    });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(1);
    const file = s.out.join('').trim();
    expect(file).toBe('.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md');
    expect(existsSync(join(root, file))).toBe(true);
    const text = readTextFile(join(root, file));
    expect(text).toMatch(/rank: human-action/);
    expect(text).toMatch(/## What a person must do/);
    expect(text).toMatch(/Ask an admin to grant the missing scope/);
    expect(s.err.join('')).toMatch(/the slice is blocked/);
  });

  it('personSteps is required when the decision settles at rank human-action', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, needsHumanAction: true });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/personSteps/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('options is required unless the decision settles at rank human-action', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const { options, ...withoutOptions } = FIELDS;
    const json = writeJson(root, withoutOptions);
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/options/);
  });

  it('breaking a named law stops with exit 1 and writes nothing', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n', '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' },
    });
    const json = writeJson(root, { ...FIELDS, bearsOn: 'N1', breaksNamedLaw: true });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.err.join('')).toMatch(/nothing was written/);
    expect(s.err.join('')).toMatch(/N1/);
  });

  it('a decision pulled apart by two principles writes a high item, prints its path, and exits 1 (stop)', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n', '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' },
    });
    const json = writeJson(root, { ...FIELDS, principlesConflict: ['P-A-1', 'P-B-1'] });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(1);
    const file = s.out.join('').trim();
    expect(file).toBe('.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md');
    expect(existsSync(join(root, file))).toBe(true);
    const text = readTextFile(join(root, file));
    expect(text).toMatch(/rank: high/);
    expect(s.err.join('')).toMatch(/the slice must stop/);
    expect(s.err.join('')).toMatch(/P-A-1, P-B-1/);
  });
});

describe('omni item new --json', () => {
  function jsonOut(s) {
    return JSON.parse(s.out.join('').trim());
  }

  it('a plain record prints outcome, rank, id and file, with adopted false and reason null', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(0);
    expect(jsonOut(s)).toEqual({
      outcome: 'record',
      rank: 'medium',
      id: 's7-01-default-timeout',
      file: '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md',
      adopted: false,
      reason: null,
    });
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md'))).toBe(true);
  });

  it('a record with --adopt prints adopted true and a null file, since no open file remains', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt', '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(0);
    expect(jsonOut(s)).toEqual({
      outcome: 'record',
      rank: 'medium',
      id: 's7-01-default-timeout',
      file: null,
      adopted: true,
      reason: null,
    });
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md'))).toBe(false);
  });

  it('an adoption the ledger refuses prints outcome null, adopted false, and the reason, exit 1', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, FIELDS);
    adoptItem.mockReturnValueOnce({ ok: false, errors: ['the ledger refused this adoption, for the test'] });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt', '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(1);
    expect(jsonOut(s)).toEqual({
      outcome: null,
      rank: null,
      id: null,
      file: null,
      adopted: false,
      reason: 'the ledger refused this adoption, for the test',
    });
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md'))).toBe(false);
  });

  it('needsHumanAction prints outcome blocked, rank human-action, with the file written and a reason', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const { options, ...withoutOptions } = FIELDS;
    const json = writeJson(root, {
      ...withoutOptions,
      needsHumanAction: true,
      personSteps: 'Ask an admin to grant the missing scope on the shared service account.',
    });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(1);
    const parsed = jsonOut(s);
    expect(parsed).toEqual({
      outcome: 'blocked',
      rank: 'human-action',
      id: 's7-01-default-timeout',
      file: '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md',
      adopted: false,
      reason: expect.stringMatching(/only a person can do this/),
    });
    expect(existsSync(join(root, parsed.file))).toBe(true);
  });

  it('a decision pulled apart by two principles prints outcome stop, rank high, with the file written', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n', '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' },
    });
    const json = writeJson(root, { ...FIELDS, principlesConflict: ['P-A-1', 'P-B-1'] });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(1);
    const parsed = jsonOut(s);
    expect(parsed).toEqual({
      outcome: 'stop',
      rank: 'high',
      id: 's7-01-default-timeout',
      file: '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md',
      adopted: false,
      reason: expect.stringMatching(/P-A-1, P-B-1/),
    });
    expect(existsSync(join(root, parsed.file))).toBe(true);
  });

  it('breaking a named law prints outcome stop with a null rank, id and file, since nothing was written', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n', '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' },
    });
    const json = writeJson(root, { ...FIELDS, bearsOn: 'N1', breaksNamedLaw: true });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(1);
    expect(jsonOut(s)).toEqual({
      outcome: 'stop',
      rank: null,
      id: null,
      file: null,
      adopted: false,
      reason: expect.stringMatching(/N1/),
    });
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });
});

describe('omni item new — user-caused errors are one line, exit 2', () => {
  const oneLine = (s) => expect(s.err.join('')).toMatch(/^[^\n]+\n$/);

  it('a missing flag', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['item', 'new', '--prd', '42', '--slice', 's7'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
  });

  it('an unknown item subcommand', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['item', 'nope'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
  });

  it('a PRD with no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const json = writeJson(root, FIELDS);
    const s = io();
    const code = await main(['item', 'new', '--prd', '999', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/PRD 999 has no inbox or shipped folder/);
  });

  it('a JSON file that does not exist', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', 'gone.json'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });

  it('a JSON file missing a required field', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const { decide, ...rest } = FIELDS;
    const json = writeJson(root, rest);
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/decide/);
  });

  it('a slug that is not kebab-case', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, slug: 'Not_Kebab' });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/slug/);
  });

  it('malformed JSON text', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const path = join(root, 'bad.json');
    writeFileSync(path, '{ not json');
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', path], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });

  it('too few options', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, options: ['only one'] });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });
});

describe('omni item new — a rendered item that "check outbox" would reject', () => {
  it('a backticked code name in an option writes nothing and exits 2, violations on stderr', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, {
      ...FIELDS,
      options: [
        'Wait five seconds, using `defaultTimeoutMs`, the option built.',
        'Wait one second, so a stuck call is caught sooner.',
      ],
    });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/carries a code span/);
    expect(s.err.join('')).toMatch(/defaultTimeoutMs/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('the same violation prints outcome null with the reason under --json, and exit stays 2', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, {
      ...FIELDS,
      options: [
        'Wait five seconds, using `defaultTimeoutMs`, the option built.',
        'Wait one second, so a stuck call is caught sooner.',
      ],
    });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(2);
    const parsed = JSON.parse(s.out.join('').trim());
    expect(parsed).toEqual({
      outcome: null,
      rank: null,
      id: null,
      file: null,
      adopted: false,
      reason: expect.stringMatching(/carries a code span/),
    });
    expect(parsed.reason).toMatch(/defaultTimeoutMs/);
    expect(s.err.join('')).toBe('');
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });
});

describe('omni item new — the intro and the punchline (PRD #50, slice s1)', () => {
  const FUN = {
    introFun: 'A slow call is a polite call that forgot to hang up.',
    punchlineFun: 'Five seconds later, we hang up for it.',
  };
  const ITEM = '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md';
  const repo = () => makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });

  it('writes both sections, right after the plain decision, when given both fields', async () => {
    const { root } = repo();
    const json = writeJson(root, { ...FIELDS, ...FUN });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('').trim()).toBe(ITEM);
    const text = readTextFile(join(root, ITEM));
    expect(text).toContain(`## The intro, for fun\n\n${FUN.introFun}\n`);
    expect(text).toContain(`## The punchline, for fun\n\n${FUN.punchlineFun}\n`);
    expect(text.indexOf('## The decision, in plain words')).toBeLessThan(text.indexOf('## The intro, for fun'));
    expect(text.indexOf('## The punchline, for fun')).toBeLessThan(text.indexOf('## The options, in plain words'));
  });

  it('writes neither section when given neither field', async () => {
    const { root } = repo();
    const json = writeJson(root, FIELDS);
    const s = io();
    expect(await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s })).toBe(0);
    expect(readTextFile(join(root, ITEM))).not.toMatch(/for fun/);
  });

  it('with --adopt, the settled entry embeds both sections', async () => {
    const { root } = repo();
    const json = writeJson(root, { ...FIELDS, ...FUN });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt', '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(0);
    expect(JSON.parse(s.out.join('').trim())).toMatchObject({ outcome: 'record', adopted: true, file: null });
    expect(existsSync(join(root, ITEM))).toBe(false);
    const settled = readTextFile(join(root, '.omni-loop/delivery/outbox/0042-a/settled.md'));
    expect(settled).toContain(`## The intro, for fun\n\n${FUN.introFun}\n`);
    expect(settled).toContain(`## The punchline, for fun\n\n${FUN.punchlineFun}\n`);
  });

  it('an intro over 120 characters writes nothing, exits 2, and names the field', async () => {
    const { root } = repo();
    const json = writeJson(root, { ...FIELDS, ...FUN, introFun: `${'a'.repeat(120)}.` });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]+\n$/);
    expect(s.err.join('')).toMatch(/"introFun"/);
    expect(s.err.join('')).toMatch(/121 characters long/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('a punchline holding a backticked code name writes nothing, exits 2, and names the field', async () => {
    const { root } = repo();
    const json = writeJson(root, { ...FIELDS, ...FUN, punchlineFun: 'Even `defaultTimeoutMs` hangs up eventually.' });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/"punchlineFun"/);
    expect(s.err.join('')).toMatch(/code span/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('the same refusal under --json and --adopt: exit 2, nothing written, adopted or not', async () => {
    const { root } = repo();
    const json = writeJson(root, { ...FIELDS, ...FUN, punchlineFun: 'a'.repeat(200) });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--adopt', '--json'],
      { cwd: root, ...s },
    );
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/"punchlineFun"/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('an intro without a punchline writes nothing, exits 2, and names the missing field', async () => {
    const { root } = repo();
    const json = writeJson(root, { ...FIELDS, introFun: FUN.introFun });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]+\n$/);
    expect(s.err.join('')).toMatch(/"punchlineFun"/);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('a punchline without an intro names the missing intro', async () => {
    const { root } = repo();
    const json = writeJson(root, { ...FIELDS, punchlineFun: FUN.punchlineFun });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/"introFun"/);
  });
});

function readTextFile(path) {
  return readFileSync(path, 'utf8');
}
