import { z } from 'zod';

// What the approvals' repositories answer (PRD 1322 s2; shared since PRD 1612 s2, so one repository
// never imports another): a read's value, or why the database said no, and the column shapes they
// parse with.

/** Why the database said no: its code (42501, P0002, 22023…, or `shape`) and message. */
export type Refusal = { code: string | null; message: string | null };

/** A read: its value, or the refusal. */
export type Answer<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

export const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const text = z.string().min(1);
export const at = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** A query's or a function's answer parsed by `schema`, or the refusal. */
export async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, fn: string): Promise<Answer<T>> {
  const { data, error } = await call;
  if (error) return { ok: false, refusal: { code: error.code ?? null, message: error.message ?? null } };
  const read = schema.safeParse(data);
  return read.success ? { ok: true, value: read.data } : { ok: false, refusal: { code: 'shape', message: `${fn}() answered out of shape` } };
}
