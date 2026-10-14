// `omni tier <tier> --agent <agent>` (PRD 1934) — the model and effort a slice advised `<tier>` runs on
// for `<agent>`, read from the config's `tiers`: `model: <model>` and `effort: <effort>` (each line
// only when set), or `inherit` when nothing maps it. Both exit 0; `/omni:wave` starts the slice's
// agent with what it prints. An unknown tier or agent is a usage error, exit 2.
import { AGENTS, TIERS } from '../../lib/config.ts';
import { isOneOf } from '../../lib/narrow.ts';
import { INHERIT, isTier, resolveTier } from '../../lib/tiers.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni tier <deep|build|light> --agent <agent>';

export const tier: Command = {
  run: synchronous((args: string[], { ctx, stdout }: CommandIo): number => {
    const { positional, flags } = parseArgs('tier', args, { values: ['agent'] });
    const [name] = positional;
    if (positional.length !== 1 || name === undefined || flags.agent === undefined) throw usageError(USAGE);
    if (!isTier(name)) throw usageError(`omni tier: ${name} is no tier — one of ${TIERS.join(', ')}.`);
    const { agent } = flags;
    if (!isOneOf(AGENTS, agent)) throw usageError(`omni tier: ${agent} is no agent the kit knows — one of ${AGENTS.join(', ')}.`);
    const resolved = resolveTier(ctx.config, agent, name);
    if (resolved === INHERIT) {
      println(stdout, INHERIT);
      return 0;
    }
    println(stdout, `model: ${resolved.model}`);
    if (resolved.effort !== undefined) println(stdout, `effort: ${resolved.effort}`);
    return 0;
  }),
};
