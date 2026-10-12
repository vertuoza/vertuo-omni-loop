import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The voids' storage (PRD 1322 s6): the only file of the voiding that reaches Supabase. It calls the
// database's functions (supabase/migrations/20261126090000_approval_voiding.sql) and parses what they
// answer; it holds no rule. Two sides:
//
// - as the caller who pushed, so the database checks who reads: approval_voids_of_push() names the
//   voids their last push of a dossier left;
// - as the service role, which alone reads how a voided approval's approver is reached
//   (approval_void_recipients()).
//
// A database refusal comes back as its code and message; an answer out of shape as the code `shape`.

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** A Supabase client's functions, as either side calls them. */
type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<Raw> };

/** A read: its value, or why the database said no (its code, or `shape`, and its message). */
type Read<T> = { ok: true; value: T } | { ok: false; code: string | null; message: string | null };

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = z.string().min(1);
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/);

/** The voids a push left, as approval_voids_of_push() lists them, oldest first. */
const Voids = z.array(z.object({
  id: UUID,
  dossier: UUID,
  repo: text,
  prd: PrdNumberSchema,
  title: z.string(),
  kind: text,
  from: SHA256,
  to: SHA256,
  pusher: text,
  approver: text,
}));

/** One void a push left: the dossier's PRD, the kind, the pinned and the new hash, who pushed and
 * whose approval it voided. */
export type PushVoid = z.infer<typeof Voids>[number];

/** How the voided approval's approver is reached, as approval_void_recipients() answers it. */
const Recipients = z.array(z.object({
  user: UUID,
  email: text.nullable(),
  devices: z.array(z.object({ id: UUID, endpoint: text, p256dh: text, auth: text })),
}));

async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, fn: string): Promise<Read<T>> {
  const { data, error } = await call;
  if (error) return { ok: false, code: error.code ?? null, message: error.message ?? null };
  const read = schema.safeParse(data);
  return read.success ? { ok: true, value: read.data } : { ok: false, code: 'shape', message: `${fn}() answered out of shape` };
}

/** The pusher's side: the voids their last push of a dossier left. */
export function voidRepository(db: Rpc) {
  return {
    ofPush: (dossier: string) => parsed(db.rpc('approval_voids_of_push', { p_dossier: dossier }), Voids, 'approval_voids_of_push'),
  };
}

export type VoidRepository = ReturnType<typeof voidRepository>;

/** The service role's side: how the approver a void voided is reached. */
export function voidReachRepository(db: Rpc) {
  return {
    recipients: (voidId: string) => parsed(db.rpc('approval_void_recipients', { p_void: voidId }), Recipients, 'approval_void_recipients'),
  };
}

export type VoidReachRepository = ReturnType<typeof voidReachRepository>;
