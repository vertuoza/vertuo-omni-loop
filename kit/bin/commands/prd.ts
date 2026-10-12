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
//
// PRD 1548, slice s2: `<n>` is a PRD's id, its number (`12`, this repository's issue 12, as before) or a
// product PRD's (`mobile-12`), which lives on the Omni page and in no repository (`./prd-product.ts`).
// `--show <kind>` prints a product PRD's latest spec, plan, before-after or voice, read-only. Anything
// else is refused by name (`mobile`, `12-mobile`, `Mobile-12`), exit 2.
import { prdState } from '../../lib/approval/prd-state.ts';
import { loadContext } from '../../lib/context.ts';
import { isPrdKind, PRD_KINDS } from '../../lib/dossier/product-prd.ts';
import { productLine } from '../../lib/dossier/product.ts';
import { gateApproval, heldWhy, prdLines, whereIs } from '../../lib/delivery/prd.ts';
import type { GateOptions } from '../../lib/delivery/prd.ts';
import { isProductPrdId, parsePrdId } from '../../lib/ids.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';
import { productPrd } from './prd-product.ts';

const USAGE = `usage: omni prd <n> | omni prd <key>-<n> [--show <${PRD_KINDS.join('|')}>]`;

/** `<n>` read as a PRD's id, or the usage error that names it. A value with no letter at its start and
 * no hyphen is a number or nothing, refused as `prdArg` refuses one (bug #571). */
function idArg(value: string | undefined) {
  if (value === undefined) throw usageError(USAGE);
  if (!/^[a-z]|-/i.test(value)) return prdArg('prd', '<n>', value);
  try {
    return parsePrdId(value);
  } catch (error) {
    throw usageError(`omni prd: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The PRD the arguments name, and the kind `--show` asks for: a product PRD's only. */
function readArgs(args: string[]) {
  const { positional, flags } = parseArgs('prd', args, { values: ['show'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const id = idArg(positional[0]);
  const kind = flags.show ?? null;
  if (kind === null) return { id, kind };
  if (!isProductPrdId(id) || !isPrdKind(kind)) throw usageError(USAGE);
  return { id, kind };
}

export const prd = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs, now = Date.now }: FreeIo & GateOptions & { now?: () => number }) {
    const { id, kind } = readArgs(args);
    const ctx = loadContext(cwd, { exec });
    if (isProductPrdId(id)) return productPrd(id, kind, { ctx, exec, stdout, stderr, tokens, home, fetch, callMs, now });
    const where = whereIs(ctx, id);
    if (!where) {
      println(stderr, `omni prd: PRD ${id} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}.`);
      return 1;
    }
    const state = await prdState(ctx, id, { approval: gateApproval(ctx, { tokens, home, fetch, callMs }) });
    const why = heldWhy(state);
    if (why !== null) println(stderr, `omni prd: ${why}`);
    const product = await productLine(ctx, id, { tokens, home, fetch, callMs });
    println(stdout, [...prdLines(where, state), ...(product === null ? [] : [product])].join('\n'));
    return 0;
  },
} satisfies FreeCommand;
