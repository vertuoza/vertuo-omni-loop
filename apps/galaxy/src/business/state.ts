// Settings → Business: the page's state through its actions (PRD 748 s2, PRD 774 s3–s4). Apart from
// ./model.ts so the claim model stays a leaf that ./reveal.ts and ./check.ts read without a cycle.

import { settled, stillTrue } from './check';
import type { Claim, ClaimKind, Product } from './model';
import { thatsUs, type DraftView, type Mark, type Marks, type WebPage } from './reveal';

// ── The page's state ─────────────────────────────────────────────────────────────

export interface BusinessState {
  /** Every claim of the business, of every product. */
  claims: Claim[];
  /** The business's products, first first. */
  products: Product[];
  /** The product whose tab is shown (the first one while there is one), or null with none known. */
  current: string | null;
  /** The "+ Add a product" field is open. */
  adding: boolean;
  /** A call is on its way: every control waits. */
  busy: boolean;
  /** What the last call was refused with, or null. */
  refusal: string | null;
  /** Skip was pressed: the picks are folded away, and nothing was stored. */
  skipped: boolean;
  /** The kind whose Other (or, for a rival, "+ add a rival") field is open, or null. */
  typing: ClaimKind | null;
  /** The size slider while it moves, before it is saved; null when it rests on the stored size. */
  sizeDraft: [number, number] | null;
  // The draft (PRD 774 s3), read in ./reveal.ts.
  /** The business's latest draft, or null when none ever ran. */
  draft: DraftView | null;
  /** The page started or watched that draft: only then does it say what the draft found. */
  watched: boolean;
  /** The web pages pasted on the business. */
  pages: WebPage[];
  /** The "+ add a web page" field is open. */
  addingPage: boolean;
  /** ✓ / ✗ on the found rows, kept in the page until That's us. */
  marks: Marks;
  /** That's us was pressed: the found rows are saved. */
  saved: boolean;
}

export type BusinessAction =
  | { type: 'busy' }
  | { type: 'saved'; claim: Claim }
  /** Rivals the small model guessed (PRD 748 s3), stored as proposed claims. */
  | { type: 'suggested'; claims: Claim[] }
  | { type: 'done' }
  | { type: 'refused'; message: string }
  | { type: 'skip' }
  | { type: 'unskip' }
  | { type: 'type'; kind: ClaimKind }
  | { type: 'untype' }
  | { type: 'size-draft'; stops: [number, number] }
  | { type: 'add-product' }
  | { type: 'unadd-product' }
  /** A product was added: its tab is shown. */
  | { type: 'product-added'; product: Product }
  | { type: 'show-product'; product: string }
  /** A draft started, or its row read again while it runs (PRD 774 s3). */
  | { type: 'draft'; draft: DraftView }
  /** A draft ended: its last row, and every claim read again. */
  | { type: 'drafted'; draft: DraftView; claims: Claim[] }
  | { type: 'mark'; claim: string; mark: Mark }
  /** That's us was saved. */
  | { type: 'thats-us' }
  | { type: 'add-page' }
  | { type: 'unadd-page' }
  | { type: 'page-added'; page: WebPage }
  | { type: 'page-removed'; page: string }
  /** ✓ or ✗ on a row the recheck left (PRD 774 s4) was saved: the claim as saved. */
  | { type: 'settled'; claim: Claim }
  /** ✓ Still true on a faded claim was saved `at`. */
  | { type: 'still-true'; claim: string; at: string };

export const initialBusinessState = (
  claims: Claim[],
  products: Product[] = [],
  { draft = null, pages = [] }: { draft?: DraftView | null; pages?: WebPage[] } = {},
): BusinessState => ({
  claims, products, current: products[0]?.id ?? null, adding: false,
  busy: false, refusal: null, skipped: false, typing: null, sizeDraft: null,
  draft, watched: false, pages, addingPage: false, marks: {}, saved: false,
});

/** A saved row comes back without its citations: they stay as the page read them. */
function withSaved(claims: Claim[], saved: Claim): Claim[] {
  const kept = claims.find((c) => c.id === saved.id);
  const claim = kept ? { ...saved, cited: kept.cited, lastBy: kept.lastBy } : saved;
  return [...claims.filter((c) => c.id !== claim.id), claim];
}

/** A draft ended: its claims read again keep their citations as the page read them. */
function drafted(state: BusinessState, draft: DraftView, claims: Claim[]): BusinessState {
  const kept = new Map(state.claims.map((c) => [c.id, c]));
  const fresh = claims.map((c) => {
    const was = kept.get(c.id);
    return was ? { ...c, cited: was.cited, lastBy: was.lastBy } : c;
  });
  return { ...state, draft, watched: true, claims: fresh, marks: {}, saved: false };
}

/** ✓ or ✗ on a found row; the same mark again takes it off. */
function marked(state: BusinessState, claim: string, mark: Mark): BusinessState {
  const { [claim]: was, ...rest } = state.marks;
  return { ...state, marks: was === mark ? rest : { ...rest, [claim]: mark } };
}

type Handlers = { [T in BusinessAction['type']]: (state: BusinessState, action: Extract<BusinessAction, { type: T }>) => BusinessState };

/** One handler per action: what it changes of the page's state. */
const HANDLERS: Handlers = {
  'busy': (state) => ({ ...state, busy: true, refusal: null }),
  'saved': (state, action) => ({ ...state, claims: withSaved(state.claims, action.claim) }),
  'suggested': (state, action) => ({ ...state, claims: action.claims.reduce(withSaved, state.claims) }),
  'done': (state) => ({ ...state, busy: false, typing: null, sizeDraft: null }),
  'refused': (state, action) => ({ ...state, busy: false, sizeDraft: null, refusal: action.message }),
  'skip': (state) => ({ ...state, skipped: true, typing: null, refusal: null }),
  'unskip': (state) => ({ ...state, skipped: false }),
  'type': (state, action) => ({ ...state, typing: action.kind, refusal: null }),
  'untype': (state) => ({ ...state, typing: null }),
  'size-draft': (state, { stops: [lo, hi] }) => ({ ...state, sizeDraft: [Math.min(lo, hi), Math.max(lo, hi)] }),
  'add-product': (state) => ({ ...state, adding: true, typing: null, refusal: null }),
  'unadd-product': (state) => ({ ...state, adding: false }),
  'product-added': (state, action) => ({
    ...state,
    products: [...state.products.filter((p) => p.id !== action.product.id), action.product],
    current: action.product.id, adding: false, busy: false, typing: null, sizeDraft: null,
  }),
  'show-product': (state, action) => ({ ...state, current: action.product, typing: null, sizeDraft: null, refusal: null }),
  'draft': (state, action) => ({ ...state, draft: action.draft, watched: true, saved: false }),
  'drafted': (state, action) => drafted(state, action.draft, action.claims),
  'mark': (state, action) => marked(state, action.claim, action.mark),
  'thats-us': (state) => ({ ...state, claims: thatsUs(state.claims, state.marks).claims, marks: {}, saved: true, busy: false }),
  'add-page': (state) => ({ ...state, addingPage: true, refusal: null }),
  'unadd-page': (state) => ({ ...state, addingPage: false }),
  'page-added': (state, action) => ({ ...state, pages: [...state.pages.filter((p) => p.id !== action.page.id), action.page], addingPage: false, busy: false }),
  'page-removed': (state, action) => ({ ...state, pages: state.pages.filter((p) => p.id !== action.page), busy: false }),
  'settled': (state, action) => ({ ...state, claims: settled(state.claims, action.claim), busy: false }),
  'still-true': (state, action) => ({ ...state, claims: stillTrue(state.claims, action.claim, action.at), busy: false }),
};

export function businessReducer(state: BusinessState, action: BusinessAction): BusinessState {
  const handle = HANDLERS[action.type] as (state: BusinessState, action: BusinessAction) => BusinessState;
  return handle(state, action);
}
