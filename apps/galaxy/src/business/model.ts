// Settings → Business as pure data (PRD 748 s2). A row of public.claims
// (supabase/migrations/20261019090000_business_store.sql) as the page draws it, with how often agents
// cited it; the short generic pick lists (decision 11: they live here, not in the database, and name
// no company); the sentence the confirmed claims write; what a pick changes; and the page's state
// through its actions.
//
// Offering, trade and size take one value: picking another rejects the one confirmed before, since no
// function replaces a claim (claim_pick() adds or confirms, claim_set_state() rejects). Region and rival
// take several, each tapped on and off.

export type ClaimKind = 'region' | 'offering' | 'size' | 'trade' | 'rival';
export type ClaimState = 'proposed' | 'confirmed' | 'rejected' | 'contradicted' | 'unknown';
export type ClaimSource = 'pick' | 'suggestion' | 'evidence' | 'answer';

export interface Claim {
  /** The claim's row id (a uuid). */
  id: string;
  /** Counted over every claim of the business: the display id is `<kind>#<seq>`. */
  seq: number;
  kind: ClaimKind;
  value: string;
  source: ClaimSource;
  state: ClaimState;
  /** The product it belongs to (PRD 748 s4); null for a region, which is the business's. Left out, it
   * counts as the first product's. */
  product?: string | null;
  /** How many times agents cited it. */
  cited: number;
  /** Who cited it last, with the run (`think-big concept #9`), or null when nobody has. */
  lastBy: string | null;
}

/** A public.claims row, as PostgREST answers it. */
export interface StoredClaim {
  id: string;
  seq: number;
  kind: string;
  value: string;
  source: string;
  state: string;
  product_id?: string | null;
}

/** A public.claim_citations row, as PostgREST answers it. */
export interface StoredCitation {
  claim_id: string;
  cited_by: string;
  ref: string | null;
  cited_at: string;
}

export const claimOf = (row: StoredClaim, citations: readonly StoredCitation[] = []): Claim => {
  const mine = citations.filter((c) => c.claim_id === row.id).sort((a, b) => Date.parse(a.cited_at) - Date.parse(b.cited_at));
  const last = mine.at(-1);
  return {
    id: row.id,
    seq: row.seq,
    kind: row.kind as ClaimKind,
    value: row.value,
    source: row.source as ClaimSource,
    state: row.state as ClaimState,
    product: row.product_id ?? null,
    cited: mine.length,
    lastBy: last ? [last.cited_by, last.ref].filter(Boolean).join(' ') : null,
  };
};

export const displayId = (claim: Pick<Claim, 'kind' | 'seq'>) => `${claim.kind}#${claim.seq}`;

// ── The pick lists (decision 11) ─────────────────────────────────────────────────

export const OFFERINGS: readonly string[] = ['ERP', 'CRM', 'marketplace', 'developer tool', 'analytics', 'e-commerce'];
export const TRADES: readonly string[] = ['construction', 'retail', 'healthcare', 'finance', 'logistics', 'manufacturing', 'software'];
export const REGIONS: readonly string[] = ['Belgium', 'France', 'Netherlands', 'Germany', 'United Kingdom', 'Europe', 'North America', 'Worldwide'];
/** The size slider's stops (decision 10); a size is stored as `<min>-<max>` of them. */
export const SIZE_STOPS: readonly string[] = ['1', '2', '5', '10', '20', '50', '100', '250', '500', '1000+'];
/** Where the slider sits before a size is picked: 2 to 50. */
const DEFAULT_SIZE: readonly [number, number] = [1, 5];

/** The kinds that hold one value; the others hold several. */
const SINGLE: ReadonlySet<ClaimKind> = new Set(['offering', 'size', 'trade']);
export const KIND_ORDER: readonly ClaimKind[] = ['offering', 'size', 'trade', 'region', 'rival'];

export const KIND_LABEL: Record<ClaimKind, string> = {
  offering: 'Offering', size: 'Size', trade: 'Trade', region: 'Region', rival: 'Rival',
};

export const SOURCE_LABEL: Record<ClaimSource, string> = {
  pick: 'you picked', suggestion: 'suggested', evidence: 'seen', answer: 'answered',
};

/** A list value as a chip says it: its first letter up. */
export const chipLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A size's two stops, or null when the value is not `<min>-<max>` of them. */
export function sizeStops(value: string): [number, number] | null {
  const cut = value.indexOf('-');
  if (cut < 0) return null;
  const lo = SIZE_STOPS.indexOf(value.slice(0, cut));
  const hi = SIZE_STOPS.indexOf(value.slice(cut + 1));
  return lo < 0 || hi < 0 || lo > hi ? null : [lo, hi];
}

export const sizeValue = ([lo, hi]: readonly [number, number]) => `${SIZE_STOPS[lo]}-${SIZE_STOPS[hi]}`;

/** A size as a person reads it: `2–50`. */
export const sizeLabel = (value: string) => value.replace('-', '–');

/** A claim's value as its row says it. */
export const valueLabel = (claim: Pick<Claim, 'kind' | 'value'>) =>
  claim.kind === 'size' ? `${sizeLabel(claim.value)} people` : chipLabel(claim.value);

/** How often agents cited the claim, and who last. */
export const citationLine = (claim: Pick<Claim, 'cited' | 'lastBy'>) =>
  claim.cited === 0 ? 'not cited yet' : `cited ${claim.cited}× · last by ${claim.lastBy}`;

// ── The sentence ─────────────────────────────────────────────────────────────────

const byOrder = (a: Claim, b: Claim) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.seq - b.seq;

/** The confirmed claims, in the sentence's order. */
export const confirmed = (claims: readonly Claim[]) => claims.filter((c) => c.state === 'confirmed').sort(byOrder);

const confirmedOf = (claims: readonly Claim[], kind: ClaimKind) => confirmed(claims).filter((c) => c.kind === kind);

/** `a`, `a and b`, `a, b and c`. */
function listed(values: readonly string[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

const article = (value: string) => (/^[aeiou]/i.test(value) ? 'an' : 'a');

/** One piece of the sentence: words, or a blank (`filled: null`) or what fills it. */
export type SentencePart = { text: string } | { blank: ClaimKind; filled: string | null };

/** The page's title: "We sell ___ to ___-person ___ in ___, up against ___.", each blank filled by the
 * confirmed claims of its kind. A proposed or rejected claim never shows in it. */
export function sentence(claims: readonly Claim[]): SentencePart[] {
  const values = (kind: ClaimKind) => confirmedOf(claims, kind).map((c) => c.value);
  const fill = (kind: ClaimKind, say: (vs: string[]) => string): SentencePart => {
    const vs = values(kind);
    return { blank: kind, filled: vs.length === 0 ? null : say(vs) };
  };
  return [
    { text: 'We sell ' },
    fill('offering', (vs) => `${article(vs[0])} ${listed(vs)}`),
    { text: ' to ' },
    fill('size', (vs) => sizeLabel(vs[0])),
    { text: '-person ' },
    fill('trade', (vs) => `${listed(vs)} firms`),
    { text: ' in ' },
    fill('region', listed),
    { text: ', up against ' },
    fill('rival', listed),
    { text: '.' },
  ];
}

export const BLANK = '___';

/** The sentence as one line of text. */
export const sentenceText = (claims: readonly Claim[]) =>
  sentence(claims).map((p) => ('text' in p ? p.text : p.filled ?? BLANK)).join('');

// ── What a pick changes ──────────────────────────────────────────────────────────

/** What the page asks the store, in order: reject these claims, then pick this value (or nothing). */
export interface Plan {
  reject: Claim[];
  pick: string | null;
}

/** Picking `value` of `kind`: for a kind that holds one value, the confirmed claim of another value is
 * rejected first. Picking what is already confirmed changes nothing. */
export function planPick(claims: readonly Claim[], kind: ClaimKind, value: string): Plan {
  const now = confirmedOf(claims, kind);
  if (now.some((c) => same(c.value, value))) return { reject: [], pick: null };
  return { reject: SINGLE.has(kind) ? now : [], pick: value.trim() };
}

/** Tapping a chip: on when it is off (planPick), off when it is on (its claim rejected). */
export function planTap(claims: readonly Claim[], kind: ClaimKind, value: string): Plan {
  const on = confirmedOf(claims, kind).find((c) => same(c.value, value));
  return on ? { reject: [on], pick: null } : planPick(claims, kind, value);
}

/** ✓ on a row: the claims of its kind that must be rejected first, so a kind that holds one value keeps
 * one. */
export const planConfirm = (claims: readonly Claim[], claim: Claim): Claim[] =>
  SINGLE.has(claim.kind) ? confirmedOf(claims, claim.kind).filter((c) => c.id !== claim.id) : [];

/** Whether a value of the list is picked; for `Other`, the confirmed values the list does not hold. */
export const isPicked = (claims: readonly Claim[], kind: ClaimKind, value: string) =>
  confirmedOf(claims, kind).some((c) => same(c.value, value));

export const othersOf = (claims: readonly Claim[], kind: ClaimKind, list: readonly string[]) =>
  confirmedOf(claims, kind).filter((c) => !list.some((v) => same(v, c.value)));

/** Where the size slider sits: the confirmed size, else the default. */
export function sizeOf(claims: readonly Claim[]): { stops: [number, number]; picked: boolean } {
  const size = confirmedOf(claims, 'size')[0];
  const stops = size ? sizeStops(size.value) : null;
  return stops ? { stops, picked: true } : { stops: [...DEFAULT_SIZE] as [number, number], picked: false };
}

// ── Products (PRD 748 s4) ────────────────────────────────────────────────────────

/** A public.products row: what the business sells. The first is made with the business. */
export interface Product {
  id: string;
  name: string;
}

/** Products show only from the second one on: while there is one, the page never mentions them. */
export const hasProducts = (products: readonly Product[]) => products.length >= 2;

/** The claims one product's tab shows: every claim while there is one product; else the business's
 * region, shared by every product, and that product's own claims. A claim that names no product counts
 * as the first product's. */
export function viewClaims(claims: readonly Claim[], products: readonly Product[], current: string | null): Claim[] {
  if (!hasProducts(products)) return [...claims];
  const first = products[0].id;
  return claims.filter((c) => c.kind === 'region' || (c.product ?? first) === current);
}

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
  | { type: 'show-product'; product: string };

export const initialBusinessState = (claims: Claim[], products: Product[] = []): BusinessState => ({
  claims, products, current: products[0]?.id ?? null, adding: false,
  busy: false, refusal: null, skipped: false, typing: null, sizeDraft: null,
});

/** A saved row comes back without its citations: they stay as the page read them. */
function withSaved(claims: Claim[], saved: Claim): Claim[] {
  const kept = claims.find((c) => c.id === saved.id);
  const claim = kept ? { ...saved, cited: kept.cited, lastBy: kept.lastBy } : saved;
  return [...claims.filter((c) => c.id !== claim.id), claim];
}

export function businessReducer(state: BusinessState, action: BusinessAction): BusinessState {
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'saved':
      return { ...state, claims: withSaved(state.claims, action.claim) };
    case 'suggested':
      return { ...state, claims: action.claims.reduce(withSaved, state.claims) };
    case 'done':
      return { ...state, busy: false, typing: null, sizeDraft: null };
    case 'refused':
      return { ...state, busy: false, sizeDraft: null, refusal: action.message };
    case 'skip':
      return { ...state, skipped: true, typing: null, refusal: null };
    case 'unskip':
      return { ...state, skipped: false };
    case 'type':
      return { ...state, typing: action.kind, refusal: null };
    case 'untype':
      return { ...state, typing: null };
    case 'size-draft': {
      const [lo, hi] = action.stops;
      return { ...state, sizeDraft: [Math.min(lo, hi), Math.max(lo, hi)] };
    }
    case 'add-product':
      return { ...state, adding: true, typing: null, refusal: null };
    case 'unadd-product':
      return { ...state, adding: false };
    case 'product-added':
      return {
        ...state,
        products: [...state.products.filter((p) => p.id !== action.product.id), action.product],
        current: action.product.id, adding: false, busy: false, typing: null, sizeDraft: null,
      };
    case 'show-product':
      return { ...state, current: action.product, typing: null, sizeDraft: null, refusal: null };
  }
}
