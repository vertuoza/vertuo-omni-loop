import { claimOf, type Claim, type ClaimKind, type StoredClaim } from './model';

// Settings → Business's calls (PRD 748 s2). In production, the functions of
// supabase/migrations/20261017090000_business_store.sql, called as the signed-in person: claim_pick()
// stores a pick, confirmed at once with source `pick`, and claim_set_state() confirms (✓) or rejects
// (✗) a claim; each answers the public.claims row it saved, or refuses (42501 not a member, P0002
// gone, 22023 invalid). A region belongs to the business, every other kind to the product the page
// shows. In the demo, the same rules kept in memory, so the page can be tried with no database.
// `run()` makes the calls of a plan of model.ts: the rejections first, then the pick.

export type Saved = { ok: true; claim: Claim } | { ok: false; message: string };

export interface BusinessPort {
  /** Picks `value` of `kind`: a confirmed claim, new or confirmed again. */
  pick(kind: ClaimKind, value: string): Promise<Saved>;
  /** ✓ Right or ✗ Wrong on a claim; the row is kept either way. */
  setState(claim: Claim, state: 'confirmed' | 'rejected'): Promise<Saved>;
}

export const NOT_MEMBER = 'Only a member of the workspace can change its business.';
const GONE = 'That is no longer in this workspace’s business. Reload the page.';
export const INVALID = 'That can’t be saved: 1 to 80 characters, on one line.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

/** An error as PostgREST answers it, or anything thrown, as the page says it. */
export function refusalOf(error: unknown): string {
  const { code } = (error ?? {}) as { code?: unknown };
  if (code === '42501') return NOT_MEMBER;
  if (code === 'P0002') return GONE;
  if (code === '22023') return INVALID;
  return COULD_NOT_SAVE;
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function databaseBusiness(db: Rpc, workspace: string, product: string): BusinessPort {
  const call = async (fn: string, args: Record<string, unknown>): Promise<Saved> => {
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      if (error || !data) return { ok: false, message: refusalOf(error) };
      return { ok: true, claim: claimOf(data as StoredClaim) };
    } catch (err) {
      return { ok: false, message: refusalOf(err) };
    }
  };
  return {
    pick: (kind, value) => call('claim_pick', {
      p_product: kind === 'region' ? null : product, p_kind: kind, p_value: value, p_source: 'pick',
    }),
    setState: (claim, state) => call('claim_set_state', { p_claim: claim.id, p_state: state }),
  };
}

/** claim_pick() and claim_set_state()'s rules on claims kept in memory. */
export function demoBusinessPort(initial: Claim[]): BusinessPort {
  let claims = [...initial];
  const save = (claim: Claim): Saved => {
    claims = [...claims.filter((c) => c.id !== claim.id), claim];
    return { ok: true, claim };
  };
  return {
    async pick(kind, value) {
      const v = value.trim();
      if (v.length < 1 || v.length > 80 || /[\r\n\t]/.test(v)) return { ok: false, message: INVALID };
      const kept = claims.find((c) => c.kind === kind && c.value.toLowerCase() === v.toLowerCase());
      if (kept) return save({ ...kept, state: 'confirmed' });
      const seq = Math.max(0, ...claims.map((c) => c.seq)) + 1;
      return save({ id: `demo-${seq}`, seq, kind, value: v, source: 'pick', state: 'confirmed', cited: 0, lastBy: null });
    },
    async setState(claim, state) {
      const kept = claims.find((c) => c.id === claim.id);
      if (!kept) return { ok: false, message: GONE };
      return save({ ...kept, state });
    },
  };
}

/** A step of a plan, as the page reports it. */
export type Step = { type: 'saved'; claim: Claim } | { type: 'refused'; message: string };

/** The calls a plan of model.ts makes, in order: each rejection, then the pick. */
export const callsOf = (port: BusinessPort, kind: ClaimKind, plan: { reject: Claim[]; pick: string | null }): Array<() => Promise<Saved>> => [
  ...plan.reject.map((claim) => () => port.setState(claim, 'rejected')),
  ...(plan.pick === null ? [] : [() => port.pick(kind, plan.pick as string)]),
];

/** The calls ✓ on a row makes: the rejections planConfirm() names, then the confirmation. */
export const confirmCalls = (port: BusinessPort, reject: Claim[], claim: Claim): Array<() => Promise<Saved>> => [
  ...reject.map((c) => () => port.setState(c, 'rejected')),
  () => port.setState(claim, 'confirmed'),
];

/** Makes the calls one at a time, reporting each; stops at the first refusal. */
export async function run(calls: Array<() => Promise<Saved>>, report: (step: Step) => void): Promise<boolean> {
  for (const call of calls) {
    const saved = await call();
    if (!saved.ok) {
      report({ type: 'refused', message: saved.message });
      return false;
    }
    report({ type: 'saved', claim: saved.claim });
  }
  return true;
}
