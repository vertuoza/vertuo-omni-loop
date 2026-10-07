import { claimOf, maxValue, Product, StoredClaim, type Claim, type ClaimKind } from './model';
import { orEmpty, parseRow, parseRows } from '../data/parse-rows';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// Settings → Business's calls (PRD 748 s2). In production, the functions of
// supabase/migrations/20261019090000_business_store.sql, called as the signed-in person: claim_pick()
// stores a pick, confirmed at once with source `pick`, and claim_set_state() confirms (✓) or rejects
// (✗) a claim; each answers the public.claims row it saved, or refuses (42501 not a member, P0002
// gone, 22023 invalid). A region belongs to the business, every other kind to the product the page
// shows. In the demo, the same rules kept in memory, so the page can be tried with no database.
// `run()` makes the calls of a plan of model.ts: the rejections first, then the pick. A Never line (PRD
// 839) is picked the same way, 1 to 200 characters, and refused in its own words.

export type Saved = { ok: true; claim: Claim } | { ok: false; message: string };
export type AddedProduct = { ok: true; product: Product } | { ok: false; message: string };

// Products (PRD 748 s4): a pick and a suggestion name the product whose tab is shown (the port's own,
// the first, when none is given), and product_add() adds one by name.
export interface BusinessPort {
  /** Picks `value` of `kind` on `product`: a confirmed claim, new or confirmed again. */
  pick(kind: ClaimKind, value: string, product?: string): Promise<Saved>;
  /** ✓ Right or ✗ Wrong on a claim; the row is kept either way. */
  setState(claim: Claim, state: 'confirmed' | 'rejected'): Promise<Saved>;
  /** Asks for suggested rivals (PRD 748 s3): the proposed rivals stored, or none on any failure. */
  suggest(product?: string): Promise<Claim[]>;
  /** Adds a product to the business, by name. */
  addProduct(name: string): Promise<AddedProduct>;
}

/** The route that asks the small model for rivals and stores them as proposed claims. */
const SUGGEST_ROUTE = '/api/business/suggest-rivals';

export const NOT_MEMBER = 'Only a member of the workspace can change its business.';
const GONE = 'That is no longer in this workspace’s business. Reload the page.';
export const INVALID = 'That can’t be saved: 1 to 80 characters, on one line.';
/** A Never line (PRD 839) refused by its length or its line breaks. */
export const NEVER_INVALID = 'That can’t be saved: a Never line is 1 to 200 characters, on one line.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

/** An error as PostgREST answers it, or anything thrown, as the page says it. */
export function refusalOf(error: unknown): string {
  const code = propertyOf(error, 'code');
  if (code === '42501') return NOT_MEMBER;
  if (code === 'P0002') return GONE;
  if (code === '22023') return INVALID;
  return COULD_NOT_SAVE;
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

const isGuess = (claim: Claim) => claim.kind === 'rival' && claim.state === 'proposed';

export function databaseBusiness(db: Rpc, workspace: string, product: string, fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args)): BusinessPort {
  const call = async (fn: string, args: Record<string, unknown>, invalid = INVALID): Promise<Saved> => {
    const refused = (error: unknown) => {
      const message = refusalOf(error);
      return { ok: false as const, message: message === INVALID ? invalid : message };
    };
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      if (error || !data) return refused(error);
      const row = parseRow(StoredClaim, data, `business/store: ${fn}`);
      return row.ok ? { ok: true, claim: claimOf(row.value) } : { ok: false, message: COULD_NOT_SAVE };
    } catch (err) {
      return refused(err);
    }
  };
  return {
    pick: (kind, value, on = product) => call('claim_pick', {
      p_product: kind === 'region' ? null : on, p_kind: kind, p_value: value, p_source: 'pick',
    }, kind === 'never' ? NEVER_INVALID : INVALID),
    setState: (claim, state) => call('claim_set_state', { p_claim: claim.id, p_state: state }),
    async addProduct(name) {
      try {
        const { data, error } = await db.rpc('product_add', { p_workspace: workspace, p_name: name });
        if (error || !data) return { ok: false, message: refusalOf(error) };
        const row = parseRow(Product, data, 'business/store: product_add');
        return row.ok ? { ok: true, product: row.value } : { ok: false, message: COULD_NOT_SAVE };
      } catch (err) {
        return { ok: false, message: refusalOf(err) };
      }
    },
    // No guess is ever an error: a refusal, a broken answer or no network all find none.
    async suggest(on = product) {
      try {
        const response = await fetch(SUGGEST_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workspace, product: on }),
        });
        if (!response.ok) return [];
        const claims = propertyOf(await response.json(), 'claims');
        const rows = orEmpty(parseRows(StoredClaim, claims, `business/store: ${SUGGEST_ROUTE}`));
        return rows.map((row) => claimOf(row)).filter(isGuess);
      } catch {
        return [];
      }
    },
  };
}

const badText = (v: string, max = 80) => v.length < 1 || v.length > max || /[\r\n\t]/.test(v);

/** claim_pick(), claim_set_state() and product_add()'s rules on claims and products kept in memory. */
export function demoBusinessPort(initial: Claim[], initialProducts: Product[] = []): BusinessPort {
  let claims = [...initial];
  let products = [...initialProducts];
  const save = (claim: Claim): Saved => {
    claims = [...claims.filter((c) => c.id !== claim.id), claim];
    return { ok: true, claim };
  };
  return {
    pick(kind, value, on = products[0]?.id) {
      const v = value.trim();
      if (badText(v, maxValue(kind))) return Promise.resolve({ ok: false, message: kind === 'never' ? NEVER_INVALID : INVALID });
      const first = products[0]?.id;
      const product = kind === 'region' ? null : on ?? null;
      // With no product known, one product holds every claim.
      const sameProduct = (c: Claim) => c.kind === 'region' || first === undefined || (c.product ?? first) === product;
      const kept = claims.find((c) => c.kind === kind && sameProduct(c) && c.value.toLowerCase() === v.toLowerCase());
      if (kept) return Promise.resolve(save({ ...kept, state: 'confirmed' }));
      const seq = Math.max(0, ...claims.map((c) => c.seq)) + 1;
      return Promise.resolve(save({ id: `demo-${seq}`, seq, kind, value: v, source: 'pick', state: 'confirmed', product, cited: 0, lastBy: null }));
    },
    addProduct(name) {
      const v = name.trim();
      if (badText(v) || products.some((p) => p.name.toLowerCase() === v.toLowerCase())) return Promise.resolve({ ok: false, message: INVALID });
      const product = { id: `demo-product-${products.length + 1}`, name: v };
      products = [...products, product];
      return Promise.resolve({ ok: true, product });
    },
    setState(claim, state) {
      const kept = claims.find((c) => c.id === claim.id);
      if (!kept) return Promise.resolve({ ok: false, message: GONE });
      return Promise.resolve(save({ ...kept, state }));
    },
    // The demo has no model: it never guesses, and its sample rivals name no real company.
    suggest() {
      return Promise.resolve([]);
    },
  };
}

/** A step of a plan, as the page reports it. */
export type Step = { type: 'saved'; claim: Claim } | { type: 'refused'; message: string };

/** The calls a plan of model.ts makes, in order: each rejection, then the pick, on `product` when
 * given. */
export const callsOf = (port: BusinessPort, kind: ClaimKind, { reject, pick }: { reject: Claim[]; pick: string | null }, product?: string): Array<() => Promise<Saved>> => [
  ...reject.map((claim) => () => port.setState(claim, 'rejected')),
  ...(pick === null ? [] : [() => port.pick(kind, pick, product)]),
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
