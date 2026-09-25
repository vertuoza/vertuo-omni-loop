import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

function planMd(rows) {
  return [
    '# A plan',
    '',
    '| id | slice | territory | blocked by | wave |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

describe('omni plan check', () => {
  it('passes a plan whose slices share no ground in any one wave', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | — | 1 |',
      '| s2 | Beta | `b/` | s1 | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/2 slice\(s\) across wave\(s\) 1, 2/);
    expect(s.out.join('')).toMatch(/all territories and blocks well-formed/);
  });

  it('flags two slices in the same wave sharing territory', async () => {
    const plan = planMd([
      '| s1 | Alpha | `shared/` | — | 1 |',
      '| s2 | Beta | `shared/` | — | 1 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 and s2 share.*wave 1/);
  });

  it('does not flag two slices sharing territory across different waves', async () => {
    const plan = planMd([
      '| s1 | Alpha | `shared/` | — | 1 |',
      '| s2 | Beta | `shared/` | s1 | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/collision matrix \(1 pair/);
  });

  it('flags a "blocked by" id that names no slice in the plan', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | s9 | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 is blocked by "s9", which names no slice/);
  });

  it('flags a slice blocked by one in its own wave', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | s2 | 1 |',
      '| s2 | Beta | `b/` | — | 1 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 \(wave 1\) is blocked by s2 \(wave 1\)/);
  });

  it('flags a slice blocked by one in a later wave', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | s2 | 1 |',
      '| s2 | Beta | `b/` | — | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 \(wave 1\) is blocked by s2 \(wave 2\)/);
  });

  it('flags an id used by more than one slice row', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | — | 1 |',
      '| s1 | Beta | `b/` | — | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/id "s1" is used by more than one slice row/);
  });

  it('passes on this repository\'s own PRD 7 plan', async () => {
    const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: repoRoot, ...s });
    expect(s.out.join('')).not.toMatch(/violation/);
    expect(code).toBe(0);
  });
});

describe('omni plan check — user-caused errors are one line, exit 2', () => {
  const oneLine = (s) => expect(s.err.join('')).toMatch(/^[^\n]+\n$/);

  it('an unknown plan subcommand', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['plan', 'nope'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
  });

  it('a missing prd argument', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['plan', 'check'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
  });

  it('a PRD with no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    const code = await main(['plan', 'check', '999'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/PRD 999 has no inbox or shipped folder/);
  });

  it('a PRD folder with no plan.md', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/spec.md': 'x' } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });

  it('a plan whose slice table has no territory column', async () => {
    const plan = [
      '| id | slice | wave |',
      '| --- | --- | --- |',
      '| s1 | Alpha | 1 |',
      '',
    ].join('\n');
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });
});
