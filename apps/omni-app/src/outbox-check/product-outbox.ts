// The outbox check of a product PRD's target feature PR (PRD 1548 s8, acceptance 7): the PRD's outbox is
// rows on the server (supabase/migrations/20261204100000_outbox_items.sql), not files in any repository,
// so the check reads them as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the approved
// check's pair) and grades the one gate there, never pointing at a plan PR.
//
//   product_repositories   the product keyed `key` that holds the pull request's repository, and its name
//   dossiers               that product's PRD `seq`
//   outbox_items           its items, each with its settlements: an item with none is open (s7-03: only
//                          the open questions hold the gate)
//
// A body naming a PRD of a product that does not hold the repository reads as no PRD, as the approved
// check reads it (../approved-check/record.ts). Throws when the database refuses or answers out of shape:
// the check reads that as held, never failed.
//
// | reading                    | conclusion | line                                                     |
// |----------------------------|------------|----------------------------------------------------------|
// | no open item               | success    | `0 open · one gate on Mobile`                            |
// | k open items               | failure    | `<k> open · answer on Mobile › Questions`                |
// | no such PRD for this repo  | failure    | `unknown · no product PRD mobile-12 holds this repository` |
// | the server could not be read | neutral  | `held · server unreachable since <time> · held, not failed` |
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import type { ProductPrdRef } from '../approved-check/state.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** An open item of the PRD: its id and its rank. */
export type OpenItem = { item: string; rank: string };

/** A product PRD's outbox, as the check reads it: its dossier, its product, and its open items. */
export type ProductOutbox = { dossierId: string; productId: string; productName: string; open: OpenItem[] };

/** Reads PRD `prd`'s outbox for a pull request of `repository` (`owner/name`); null when there is no such PRD there. */
export type ProductOutboxReader = (repository: string, prd: ProductPrdRef) => Promise<ProductOutbox | null>;

/** What reading the outbox gave: the outbox (null when there is no such PRD for this repository), or since when it could not be read. */
export type OutboxReading = { reachable: true; outbox: ProductOutbox | null } | { reachable: false; since: string };

/** The check run a reading asks for. */
export type ProductOutboxVerdict = {
  conclusion: 'success' | 'failure' | 'neutral';
  title: string;
  summary: string;
  detailsUrl: string | null;
};

const text = z.string().min(1);
const HolderRowSchema = z.object({ product_id: text, products: z.object({ name: text }) });
const DossierRowSchema = z.object({ id: text });
const ItemRowSchema = z.object({ item: text, rank: text, outbox_settlements: z.array(z.unknown()) });

/** The outbox reader, as the service role on `connection`. */
export function productOutboxReader(connection: Connection): ProductOutboxReader {
  const db = serviceDb(connection);
  return async (repository, prd) => {
    const [holder] = rowsOf(HolderRowSchema, await db.from('product_repositories').select('product_id, products!inner(key, name)')
      .eq('repository', repository.toLowerCase()).eq('products.key', prd.key).limit(1));
    if (!holder) return null;
    const [dossier] = rowsOf(DossierRowSchema, await db.from('dossiers').select('id')
      .eq('product_id', holder.product_id).eq('product_seq', prd.seq).eq('kind', 'prd').limit(1));
    if (!dossier) return null;
    const items = rowsOf(ItemRowSchema, await db.from('outbox_items').select('item, rank, outbox_settlements(verdict)')
      .eq('dossier_id', dossier.id).order('raised_at', { ascending: true }).order('item', { ascending: true }));
    return {
      dossierId: dossier.id,
      productId: holder.product_id,
      productName: holder.products.name,
      open: items.filter((row) => row.outbox_settlements.length === 0).map(({ item, rank }) => ({ item, rank })),
    };
  };
}

/** The product's Questions tab on the galaxy, where its open questions are answered. */
export function questionsUrl(galaxyUrl: string, productId: string): string {
  return `${galaxyUrl.replace(/\/+$/, '')}/app/products/${encodeURIComponent(productId)}/questions`;
}

/** An ISO time to the minute, as a check's line says it: `2026-10-11 10:05 UTC`; any other text as it is. */
function minuteOf(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return match ? `${match[1] ?? ''} ${match[2] ?? ''} UTC` : iso;
}

/** The outbox check's verdict for PRD `prd`'s target PR, from what reading its outbox gave. */
export function productOutboxVerdict(prd: ProductPrdRef, reading: OutboxReading, galaxyUrl: string): ProductOutboxVerdict {
  if (!reading.reachable) {
    return {
      conclusion: 'neutral',
      title: `held · server unreachable since ${minuteOf(reading.since)} · held, not failed`,
      summary: `The outbox of ${prd.id} could not be read: held, not failed. It is posted again on the next push, answer or question, or when this check is re-run.`,
      detailsUrl: null,
    };
  }
  const { outbox } = reading;
  if (!outbox) {
    return {
      conclusion: 'failure',
      title: `unknown · no product PRD ${prd.id} holds this repository`,
      summary: `This pull request says it is part of ${prd.id}, but no product keyed \`${prd.key}\` that holds this repository has a PRD ${prd.seq}.`,
      detailsUrl: null,
    };
  }
  const details = questionsUrl(galaxyUrl, outbox.productId);
  const gate = `${prd.id}'s outbox lives on ${outbox.productName}, on the server: one gate for every repository the PRD builds in.`;
  if (outbox.open.length === 0) {
    return { conclusion: 'success', title: `0 open · one gate on ${outbox.productName}`, summary: [gate, '', 'No open question.'].join('\n'), detailsUrl: details };
  }
  return {
    conclusion: 'failure',
    title: `${outbox.open.length} open · answer on ${outbox.productName} › Questions`,
    summary: [
      gate,
      '',
      ...outbox.open.map(({ item, rank }) => `- \`${item}\` · ${rank}`),
      '',
      `Answer them on [${outbox.productName} › Questions](${details}).`,
    ].join('\n'),
    detailsUrl: details,
  };
}
