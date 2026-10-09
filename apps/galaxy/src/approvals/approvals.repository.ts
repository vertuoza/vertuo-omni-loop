import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type PrdNumber, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The approvals' storage (PRD 1322 s2): the only file of this folder that reaches Supabase. It calls the
// database's functions (supabase/migrations/20261125090000_approval_requests.sql) and parses what they
// answer; it holds no rule. Two clients:
//
// - as the caller (a terminal's access token, or the page's session), so the database checks who calls:
//   approval_request() asks a PRD's approvers, approval_requests_waiting() reads the caller's bell;
// - as the service role, which alone reads how each asked person is reached (approval_recipients()) and
//   removes a device its push service says is gone.
//
// A database refusal comes back as its code and message; an answer out of shape as the code `shape`.

/** A Supabase client acting as the caller: the functions. */
type CallerDb = Pick<SupabaseClient, 'rpc'>;
/** The service role's client: the functions and the subscriptions table. */
type ServiceDb = Pick<SupabaseClient, 'rpc' | 'from'>;

/** Why the database said no: its code (42501, P0002, 22023…, or `shape`) and message. */
export type Refusal = { code: string | null; message: string | null };

/** A read: its value, or the refusal. */
export type Answer<T> = { ok: true; value: T } | { ok: false; refusal: Refusal };

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const text = z.string().min(1);
const at = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

/** What approval_request() answers: the request recorded, who it asked, and what a notification shows. */
const Requested = z.object({
  id: UUID,
  dossier: UUID,
  repo: text,
  prd: PrdNumberSchema,
  title: z.string(),
  kind: z.enum(['asked', 're-asked']),
  askedAt: at,
  product: text.nullable(),
  author: text,
  nobodyElse: z.boolean(),
  asked: z.array(z.object({ user: UUID, login: text, name: text.nullable() })),
  files: z.array(z.object({ kind: text, sha256: text })),
  spec: z.string().nullable(),
});

/** A request recorded, as approval_request() answers it. */
export type Requested = z.infer<typeof Requested>;

/** One request waiting on the caller, as approval_requests_waiting() lists it. */
const Waiting = z.array(z.object({ id: UUID, dossier: UUID, repo: text, prd: PrdNumberSchema, title: z.string(), askedAt: at }));

/** How each asked person is reached, as approval_recipients() answers it. */
const Recipients = z.array(z.object({
  user: UUID,
  email: text.nullable(),
  devices: z.array(z.object({ id: UUID, endpoint: text, p256dh: text, auth: text })),
}));

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** A function's answer parsed by `schema`, or the refusal. */
async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, fn: string): Promise<Answer<T>> {
  const { data, error } = await call;
  if (error) return { ok: false, refusal: { code: error.code ?? null, message: error.message ?? null } };
  const read = schema.safeParse(data);
  return read.success ? { ok: true, value: read.data } : { ok: false, refusal: { code: 'shape', message: `${fn}() answered out of shape` } };
}

/** The caller's side: asking, and the bell. */
export function approvalsRepository(db: CallerDb) {
  return {
    /** Records a request to approve PRD `prd` of `repo`, asking its approvers. */
    request: (repo: string, prd: PrdNumber) => parsed(db.rpc('approval_request', { p_repo: repo, p_prd: prd }), Requested, 'approval_request'),
    /** The requests that wait on the caller, oldest first. */
    waiting: () => parsed(db.rpc('approval_requests_waiting'), Waiting, 'approval_requests_waiting'),
  };
}

export type ApprovalsRepository = ReturnType<typeof approvalsRepository>;

/** The service role's side: how people are reached. */
export function reachRepository(db: ServiceDb) {
  return {
    /** How each person request `request` asked is reached. */
    recipients: (request: string) => parsed(db.rpc('approval_recipients', { p_request: request }), Recipients, 'approval_recipients'),
    /** Removes a device its push service says is gone. Throws when the database refuses. */
    async forget(device: string): Promise<void> {
      const { error } = await db.from('push_subscriptions').delete().eq('id', device);
      if (error) throw new Error(error.message);
    },
  };
}

export type ReachRepository = ReturnType<typeof reachRepository>;
