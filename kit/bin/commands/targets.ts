// `omni targets [--json]` (PRD 522): a plan repository's target repositories, one row each, in config
// order: role, knowledge, loop and state (`kit/lib/plan-repo/targets.ts`). Read-only: it reads each
// target through `gh api`, never clones one, and never refreshes an imported copy. Exit 0 when every
// row is ok, 1 otherwise, and 1 with `not a plan repository` when the config has no `plan` section.
import { readTargets, targetsTable } from '../../lib/plan-repo/targets.ts';
import { githubEnv } from '../github.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';

const USAGE = 'usage: omni targets [--json]';

export const targets: Command = {
  async run(args: string[], { ctx, stdout, exec, env }: CommandIo) {
    const { positional, flags } = parseArgs('targets', args, { booleans: ['json'] });
    if (positional.length) throw usageError(USAGE);
    const plan = ctx.config.plan;
    if (!plan) {
      println(stdout, 'not a plan repository');
      return 1;
    }
    const rows = readTargets(plan.targets, { ctx, exec, env: githubEnv(ctx, { exec, env }) });
    if (flags.json) println(stdout, JSON.stringify(rows, null, 2));
    else for (const line of targetsTable(rows)) println(stdout, line);
    return rows.every((row) => row.state === 'ok') ? 0 : 1;
  },
};
