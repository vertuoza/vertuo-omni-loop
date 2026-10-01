// @ts-nocheck
// `omni rework plan <prd> [--json]` and `omni rework close <id> --prd <n> --pr <n>` — the CLI half
// of `/omni:yolo-fix`: deriving what a drifted PRD needs reworked, then recording that a sub-PR
// closed one of those drifts. Both commands are thin over `kit/lib/policy/rework.ts`, which is the
// whole derivation and the whole amendment; nothing here decides anything the library does not
// already decide.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fillBranch } from '../../lib/board.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { closeDriftedEntry, planRework } from '../../lib/policy/rework.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';

const USAGE = 'usage: omni rework plan <prd> [--json] | omni rework close <id> --prd <n> --pr <n>';
const PLAN_USAGE = 'usage: omni rework plan <prd> [--json]';
const CLOSE_USAGE = 'usage: omni rework close <id> --prd <n> --pr <n>';

/** `path`'s text, or `''` when it does not exist yet — a PRD not yet drifted has no `settled.md`. */
function readIfExists(ctx, path) {
  try {
    return readFileSync(join(ctx.root, path), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

/** The PRD folder's own topic, which fills `{topic}` in `branches.feature` — the same reading
 * `omni board` already does. */
function topicFor(prd, { ctx }) {
  const where = ctx.layout.whereIs(prd);
  const parsed = where ? parseFolderName(where.name) : null;
  return parsed ? parsed.topic : null;
}

function territoryOf(rework) {
  return rework.territory.map((path) => `\`${path}\``).join(', ') || '(none declared)';
}

function printPlan(stdout, result) {
  if (result.reworks.length === 0) {
    for (const line of result.report) println(stdout, line);
    return;
  }
  println(
    stdout,
    `omni rework plan — PRD ${result.prd}: ${result.reworks.length} drifted item(s) of ${result.settledCount} settled item(s).`,
  );
  for (const rework of result.reworks) {
    println(stdout, `- ${rework.id} (wave ${rework.wave}) — reworks ${rework.itemId}`);
    println(stdout, `  branch: ${rework.branch ?? '(unknown — no feature branch resolved)'}`);
    println(stdout, `  territory: ${territoryOf(rework)}`);
    if ('repo' in rework) println(stdout, `  repo: ${rework.repo ?? '(unknown — the plan names no repository for its slice)'}`);
  }
}

async function runPlan(args, { ctx, stdout }) {
  const { positional, flags } = parseArgs('rework plan', args, { booleans: ['json'] });
  if (positional.length !== 1) throw usageError(PLAN_USAGE);
  const prd = positiveInt('rework plan', '<prd>', positional[0]);

  const planPath = ctx.layout.planPath(prd);
  if (planPath === null) throw usageError(`omni rework plan: PRD ${prd} has no inbox or shipped folder.`);

  const outboxDir = ctx.layout.outboxDir(prd);
  const settledText = outboxDir ? readIfExists(ctx, `${outboxDir}/settled.md`) : '';
  const planMarkdown = readIfExists(ctx, planPath);
  const topic = topicFor(prd, { ctx });
  const featureBranch = topic ? fillBranch(ctx.config.branches.feature, { topic }) : null;

  const result = planRework({
    settledText,
    planMarkdown,
    prd,
    featureBranch,
    markers: ctx.markers,
    branches: ctx.config.branches,
    // In a plan repository (PRD 563) each rework names the repository its item was raised in.
    planRepository: Boolean(ctx.config.plan),
  });

  if (flags.json) {
    println(stdout, JSON.stringify(result, null, 2));
    return 0;
  }

  printPlan(stdout, result);
  return 0;
}

async function runClose(args, { ctx, stdout }) {
  const { positional, flags } = parseArgs('rework close', args, { values: ['pr', 'prd'] });
  if (positional.length !== 1 || flags.pr === undefined || flags.prd === undefined) {
    throw usageError(CLOSE_USAGE);
  }
  const id = positional[0];
  const prd = positiveInt('rework close', '--prd', flags.prd);
  const pr = positiveInt('rework close', '--pr', flags.pr);
  const pullRequest = `#${pr}`;

  // Item ids are unique only within one PRD (`<slice>-<nn>-<slug>`, and slice numbering restarts
  // per PRD) — `--prd` is required so this only ever reads and amends ITS OWN PRD's ledger, never
  // another PRD's, however similar an id might look.
  const outboxDir = ctx.layout.outboxDir(prd);
  if (outboxDir === null) throw usageError(`omni rework close: PRD ${prd} has no inbox or shipped folder.`);
  const settledFile = `${outboxDir}/settled.md`;
  const text = readIfExists(ctx, settledFile);

  let closedText;
  try {
    closedText = closeDriftedEntry(text, { id, pullRequest, markers: ctx.markers });
  } catch (error) {
    throw usageError(error.message.split('\n')[0]);
  }

  writeFileSync(join(ctx.root, settledFile), closedText);
  println(
    stdout,
    `omni rework close — PRD ${prd}: ${id} closed by ${pullRequest}; ${settledFile} amended. Commit the amendment.`,
  );
  return 0;
}

export const rework = {
  async run(args, io) {
    const [sub, ...rest] = args;
    if (sub === 'plan') return runPlan(rest, io);
    if (sub === 'close') return runClose(rest, io);
    throw usageError(USAGE);
  },
};
