// What `pnpm check:changed` does (PRD 1042), run by scripts/check-changed.ts: the files changed against
// a base, the steps those changes call for, and a run of them that stops at the first failure and
// times each one. The full preflight stays the gate; this is the loop an agent runs while iterating.
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

/** One command of the run: its name as printed, what it runs, and what it adds to the environment. */
export type Step = { name: string; command: string; args: string[]; env?: Record<string, string> };

/** Runs one step and answers its exit code. */
type Spawn = (step: Step) => number;

const git = (root: string, args: readonly string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const lines = (text: string) => text.split('\n').filter(Boolean);

/** The commit `HEAD` and `ref` share: what a branch cut from `ref` has changed since. */
export function mergeBase(root: string, ref: string): string {
  return git(root, ['merge-base', 'HEAD', ref]).trim();
}

/** What changed against a base: the files git tracks (staged included), and the ones it does not yet. */
export type Changes = { tracked: string[]; untracked: string[] };

/**
 * Every file changed against `base` (committed, staged, uncommitted) and every untracked file git does
 * not ignore, from the root, each sorted. A deleted file is left out: there is nothing left to check.
 */
export function changedFiles(root: string, base: string): Changes {
  return {
    tracked: lines(git(root, ['diff', '--name-only', '--diff-filter=d', base, '--'])).sort(),
    untracked: lines(git(root, ['ls-files', '--others', '--exclude-standard'])).sort(),
  };
}

const TYPESCRIPT = /\.(ts|tsx|mts|cts)$/;
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;

/** A file every test depends on: a change to it can break any test, so the whole suite runs. */
function shared(path: string): boolean {
  const name = basename(path);
  return (
    ['package.json', 'pnpm-lock.yaml', 'vitest.config.ts', 'eslint.config.ts'].includes(name) ||
    /^tsconfig.*\.json$/.test(name) ||
    /(^|\.)setup\.(ts|mts|js|mjs)$/.test(name)
  );
}

/**
 * The steps `changes` call for, in order: the whole typecheck (a type change reaches beyond its file),
 * lint of the changed TypeScript files git tracks (`pnpm lint` lints only those: an untracked file is
 * linted once it is added), their related tests (or the whole suite when a shared file changed), and
 * the fallow audit against `base`. With no source and no shared file changed, the typecheck alone.
 */
export function planChecks({ tracked, untracked }: Changes, base: string): Step[] {
  const typecheck: Step = { name: 'typecheck', command: 'pnpm', args: ['typecheck'] };
  const changed = [...new Set([...tracked, ...untracked])].sort();
  const sources = changed.filter((path) => SOURCE.test(path));
  const whole = changed.some(shared);
  if (sources.length === 0 && !whole) return [typecheck];
  const typescript = tracked.filter((path) => TYPESCRIPT.test(path));
  return [
    typecheck,
    ...(typescript.length > 0 ? [{ name: 'lint', command: 'pnpm', args: ['lint', ...typescript] }] : []),
    whole
      ? { name: 'tests', command: 'pnpm', args: ['test'] }
      : { name: 'tests', command: 'pnpm', args: ['exec', 'vitest', 'related', '--run', ...sources] },
    { name: 'fallow', command: 'pnpm', args: ['fallow:audit'], env: { FALLOW_AUDIT_BASE: base } },
  ];
}

/** The untracked TypeScript files of `changes`: `pnpm lint` lints them once git adds them. */
export function unlinted({ untracked }: Changes): string[] {
  return untracked.filter((path) => TYPESCRIPT.test(path));
}

const seconds =(ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Runs `steps` in order, printing each with its time, and stops at the first that fails. Answers 0
 * when every step passed, or the failing step's exit code.
 */
export function runChecks(
  steps: readonly Step[],
  { spawn, now, write }: { spawn: Spawn; now: () => number; write: (text: string) => void },
): number {
  const start = now();
  for (const step of steps) {
    write(`▶ ${step.name}: ${[step.command, ...step.args].join(' ')}\n`);
    const from = now();
    const code = spawn(step);
    const took = seconds(now() - from);
    if (code !== 0) {
      write(`✗ ${step.name} failed (exit ${String(code)}) after ${took}\n`);
      write(`check:changed: stopped at ${step.name} after ${seconds(now() - start)}\n`);
      return code;
    }
    write(`✓ ${step.name} ${took}\n`);
  }
  write(`check:changed: ${String(steps.length)} steps passed in ${seconds(now() - start)}\n`);
  return 0;
}
