// `omni product`'s verbs for running from a product (PRD 1548, s11): `/omni:mega-brainstorm --product
// <key>` runs from any kitted checkout of a repository the product holds.
//
// - `use <key>` remembers the product in the main checkout's `.omni-loop/local/product.json`
//   (`../../lib/product/checkout.ts`), so every worktree of the checkout reads the same, and prints
//   `product <key> remembered in this checkout`. It calls nothing: the server alone says whether the key
//   names a product, when the PRD is created. A key that is not one is a usage error, exit 2.
// - `which` prints `remembered: <key>` first when the checkout remembers a product
//   (`rememberedLines`), then the products the server says this repository is in, as before.
// - `phase0 <owner/name>…` reads each repository's phase-0 flag on the Omni page and prints one line
//   each: `<repo> is phase0: server`, or, for a target a product PRD cannot take, acceptance 10's
//   `<repo> is phase0: pr · switch it to server on its Omni page, or leave it out`, or
//   `<repo>: its phase0 could not be read: <why>`. Exit 0 when every one is on server, 1 otherwise.
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { readFlag } from '../../lib/approval/flag.ts';
import type { Context } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { messageOf } from '../../lib/narrow.ts';
import { phase0Line, rememberedProduct, rememberProduct } from '../../lib/product/checkout.ts';
import { println, usageError } from '../args.ts';
import type { FreeIo } from '../io.ts';

/** What a test hands these verbs beyond `main()`'s own: the sign-in, the app and the clock. */
export type CheckoutOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  now?: (() => Date) | undefined;
};

const SLUG = /^[\w.-]+\/[\w.-]+$/;

/** The checkout whose local folder holds the product: the main one, or `cwd` outside a repository. */
const checkoutOf = (io: FreeIo): string => mainCheckout(io.cwd, io.exec) ?? io.cwd;

/** `use <key>`: remembers it, or a usage error naming why it is no key. */
export function useProduct(key: string, io: FreeIo & CheckoutOptions): number {
  try {
    rememberProduct(checkoutOf(io), key, (io.now ?? (() => new Date()))());
  } catch (error) {
    throw usageError(`omni product use: ${messageOf(error)}.`);
  }
  println(io.stdout, `product ${key} remembered in this checkout`);
  return 0;
}

/** The line `which` prints first: the product this checkout remembers, or nothing. */
export function rememberedLines(io: FreeIo): string[] {
  const remembered = rememberedProduct(checkoutOf(io));
  return remembered ? [`remembered: ${remembered.key}`] : [];
}

/** The repositories `phase0` reads, each `owner/name`; a usage error otherwise. */
export function phase0Repos(repos: string[]): string[] {
  if (repos.length === 0) throw usageError('omni product phase0: name each repository as <owner/name>.');
  const bad = repos.find((repo) => !SLUG.test(repo));
  if (bad !== undefined) throw usageError(`omni product phase0: ${bad} is not <owner/name>.`);
  return repos;
}

/** `phase0 <repo>…`: one line per repository, in the order named. */
export async function phase0Of(repos: string[], ctx: Context, io: FreeIo & CheckoutOptions): Promise<number> {
  let ok = true;
  for (const repo of repos) {
    const reading = await readFlag(ctx.config.ask.url, { repo, tokens: io.tokens, home: io.home, fetch: io.fetch, callMs: io.callMs });
    const said = phase0Line(repo, reading);
    ok &&= said.ok;
    println(io.stdout, said.line);
  }
  return ok ? 0 : 1;
}
