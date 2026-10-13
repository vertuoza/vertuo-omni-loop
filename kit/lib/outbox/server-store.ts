// The `server` outbox store (PRD 1548, slice s7): a product PRD's outbox (`mobile-12`) as rows on the
// Omni page, never files. An item is a row whose body is its markdown as written, read back through the
// kit's one item parser; a settlement is a row appended to it, never changed; nothing is ever deleted.
// The store reaches them through the Omni page's routes (`GET /api/outbox/items`, `POST /api/outbox/items`,
// `POST /api/outbox/items/settle`), signed in as the person who runs the kit.
//
// Every rule a file's item meets, a row's meets too, before any write: an item is graded by
// `checkItemText`, the check `omni check outbox` runs, and an answer is judged by `judgeAnswer`, as
// the `git` store judges it. What differs, because the server holds it:
//
// - An item is named `<prd>/<item id>`, its ref; `removeItem` writes nothing, since a settlement is what
//   closes a row, and a settled row reads as no open item.
// - An answer given here is recorded as given in the terminal, by whoever is signed in: who approved it,
//   when and on which channel are checked when given, and the server records its own.
// - The gate counts open rows only: a drifted answer has no rework to wait for on the server yet, and
//   the server keeps no account, so a relayed account is refused and stays where it is.
// - Nothing is posted on GitHub: a product PRD's questions are answered on its Questions tab, so the
//   replies read nothing and the outbox comments are skipped.
//
// With the server unreachable every method rejects with `OutboxServerError`, whose message is the held
// line, `held · server unreachable since <time> · held, not failed`: the caller exits 1, holding.
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import type { Context } from '../context.ts';
import { isProductPrdId, OutboxItemIdSchema, productPrdParts, ProductPrdIdSchema } from '../ids.ts';
import type { OutboxItemId, ProductPrdId } from '../ids.ts';
import { lawsFor } from '../laws.ts';
import { RANK_VALUES } from '../schema/front-matter.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';
import type { OutboxItem } from '../types.ts';
import { ACCOUNTS_DIR } from './account.ts';
import type { SettledEntryView } from './comment.ts';
import { isFolder, markdownFiles, spendFolder, writeInto } from './out-folder.ts';
import { parseOutboxItem } from './outbox.ts';
import { itemRefusal } from './relay.ts';
import { ADOPTED_VERDICT, AnswerSchema, answerErrors, judgeAnswer, renderAdoptedEntry, renderSettledEntry } from './settle.ts';
import type { OpenItem } from './status.ts';
import type { OutboxPrd, OutboxStore } from './store.ts';

/** The calls of the Omni page the store makes, as `askClient` (`../ask/client.ts`) makes them. */
export type OutboxServerClient = {
  readOutboxItems(query: { key: string; seq: number; repo: string | null }): Promise<unknown>;
  putOutboxItem(item: { key: string; seq: number; repo: string | null; body: string; adopt: boolean }): Promise<unknown>;
  settleOutboxItem(answer: { key: string; seq: number; repo: string | null; item: string; verdict: string; basis: string; answer: string }): Promise<unknown>;
};

/** Why the store could not read or write the Omni page: unreachable (`status` null, the held line) or
 * refused (its status, and its reason in its words). */
export class OutboxServerError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'OutboxServerError';
    this.status = status;
  }
}

/** The line a verb holds on while the server cannot be reached, since `at`. */
export const heldLine = (at: string): string => `held · server unreachable since ${at} · held, not failed`;

/** The refusals of a write that are answers, not failures: a malformed item, a settled one, a rank. */
const ANSWERED_REFUSALS: ReadonlySet<number | null> = new Set([400, 409, 422]);

const SettlementSchema = z.object({
  verdict: z.enum(['agreed', 'drifted', ADOPTED_VERDICT]),
  basis: z.string(),
  settledAt: z.string(),
});

const RowSchema = z.object({
  item: OutboxItemIdSchema,
  rank: z.enum(RANK_VALUES),
  body: z.string(),
  settlement: SettlementSchema.nullable(),
});
type Row = z.infer<typeof RowSchema>;

const ItemsReplySchema = z.object({ prdId: ProductPrdIdSchema, items: z.array(RowSchema) });

/** An answer as the `server` store takes it: the text and a stated verdict, and, when given, who
 * approved it, when and where, held to the `git` store's rules. */
const ServerAnswerSchema = AnswerSchema.partial({ approvedBy: true, approvedAt: true, channel: true });

/** The ref of item `id` of product PRD `prd`. */
const refOf = (prd: ProductPrdId, id: string): string => `${prd}/${id}`;

/** Where a settlement goes, as a verb names it. */
const ledgerOf = (prd: ProductPrdId): string => `PRD ${prd}'s ledger on the Omni page`;

/** The product PRD and the item a ref names, or null when it names none. */
function refParts(ref: string): { prd: ProductPrdId; id: OutboxItemId } | null {
  const cut = ref.lastIndexOf('/');
  const prd = ProductPrdIdSchema.safeParse(ref.slice(0, Math.max(cut, 0)));
  const id = OutboxItemIdSchema.safeParse(ref.slice(cut + 1));
  return prd.success && id.success ? { prd: prd.data, id: id.data } : null;
}

/** PRD `prd` as a product's, or the error for a repository's: its outbox is in the repository. */
function productPrd(prd: OutboxPrd): ProductPrdId {
  if (!isProductPrdId(prd)) throw new Error(`PRD ${prd} is a repository's: its outbox is in the repository, not on the Omni page`);
  return prd;
}

/** A row's item, parsed, or null when its body does not parse. */
function parsedRow(prd: ProductPrdId, row: Row): OutboxItem | null {
  const parsed = parseOutboxItem(row.body, { file: refOf(prd, row.item) });
  return parsed.ok ? parsed.item : null;
}

/** A row as a ledger entry, its id, verdict, basis and item text; none while it is open. */
function settledEntriesOf(row: Row): SettledEntryView[] {
  if (row.settlement === null) return [];
  const { verdict, basis } = row.settlement;
  return [{ id: row.item, verdict, closed: true, fields: { Verdict: verdict, Basis: basis }, answerText: '', itemText: row.body, became: [] }];
}

/** The `server` store of the repository `ctx`, reaching the Omni page through `connect`'s client;
 * `now` dates the held line. */
export function serverOutboxStore({ ctx, connect, now }: { ctx: Context; connect: () => OutboxServerClient; now: () => number }): OutboxStore {
  const repo = ctx.config.repo.slug;

  /** `call`'s answer, or the store's error for a failed call. */
  async function ask(call: (client: OutboxServerClient) => Promise<unknown>): Promise<unknown> {
    const client = connect();
    try {
      return await call(client);
    } catch (error) {
      if (!(error instanceof AskCallError)) throw error;
      if (error.status === null) throw new OutboxServerError(heldLine(new Date(now()).toISOString()), null);
      throw new OutboxServerError(error.reason ?? `the Omni page refused the call (${error.status})`, error.status);
    }
  }

  /** Every row of PRD `prd`, open or settled. */
  async function rows(prd: ProductPrdId): Promise<Row[]> {
    const { key, seq } = productPrdParts(prd);
    const reply = ItemsReplySchema.safeParse(await ask((client) => client.readOutboxItems({ key, seq, repo })));
    if (!reply.success) throw new OutboxServerError('the Omni page answered the outbox items out of shape', 200);
    return reply.data.items;
  }

  /** PRD `prd`'s open rows. */
  const openRows = async (prd: ProductPrdId): Promise<Row[]> => (await rows(prd)).filter((row) => row.settlement === null);

  /** The item `body` written on PRD `prd`'s server outbox, or adopted at once. */
  async function put(prd: ProductPrdId, body: string, adopt: boolean): Promise<void> {
    const { key, seq } = productPrdParts(prd);
    await ask((client) => client.putOutboxItem({ key, seq, repo, body, adopt }));
  }

  /** `write`'s outcome, or a refusal the server answered, as a verb's errors. */
  async function answered<T>(write: () => Promise<T>): Promise<T | { ok: false; errors: string[] }> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof OutboxServerError && ANSWERED_REFUSALS.has(error.status)) return { ok: false, errors: [error.message] };
      throw error;
    }
  }

  return {
    async readItem(ref) {
      const named = refParts(ref);
      const row = named === null ? undefined : (await openRows(named.prd)).find((open) => open.item === named.id);
      return row === undefined ? { ok: false, code: 'ENOENT' } : { ok: true, text: row.body };
    },

    // A settlement closes a row: there is nothing to remove.
    removeItem: () => Promise.resolve(),

    async spentIds(prd, out) {
      const ids = new Set<string>((await rows(productPrd(prd))).map((row) => row.item));
      if (out !== null) spendFolder(ids, out.abs);
      return ids;
    },

    async writeItem({ prd, id, text }, out) {
      const product = productPrd(prd);
      if (out !== null) return writeInto(out, id, text);
      const ref = refOf(product, id);
      const refusal = itemRefusal({ laws: lawsFor(ctx), prd: product, file: ref, name: `${id}.md`, text, taken: new Set() });
      if (refusal !== null) throw new Error(`${ref}: ${refusal}`);
      await put(product, text, false);
      return ref;
    },

    async adopt(itemText) {
      const parsed = parseOutboxItem(itemText, { file: null });
      if (!parsed.ok) return { ok: false, errors: parsed.errors };
      const { item } = parsed;
      if (item.rank !== 'medium') {
        return { ok: false, errors: [`${item.id}: only a "medium" item is adopted at raise time — this one is ranked "${item.rank}" and is written as an open item instead.`] };
      }
      const prd = productPrd(item.prd);
      return answered(async () => {
        await put(prd, itemText, true);
        return { ok: true as const, entry: renderAdoptedEntry({ item, itemText, markers: ctx.markers }), settledFile: ledgerOf(prd), item };
      });
    },

    async settle(ref, answer) {
      const given = ServerAnswerSchema.safeParse(answer, { error: KIT_MESSAGES });
      if (!given.success) return { ok: false, errors: answerErrors(given.error) };
      const named = refParts(ref);
      const row = named === null ? undefined : (await openRows(named.prd)).find((open) => open.item === named.id);
      const item = named === null || row === undefined ? null : parsedRow(named.prd, row);
      if (named === null || row === undefined || item === null) return { ok: false, errors: [`${ref}: no such open item.`] };
      const { text, statedVerdict = null } = given.data;
      const judgement = judgeAnswer({ choice: item.sections.whatIDidMeanwhile, answer: text, statedVerdict });
      const { verdict } = judgement;
      if (verdict === null) {
        return { ok: false, errors: [`${ref}: the verdict is undetermined — ${judgement.reason}. Say it outright: add a "Verdict: agreed" or "Verdict: drifted" line to the answer, or pass --verdict.`] };
      }
      const { key, seq } = productPrdParts(named.prd);
      return answered(async () => {
        await ask((client) => client.settleOutboxItem({ key, seq, repo, item: named.id, verdict, basis: judgement.basis, answer: text }));
        const entryAnswer = { text, approvedBy: given.data.approvedBy ?? 'the signed-in person', approvedAt: given.data.approvedAt ?? new Date(now()).toISOString(), channel: null };
        const entry = renderSettledEntry({ item, itemText: row.body, answer: entryAnswer, judgement, markers: ctx.markers });
        return { ok: true as const, verdict, basis: judgement.basis, entry, settledFile: ledgerOf(named.prd), removedFile: ref };
      });
    },

    async relay(prd, dir, laws) {
      const product = productPrd(prd);
      if (!isFolder(dir)) return null;
      const taken = new Set<string>((await rows(product)).map((row) => row.item));
      const moved: { from: string; to: string }[] = [];
      const refused: { file: string; reason: string }[] = [];
      for (const name of markdownFiles(dir)) {
        const from = join(dir, name);
        const text = readFileSync(from, 'utf8');
        const id = name.slice(0, -'.md'.length);
        const reason = itemRefusal({ laws, prd: product, file: refOf(product, id), name, text, taken });
        if (reason !== null) {
          refused.push({ file: from, reason });
          continue;
        }
        await put(product, text, false);
        unlinkSync(from);
        taken.add(id);
        moved.push({ from, to: refOf(product, id) });
      }
      for (const name of markdownFiles(join(dir, ACCOUNTS_DIR))) {
        refused.push({ file: join(dir, ACCOUNTS_DIR, name), reason: `PRD ${product}'s outbox is on the Omni page, which keeps no account yet: it stays here` });
      }
      return { moved, refused };
    },

    async gate(prd, { labels = [] }) {
      const product = productPrd(prd);
      const items = (await openRows(product)).map((row): OpenItem => {
        const file = refOf(product, row.item);
        return parsedRow(product, row) === null ? { file, id: null, rank: null } : { file, id: row.item, rank: row.rank };
      });
      const overrideLabel = ctx.config.labels.outboxGo;
      const overridden = labels.includes(overrideLabel);
      return { ok: overridden || items.length === 0, items, overridden, unreworked: [], overrideLabel };
    },

    async openItems(prd) {
      const product = productPrd(prd);
      return (await openRows(product)).flatMap((row) => parsedRow(product, row) ?? []);
    },

    async adoptedEntries(prd) {
      return (await rows(productPrd(prd))).flatMap(settledEntriesOf).filter((entry) => entry.verdict === ADOPTED_VERDICT);
    },

    async settledEntries(prd) {
      return (await rows(productPrd(prd))).flatMap(settledEntriesOf);
    },

    // A product PRD's questions are answered on its Questions tab: no reply on GitHub settles one.
    replies(request) {
      return new Promise((resolve) => {
        productPrd(request.prd);
        resolve({ settled: [], failed: [], held: [], round: null });
      });
    },

    async prComment(prd) {
      const open = await openRows(productPrd(prd));
      return { action: 'skipped', id: null, htmlUrl: null, openCount: open.length, answeredCount: 0, adoptedCount: 0, newAdoptedCount: 0, body: null };
    },

    async issueComment(request) {
      const open = await openRows(productPrd(request.prd));
      return { action: 'skipped', id: null, htmlUrl: null, itemCount: open.length, unaccountedCount: 0, newCount: 0, counts: {}, adoptedCount: 0, body: '' };
    },
  };
}

/** A verb's exit when its store failed on the Omni page: the reason on `stderr`, as `omni <command>:
 * <reason>`, the held line while the server is unreachable, and exit 1. Any other error is thrown. */
export function serverFailure(command: string, error: unknown, stderr: { write(text: string): unknown }): number {
  if (!(error instanceof OutboxServerError)) throw error;
  stderr.write(`omni ${command}: ${error.message}\n`);
  return 1;
}
