// `omni adopt <item-text-file>` — adopts a medium item, at raise time or an already-open one: reads
// the file, appends its "Verdict: adopted" entry to its PRD's settled ledger, then removes the file
// it adopted — just as `omni settle` removes a settled one. Refuses a file that is not under the
// item's own PRD's outbox directory, leaving the tree untouched.
// It reads, adopts and removes the item through the PRD's outbox store (PRD 1548, s6).
//
// `omni adopt <item-id> --prd <key>-<n>` (PRD 1548, s7) adopts a product PRD's open medium item, a row
// on the Omni page, through the `server` store: nothing in the repository changes. While the server
// cannot be reached it holds, exit 1. It runs before a context exists, like `omni status`, so that a
// test can hand it `tokens`, `home`, `fetch`, `callMs` and `now`; it loads the context itself.
// Ported from nimbus-brain@c4a210122:scripts/outbox-settle.mjs (its CLI half, `adopt`) — changes in kit/porting/bin--commands.md.
import { isAbsolute, relative } from 'node:path';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { isProductPrdId } from '../../lib/ids.ts';
import type { ProductPrdId } from '../../lib/ids.ts';
import { parseOutboxItem } from '../../lib/outbox/outbox.ts';
import { serverFailure } from '../../lib/outbox/server-store.ts';
import { outboxStore } from '../../lib/outbox/stores.ts';
import type { OutboxStore } from '../../lib/outbox/store.ts';
import type { OutboxSignIn } from '../../lib/outbox/stores.ts';
import { inRoot, parseArgs, prdIdArg, println, usageError, withPrdFolder } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';

/** Whether `file` (absolute) sits inside `dir` (absolute) — itself does not count. */
function isUnder(dir: string, file: string): boolean {
  const rel = relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** A usage error when the repository's item at `path` is not under its own PRD's outbox directory. A
 * malformed item is left for `adoptItem` itself to refuse (exit 1, "nothing was written") — this guard
 * only fires once the item parses, so it can name the PRD's own outbox directory. */
function requireUnderOutbox(ctx: Context, path: string, itemText: string): void {
  const parsedItem = parseOutboxItem(itemText, { file: null });
  if (!parsedItem.ok || isProductPrdId(parsedItem.item.prd)) return;
  const outboxDir = ctx.layout.outboxDir(parsedItem.item.prd);
  if (outboxDir !== null && !isUnder(inRoot(ctx, outboxDir), inRoot(ctx, path))) {
    throw usageError(`omni adopt: ${relative(ctx.root, inRoot(ctx, path))} is not under ${outboxDir}, PRD ${parsedItem.item.prd}'s outbox directory.`);
  }
}

/** Adopts the item at `ref` through `store`; `product` is its product PRD, null for a repository's. */
async function adoptAt(ref: string, product: ProductPrdId | null, { ctx, store, stdout, stderr }: { ctx: Context; store: OutboxStore; stdout: Out; stderr: Out }): Promise<number> {
  const read = await store.readItem(ref);
  if (!read.ok) throw usageError(`omni adopt: cannot read ${ref} (${read.code}).`);
  if (product === null) requireUnderOutbox(ctx, ref, read.text);
  const result = await store.adopt(read.text).catch((error: unknown) => withPrdFolder('adopt', () => { throw error; }));
  if (!result.ok) {
    println(stderr, 'omni adopt — nothing was written:');
    for (const error of result.errors) println(stderr, `  - ${error}`);
    return 1;
  }
  await store.removeItem(ref);
  const removed = relative(ctx.root, inRoot(ctx, ref));
  println(
    stdout,
    product === null
      ? `omni adopt — ${result.item.id} adopted; appended to ${result.settledFile}; removed ${removed}. Commit the append and the deletion together.`
      : `omni adopt — ${result.item.id} adopted on ${result.settledFile}.`,
  );
  return 0;
}

export const adopt = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, ...signIn }: FreeIo & OutboxSignIn): Promise<number> {
    const { positional, flags } = parseArgs('adopt', args, { values: ['prd'] });
    const [path] = positional;
    if (positional.length !== 1 || path === undefined) throw usageError('usage: omni adopt <item-text-file> | omni adopt <item-id> --prd <key>-<n>');
    const prd = flags.prd === undefined ? null : prdIdArg('adopt', '--prd', flags.prd);
    const product = prd !== null && isProductPrdId(prd) ? prd : null;
    const ctx = loadContext(cwd, { exec });
    const store = outboxStore(ctx, product, signIn);
    return adoptAt(product === null ? path : `${product}/${path}`, product, { ctx, store, stdout, stderr })
      .catch((error: unknown) => serverFailure('adopt', error, stderr));
  },
} satisfies FreeCommand;
