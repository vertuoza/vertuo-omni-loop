// The raises a person said yes to (PRD 1679 s3, D4), as the `omni / budgets` check reads them: through
// the kit's `OutboxStore.settledEntries`, the store `omni check context` reads, then `settledRaises`.
//
// - A repository's PRD keeps its ledger in git: the `git` store reads `settled.md` from the head's
//   snapshot, so the check sees what the pull request holds.
// - A product PRD (`Part of mobile-12`, PRD 1548) keeps its outbox as rows on the server: the `server`
//   store reads them through a client whose one read is the App's, as the service role
//   (`outboxRowsReader`), since the App has no person's session. It writes nothing: no agent settles
//   a raise, and the App neither.
//
// A store that cannot be read gives no raise, as the command reads it: a raised ceiling then stays red
// until the next event reads the yes.
import { settledRaises, type Raise } from 'omni-loop/kit/lib/budgets/ratchet.ts';
import type { Context } from 'omni-loop/kit/lib/context.ts';
import { isProductPrdId, productPrdParts, type PrdNumber, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { gitOutboxStore } from 'omni-loop/kit/lib/outbox/git-store.ts';
import { serverOutboxStore, type OutboxServerClient } from 'omni-loop/kit/lib/outbox/server-store.ts';
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** A product PRD's outbox rows for a pull request of `repository`, in the shape the `server` store reads. */
export type OutboxRowsReader = (repository: string, prd: ProductPrdId) => Promise<unknown>;

const text = z.string().min(1);
const HolderRowSchema = z.object({ product_id: text });
const DossierRowSchema = z.object({ id: text });
const SettlementRowSchema = z.object({ verdict: text, basis: z.string(), settled_at: text });
const ItemRowSchema = z.object({ item: text, rank: text, body: z.string(), outbox_settlements: z.array(SettlementRowSchema) });

/** An item's latest settlement, as the store reads it; null while it is open. */
function latestSettlement(settlements: readonly z.infer<typeof SettlementRowSchema>[]) {
  const [latest] = [...settlements].sort((a, b) => b.settled_at.localeCompare(a.settled_at));
  return latest ? { verdict: latest.verdict, basis: latest.basis, settledAt: latest.settled_at } : null;
}

/**
 * The outbox rows reader, as the service role on `connection`: the product keyed as the PRD that holds
 * `repository`, its PRD of that number, and every item with its latest settlement. No such PRD there
 * reads as no item. Throws when the database refuses or answers out of shape.
 */
export function outboxRowsReader(connection: Connection): OutboxRowsReader {
  const db = serviceDb(connection);
  return async (repository, prd) => {
    const { key, seq } = productPrdParts(prd);
    const none = { prdId: prd, items: [] };
    const [holder] = rowsOf(HolderRowSchema, await db.from('product_repositories').select('product_id, products!inner(key)')
      .eq('repository', repository.toLowerCase()).eq('products.key', key).limit(1));
    if (!holder) return none;
    const [dossier] = rowsOf(DossierRowSchema, await db.from('dossiers').select('id')
      .eq('product_id', holder.product_id).eq('product_seq', seq).eq('kind', 'prd').limit(1));
    if (!dossier) return none;
    const items = rowsOf(ItemRowSchema, await db.from('outbox_items').select('item, rank, body, outbox_settlements(verdict, basis, settled_at)')
      .eq('dossier_id', dossier.id).order('raised_at', { ascending: true }).order('item', { ascending: true }));
    return { prdId: prd, items: items.map(({ item, rank, body, outbox_settlements }) => ({ item, rank, body, settlement: latestSettlement(outbox_settlements) })) };
  };
}

/** A `server` store client that reads through `read` and never writes. */
function readOnlyClient(repository: string, prd: ProductPrdId, read: OutboxRowsReader): OutboxServerClient {
  const refuse = () => Promise.reject(new Error('the omni / budgets check never writes an outbox'));
  return { readOutboxItems: () => read(repository, prd), putOutboxItem: refuse, settleOutboxItem: refuse };
}

/**
 * The raises a person said yes to in PRD `prd`'s outbox: the `git` store of the head's snapshot `ctx`
 * for a repository's PRD, the server's rows for a product's. None without a PRD, without a reader for a
 * product PRD, or when the store cannot be read, each said in the log.
 */
export async function raisesFor({
  ctx,
  prd,
  repository,
  readOutboxRows,
  log,
}: {
  ctx: Context;
  prd: PrdNumber | ProductPrdId | null;
  repository: string;
  readOutboxRows: OutboxRowsReader | null;
  log: (line: string) => void;
}): Promise<Raise[]> {
  if (prd === null) return [];
  let store;
  if (!isProductPrdId(prd)) store = gitOutboxStore(ctx);
  else if (readOutboxRows) store = serverOutboxStore({ ctx, connect: () => readOnlyClient(repository, prd, readOutboxRows), now: Date.now });
  else {
    log(`budgets check of ${repository}: the raises of PRD ${prd} are not read, the App cannot read the server here`);
    return [];
  }
  try {
    return settledRaises(await store.settledEntries(prd));
  } catch (error) {
    log(`budgets check of ${repository}: the raises of PRD ${prd} could not be read — ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
