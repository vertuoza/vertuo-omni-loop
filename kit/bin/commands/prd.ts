// `omni prd <n>` — where PRD <n> lives today, as text: the one lookup an agent runs before following
// any delivery path.
//
// PRD 1299, slice s5: its stage is read through `prdState()`. A ◇ PRD prints exactly as before and
// never calls the server; a ◆ PRD reads `inbox` only once approved, else `prd` while it waits, or
// `drifted`, `unreachable` or `refused`, with its birthplace and its approval's lines. It runs before
// a context exists, like `omni approval`, so that a test can hand it `tokens`, `home`, `fetch` and
// `callMs`; it loads the context itself. With no sign-in, no Omni page or no slug it holds a ◆ PRD and
// says why on stderr.
//
// PRD 1364, slice s6: where dossiers are on, its last line is the PRD's product as its dossier on the
// Omni page names it, `product: <name>` or `product: none` (`../../lib/dossier/product.ts`), or
// `product: unknown (<why>)` when the page cannot tell; it never changes the exit. Where dossiers are
// off, no line, and nothing more is called.
import { prdState } from '../../lib/approval/prd-state.ts';
import { loadContext } from '../../lib/context.ts';
import { productLine } from '../../lib/dossier/product.ts';
import { gateApproval, heldWhy, prdLines, whereIs } from '../../lib/delivery/prd.ts';
import type { GateOptions } from '../../lib/delivery/prd.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

export const prd = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs }: FreeIo & GateOptions) {
    const { positional } = parseArgs('prd', args);
    if (positional.length !== 1) throw usageError('usage: omni prd <n>');
    const number = prdArg('prd', '<n>', positional[0]);
    const ctx = loadContext(cwd, { exec });
    const where = whereIs(ctx, number);
    if (!where) {
      println(stderr, `omni prd: PRD ${number} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}.`);
      return 1;
    }
    const state = await prdState(ctx, number, { approval: gateApproval(ctx, { tokens, home, fetch, callMs }) });
    const why = heldWhy(state);
    if (why !== null) println(stderr, `omni prd: ${why}`);
    const product = await productLine(ctx, number, { tokens, home, fetch, callMs });
    println(stdout, [...prdLines(where, state), ...(product === null ? [] : [product])].join('\n'));
    return 0;
  },
} satisfies FreeCommand;
