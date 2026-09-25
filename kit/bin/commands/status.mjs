// `omni status <prd> [--labels a,b] [--base <ref> | --changes]` — the outbox gate: exit 0 green, 1 red.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-status.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { appendFileSync } from 'node:fs';
import { rangeChanges } from '../../lib/git.mjs';
import { formatReport, gateResult } from '../../lib/outbox/status.mjs';
import { list, parseArgs, positiveInt, println, usageError } from '../args.mjs';

export const status = {
  async run(args, { ctx, stdout, exec, env }) {
    const { positional, flags } = parseArgs('status', args, { values: ['labels', 'base'], booleans: ['changes'] });
    if (positional.length !== 1) throw usageError('usage: omni status <prd> [--labels a,b] [--base <ref> | --changes]');
    const prd = positiveInt('status', '<prd>', positional[0]);
    const labels = list(flags.labels);
    const base = flags.base ?? (flags.changes ? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}` : null);

    let changes = null;
    if (base !== null) {
      try {
        changes = rangeChanges({ ctx, base, exec });
      } catch (error) {
        throw usageError(error.message.split('\n')[0]);
      }
    }
    const result = gateResult(prd, { ctx, labels, changes });
    const report = formatReport(prd, result);
    println(stdout, report);

    // In the outbox workflow the runner sets these; unset everywhere else, where this is a no-op.
    if (env.GITHUB_OUTPUT) {
      const lines = [
        `open_items=${result.items.length > 0}`,
        `unreworked=${result.unreworked.length > 0}`,
        `unaccounted=${(result.unaccounted ?? []).length > 0}`,
      ];
      appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
    }
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${report}\n`);

    return result.ok ? 0 : 1;
  },
};
