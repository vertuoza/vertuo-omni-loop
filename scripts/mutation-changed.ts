// `pnpm mutation:changed [--base <ref>]` (PRD 1072): mutation testing of the delivery core's files
// changed since the merge-base of HEAD with <ref> (origin/main by default), committed, uncommitted or
// new. With none, it says so and exits 0. It ends with one line,
// `mutation: <k> killed, <s> survived in <files>`, which the bug-fix skill records. `commands.mutation`
// in `.omni-loop/config.yml` is this command.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnvError, processEnv, readEnv, type KitEnv } from '../kit/lib/env/read.ts';
import { changedFiles, mergeBase } from './check-changed-steps.ts';
import { changedSummary, corePatterns, mutationArgs, planMutation } from './mutation-changed-plan.ts';
import { parseReport } from './mutation-report.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const REPORT = 'reports/mutation/mutation.json';

/** The environment's groups; a half-set or malformed one stops the run here, naming its variables. */
function readVars(): KitEnv {
  try {
    return readEnv(processEnv());
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    process.stderr.write(`mutation:changed: ${error.message}\n`);
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

const ref = baseRef(process.argv.slice(2));
const base = mergeBase(root, ref);
const files = planMutation(changedFiles(root, base), corePatterns);
if (files.length === 0) {
  process.stdout.write(`mutation: no changed core file against ${ref} (${base.slice(0, 8)}): nothing to mutate\n`);
  process.exit(0);
}
process.stdout.write(`mutation:changed: ${String(files.length)} core files changed against ${ref} (${base.slice(0, 8)}): ${files.join(' ')}\n`);

// The pnpm that runs this script runs Stryker too, so `npx pnpm@9 mutation:changed` never hands it to
// another pnpm on the PATH.
const pnpm = readVars().packageManager?.execPath;
const args = mutationArgs(files);
const command = !pnpm ? { file: 'pnpm', args } : /\.[cm]?js$/.test(pnpm) ? { file: process.execPath, args: [pnpm, ...args] } : { file: pnpm, args };
const run = spawnSync(command.file, command.args, { cwd: root, stdio: 'inherit' });
if (run.status !== 0) {
  process.stderr.write(`mutation:changed: Stryker failed (exit ${String(run.status ?? 1)})\n`);
  process.exit(run.status ?? 1);
}
const report = parseReport(JSON.parse(readFileSync(join(root, REPORT), 'utf8')));
process.stdout.write(`${changedSummary(report, files).join('\n')}\n`);
