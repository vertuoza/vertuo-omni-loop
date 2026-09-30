import { SIZE_STOPS, sizeValue, type ClaimKind, type StoredClaim } from '../model';

// The merge of a draft (PRD 774, decision 9), for one verified candidate against the claims the
// business holds. claim_propose_evidence() (supabase/migrations/20261021090000_business_evidence.sql)
// does the same in the database, where it is final; this is the draft's own reading of it, so a
// rejected value costs no call and each outcome is counted:
//
//   the store holds                                  outcome
//   nothing for that value                           added       a proposed claim with its receipts
//   the value, confirmed (or contradicted)           seen        its receipt added or moved; nothing shown
//   the value, proposed                              seen        its receipt added
//   the value, rejected                              rejected    nothing: never proposed again
//   another confirmed value, kind offering or size   replacing   a proposed claim that replaces it
//
// A size is snapped to PRD 748's slider stops before it is compared. Pure.

export type MergeOutcome = 'added' | 'seen' | 'rejected' | 'replacing';

/** What a candidate becomes; `replaces` is the id of the claim it would replace. */
export interface Merge {
  outcome: MergeOutcome;
  replaces: string | null;
}

/** The kinds that hold one value, which a new value replaces rather than joins. */
const REPLACED: ReadonlySet<ClaimKind> = new Set(['offering', 'size']);

const NUMBERS = SIZE_STOPS.map((s) => Number.parseInt(s, 10));

/** The highest stop at or below `n`, as an index. */
const floorStop = (n: number) => NUMBERS.reduce((at, stop, i) => (stop <= n ? i : at), 0);
/** The lowest stop at or above `n`, as an index; past the last, the last (`1000+`). */
const ceilStop = (n: number) => {
  const i = NUMBERS.findIndex((stop) => stop >= n);
  return i < 0 ? NUMBERS.length - 1 : i;
};

/** A size as the slider holds it: `<min>-<max>` of its stops, the low end snapped down and the high end
 * up (`30-60` is `20-100`, `12` is `10-20`, `2000+` is `1000+-1000+`). Null when it names no number. */
export function snapSize(raw: string): string | null {
  const numbers = [...raw.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/\d+/g)].map((m) => Number.parseInt(m[0], 10)).filter((n) => n > 0);
  if (numbers.length === 0 || numbers.length > 2) return null;
  const lo = Math.min(...numbers);
  const hi = Math.max(...numbers);
  return sizeValue([floorStop(lo), numbers.length === 1 && /\+/.test(raw) ? NUMBERS.length - 1 : ceilStop(hi)]);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Where a candidate of `kind` lands: a region on the business (null), any other kind on `product`. */
export const productFor = (kind: ClaimKind, product: string | null) => (kind === 'region' ? null : product);

/** Decision 9 for `value` of `kind` on `product`, given every claim the business holds. `value` is
 * already snapped when it is a size. */
export function mergeOf(held: readonly StoredClaim[], kind: ClaimKind, value: string, product: string | null): Merge {
  const on = productFor(kind, product);
  const ofKind = held.filter((c) => c.kind === kind && (c.product_id ?? null) === on);
  const there = ofKind.find((c) => same(c.value, value));
  if (there) return { outcome: there.state === 'rejected' ? 'rejected' : 'seen', replaces: null };
  if (REPLACED.has(kind)) {
    const old = ofKind.filter((c) => c.state === 'confirmed' || c.state === 'contradicted').sort((a, b) => a.seq - b.seq)[0];
    if (old) return { outcome: 'replacing', replaces: old.id };
  }
  return { outcome: 'added', replaces: null };
}
