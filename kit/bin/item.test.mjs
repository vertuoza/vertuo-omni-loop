import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

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
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
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
    await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    const file = s.out.join('').trim();
    const text = readTextFile(join(root, file));
    const today = new Date().toISOString().slice(0, 10);
    expect(text).toMatch(new RegExp(`raised: ${today}`));
  });

  it('uses a raised date given in the JSON instead of defaulting', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, raised: '2026-01-01' });
    const s = io();
    await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
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
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
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
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('').trim()).toBe('.omni-loop/delivery/outbox/0042-a/s7-02-a-completely-different-slug.md');
  });

  it('a high item (hardToRevert) still writes an open file even with --adopt', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, hardToRevert: true });
    const s = io();
    const code = await main(
      ['item', 'new', '--prd', '42', '--slice', 's7', '--json', json, '--adopt'],
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
      ['item', 'new', '--prd', '42', '--slice', 's7', '--json', json, '--adopt'],
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
    await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json, '--adopt'], { cwd: root, ...s1 });
    const s2 = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json, '--adopt'], { cwd: root, ...s2 });
    expect(code).toBe(0);
    expect(s2.out.join('')).toMatch(/s7-02-default-timeout/);
  });

  it('needsHumanAction stops with exit 1 and writes nothing', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, needsHumanAction: true });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.err.join('')).toMatch(/nothing was written/);
    expect(s.out.join('')).toBe('');
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
  });

  it('breaking a named law stops with exit 1 and writes nothing', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n', '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' },
    });
    const json = writeJson(root, { ...FIELDS, bearsOn: 'N1', breaksNamedLaw: true });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.err.join('')).toMatch(/nothing was written/);
    expect(s.err.join('')).toMatch(/N1/);
  });

  it('a decision pulled apart by two principles stops with exit 1 and writes nothing', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n', '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' },
    });
    const json = writeJson(root, { ...FIELDS, principlesConflict: ['P-A-1', 'P-B-1'] });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.err.join('')).toMatch(/nothing was written/);
    expect(s.err.join('')).toMatch(/P-A-1, P-B-1/);
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
    const code = await main(['item', 'new', '--prd', '999', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/PRD 999 has no inbox or shipped folder/);
  });

  it('a JSON file that does not exist', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', 'gone.json'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });

  it('a JSON file missing a required field', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const { decide, ...rest } = FIELDS;
    const json = writeJson(root, rest);
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/decide/);
  });

  it('a slug that is not kebab-case', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, slug: 'Not_Kebab' });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/slug/);
  });

  it('malformed JSON text', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const path = join(root, 'bad.json');
    writeFileSync(path, '{ not json');
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', path], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });

  it('too few options', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
    const json = writeJson(root, { ...FIELDS, options: ['only one'] });
    const s = io();
    const code = await main(['item', 'new', '--prd', '42', '--slice', 's7', '--json', json], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });
});

function readTextFile(path) {
  return readFileSync(path, 'utf8');
}
