// What the product home's Archive and Restore send and read (PRD 2232 s1; ADR-0095), as zod schemas both
// sides share: the controller (product-home.controller.ts) answers these shapes, and the browser's client
// (product-archive.client.ts) parses every answer with them. Browser-safe: zod only.
//
//   POST /app/products/<id>/archive → 200 { id, name, archivedAt }         an owner archives the product
//   POST /app/products/<id>/restore → 200 { id, name, archivedAt: null }   an owner restores it as it was
//
// Archiving an archived product, or restoring a live one, answers it as it is. A refusal is `{ error }` in
// plain words (ADR-0029): 401 signed out, 403 not an owner, 404 no such product, 500 the database failed.
import { z } from 'zod';

/** The product as Archive or Restore left it: archivedAt null once restored. */
export const ArchiveAnswerSchema = z.object({ id: z.string(), name: z.string(), archivedAt: z.string().nullable() });
export type ArchiveAnswer = z.infer<typeof ArchiveAnswerSchema>;

/** Every refusal. */
export const ArchiveErrorSchema = z.object({ error: z.string() });

/** Why Archive or Restore was refused, each with its status. */
export const ARCHIVE_REFUSALS = { 'signed-out': 401, 'not-owner': 403, missing: 404, database: 500 } as const;
export type ArchiveRefusal = keyof typeof ARCHIVE_REFUSALS;

const productRoute = (product: string) => `/app/products/${encodeURIComponent(product)}`;
/** Where an owner archives the product. */
export const archiveRoute = (product: string) => `${productRoute(product)}/archive`;
/** Where an owner restores it. */
export const restoreRoute = (product: string) => `${productRoute(product)}/restore`;
