// PRD 2898, s1: `omni item new --excuses <path>` — the exact paths an item excuses, written into its
// front matter before the item is graded. Its own file: `item.test.ts` proves N-PRODUCT-3 and is its
// owner's.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { itemExcuses } from '../lib/outbox/excuses.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n', '.omni-loop/delivery/inbox/0042-a/spec.md': 'x', 'kit/lib/init/labels.ts': 'x' };

const FIELDS = {
  slug: 'label-style',
  wave: 1,
  questionPlain: 'May the new label get its colour beside the other loop labels?',
  decisionPlain: 'It gets one, so that the install creates it with the others.',
  decide: 'Whether the new label is created at install.',
  meanwhile: 'Its colour sits beside the other loop labels.',
  cost: 'One line.',
  gaps: ['whether the install should create it at all'],
  options: ['Create it at install, the option built.', 'Leave it for a person to create.'],
};

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

async function itemNew(extra: string[], fields: Record<string, unknown> = FIELDS) {
  const { root } = makeRepo({ git: true, files: CONFIG });
  const json = join(root, 'item.json');
  writeFileSync(json, JSON.stringify(fields));
  const s = io();
  const code = await main(['item', 'new', '--prd', '42', '--slice', 's1', '--file', json, ...extra], { cwd: root, ...s });
  return { root, code, out: s.out.join(''), err: s.err.join('') };
}

describe('omni item new --excuses (PRD 2898)', () => {
  it('writes each path it is given into the item\'s excuses field', async () => {
    const { root, code, out } = await itemNew(['--excuses', 'kit/lib/init/labels.ts', '--excuses', 'kit/lib/init/labels.test.ts']);
    expect(code).toBe(0);
    const text = readFileSync(join(root, out.trim()), 'utf8');
    expect(text).toMatch(/^wave: 1\nexcuses: \[kit\/lib\/init\/labels\.ts, kit\/lib\/init\/labels\.test\.ts\]\n---$/m);
    expect(itemExcuses(text)).toEqual(['kit/lib/init/labels.ts', 'kit/lib/init/labels.test.ts']);
  });

  it('writes no field without the flag', async () => {
    const { root, out } = await itemNew([]);
    expect(readFileSync(join(root, out.trim()), 'utf8')).not.toMatch(/excuses:/);
  });

  it('keeps the field when a medium item is adopted straight to the ledger', async () => {
    const { root, code } = await itemNew(['--adopt', '--excuses', 'kit/lib/init/labels.ts']);
    expect(code).toBe(0);
    expect(readFileSync(join(root, '.omni-loop/delivery/outbox/0042-a/settled.md'), 'utf8')).toMatch(/excuses: \[kit\/lib\/init\/labels\.ts\]/);
  });

  it('refuses a folder on disk, a pattern, a path outside the root or one given twice, writing nothing, exit 2', async () => {
    for (const [paths, message] of [
      [['kit/lib/init'], 'kit/lib/init is a folder: an item excuses exact paths only'],
      [['kit/lib/'], 'kit/lib/ is a folder: an item excuses exact paths only'],
      [['kit/**/labels.ts'], 'kit/**/labels.ts is a pattern: an item excuses exact paths only'],
      [['../x.ts'], '../x.ts is not a path from the repository root'],
      [['a.ts', 'a.ts'], 'a.ts is given twice'],
    ] as const) {
      const { root, code, err } = await itemNew(paths.flatMap((path) => ['--excuses', path]));
      expect(code, paths.join(' ')).toBe(2);
      expect(err).toBe(`omni item new: --excuses ${message}.\n`);
      expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a'))).toBe(false);
    }
  });

  it('refuses --excuses with no path', async () => {
    const { code, err } = await itemNew(['--excuses']);
    expect(code).toBe(2);
    expect(err).toMatch(/--excuses needs a value/);
  });
});
