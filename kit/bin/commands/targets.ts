// `omni targets [--json]` (PRD 522): a plan repository's target repositories, one row each, in config
// order: role, knowledge, loop and state (`kit/lib/plan-repo/targets.ts`). Read-only: it reads each
// target through `gh api`, never clones one, and never refreshes an imported copy; an imported
// target whose committed flow is not its copy's reads stale, naming the flow (PRD 1089, s6). Exit 0 when every
// row is ok, 1 otherwise, and 1 with `not a plan repository` when the config has no `plan` section.
//
// With `plan.product` (PRD 1364, s4), the targets are the product's links on the Omni page, read with
// the terminal's sign-in (`kit/lib/product/targets.ts`) in the server's order, then each read through
// `gh api` as above, into the same table. The read is kept in the main checkout's
// `.omni-loop/local/product-targets.json`; when the server cannot be reached, that copy is read and
// `targets from the last read, <date> · server unreachable` is printed first (on stderr with
// `--json`). With no copy, no Omni page, no sign-in, a link with no role or the server's refusal, it
// prints the one line saying so and exits 1.
//
// It runs before a context exists, like `roadmap`, so that a test can hand it `tokens`, `home`,
// `fetch`, `callMs` and `now`; it loads the context itself.
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { credentialsHost, signedInClient } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { readTargets, targetsTable } from '../../lib/plan-repo/targets.ts';
import type { Target } from '../../lib/plan-repo/targets.ts';
import { lastReadLine, productTargets } from '../../lib/product/targets.ts';
import { messageOf } from '../../lib/narrow.ts';
import { githubEnv } from '../github.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';

const USAGE = 'usage: omni targets [--json]';

/** What a test hands `omni targets` beyond `main()`'s own: the sign-in, the app and the clock. */
type TargetsOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  now?: (() => Date) | undefined;
};

/** The targets to read, or the one line saying why there are none: `plan.targets`, or the product's. */
async function targetList(
  ctx: Context,
  product: string,
  io: FreeIo & TargetsOptions,
  note: Out,
): Promise<readonly Target[] | string> {
  const askUrl = ctx.config.ask.url;
  if (!askUrl) return 'no targets: plan.product reads them from the Omni page, and ask.url is not set';
  const client = signedInClient({ askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs });
  if (client === null) return `no targets: no sign-in for ${credentialsHost(askUrl)} (omni signin)`;
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni targets: no repository slug — set repo.slug in the config.');
  try {
    const read = await productTargets({
      product,
      root: mainCheckout(io.cwd, io.exec) ?? ctx.root,
      now: io.now ?? (() => new Date()),
      fetchTargets: () => client.readProductTargets({ repo, product }),
    });
    if (read.from === 'copy') println(note, lastReadLine(read.readAt));
    return read.targets;
  } catch (error) {
    return messageOf(error);
  }
}

export const targets: FreeCommand = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & TargetsOptions): Promise<number> {
    const { stdout, stderr, exec, env } = io;
    const { positional, flags } = parseArgs('targets', args, { booleans: ['json'] });
    if (positional.length) throw usageError(USAGE);
    const ctx = loadContext(io.cwd, { exec });
    const plan = ctx.config.plan;
    if (!plan) {
      println(stdout, 'not a plan repository');
      return 1;
    }
    const list = plan.product === undefined ? plan.targets : await targetList(ctx, plan.product, io, flags.json ? stderr : stdout);
    if (typeof list === 'string') {
      println(stdout, list);
      return 1;
    }
    const rows = readTargets(list, { ctx, exec, env: githubEnv(ctx, { exec, env }) });
    if (flags.json) println(stdout, JSON.stringify(rows, null, 2));
    else for (const line of targetsTable(rows)) println(stdout, line);
    return rows.every((row) => row.state === 'ok') ? 0 : 1;
  },
};
