// `pnpm mutation:changed [--base <ref>]` (PRD 1072): mutation testing of the delivery core's files
// changed since the merge-base of HEAD with <ref> (origin/main by default), committed, uncommitted or
// new. With none, it says so and exits 0. It ends with one line,
// `mutation: <k> killed, <s> survived in <files>`, which the bug-fix skill records. `commands.mutation`
// in `.omni-loop/config.yml` is this command.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { processEnv, readEnv } from '../kit/lib/env/read.ts';
import { changedFiles, mergeBase } from './check-changed-steps.ts';
import { changedSummary, corePatterns, mutationArgs, planMutation } from './mutation-changed-plan.ts';
import { parseReport } from './mutation-report.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const REPORT = 'reports/mutation/mutation.json';

const { values } = parseArgs({ options: { base: { type: 'string', default: 'origin/main' } } });
const ref = values.base;
const base = mergeBase(root, ref);
const files = planMutation(changedFiles(root, base), corePatterns);
if (files.length === 0) {
  process.stdout.write(`mutation: no changed core file against ${ref} (${base.slice(0, 8)}): nothing to mutate\n`);
  process.exit(0);
}
process.stdout.write(`mutation:changed: ${String(files.length)} core files changed against ${ref} (${base.slice(0, 8)}): ${files.join(' ')}\n`);

// The pnpm that runs this script runs Stryker too, so `npx pnpm@9 mutation:changed` never hands it to
// another pnpm on the PATH: a script (`pnpm.cjs`) through this node, a binary as itself.
const pnpm = readEnv(processEnv()).packageManager?.execPath ?? 'pnpm';
const [file, ...args] = /\.[cm]?js$/.test(pnpm) ? [process.execPath, pnpm, ...mutationArgs(files)] : [pnpm, ...mutationArgs(files)];
const run = spawnSync(file, args, { cwd: root, stdio: 'inherit' });
if (run.status !== 0) {
  process.stderr.write(`mutation:changed: Stryker failed (exit ${String(run.status ?? 1)})\n`);
  process.exit(run.status ?? 1);
}
const report = parseReport(JSON.parse(readFileSync(join(root, REPORT), 'utf8')));
process.stdout.write(`${changedSummary(report, files).join('\n')}\n`);
