// The git hooks' gate (PRD 1814): `.githooks/pre-commit` and `.githooks/pre-push` run
// `node scripts/check-changed.ts --hook <hook>` from the root of the work tree git runs them in.
//
// - pre-commit: `fallow audit` from that root, so a commit in a worktree is audited against it.
// - pre-push: check:changed's typecheck and lint steps (scripts/check-changed-steps.ts) of what changed
//   since the merge-base with the branch's upstream, else origin/main. The tests run in CI.
//
// Both fail closed: a tool not found (in the work tree's node_modules/.bin, the main checkout's, then
// PATH), a base not found, or an audit that cannot run refuses, in one line naming the fix.
import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { changedFiles, pickSteps, planChecks, runChecks } from './check-changed-steps.ts';

/** Runs `file` with `args` in `cwd`, its output on the terminal, and answers its exit code. */
type Run = (file: string, args: readonly string[], cwd: string, env?: NodeJS.ProcessEnv) => number;

/** What a hook runs, what it reads from git and PATH, and where it writes; the tests hand in fakes. */
export type HookIO = {
  run: Run;
  git: (cwd: string, args: readonly string[]) => string | null;
  write: (text: string) => void;
  warn: (text: string) => void;
  path: string;
};

const realIO = (): HookIO => ({
  run: (file, args, cwd, env) => spawnSync(file, args, { cwd, stdio: 'inherit', env }).status ?? 1,
  git: (cwd, args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return null;
    }
  },
  write: (text) => process.stdout.write(text),
  warn: (text) => process.stderr.write(text),
  path: process.env.PATH ?? '',
});

const executable = (file: string): boolean => {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** The folders a tool is looked up in, in order: the work tree's install, the main checkout's, PATH. */
export function searchPath(root: string, io: Pick<HookIO, 'git' | 'path'>): string[] {
  const common = io.git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const main = common ? dirname(common) : root;
  const installs = [...new Set([root, main])].map((dir) => join(dir, 'node_modules/.bin'));
  return [...installs, ...io.path.split(delimiter).filter(Boolean)];
}

/** The first executable `name` in `dirs`, or null. */
function findTool(name: string, dirs: readonly string[]): string | null {
  return dirs.map((dir) => join(dir, name)).find(executable) ?? null;
}

const refuse = (io: HookIO, hook: string, line: string): number => {
  io.warn(`${hook}: ${line}\n`);
  return 1;
};

/** pre-commit: the fallow audit from `root`. A failing verdict (exit 1) or a runtime error refuses. */
export function preCommit(root: string, dirs: readonly string[], io: HookIO): number {
  const fallow = findTool('fallow', dirs);
  if (!fallow) return refuse(io, 'pre-commit', 'fallow not found (in node_modules/.bin or on PATH): run pnpm install');
  const code = io.run(fallow, ['audit'], root);
  if (code === 0) return 0;
  return code === 1
    ? refuse(io, 'pre-commit', 'refused: the fallow audit above found what the baselines do not allow')
    : refuse(io, 'pre-commit', `fallow audit could not run (exit ${String(code)}): fix it, or commit with --no-verify and say why in the pull request`);
}

/** pre-push: the typecheck and lint of what changed since the merge-base with the upstream, else origin/main. */
export function prePush(root: string, dirs: readonly string[], io: HookIO): number {
  const pnpm = findTool('pnpm', dirs);
  if (!pnpm) return refuse(io, 'pre-push', 'pnpm not found (in node_modules/.bin or on PATH): install pnpm, then run pnpm install');
  const ref = io.git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']) ?? 'origin/main';
  const base = io.git(root, ['merge-base', 'HEAD', ref]);
  if (!base) return refuse(io, 'pre-push', `no merge-base with ${ref}: run git fetch origin`);
  const steps = pickSteps(planChecks(changedFiles(root, base), base), ['typecheck', 'lint']);
  const env = { ...process.env, PATH: dirs.join(delimiter) };
  const code = runChecks(steps, { spawn: (step) => io.run(pnpm, step.args, root, env), now: () => performance.now(), write: io.write });
  return code === 0 ? 0 : refuse(io, 'pre-push', `refused: fix what failed above (measured against ${ref})`);
}

/** Runs the hook `hook` from `cwd`, answering its exit code. */
export function runHook(hook: string | undefined, cwd: string, io: HookIO = realIO()): number {
  if (hook !== 'pre-commit' && hook !== 'pre-push') return refuse(io, 'check:changed', `unknown hook "${hook ?? ''}": pre-commit or pre-push`);
  const root = io.git(cwd, ['rev-parse', '--show-toplevel']);
  if (!root) return refuse(io, hook, 'not inside a git work tree');
  const dirs = searchPath(root, io);
  return hook === 'pre-commit' ? preCommit(root, dirs, io) : prePush(root, dirs, io);
}
