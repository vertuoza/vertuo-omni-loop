// `omni status [--fetch]` — the repository's overview, read from git: exit 0, or 2 when the default
// branch cannot be read (`kit/lib/status/`).
// `omni status <prd> [--labels a,b] [--base <ref> | --changes]` — the outbox gate: exit 0 green, 1 red.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-status.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { appendFileSync } from 'node:fs';
import { rangeChanges } from '../../lib/git.ts';
import { formatReport, gateResult } from '../../lib/outbox/status.ts';
import { baseNames, fetchRemote, readFacts } from '../../lib/status/facts.ts';
import { formatOverview } from '../../lib/status/format.ts';
import { overviewFor } from '../../lib/status/overview.ts';
import { errorMessage, list, parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni status [--fetch] | omni status <prd> [--labels a,b] [--base <ref> | --changes]';

/** The overview: fetch first when asked (a failed fetch is one line, never a stop), then read the
 * base, which only a checkout with neither default branch cannot do. */
function overview({ ctx, stdout, exec, fetch }: Pick<CommandIo, 'ctx' | 'stdout' | 'exec'> & { fetch: boolean }): number {
  if (fetch) {
    const failure = fetchRemote({ ctx, exec });
    if (failure !== null) println(stdout, `fetch failed: ${failure}; showing your last fetch`);
  }
  const facts = readFacts({ ctx, exec });
  if (facts === null) {
    const names = baseNames(ctx);
    throw usageError(`omni status: cannot read ${names.remote} or ${names.local}; run omni status --fetch`);
  }
  println(stdout, formatOverview(overviewFor(facts), { now: Date.now() }));
  return 0;
}

export const status: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec, vars }: CommandIo): number => {
    const { positional, flags } = parseArgs('status', args, { values: ['labels', 'base'], booleans: ['changes', 'fetch'] });
    const gateFlags = flags.labels !== undefined || flags.base !== undefined || flags.changes === true;
    if (positional.length === 0 && !gateFlags) return overview({ ctx, stdout, exec, fetch: flags.fetch === true });
    if (positional.length !== 1 || flags.fetch === true) throw usageError(USAGE);
    const prd = prdArg('status', '<prd>', positional[0]);
    const labels = list(flags.labels);
    const base = flags.base ?? (flags.changes ? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}` : null);

    let changes = null;
    if (base !== null) {
      try {
        changes = rangeChanges({ ctx, base, exec });
      } catch (error) {
        throw usageError(errorMessage(error).split('\n')[0] ?? '');
      }
    }
    const result = gateResult(prd, { ctx, labels, changes });
    const report = formatReport(prd, result);
    println(stdout, report);

    // In the outbox workflow the runner sets these; unset everywhere else, where this is a no-op.
    const actions = vars.githubActions;
    if (actions?.output) {
      const lines = [
        `open_items=${result.items.length > 0}`,
        `unreworked=${result.unreworked.length > 0}`,
        `unaccounted=${(result.unaccounted ?? []).length > 0}`,
      ];
      appendFileSync(actions.output, `${lines.join('\n')}\n`);
    }
    if (actions?.summary) appendFileSync(actions.summary, `${report}\n`);

    return result.ok ? 0 : 1;
  }),
};
