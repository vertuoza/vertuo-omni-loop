// What the PRD page's Product picker sends and reads (PRD 1364 s7; ADR-0095), as zod schemas both sides
// share: the controller (src/dossier/product/product.controller.ts) answers these shapes, and the
// browser's client (src/dossier/product/product.client.ts) parses every answer with them. Browser-safe:
// zod and the kit's ids only.
//
//   GET  /api/dossiers/product?dossier=<id>        → { product, products, locked }
//   POST /api/dossiers/product {dossier, product}  → { product }
//
// `product` is `{id, name}` or null (No product). `locked` is `product is locked: PRD <n> is approved`
// while an approval is in force, else null. A refusal is `{ error }` in plain words (ADR-0029): 400 a
// malformed request or a product of another workspace, 401 signed out, 404 no such PRD the caller reads,
// 409 locked, 500 the database failed.
import { z } from 'zod';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** The picker's route. */
export const PRODUCT_ROUTE = '/api/dossiers/product';

/** A row id, as the database writes it. */
export const UuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

/** One of the workspace's products. */
export const ProductRefSchema = z.object({ id: UuidSchema, name: z.string() });
export type ProductRef = z.infer<typeof ProductRefSchema>;

/** What the picker shows: the PRD's product, the workspace's products, and the lock. */
export const ProductPickSchema = z.object({
  product: ProductRefSchema.nullable(),
  products: z.array(ProductRefSchema),
  locked: z.string().nullable(),
});
export type ProductPick = z.infer<typeof ProductPickSchema>;

/** A change: the dossier, and the product it takes, or null for No product. */
export const ProductChangeSchema = z.object({ dossier: UuidSchema, product: UuidSchema.nullable() });

/** What a change answers: the product set. */
export const ProductSetSchema = z.object({ product: ProductRefSchema.nullable() });

/** Every refusal. */
export const ProductErrorSchema = z.object({ error: z.string() });

/** Why a read or a change was refused, each with its status. */
export const PRODUCT_REFUSALS = { malformed: 400, 'foreign-product': 400, 'signed-out': 401, missing: 404, locked: 409, database: 500 } as const;
export type ProductRefusal = keyof typeof PRODUCT_REFUSALS;

/** The lock, in the database's words (dossier_set_product()). */
export const lockedLine = (prd: PrdNumber): string => `product is locked: PRD ${prd} is approved`;
