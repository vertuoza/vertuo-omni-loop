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

/** A fake `execFileSync`: resolves `git rev-parse --show-toplevel` to `root`, and `gh pr list …` to
 * `prs` (as JSON), whatever else is passed. Records every call. */
function fakeExec(root, prs) {
  const calls = [];
  const exec = (file, args, options = {}) => {
    calls.push({ file, args, options });
    if (file === 'git' && args[0] === 'rev-parse') return `${root}\n`;
    if (file === 'gh' && args[0] === 'pr' && args[1] === 'list') return JSON.stringify(prs);
    throw new Error(`fakeExec: unexpected call ${file} ${args.join(' ')}`);
  };
  return { exec, calls };
}

function pr(overrides = {}) {
  return {
    number: 1,
    title: 's1',
    headRefName: 'feat/widgets--s1',
    baseRefName: 'feat/widgets',
    state: 'OPEN',
    isDraft: false,
    mergedAt: null,
    body: '',
    labels: [],
    updatedAt: '2026-09-25T11:00:00Z',
    createdAt: '2026-09-25T10:00:00Z',
    commits: [{ committedDate: '2026-09-25T10:00:00Z' }],
    ...overrides,
  };
}

describe('omni board', () => {
  it('prints one row per slice and the runnable frontier', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |', '| s2 | Beta | `b/` | s1 | 2 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const { exec, calls } = fakeExec(root, [pr({ mergedAt: '2026-09-25T11:30:00Z', state: 'MERGED' })]);
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    const text = s.out.join('');
    expect(text).toMatch(/omni board — PRD 7: 2 slice\(s\)/);
    expect(text).toMatch(/s1\s+w1\s+merged/);
    expect(text).toMatch(/s2\s+w2\s+runnable/);
    expect(text).toMatch(/runnable frontier: wave 2 — s2/);

    const ghCall = calls.find((call) => call.file === 'gh');
    expect(ghCall.args).toEqual([
      'pr',
      'list',
      '--repo',
      'acme/widgets',
      '--json',
      'number,title,headRefName,baseRefName,state,isDraft,mergedAt,body,labels,updatedAt,createdAt,commits',
      '--state',
      'all',
      '--limit',
      '200',
    ]);
  });

  it('prints --json with the same shape boardFor returns', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const { exec } = fakeExec(root, []);
    const s = io();
    const code = await main(['board', '7', '--json'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    const payload = JSON.parse(s.out.join(''));
    expect(payload.slices).toHaveLength(1);
    expect(payload.slices[0]).toMatchObject({ id: 's1', state: 'runnable', pr: null });
    expect(payload.frontier).toEqual({ wave: 1, slices: ['s1'], excluded: [], collisions: [] });
  });

  it('reports a stuck slice from the needs-fix label', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const { exec } = fakeExec(root, [pr({ labels: [{ name: 'pr:needs-fix' }] })]);
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/s1\s+w1\s+stuck/);
  });

  it('honours a configured board.matchBy of "label"', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nboard:\n  matchBy: label\n',
        '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan,
      },
    });
    const { exec } = fakeExec(root, [pr({ baseRefName: 'main', labels: [{ name: 'pr:sub' }] })]);
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/s1\s+w1\s+in-flight/);
  });

  it('fails usage with no PRD argument', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG } });
    const s = io();
    const code = await main(['board'], { cwd: root, exec: fakeExec(root, []).exec, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/usage: omni board <prd>/);
  });

  it('fails usage when the PRD has no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG } });
    const s = io();
    const code = await main(['board', '9'], { cwd: root, exec: fakeExec(root, []).exec, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/PRD 9 has no inbox or shipped folder/);
  });
});
