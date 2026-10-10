// `omni product import --product <name>` and `omni product which` (PRD 1364, s5): a repository's
// products on the Omni page, with the terminal's sign-in.
//
// - `import` sends this plan repository's `plan.targets[]` to the product named `<name>`, once
//   (`kit/lib/product/import.ts`): each target becomes a link, an existing link is changed to match,
//   and it prints what it added and changed; a second run changes nothing. It never edits the config:
//   the person swaps `targets` for `product: <name>` themselves. A repository with no `plan` section,
//   or no targets to send, says so and exits 1.
// - `which` prints the products this repository is in, one per line, or `none`.
//
// Either prints one line and exits 1 with no Omni page (`ask.url`), no sign-in, no repository slug, the
// server unreachable or its refusal (with its reason). It runs before a context exists, like
// `targets`, so that a test can hand it `tokens`, `home`, `fetch` and `callMs`; it loads the context
// itself.
import { AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { credentialsHost, signedInClient } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { importLines, linksOfTargets, whichLines } from '../../lib/product/import.ts';
import { messageOf } from '../../lib/narrow.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

const USAGE = 'usage: omni product import --product <name> | omni product which';

/** What a test hands `omni product` beyond `main()`'s own: the sign-in and the app. */
type ProductOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
};

/** What a verb prints, and whether it went through. */
type Said = { ok: boolean; lines: string[] };
type Client = NonNullable<ReturnType<typeof signedInClient>>;
/** A verb's call to make, or the one line saying why there is none. */
type Call = ((client: Client) => Promise<Said>) | string;

/** The one line a failed call prints: the server unreachable, or its refusal with its reason. */
function failure(error: unknown, what: string): Said {
  if (!(error instanceof AskCallError)) return { ok: false, lines: [messageOf(error)] };
  if (error.status === null) return { ok: false, lines: [`${what}: the server is unreachable`] };
  return { ok: false, lines: [`${what}: the server refused (${error.status}): ${error.reason ?? error.message}`] };
}

/** `import`: this plan repository's targets, sent to `product`. */
function importCall(ctx: Context, repo: string, product: string): Call {
  const plan = ctx.config.plan;
  if (!plan) return 'not a plan repository: omni product import sends plan.targets, and this config has no plan section';
  if (plan.targets.length === 0) return 'nothing to import: plan.targets is empty';
  const targets = linksOfTargets(plan.targets);
  return async (client) => {
    try {
      return { ok: true, lines: importLines(await client.importProductTargets({ repo, product, targets }), product) };
    } catch (error) {
      return failure(error, `the import into product ${product} stopped`);
    }
  };
}

/** `which`: the products this repository is in. */
const whichCall = (repo: string): Call => async (client) => {
  try {
    return { ok: true, lines: whichLines(await client.readProductsOf(repo)) };
  } catch (error) {
    return failure(error, `no products read for ${repo}`);
  }
};

/** The verb and its product, as the arguments name them; a usage error otherwise. */
function verbOf(args: string[]): { verb: 'import'; product: string } | { verb: 'which' } {
  const { positional, flags } = parseArgs('product', args, { values: ['product'] });
  const [verb, ...rest] = positional;
  if (rest.length === 0 && verb === 'import') {
    if (flags.product === undefined) throw usageError('omni product import: name the product with --product <name>.');
    return { verb, product: flags.product };
  }
  if (rest.length === 0 && verb === 'which' && flags.product === undefined) return { verb };
  throw usageError(USAGE);
}

/** What the verb says: its call through the signed-in client, or why it cannot make it. */
async function said(call: Call, verb: string, ctx: Context, io: FreeIo & ProductOptions): Promise<Said> {
  if (typeof call === 'string') return { ok: false, lines: [call] };
  const askUrl = ctx.config.ask.url;
  if (!askUrl) return { ok: false, lines: [`omni product ${verb}: products live on the Omni page, and ask.url is not set`] };
  const client = signedInClient({ askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs });
  if (client === null) return { ok: false, lines: [`omni product ${verb}: no sign-in for ${credentialsHost(askUrl)} (omni signin)`] };
  return call(client);
}

export const product: FreeCommand = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & ProductOptions): Promise<number> {
    const asked = verbOf(args);
    const ctx = loadContext(io.cwd, { exec: io.exec });
    const repo = ctx.config.repo.slug;
    if (!repo) throw usageError(`omni product ${asked.verb}: no repository slug — set repo.slug in the config.`);
    const call = asked.verb === 'import' ? importCall(ctx, repo, asked.product) : whichCall(repo);
    const { ok, lines } = await said(call, asked.verb, ctx, io);
    for (const line of lines) println(io.stdout, line);
    return ok ? 0 : 1;
  },
};
