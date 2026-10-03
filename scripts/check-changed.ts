// `pnpm check:changed [--base <ref>]` (PRD 1042): the typecheck, then lint, related tests and the fallow
// audit of what changed since the merge-base of HEAD with <ref> (origin/main by default), stopping at
// the first failure and timing each step (scripts/check-changed-steps.ts). For iterating: the full
// preflight and `pnpm lint` stay what a pull request is checked by.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { type Step, changedFiles, mergeBase, planChecks, runChecks, unlinted } from './check-changed-steps.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

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
function resolve(step: Step): { file: string; args: string[] } {
  const pnpm = process.env['npm_execpath'];
  if (step.command !== 'pnpm' || !pnpm) return { file: step.command, args: step.args };
  return /\.[cm]?js$/.test(pnpm) ? { file: process.execPath, args: [pnpm, ...step.args] } : { file: pnpm, args: step.args };
}

const spawn = (step: Step): number => {
  const { file, args } = resolve(step);
  const result = spawnSync(file, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...step.env } });
  return result.status ?? 1;
};

const ref = baseRef(process.argv.slice(2));
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
process.exitCode = runChecks(planChecks(changes, base), { spawn, now: () => performance.now(), write: (text) => process.stdout.write(text) });
