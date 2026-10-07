import { claimOf, type StoredClaim } from './model';
import { refuse, reply } from '../business-api/reply';
import { suggestInput, type Suggester } from './suggest';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// POST /api/business/suggest-rivals {workspace, product} → 200 {claims} (PRD 748 s3), as a plain
// function of a Request so app/api/business/suggest-rivals/route.ts stays one line. Settings › Business
// calls it once offering, trade and region are picked. As the signed-in person (row-level security and
// the claim functions decide what is read and stored), it reads the business's region and the product's
// claims, asks the small model for rivals (src/business/suggest.ts), and stores each new name through
// claim_pick() with source `suggestion`, which makes it `proposed`. It answers the proposed rows it
// stored. A name the business already holds, in any state, is never answered, so a rejected rival does
// not come back. No model key, too few picks or a failed model call answer no claim: never an error,
// since the page then shows no guess and "+ add a rival" is unchanged.
//
// Refusals, each `{error}` in plain words: 400 a malformed body, 401 signed out, 403 not a member of the
// workspace, 404 no business or product there, 500 the database failed.

/** A store call that failed, with the database's code. */
export class SuggestStoreError extends Error {
  readonly code: string | undefined;
  constructor(what: string, code: string | undefined, message: string) {
    super(`Could not ${what}: ${message}`);
    this.code = code;
  }
}

export interface SuggestStore {
  /** The claims of the business's region and of the product. */
  claims(workspace: string, product: string): Promise<StoredClaim[]>;
  /** claim_pick() of a rival with source `suggestion`: the row it made, or the one already there. */
  propose(workspace: string, product: string, name: string): Promise<StoredClaim>;
}

export type SuggestDeps = {
  /** The store as the signed-in person, or null when nobody is signed in (or no database). */
  store: () => Promise<SuggestStore | null>;
  /** The small model, or null when OPENROUTER_API_KEY is unset. */
  suggest: Suggester | null;
};

const NOTHING: { claims: StoredClaim[] } = { claims: [] };

const id = (value: unknown) => (typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null);

function refusal(error: unknown): Response {
  const code = error instanceof SuggestStoreError ? error.code : undefined;
  if (code === '42501') return refuse(403, 'Only a member of the workspace can change its business.');
  if (code === 'P0002') return refuse(404, 'This workspace has no such business or product.');
  console.error(`business: rival suggestions failed (${error instanceof Error ? error.message : String(error)})`);
  return refuse(500, 'The business database could not answer. Try again.');
}

type Target = { ws: string; product: string };
const NOT_JSON = Symbol('not JSON');

/** The workspace and product a body names, or the Response that refuses it. */
async function targetOf(request: Request): Promise<Target | Response> {
  const sent: unknown = await request.json().catch(() => NOT_JSON);
  if (sent === NOT_JSON) return refuse(400, 'The body must be a JSON object.');
  const ws = id(propertyOf(sent, 'workspace'));
  const product = id(propertyOf(sent, 'product'));
  if (!ws || !product) return refuse(400, '`workspace` and `product` must be the ids the page shows.');
  return { ws, product };
}

/** The model's rival names not already held, or null when there is nothing to ask or it failed. */
async function freshNames(store: SuggestStore, suggest: Suggester, { ws, product }: Target): Promise<string[] | null> {
  const stored = (await store.claims(ws, product)).filter((c) => c.product_id == null || c.product_id === product);
  const input = suggestInput(stored.map((c) => claimOf(c)));
  if (!input) return null;
  const names = await suggest(input);
  if (!names) return null;
  const held = new Set(input.exclude.map((v) => v.trim().toLowerCase()));
  return names.filter((name) => !held.has(name.trim().toLowerCase()));
}

/** Stores one name as a proposed rival: the row when it is proposed, else null. One name the database
 * finds invalid is dropped; a refusal of the caller stops the call. */
async function proposed(store: SuggestStore, { ws, product }: Target, name: string): Promise<StoredClaim | null> {
  try {
    const saved = await store.propose(ws, product, name);
    return saved.state === 'proposed' ? saved : null;
  } catch (error) {
    if (error instanceof SuggestStoreError && error.code === '22023') return null;
    throw error;
  }
}

async function suggestAndStore(store: SuggestStore, suggest: Suggester, target: Target): Promise<Response> {
  const names = await freshNames(store, suggest, target);
  const claims: StoredClaim[] = [];
  for (const name of names ?? []) {
    const saved = await proposed(store, target, name);
    if (saved) claims.push(saved);
  }
  return reply(200, { claims });
}

export async function suggestRivalsRoute(request: Request, deps: SuggestDeps): Promise<Response> {
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const target = await targetOf(request);
  if (target instanceof Response) return target;
  if (!deps.suggest) return reply(200, NOTHING);
  return suggestAndStore(store, deps.suggest, target).catch(refusal);
}
