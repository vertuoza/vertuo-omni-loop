// `omni rework plan <prd> [--json]` and `omni rework close <id> --pr <n>` — the CLI half of
// `/omni-yolo-fix`: deriving what a drifted PRD needs reworked, then recording that a sub-PR closed
// one of those drifts. Both commands are thin over `kit/lib/policy/rework.mjs`, which is the whole
// derivation and the whole amendment; nothing here decides anything the library does not already
// decide.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fillBranch } from '../../lib/board.mjs';
import { parseFolderName } from '../../lib/layout.mjs';
import { parseSettledEntries } from '../../lib/outbox/settle.mjs';
import { closeDriftedEntry, planRework } from '../../lib/policy/rework.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni rework plan <prd> [--json] | omni rework close <id> --pr <n>';
const PLAN_USAGE = 'usage: omni rework plan <prd> [--json]';
const CLOSE_USAGE = 'usage: omni rework close <id> --pr <n>';

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
  });

  if (flags.json) {
    println(stdout, JSON.stringify(result, null, 2));
    return 0;
  }

  printPlan(stdout, result);
  return 0;
}

/** Every outbox directory (open or shipped) that carries a settled entry with this id — searched
 * across every PRD, because the id alone (`<slice>-<nn>-<slug>`) names no PRD, and `omni rework
 * close` takes no `--prd` of its own. On a repository where two PRDs happened to raise the same
 * slice id, the first one `outboxDirs()` lists wins; raised as an item rather than guessed around,
 * since a person could reasonably want `--prd` required instead. */
function findLedgerFor(id, { ctx }) {
  for (const entry of ctx.layout.outboxDirs()) {
    const settledFile = `${entry.dir}/settled.md`;
    const text = readIfExists(ctx, settledFile);
    if (!text) continue;
    const found = parseSettledEntries(text, ctx.markers).some((candidate) => candidate.id === id);
    if (found) return { settledFile, text };
  }
  return null;
}

async function runClose(args, { ctx, stdout }) {
  const { positional, flags } = parseArgs('rework close', args, { values: ['pr'] });
  if (positional.length !== 1 || flags.pr === undefined) throw usageError(CLOSE_USAGE);
  const id = positional[0];
  const pr = positiveInt('rework close', '--pr', flags.pr);
  const pullRequest = `#${pr}`;

  const ledger = findLedgerFor(id, { ctx });
  if (!ledger) {
    throw usageError(`omni rework close: ${id}: no PRD's settled ledger holds an entry with that id.`);
  }

  let closedText;
  try {
    closedText = closeDriftedEntry(ledger.text, { id, pullRequest, markers: ctx.markers });
  } catch (error) {
    throw usageError(error.message.split('\n')[0]);
  }

  writeFileSync(join(ctx.root, ledger.settledFile), closedText);
  println(
    stdout,
    `omni rework close — ${id} closed by ${pullRequest}; ${ledger.settledFile} amended. Commit the amendment.`,
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
