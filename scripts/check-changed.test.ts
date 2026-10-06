// `pnpm check:changed` (PRD 1042), proven on fixture repositories: what changed against the base, the
// steps that change gives, and a run that stops at the first failing step. The plan is what is tested;
// no step here runs lint, vitest or the audit: the runner is handed a fake that only records.
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { makeRepo } from '../kit/test/fixture.ts';
import { type Changes, type Step, changedFiles, mergeBase, planChecks, runChecks, unlinted } from './check-changed-steps.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A fixture repository on a branch `work` cut from `main`, which holds `files`. */
function repo(files: Record<string, string>) {
  const fixture = makeRepo({ files, git: true });
  roots.push(fixture.root);
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: fixture.root, stdio: 'ignore' });
  git('checkout', '-q', '-b', 'work');
  const commit = () => {
    git('add', '-A');
    git('commit', '-q', '-m', 'change');
  };
  return { ...fixture, commit };
}

const source = { 'kit/lib/a.ts': 'export const a = 1;\n', 'kit/lib/b.ts': 'export const b = 2;\n', 'package.json': '{}\n' };

/** Changes to files git tracks, none untracked. */
const tracked = (...paths: string[]): Changes => ({ tracked: paths, untracked: [] });

describe('what changed against the base', () => {
  it('takes committed, uncommitted and untracked files, never a deleted one', () => {
    const { root, write, commit } = repo(source);
    write('kit/lib/a.ts', 'export const a = 3;\n');
    commit();
    write('kit/lib/b.ts', 'export const b = 4;\n');
    write('kit/lib/c.ts', 'export const c = 5;\n');
    rmSync(`${root}/package.json`);
    expect(changedFiles(root, mergeBase(root, 'main'))).toEqual({ tracked: ['kit/lib/a.ts', 'kit/lib/b.ts'], untracked: ['kit/lib/c.ts'] });
  });

  it('is empty when nothing changed', () => {
    const { root } = repo(source);
    expect(changedFiles(root, mergeBase(root, 'main'))).toEqual({ tracked: [], untracked: [] });
  });
});

const names = (steps: readonly Step[]) => steps.map((step) => step.name);
const step = (steps: readonly Step[], name: string) => steps.find((s) => s.name === name);

describe('the steps a change gives', () => {
  it('one changed source file: typecheck, lint of it, its related tests, then the audit against the base', () => {
    const { root, write } = repo(source);
    write('kit/lib/a.ts', 'export const a = 3;\n');
    const base = mergeBase(root, 'main');
    const steps = planChecks(changedFiles(root, base), base);
    expect(steps).toEqual([
      { name: 'typecheck', command: 'pnpm', args: ['typecheck'] },
      { name: 'lint', command: 'pnpm', args: ['lint', 'kit/lib/a.ts'] },
      { name: 'tests', command: 'pnpm', args: ['exec', 'vitest', 'related', '--run', 'kit/lib/a.ts'] },
      { name: 'fallow', command: 'pnpm', args: ['fallow:audit'], env: { FALLOW_AUDIT_BASE: base } },
    ]);
  });

  it('a changed test file is linted and run like any source file', () => {
    const steps = planChecks(tracked('kit/lib/a.test.ts', 'kit/lib/a.ts'), 'origin/main');
    expect(step(steps, 'lint')?.args).toEqual(['lint', 'kit/lib/a.test.ts', 'kit/lib/a.ts']);
    expect(step(steps, 'tests')?.args).toEqual(['exec', 'vitest', 'related', '--run', 'kit/lib/a.test.ts', 'kit/lib/a.ts']);
  });

  it('an untracked file runs its related tests, but is not handed to lint, which lints tracked files only', () => {
    const steps = planChecks({ tracked: ['kit/lib/a.ts'], untracked: ['kit/lib/new.ts'] }, 'origin/main');
    expect(step(steps, 'lint')?.args).toEqual(['lint', 'kit/lib/a.ts']);
    expect(step(steps, 'tests')?.args).toEqual(['exec', 'vitest', 'related', '--run', 'kit/lib/a.ts', 'kit/lib/new.ts']);
    expect(names(planChecks({ tracked: [], untracked: ['kit/lib/new.ts'] }, 'origin/main'))).toEqual(['typecheck', 'tests', 'fallow']);
    expect(unlinted({ tracked: ['kit/lib/a.ts'], untracked: ['kit/lib/new.ts', 'kit/lib/new.test.mjs', 'notes.md'] })).toEqual(['kit/lib/new.ts']);
  });

  it.each([
    'package.json',
    'apps/galaxy/package.json',
    'pnpm-lock.yaml',
    'tsconfig.json',
    'apps/galaxy/tsconfig.build.json',
    'vitest.config.ts',
    'eslint.config.ts',
    'vitest.setup.ts',
  ])('a change to %s runs the whole suite', (shared) => {
    const steps = planChecks(tracked('kit/lib/a.ts', shared), 'origin/main');
    expect(names(steps)).toEqual(['typecheck', 'lint', 'tests', 'fallow']);
    expect(step(steps, 'tests')?.args).toEqual(['test']);
  });

  it('a shared file alone is never handed to lint', () => {
    const steps = planChecks(tracked('package.json'), 'origin/main');
    expect(names(steps)).toEqual(['typecheck', 'tests', 'fallow']);
    expect(step(steps, 'tests')?.args).toEqual(['test']);
  });

  it('no change gives the typecheck alone', () => {
    expect(planChecks(tracked(), 'origin/main')).toEqual([{ name: 'typecheck', command: 'pnpm', args: ['typecheck'] }]);
  });

  it('a change to no source file gives the typecheck alone', () => {
    expect(names(planChecks(tracked('README.md', 'docs/guide/loop.md'), 'origin/main'))).toEqual(['typecheck']);
  });
});

/** A clock that moves `seconds` each time it is read. */
function clock(seconds: number): () => number {
  let now = 0;
  return () => (now += seconds * 1000);
}

describe('a run', () => {
  const steps: Step[] = [
    { name: 'typecheck', command: 'pnpm', args: ['typecheck'] },
    { name: 'lint', command: 'pnpm', args: ['lint', 'a.ts'] },
    { name: 'tests', command: 'pnpm', args: ['test'] },
  ];

  it('runs every step, printing each with its time, then the total', () => {
    const ran: string[] = [];
    const out: string[] = [];
    const code = runChecks(steps, { spawn: (s) => (ran.push(s.name), 0), now: clock(1), write: (text) => out.push(text) });
    expect(code).toBe(0);
    expect(ran).toEqual(['typecheck', 'lint', 'tests']);
    const text = out.join('');
    expect(text).toContain('✓ typecheck 1.0s');
    expect(text).toContain('✓ tests 1.0s');
    expect(text).toMatch(/check:changed: 3 steps passed in \d+\.\ds/);
  });

  it('stops at the first failing step, with its exit code', () => {
    const ran: string[] = [];
    const out: string[] = [];
    const code = runChecks(steps, { spawn: (s) => (ran.push(s.name), s.name === 'lint' ? 3 : 0), now: clock(1), write: (text) => out.push(text) });
    expect(code).toBe(3);
    expect(ran).toEqual(['typecheck', 'lint']);
    expect(out.join('')).toContain('✗ lint failed (exit 3) after 1.0s');
  });
});
