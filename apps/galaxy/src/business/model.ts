// Settings → Business as pure data (PRD 748 s2). A row of public.claims
// (supabase/migrations/20261019090000_business_store.sql) as the page draws it, with how often agents
// cited it; the short generic pick lists (decision 11: they live here, not in the database, and name
// no company); the sentence the confirmed claims write; what a pick changes; and the page's state
// through its actions (./state.ts).
//
// Offering, trade and size take one value: picking another rejects the one confirmed before, since no
// function replaces a claim (claim_pick() adds or confirms, claim_set_state() rejects). Region and rival
// take several, each tapped on and off.
//
// A Never line (PRD 839, kind `never`) is a line the team never crosses, a product's, typed on the page
// and confirmed at once, or proposed by the draft with its receipt. It is never part of the sentence and
// holds several at once; its value is the line itself, 1 to 200 characters (every other kind 1 to 80).
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';

export type ClaimKind = 'region' | 'offering' | 'size' | 'trade' | 'rival' | 'never';
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
  /** Where evidence quoted it (PRD 774), newest first; none for a pick. */
  receipts?: ClaimReceipt[] | undefined;
  /** The confirmed claim a proposed offering or size would replace (PRD 774), or null. */
  replaces?: string | null;
  /** When a source last quoted it (PRD 774), or when someone said ✓ Still true; left out, never. */
  lastSeen?: string | null;
}

/** One place a draft quoted a claim (PRD 774, decision 8). */
export interface ClaimReceipt {
  kind: 'file' | 'pr' | 'link';
  /** A repository path (`owner/name/path`) or a URL. */
  where: string;
  /** Word for word, at most 300 characters. */
  quote: string;
  seenAt: string;
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
  replaces?: string | null;
  last_seen?: string | null;
}

/** A public.claim_receipts row, as PostgREST answers it (PRD 774). */
export interface StoredReceipt {
  claim_id: string;
  kind: string;
  location: string;
  quote: string;
  seen_at: string;
}

/** A public.claim_citations row, as PostgREST answers it. */
export interface StoredCitation {
  claim_id: string;
  cited_by: string;
  ref: string | null;
  cited_at: string;
}

export const claimOf = (row: StoredClaim, citations: readonly StoredCitation[] = [], receipts: readonly StoredReceipt[] = []): Claim => {
  const mine = citations.filter((c) => c.claim_id === row.id).sort((a, b) => Date.parse(a.cited_at) - Date.parse(b.cited_at));
  const last = mine.at(-1);
  const quoted = receipts
    .filter((r) => r.claim_id === row.id)
    .sort((a, b) => Date.parse(b.seen_at) - Date.parse(a.seen_at))
    .map((r): ClaimReceipt => ({ kind: r.kind as ClaimReceipt['kind'], where: r.location, quote: r.quote, seenAt: r.seen_at })); // ts-allow: the column's check constraint holds only file, pr and link
  return {
    id: row.id,
    seq: row.seq,
    kind: row.kind as ClaimKind, // ts-allow: the column's check constraint holds only ClaimKind's values
    value: row.value,
    source: row.source as ClaimSource, // ts-allow: the column's check constraint holds only ClaimSource's values
    state: row.state as ClaimState, // ts-allow: the column's check constraint holds only ClaimState's values
    product: row.product_id ?? null,
    cited: mine.length,
    lastBy: last ? [last.cited_by, last.ref].filter(Boolean).join(' ') : null,
    // Only a quoted claim, and only a replacement, carry these: a pick reads as it did before PRD 774.
    ...(quoted.length > 0 ? { receipts: quoted } : {}),
    ...(row.replaces ? { replaces: row.replaces } : {}),
    ...(row.last_seen ? { lastSeen: row.last_seen } : {}),
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
export const KIND_ORDER: readonly ClaimKind[] = ['offering', 'size', 'trade', 'region', 'rival', 'never'];

export const KIND_LABEL: Record<ClaimKind, string> = {
  offering: 'Offering', size: 'Size', trade: 'Trade', region: 'Region', rival: 'Rival', never: 'Never',
};

/** The most characters a claim's value holds: a Never line 200, every other kind 80. */
export const maxValue = (kind: ClaimKind) => (kind === 'never' ? 200 : 80);

const SOURCE_LABEL: Record<ClaimSource, string> = {
  pick: 'you picked', suggestion: 'suggested', evidence: 'seen', answer: 'answered',
};

/** Where a claim came from, as its row says it: a typed Never line was written, not picked. */
export const sourceLabel = (claim: Pick<Claim, 'kind' | 'source'>) =>
  claim.kind === 'never' && claim.source === 'pick' ? 'you wrote' : SOURCE_LABEL[claim.source];

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

export const byOrder = (a: Claim, b: Claim) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.seq - b.seq;

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
 * confirmed claims of its kind. A proposed or rejected claim never shows in it. While a draft's finds
 * wait (PRD 774), it opens with `We think you sell ` instead. */
export function sentence(claims: readonly Claim[], lead = 'We sell '): SentencePart[] {
  const values = (kind: ClaimKind) => confirmedOf(claims, kind).map((c) => c.value);
  const fill = (kind: ClaimKind, say: (vs: string[]) => string): SentencePart => {
    const vs = values(kind);
    return { blank: kind, filled: vs.length === 0 ? null : say(vs) };
  };
  return [
    { text: lead },
    fill('offering', (vs) => `${article(at(vs, 0, 'the first offering'))} ${listed(vs)}`),
    { text: ' to ' },
    fill('size', (vs) => sizeLabel(at(vs, 0, 'the size'))),
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
export const sentenceText = (claims: readonly Claim[], lead?: string) =>
  sentence(claims, lead).map((p) => ('text' in p ? p.text : p.filled ?? BLANK)).join('');

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
  return stops ? { stops, picked: true } : { stops: [DEFAULT_SIZE[0], DEFAULT_SIZE[1]], picked: false };
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
  const first = at(products, 0, 'the first product').id;
  return claims.filter((c) => c.kind === 'region' || (c.product ?? first) === current);
}
