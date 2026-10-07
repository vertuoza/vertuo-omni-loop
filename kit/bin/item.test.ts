import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { adoptItem } from '../lib/outbox/settle.ts';
import { dig, digText } from './dig.ts';
import { main } from './omni.ts';
import type { Io } from '../test/fixture.ts';

// `adoptItem`'s own two failure conditions (a rendered item that fails to parse, or one whose rank
// is not `medium`) are both already excluded by the time `item new --adopt` calls it: the same
// `checkItemText` grading runs first on the identical text, and this branch is only ever reached
// when `decision.rank === 'medium'`. Wrapping the real implementation lets one test force the
// ledger-refusal branch anyway — a `settle.mjs` internal detail (a malformed `settled.md`, say)
// that has nothing to do with the item text itself — without touching any other test's behavior.
vi.mock('../lib/outbox/settle.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/outbox/settle.ts')>();
  return { ...actual, adoptItem: vi.fn(actual.adoptItem) };
});

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
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

/** `FIELDS` without `key`: an item JSON missing that field. */
const fieldsWithout = (key: string) => Object.fromEntries(Object.entries(FIELDS).filter(([name]) => name !== key));

/** Matches any text `pattern` matches, inside an expected object. */
const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern);

function writeJson(dir: string, fields: Record<string, unknown>) {
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
    vi.mocked(adoptItem).mockReturnValueOnce({ ok: false, errors: ['the ledger refused this adoption, for the test'] });
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
    const withoutOptions = fieldsWithout('options');
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
    const withoutOptions = fieldsWithout('options');
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
  function jsonOut(s: Io): unknown {
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
    vi.mocked(adoptItem).mockReturnValueOnce({ ok: false, errors: ['the ledger refused this adoption, for the test'] });
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
    const withoutOptions = fieldsWithout('options');
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
      reason: matching(/only a person can do this/),
    });
    expect(existsSync(join(root, digText(parsed, 'file')))).toBe(true);
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
      reason: matching(/P-A-1, P-B-1/),
    });
    expect(existsSync(join(root, digText(parsed, 'file')))).toBe(true);
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
      reason: matching(/N1/),
    });
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });
});

describe('omni item new — user-caused errors are one line, exit 2', () => {
  const oneLine = (s: Io) => {
    expect(s.err.join('')).toMatch(/^[^\n]+\n$/);
  };

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
    const rest = fieldsWithout('decide');
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
    const parsed: unknown = JSON.parse(s.out.join('').trim());
    expect(parsed).toEqual({
      outcome: null,
      rank: null,
      id: null,
      file: null,
      adopted: false,
      reason: matching(/carries a code span/),
    });
    expect(dig(parsed, 'reason')).toMatch(/defaultTimeoutMs/);
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

describe('omni item new --out (PRD 563, s3)', () => {
  const repo = () => makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
  const scratch = () => mkdtempSync(join(tmpdir(), 'omni-out-'));

  it('writes the same file name and content into the folder, and nothing in the outbox', async () => {
    const plain = repo();
    const s1 = io();
    expect(await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', writeJson(plain.root, FIELDS)], { cwd: plain.root, ...s1 })).toBe(0);
    const expected = readTextFile(join(plain.root, s1.out.join('').trim()));

    const { root } = repo();
    const out = scratch();
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', writeJson(root, FIELDS), '--out', out], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('').trim()).toBe(join(out, 's7-01-default-timeout.md'));
    expect(readTextFile(join(out, 's7-01-default-timeout.md'))).toBe(expected);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('under --json names the file in the folder', async () => {
    const { root } = repo();
    const out = scratch();
    const s = io();
    expect(await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', writeJson(root, FIELDS), '--out', out, '--json'], { cwd: root, ...s })).toBe(0);
    expect(JSON.parse(s.out.join(''))).toMatchObject({
      outcome: 'record',
      rank: 'medium',
      id: 's7-01-default-timeout',
      file: join(out, 's7-01-default-timeout.md'),
      adopted: false,
    });
  });

  it('counts the numbers already spent in the folder and in the outbox', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md': 'spent',
      },
    });
    const out = scratch();
    writeFileSync(join(out, 's7-02-other.md'), 'spent');
    const s = io();
    expect(await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', writeJson(root, FIELDS), '--out', out], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('').trim()).toBe(join(out, 's7-03-default-timeout.md'));
  });

  it('refuses --out with --adopt, one line, exit 2, nothing written', async () => {
    const { root } = repo();
    const out = scratch();
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', writeJson(root, FIELDS), '--out', out, '--adopt'], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]*--out[^\n]*--adopt[^\n]*\n$/);
    expect(readdirSync(out)).toEqual([]);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('a blocked item is written into the folder too, exit 1', async () => {
    const { root } = repo();
    const out = scratch();
    const rest = fieldsWithout('options');
    const json = writeJson(root, { ...rest, needsHumanAction: true, personSteps: 'Set the secret in the console.' });
    const s = io();
    expect(await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', json, '--out', out], { cwd: root, ...s })).toBe(1);
    expect(existsSync(join(out, 's7-01-default-timeout.md'))).toBe(true);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });
});

describe('omni item relay (PRD 563, s3)', () => {
  const OUTBOX = '.omni-loop/delivery/outbox/0042-a';
  const repo = () => makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
  const scratch = () => mkdtempSync(join(tmpdir(), 'omni-out-'));

  async function raise(root: string, out: string, fields: Record<string, unknown>) {
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--file', writeJson(root, fields), '--out', out], { cwd: root, ...s });
    expect(code).toBe(0);
    return s.out.join('').trim();
  }

  const ACCOUNT = [
    '---',
    'prd: 42',
    'slice: s7',
    'graded: 2026-09-29',
    '---',
    '',
    '## Risky changes',
    '',
    '- `kit/lib/a.mjs`',
    '  stored-shape',
    '  spec point 3',
    '',
  ].join('\n');

  it('moves every valid item and account into the outbox, prints each move, exit 0', async () => {
    const { root } = repo();
    const out = scratch();
    const first = await raise(root, out, FIELDS);
    await raise(root, out, { ...FIELDS, slug: 'retry-count' });
    mkdirSync(join(out, 'accounts'));
    writeFileSync(join(out, 'accounts', 's7.md'), ACCOUNT);
    const itemText = readTextFile(first);

    const s = io();
    const code = await main(['item', 'relay', out, '--prd', '42'], { cwd: root, ...s });
    expect(s.err.join('')).toBe('');
    expect(code).toBe(0);
    expect(readTextFile(join(root, OUTBOX, 's7-01-default-timeout.md'))).toBe(itemText);
    expect(existsSync(join(root, OUTBOX, 's7-02-retry-count.md'))).toBe(true);
    expect(readTextFile(join(root, OUTBOX, 'accounts', 's7.md'))).toBe(ACCOUNT);
    expect(readdirSync(out)).toEqual(['accounts']);
    expect(readdirSync(join(out, 'accounts'))).toEqual([]);
    const printed = s.out.join('');
    expect(printed).toContain(`${OUTBOX}/s7-01-default-timeout.md`);
    expect(printed).toContain(`${OUTBOX}/s7-02-retry-count.md`);
    expect(printed).toContain(`${OUTBOX}/accounts/s7.md`);
    // the relayed items read as open items of the PRD
    expect(await main(['check', 'outbox'], { cwd: root, ...io() })).toBe(0);
  });

  it('leaves a refused item in the folder with its reason, exit 2, while the valid ones still move', async () => {
    const { root } = repo();
    const out = scratch();
    await raise(root, out, FIELDS);
    const bad = join(out, 's7-02-broken.md');
    const good = readTextFile(join(out, 's7-01-default-timeout.md'));
    writeFileSync(bad, good.replace('id: s7-01-default-timeout', 'id: s7-02-broken').replace('A. Wait five seconds', 'A. Wait `defaultTimeoutMs`'));

    const s = io();
    const code = await main(['item', 'relay', out, '--prd', '42'], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(existsSync(join(root, OUTBOX, 's7-01-default-timeout.md'))).toBe(true);
    expect(existsSync(bad)).toBe(true);
    expect(existsSync(join(root, OUTBOX, 's7-02-broken.md'))).toBe(false);
    expect(s.err.join('')).toMatch(/s7-02-broken\.md/);
    expect(s.err.join('')).toMatch(/option/);
  });

  it('refuses an item of another PRD, and one whose id is already in the outbox', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        [`${OUTBOX}/s7-01-default-timeout.md`]: 'already here',
      },
    });
    const out = scratch();
    const text = readTextFile(await raise(root, out, FIELDS)); // s7-02: the outbox spent 01
    writeFileSync(join(out, 's7-01-default-timeout.md'), text.replace('id: s7-02-default-timeout', 'id: s7-01-default-timeout'));
    writeFileSync(
      join(out, 's7-03-elsewhere.md'),
      text.replace('id: s7-02-default-timeout', 'id: s7-03-elsewhere').replace('prd: 42', 'prd: 43'),
    );

    const s = io();
    expect(await main(['item', 'relay', out, '--prd', '42'], { cwd: root, ...s })).toBe(2);
    expect(readTextFile(join(root, OUTBOX, 's7-01-default-timeout.md'))).toBe('already here');
    expect(existsSync(join(root, OUTBOX, 's7-02-default-timeout.md'))).toBe(true);
    expect(existsSync(join(out, 's7-01-default-timeout.md'))).toBe(true);
    expect(existsSync(join(out, 's7-03-elsewhere.md'))).toBe(true);
    const err = s.err.join('');
    expect(err).toMatch(/s7-01-default-timeout\.md[^\n]*already/);
    expect(err).toMatch(/s7-03-elsewhere\.md[^\n]*PRD 43/);
  });

  it('refuses a malformed account and leaves it in place', async () => {
    const { root } = repo();
    const out = scratch();
    mkdirSync(join(out, 'accounts'));
    writeFileSync(join(out, 'accounts', 's7.md'), 'no front matter\n');
    const s = io();
    expect(await main(['item', 'relay', out, '--prd', '42'], { cwd: root, ...s })).toBe(2);
    expect(existsSync(join(out, 'accounts', 's7.md'))).toBe(true);
    expect(existsSync(join(root, OUTBOX, 'accounts', 's7.md'))).toBe(false);
    expect(s.err.join('')).toMatch(/accounts\/s7\.md/);
  });

  it('an empty folder relays nothing, exit 0', async () => {
    const { root } = repo();
    const s = io();
    expect(await main(['item', 'relay', scratch(), '--prd', '42'], { cwd: root, ...s })).toBe(0);
    expect(s.out.join('')).toMatch(/nothing to relay/);
  });

  it('a folder that does not exist, or a missing --prd, is one line, exit 2', async () => {
    const { root } = repo();
    const s = io();
    expect(await main(['item', 'relay', join(tmpdir(), 'omni-no-such-dir-563'), '--prd', '42'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]+\n$/);
    expect(await main(['item', 'relay', scratch()], { cwd: root, ...io() })).toBe(2);
  });
});

function readTextFile(path: string) {
  return readFileSync(path, 'utf8');
}
