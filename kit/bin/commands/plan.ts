// `omni plan check <prd>` — grades a PRD's own `plan.md` before anyone builds off it, through
// `gradePlan` (`kit/lib/inbox/plan-grade.ts`, which says what it checks). Prints the slice count,
// the waves and the collision matrix, then every violation; exits 1 on any. In a plan repository
// (PRD 549) it prints the waves and the collision matrix per repository.
//
// `omni plan moved <prd> [--json]` (PRD 563) reads, for each target row of a plan repository's
// `## Repositories`, what changed on the target's default branch since `read at` under the
// territories of the slices landing there (`kit/lib/plan-repo/moved.ts`): `moved` with the files,
// `ok`, or `unreachable`. Read-only. Exit 0 whatever the states (a moved target is a decision, not an
// error); `not a plan repository` and exit 1 when the config has no `plan` section.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatFailure, formatPass } from '../../lib/check-report.ts';
import { gradePlan } from '../../lib/inbox/plan-grade.ts';
import { parsePlanRepositories, parsePlanSlices } from '../../lib/inbox/territory.ts';
import { defined } from '../../lib/narrow.ts';
import { movedTable, planMoved } from '../../lib/plan-repo/moved.ts';
import { errorCode, errorMessage, parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Context } from '../../lib/context.ts';
import { githubEnv } from '../github.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';
import type { PrdNumber } from '../../lib/ids.ts';

const USAGE = 'usage: omni plan check <prd> | omni plan moved <prd> [--json]';

/** `count` and its noun, singular for one. */
function counted(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** PRD n's plan: its path and its Markdown. */
function readPlanText(prd: PrdNumber, { ctx, verb }: { ctx: Context; verb: string }): { planPath: string; markdown: string } {
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null) throw usageError(`omni plan ${verb}: PRD ${prd} has no inbox or shipped folder.`);

  try {
    return { planPath, markdown: readFileSync(join(ctx.root, planPath), 'utf8') };
  } catch (error) {
    if (errorCode(error) === 'ENOENT') throw usageError(`omni plan ${verb}: no plan at ${planPath}.`);
    throw error;
  }
}

/** PRD n's plan, read and parsed: its path, its slices and its `## Repositories` rows. */
function readPlan(prd: PrdNumber, { ctx, verb }: { ctx: Context; verb: string }) {
  const { planPath, markdown } = readPlanText(prd, { ctx, verb });
  let slices;
  try {
    slices = parsePlanSlices(markdown);
  } catch (error) {
    throw usageError(`omni plan ${verb}: ${planPath}: ${errorMessage(error)}`);
  }
  return { planPath, slices, repositories: parsePlanRepositories(markdown) };
}

/** PRD n's plan, graded; a slice table that cannot be read is a usage error, as it always was. */
function checkPlan(prd: PrdNumber, { ctx }: { ctx: Context }) {
  const { planPath, markdown } = readPlanText(prd, { ctx, verb: 'check' });
  const graded = gradePlan(markdown, { config: ctx.config });
  if (graded.parseError !== null) throw usageError(`omni plan check: ${planPath}: ${graded.parseError}`);
  return { planPath, ...graded };
}

/** `omni plan moved <prd> [--json]`: one row per target, exit 0 in a plan repository. */
function moved(rest: string[], { ctx, stdout, exec, env }: Omit<CommandIo, 'stderr'>): number {
  const { positional, flags } = parseArgs('plan moved', rest, { booleans: ['json'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('plan moved', '<prd>', positional[0]);
  const planSection = ctx.config.plan ?? null;
  if (planSection === null) {
    println(stdout, 'not a plan repository');
    return 1;
  }
  const { slices, repositories } = readPlan(prd, { ctx, verb: 'moved' });
  const rows = planMoved(
    { slices, repositories, planSlug: defined(ctx.config.repo.slug, "the plan repository's slug"), targets: planSection.targets },
    { exec, env: githubEnv(ctx, { exec, env }) },
  );
  if (flags.json) println(stdout, JSON.stringify(rows.map(({ repo, state, files }) => ({ repo, state, files })), null, 2));
  else for (const line of movedTable(rows)) println(stdout, line);
  return 0;
}

export const plan: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec, env }: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub === 'moved') return moved(rest, { ctx, stdout, exec, env });
    if (sub !== 'check') throw usageError(USAGE);
    const { positional } = parseArgs('plan check', rest);
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = prdArg('plan check', '<prd>', positional[0]);

    const { planPath, slices, waves, multi, matrices, violations } = checkPlan(prd, { ctx });

    println(
      stdout,
      `omni plan check — PRD ${prd}: ${slices.length} slice(s) across wave(s) ${waves.join(', ')} (${planPath}).`,
    );
    if (multi) {
      const repos = new Set(slices.map((slice) => slice.repo)).size;
      println(
        stdout,
        `omni plan check — ${counted(slices.length, 'slice', 'slices')} · ${counted(waves.length, 'wave', 'waves')} · ${counted(repos, 'repository', 'repositories')}:`,
      );
      for (const wave of waves) {
        const members = slices.filter((slice) => slice.wave === wave).map((slice) => `${slice.id} (${slice.repo})`);
        println(stdout, `  wave ${wave}: ${members.join(', ')}`);
      }
    }
    for (const { repo, rows } of matrices) {
      if (rows.length === 0) continue;
      const where = repo === null ? '' : `, ${repo}`;
      println(stdout, `omni plan check — collision matrix${where} (${rows.length} pair(s) sharing ground):`);
      for (const row of rows) println(stdout, `  ${row.pair}: ${row.shared} — ${row.resolved}`);
    }

    if (violations.length > 0) {
      println(stdout, formatFailure(`omni plan check — PRD ${prd}: violation(s):`, violations));
      return 1;
    }
    println(
      stdout,
      formatPass(`omni plan check — PRD ${prd}: ${slices.length} slice(s), all territories and blocks well-formed.`),
    );
    return 0;
  }),
};
