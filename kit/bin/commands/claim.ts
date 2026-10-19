// `omni claim check <prd> <slice>` (PRD 2175): whether a takeover of a `claimed-stale` slice reuses
// its branch or rebuilds the slice, through `checkClaim` (`kit/lib/claim/check.ts`, which says what it
// checks). It reads the remote's feature branch and slice branch as last fetched, so `/omni:wave`
// fetches first. Prints `reuse` and exits 0, or one `rebuild: <reason>` line and exits 1. Exit 2 when
// the call is malformed, the PRD has no folder here, or the feature branch cannot be read.
//
// The feature branch is the slice's landing branch: `branches.feature` for a PRD of one landing, its
// landing's `branches.landing` for one of several, read from the plan in this checkout.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fillBranch, landingBranches } from '../../lib/board.ts';
import { checkClaim } from '../../lib/claim/check.ts';
import { claimGit, refExists } from '../../lib/claim/git.ts';
import type { Context } from '../../lib/context.ts';
import { parsePlanLandings, parsePlanSlices } from '../../lib/inbox/territory.ts';
import type { PrdNumber, WorkSliceId } from '../../lib/ids.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { parseArgs, prdArg, println, sliceArg, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni claim check <prd> <slice>';

/** PRD n's topic, plan path and the plan as this checkout holds it; a usage error when it has none. */
function prdPlan(prd: PrdNumber, ctx: Context): { topic: string; planPath: string; markdown: string } {
  const where = ctx.layout.whereIs(prd);
  const topic = where ? parseFolderName(where.name)?.topic : undefined;
  const planPath = ctx.layout.planPath(prd);
  if (topic === undefined || planPath === null) throw usageError(`omni claim check: PRD ${prd} has no inbox or shipped folder.`);
  let markdown = '';
  try {
    markdown = readFileSync(join(ctx.root, planPath), 'utf8');
  } catch {
    // No plan here: the slice reads as landing 1, and the remote's plan says the rest.
  }
  return { topic, planPath, markdown };
}

/** The branch the slice is cut from and merged into: its landing's, read from `markdown`. */
function featureBranchOf(slice: WorkSliceId, { ctx, topic, markdown }: { ctx: Context; topic: string; markdown: string }): string {
  let landing = 1;
  try {
    landing = parsePlanSlices(markdown).find((row) => row.id === slice)?.landing ?? 1;
  } catch {
    // An unreadable plan has one landing.
  }
  const branches = landingBranches(ctx.config.branches, { topic, landings: parsePlanLandings(markdown) });
  return branches.find((entry) => entry.landing === landing)?.branch ?? fillBranch(ctx.config.branches.feature, { topic });
}

function check(rest: readonly string[], { ctx, stdout, exec }: Pick<CommandIo, 'ctx' | 'stdout' | 'exec'>): number {
  const { positional } = parseArgs('claim check', rest);
  if (positional.length !== 2) throw usageError(`omni claim: ${USAGE}`);
  const prd = prdArg('claim check', '<prd>', positional[0]);
  const slice = sliceArg('claim check', '<slice>', positional[1] ?? '');
  const { topic, planPath, markdown } = prdPlan(prd, ctx);
  const remote = ctx.config.repo.remote;
  const featureRef = `${remote}/${featureBranchOf(slice, { ctx, topic, markdown })}`;
  if (!refExists({ root: ctx.root, exec, ref: featureRef })) {
    throw usageError(`omni claim check: cannot read ${featureRef} — fetch it first (git fetch ${remote}).`);
  }
  const sliceRef = `${remote}/${fillBranch(ctx.config.branches.slice, { topic, slice })}`;
  const verdict = checkClaim(
    { slice, planPath, featureRef, outboxDir: ctx.layout.outboxDir(prd), generated: ctx.config.generated ?? [] },
    claimGit({ root: ctx.root, exec, featureRef, sliceRef }),
  );
  println(stdout, verdict.line);
  return verdict.reuse ? 0 : 1;
}

export const claim: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec }: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub !== 'check') throw usageError(`omni claim: ${USAGE}`);
    return check(rest, { ctx, stdout, exec });
  }),
};
