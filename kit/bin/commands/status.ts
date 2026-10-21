// `omni status [--fetch]` — the repository's overview, read from git: exit 0, or 2 when the default
// branch cannot be read (`kit/lib/status/`).
// `omni status <prd> [--labels a,b] [--base <ref> | --changes]` — the outbox gate: exit 0 green, 1 red.
// Ported from nimbus-brain@c4a210122:scripts/outbox-status.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
//
// PRD 1299, slice s5: the overview places each ◆ PRD the checkout's inbox holds through `prdState()`
// (`kit/lib/status/server.ts`): waiting for approval is PRD, approved is in the inbox, and drifted,
// unreachable or refused are held with their lines. A ◇ PRD reads as before and never calls the
// server. It runs before a context exists, like `omni approval`, so that a test can hand it `tokens`,
// `home`, `fetch` and `callMs`; it loads the context itself.
//
// PRD 1548, slice s6: the gate reads the PRD's outbox through its outbox store. Slice s7: `omni status
// <key>-<n>` is a product PRD's gate, read from its rows on the Omni page; while the server cannot be
// reached it holds, exit 1, with the held line.
import { appendFileSync } from 'node:fs';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { gateApproval } from '../../lib/delivery/prd.ts';
import type { GateOptions } from '../../lib/delivery/prd.ts';
import { baseKnowledge, rangeChanges } from '../../lib/git.ts';
import { formatReport } from '../../lib/outbox/status.ts';
import { serverFailure } from '../../lib/outbox/server-store.ts';
import { outboxStore } from '../../lib/outbox/stores.ts';
import type { OutboxSignIn } from '../../lib/outbox/stores.ts';
import { baseNames, fetchRemote, readFacts } from '../../lib/status/facts.ts';
import { formatOverview } from '../../lib/status/format.ts';
import { overviewFor } from '../../lib/status/overview.ts';
import { serverPrds } from '../../lib/status/server.ts';
import { errorMessage, list, parseArgs, prdIdArg, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo, Out, Vars } from '../io.ts';

const USAGE = 'usage: omni status [--fetch] | omni status <prd> [--labels a,b] [--base <ref> | --changes]';

/** The overview: fetch first when asked (a failed fetch is one line, never a stop), then read the
 * base, which only a checkout with neither default branch cannot do, then each ◆ PRD's approval. */
async function overview({ ctx, stdout, exec, fetch, gate }: { ctx: Context; stdout: Out; exec: Exec; fetch: boolean; gate: GateOptions }): Promise<number> {
  if (fetch) {
    const failure = fetchRemote({ ctx, exec });
    if (failure !== null) println(stdout, `fetch failed: ${failure}; showing your last fetch`);
  }
  const facts = readFacts({ ctx, exec });
  if (facts === null) {
    const names = baseNames(ctx);
    throw usageError(`omni status: cannot read ${names.remote} or ${names.local}; run omni status --fetch`);
  }
  const server = await serverPrds(ctx, new Set(facts.shipped.map(({ prd }) => prd)), gateApproval(ctx, gate));
  println(stdout, formatOverview(overviewFor({ ...facts, server }), { now: Date.now() }));
  return 0;
}

/** The outbox gate of PRD `prd`: exit 0 green, 1 red. */
async function outboxGate({ number, labels: named, base }: { number: string | undefined; labels: string | undefined; base: string | null }, { ctx, stdout, stderr, exec, vars, gate }: { ctx: Context; stdout: Out; stderr: Out; exec: Exec; vars: Vars; gate: OutboxSignIn }): Promise<number> {
  const prd = prdIdArg('status', '<prd>', number);
  const labels = list(named);

  let changes = null;
  let knowledge = null;
  if (base !== null) {
    try {
      changes = rangeChanges({ ctx, base, exec });
    } catch (error) {
      throw usageError(errorMessage(error).split('\n')[0] ?? '');
    }
    // The knowledge folder at the range's base grades law-demoted (PRD 1342).
    knowledge = baseKnowledge({ ctx, base, exec });
  }
  const result = await outboxStore(ctx, prd, gate).gate(prd, { labels, changes, base: knowledge }).catch((error: unknown) => serverFailure('status', error, stderr));
  if (typeof result === 'number') return result;
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
}

export const status = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, vars, tokens, home, fetch = globalThis.fetch, callMs, now }: FreeIo & GateOptions & { now?: () => number }) {
    const { positional, flags } = parseArgs('status', args, { values: ['labels', 'base'], booleans: ['changes', 'fetch'] });
    const gateFlags = flags.labels !== undefined || flags.base !== undefined || flags.changes === true;
    const ctx = loadContext(cwd, { exec });
    if (positional.length === 0 && !gateFlags) return overview({ ctx, stdout, exec, fetch: flags.fetch === true, gate: { tokens, home, fetch, callMs } });
    if (positional.length !== 1 || flags.fetch === true) throw usageError(USAGE);
    const base = flags.base ?? (flags.changes ? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}` : null);
    return outboxGate({ number: positional[0], labels: flags.labels, base }, { ctx, stdout, stderr, exec, vars, gate: { tokens, home, fetch, callMs, now } });
  },
} satisfies FreeCommand;
