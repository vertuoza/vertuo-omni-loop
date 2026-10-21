// What the kit sends and reads on a product PRD's outbox (PRD 1548 s7; ADR-0095), as zod schemas both
// sides share: the controller (src/outbox-items/outbox-items.controller.ts) answers these shapes, and the
// kit's `server` outbox store (kit/lib/outbox/server-store.ts) reads them. Browser-safe: zod and the kit's
// ids only.
//
//   GET  /api/outbox/items?product=<key>&prd=<n>[&repo=<owner/name>]   → { prdId, items }
//   POST /api/outbox/items {product, prd, repo?, body, adopt?}           → { id, item, prdId, open } | { …, verdict, settledAt }
//   POST /api/outbox/items/settle {product, prd, repo?, item, verdict, basis, answer} → { id, item, prdId, verdict, settledAt }
//
// `product` and `prd` name the product PRD (`mobile-12` is product `mobile`, PRD 12); `repo` is the
// repository the kit runs from, which picks the workspace when two hold the key and is the repository an
// item is raised in. `body` is the item's markdown as written; the server reads its columns from it with
// the kit's one item parser. An item's settlement is null while it is open. A refusal is `{ error }` in
// plain words (ADR-0029): 400 a malformed request or a body that is not an item of that PRD, 401 signed
// out, 404 no such PRD (or item) in the caller's workspaces, 409 an item already settled, 422 a value the
// database refuses (a rank other than medium adopted, say), 503 no database here, 500 the database failed.
import { z } from 'zod';
import { OutboxItemIdSchema, PrdNumberSchema, ProductPrdIdSchema } from 'omni-loop/kit/lib/ids.ts';

/** A product's key: lowercase kebab-case, each part starting with a letter, 40 characters at most. */
const ProductKeySchema = z.string().max(40).regex(/^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/);

/** A repository, as `owner/name`. */
const RepoSchema = z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/);

/** Which product PRD a call is about, and the repository it comes from. */
const PrdOnProduct = { product: ProductKeySchema, prd: PrdNumberSchema, repo: RepoSchema.optional() };

/** The items' query, its PRD's number read from its digits. */
export const ItemsQuerySchema = z.object({ ...PrdOnProduct, prd: z.coerce.number().pipe(PrdNumberSchema) });
export type ItemsQuery = z.infer<typeof ItemsQuerySchema>;

/** The three verdicts a settlement carries. */
const SettledVerdictSchema = z.enum(['agreed', 'drifted', 'adopted']);

/** An item's settlement: its verdict and why, the answer as given and where (none for an adoption), who
 * settled it, by their GitHub login, and when. */
const SettlementSchema = z.object({
  verdict: SettledVerdictSchema,
  basis: z.string(),
  answer: z.string().nullable(),
  channel: z.enum(['questions', 'terminal']).nullable(),
  settledBy: z.string(),
  settledAt: z.string(),
});

/** One item: its id and rank, the repository it was raised in, its markdown, when it was raised, and its
 * settlement, or null while it is open. */
export const OutboxRowSchema = z.object({
  item: OutboxItemIdSchema,
  rank: z.enum(['medium', 'high', 'human-action']),
  repository: z.string().nullable(),
  body: z.string(),
  raisedAt: z.string(),
  settlement: SettlementSchema.nullable(),
});

/** Every item of a product PRD, oldest first. */
export const ItemsReplySchema = z.object({ prdId: ProductPrdIdSchema, items: z.array(OutboxRowSchema) });
export type ItemsReply = z.infer<typeof ItemsReplySchema>;

/** An item to raise, or to rewrite while it is open; with `adopt`, a medium item adopted at once. */
export const PutRequestSchema = z.object({ ...PrdOnProduct, body: z.string().min(1).max(100_000), adopt: z.boolean().optional() }).strict();
export type PutRequest = z.infer<typeof PutRequestSchema>;

/** What a put answers: the item's row, open, or its adoption. */
export const PutReplySchema = z.union([
  z.object({ id: z.string(), item: OutboxItemIdSchema, prdId: ProductPrdIdSchema, open: z.literal(true) }),
  z.object({ id: z.string(), item: OutboxItemIdSchema, prdId: ProductPrdIdSchema, verdict: z.literal('adopted'), settledAt: z.string() }),
]);

/** A settlement of an open item, with an answer given in the terminal. */
export const SettleRequestSchema = z.object({
  ...PrdOnProduct,
  item: OutboxItemIdSchema,
  verdict: z.enum(['agreed', 'drifted']),
  basis: z.string().trim().min(1).max(500),
  answer: z.string().min(1).max(20_000),
}).strict();
export type SettleRequest = z.infer<typeof SettleRequestSchema>;

/** What a settlement answers: the settlement's id, its item and its verdict. */
export const SettleReplySchema = z.object({ id: z.string(), item: OutboxItemIdSchema, prdId: ProductPrdIdSchema, verdict: SettledVerdictSchema, settledAt: z.string() });

/** Why a call was refused, each with its status. */
export const OUTBOX_REFUSALS = { malformed: 400, 'not-an-item': 400, 'signed-out': 401, missing: 404, settled: 409, refused: 422, unavailable: 503, database: 500 } as const;
export type OutboxRefusal = keyof typeof OUTBOX_REFUSALS;
