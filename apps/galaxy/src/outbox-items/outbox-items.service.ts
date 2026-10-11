import { parseProductPrdId, type ProductPrdId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseOutboxItem } from 'vertuo-omni-plan/kit/lib/outbox/outbox.ts';
import { OutboxRowSchema, type ItemsQuery, type ItemsReply, type OutboxRefusal, type PutRequest, type SettleRequest } from './outbox-items.contract';
import type { ItemColumns, OutboxItemsRepository, PrdOnProduct, Stored, StoredItemRow } from './outbox-items.repository';

// A product PRD's outbox rules (PRD 1548 s7; ADR-0095), on its repository, for the kit's `server` outbox
// store. An item's columns are read from its body by the kit's one item parser, so a row can never say
// other than its markdown, and a body that is not an item of the PRD it is sent to is refused before the
// database is asked. An answer given through the kit is recorded as given in the terminal. The database
// has the last word on the rest: who is a member, a PRD of another workspace (no such PRD), an item
// already settled, a rank other than medium adopted.

/** A service answer: its value, or why it was refused, in plain words. */
type Served<T> = { ok: true; value: T } | { ok: false; kind: OutboxRefusal; error: string };

const SIGNED_OUT = 'Sign in first to read or write a PRD\'s outbox.';
const NOT_READ = 'The PRD\'s outbox could not be read. Try again.';
const NOT_WRITTEN = 'The PRD\'s outbox was not written. Try again.';

const refused = (kind: OutboxRefusal, error: string): { ok: false; kind: OutboxRefusal; error: string } => ({ ok: false, kind, error });

/** The product PRD a request names, as the repository takes it, and its id. */
function prdOf({ product, prd, repo }: { product: string; prd: number; repo?: string | undefined }): PrdOnProduct & { id: ProductPrdId } {
  return { key: product, seq: prd, repo: repo?.toLowerCase() ?? null, id: parseProductPrdId(`${product}-${prd}`) };
}

/** The database's refusal of a write, as the route answers it. */
function writeRefusal(stored: Extract<Stored<unknown>, { ok: false }>, id: string): { ok: false; kind: OutboxRefusal; error: string } {
  const message = stored.message ?? '';
  if (stored.code === 'P0002') return refused('missing', message || `No PRD ${id} in your workspaces.`);
  if (stored.code === '22023' && stored.hint === 'settled') return refused('settled', message);
  if (stored.code === '22023') return refused('refused', message);
  if (stored.code === '42501') return refused('signed-out', SIGNED_OUT);
  return refused('database', NOT_WRITTEN);
}

/** A stored item, as the kit reads it. */
function rowOf(row: StoredItemRow) {
  const [settlement] = row.outbox_settlements;
  return OutboxRowSchema.parse({
    item: row.item, rank: row.rank, repository: row.repository, body: row.body, raisedAt: row.raised_at,
    settlement: settlement === undefined ? null : {
      verdict: settlement.verdict, basis: settlement.basis, answer: settlement.answer, channel: settlement.channel,
      settledBy: settlement.settler_login, settledAt: settlement.settled_at,
    },
  });
}

/** The columns of the item `body` sends to PRD `id`, or why it is no item of that PRD. */
function columnsOf(body: string, id: ProductPrdId): Served<ItemColumns> {
  const parsed = parseOutboxItem(body, { file: null });
  if (!parsed.ok) return refused('not-an-item', `The body is not an outbox item: ${parsed.errors.join('; ')}`);
  const { item } = parsed;
  if (item.prd !== id) return refused('not-an-item', `The item belongs to PRD ${item.prd}, not PRD ${id}.`);
  return { ok: true, value: { item: item.id, slice: item.slice, rank: item.rank, bearsOn: item.bearsOn, wave: item.wave, raised: item.raised, body } };
}

export function outboxItemsService(repo: OutboxItemsRepository) {
  return {
    /** Every item of the product PRD, oldest first, with its settlement. */
    items: async (query: ItemsQuery): Promise<Served<ItemsReply>> => {
      const prd = prdOf(query);
      const dossier = await repo.dossier(prd);
      if (!dossier.ok) return refused('database', NOT_READ);
      if (dossier.value === null) return refused('missing', `No PRD ${prd.id} in your workspaces.`);
      const rows = await repo.items(dossier.value);
      return rows.ok ? { ok: true, value: { prdId: prd.id, items: rows.value.map(rowOf) } } : refused('database', NOT_READ);
    },

    /** Raises an item, or rewrites it while it is open; with `adopt`, adopts a medium one at once. */
    put: async (request: PutRequest): Promise<Served<unknown>> => {
      const prd = prdOf(request);
      const columns = columnsOf(request.body, prd.id);
      if (!columns.ok) return columns;
      const stored = await (request.adopt === true ? repo.adopt(prd, columns.value) : repo.put(prd, columns.value));
      return stored.ok ? stored : writeRefusal(stored, prd.id);
    },

    /** Settles an open item with an answer given in the terminal. */
    settle: async (request: SettleRequest): Promise<Served<unknown>> => {
      const prd = prdOf(request);
      const { item, verdict, basis, answer } = request;
      const stored = await repo.settle(prd, { item, verdict, basis, answer, channel: 'terminal' });
      return stored.ok ? stored : writeRefusal(stored, prd.id);
    },
  };
}

export type OutboxItemsService = ReturnType<typeof outboxItemsService>;
