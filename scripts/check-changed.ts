// `pnpm check:changed [--base <ref>] [--only <steps>]` (PRD 1042): the typecheck, then lint, related
// tests and the fallow audit of what changed since the merge-base of HEAD with <ref> (origin/main by
// default), stopping at the first failure and timing each step (scripts/check-changed-steps.ts).
// `--only typecheck,lint` runs those steps alone. For iterating: the full preflight and `pnpm lint`
// stay what a pull request is checked by.
//
// `node scripts/check-changed.ts --hook pre-commit|pre-push` is the git hooks' gate (PRD 1814), run by
// `.githooks/` from the work tree being committed or pushed (scripts/check-changed-hooks.ts).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EnvError, processEnv, readEnv, withStepVariables, type KitEnv } from '../kit/lib/env/read.ts';
import { runHook } from './check-changed-hooks.ts';
import { type Step, changedFiles, mergeBase, onlySteps, pickSteps, planChecks, runChecks, unlinted } from './check-changed-steps.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The environment's groups; a half-set or malformed one stops the run here, naming its variables. */
function readVars(): KitEnv {
  try {
    return readEnv(processEnv());
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    process.stderr.write(`check:changed: ${error.message}\n`);
    return process.exit(2);
  }
}

function baseRef(argv: readonly string[]): string {
  const at = argv.indexOf('--base');
  const next = at >= 0 ? argv[at + 1] : undefined;
  if (next) return next;
  const inline = argv.find((arg) => arg.startsWith('--base='));
  return inline ? inline.slice('--base='.length) : 'origin/main';
}

/**
 * The pnpm that runs this script runs its steps too, so `npx pnpm@9 check:changed` never hands a step
 * to another pnpm on the PATH.
 */
function spawner(vars: KitEnv): (step: Step) => number {
  const pnpm = vars.packageManager?.execPath;
  const resolve = (step: Step): { file: string; args: string[] } => {
    if (step.command !== 'pnpm' || !pnpm) return { file: step.command, args: step.args };
    return /\.[cm]?js$/.test(pnpm) ? { file: process.execPath, args: [pnpm, ...step.args] } : { file: pnpm, args: step.args };
  };
  return (step) => {
    const { file, args } = resolve(step);
    const result = spawnSync(file, args, { cwd: root, stdio: 'inherit', env: withStepVariables(step.env ?? {}) });
    return result.status ?? 1;
  };
}

/** The steps `--only` asks for; a name no step has stops the run here, naming it. */
function readOnly(argv: readonly string[]): string[] | null {
  try {
    return onlySteps(argv);
  } catch (error) {
    process.stderr.write(`check:changed: ${error instanceof Error ? error.message : String(error)}\n`);
    return process.exit(2);
  }
}

function checkChanged(argv: readonly string[]): number {
  const spawn = spawner(readVars());
  const only = readOnly(argv);
  const ref = baseRef(argv);
  const base = mergeBase(root, ref);
  const changes = changedFiles(root, base);
  const count = changes.tracked.length + changes.untracked.length;
  process.stdout.write(
    count > 0
      ? `check:changed: ${String(count)} files changed against ${ref} (${base.slice(0, 8)})\n`
      : `check:changed: no changed file against ${ref} (${base.slice(0, 8)}): the typecheck alone\n`,
  );
  const skipped = unlinted(changes);
  if (skipped.length > 0) process.stdout.write(`check:changed: not linted until git adds them: ${skipped.join(' ')}\n`);
  const planned = planChecks(changes, base);
  return runChecks(only ? pickSteps(planned, only) : planned, { spawn, now: () => performance.now(), write: (text) => process.stdout.write(text) });
}

const argv = process.argv.slice(2);
process.exitCode = argv[0] === '--hook' ? runHook(argv[1], process.cwd()) : checkChanged(argv);
