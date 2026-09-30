import { KIND_LABEL, valueLabel, type Claim } from './model';

// What the weekly recheck leaves to check on Settings › Business (PRD 774 s4), as pure data. Each sits on
// top of the page until someone answers it:
//
//   addition     a proposed evidence value of a kind that holds several (region, trade, rival), beside
//                the confirmed ones of its kind: "Region: Belgium → Belgium + France". ✓ confirms it,
//                ✗ rejects it. A first value of a kind is not an addition: it is a found row (./reveal.ts).
//                A proposed Never line (PRD 839) is never one: it waits in the Never lines list.
//   replacement  a proposed offering or size that `replaces` a confirmed one, now contradicted:
//                "~~ERP~~ → CRM". ✓ confirms the new and rejects the old; ✗ the reverse
//                (claim_set_state() settles it in the database).
//   answer       a proposed claim a person gave as an answer in a skill run (PRD 822, an overrule saved as
//                a claim, source `answer`): "Size: 20 – 50 · answered in a run". ✓ confirms it, ✗ rejects it.
//   faded        a confirmed claim with receipts that no source has quoted for eight weeks (decision 13):
//                dimmed, "not seen since 12 Aug". ✓ Still true sets its last_seen to now; ✗ Wrong rejects
//                it. A claim with no receipt (a pick) never fades.

/** Eight weeks: how long a quoted claim may go unquoted before it fades. */
export const FADE_MS = 8 * 7 * 24 * 3600_000;

/** The kinds a new value replaces rather than joins (src/business/draft/merge.ts). */
const REPLACED: ReadonlySet<Claim['kind']> = new Set(['offering', 'size']);

const sameProduct = (a: Claim, b: Claim) => (a.product ?? null) === (b.product ?? null);
const waiting = (c: Claim) => c.state === 'proposed' && c.source === 'evidence';

/** A proposed claim a person answered in a skill run (PRD 822): it waits for a member to confirm it. */
const isAnswerToCheck = (c: Claim) => c.state === 'proposed' && c.source === 'answer';

/** The confirmed claims an addition would join; none when `claim` is not an addition. */
function joined(claim: Claim, claims: readonly Claim[]): Claim[] {
  if (!waiting(claim) || claim.replaces || REPLACED.has(claim.kind) || claim.kind === 'never') return [];
  return claims.filter((c) => c.state === 'confirmed' && c.kind === claim.kind && sameProduct(c, claim)).sort((a, b) => a.seq - b.seq);
}

/** Whether `claim` is an addition beside the confirmed claims of its kind. */
export const isAddition = (claim: Claim, claims: readonly Claim[]) => joined(claim, claims).length > 0;

/** When a source last quoted the claim: the newer of its last_seen and its newest receipt; null unquoted. */
export function lastSeenOf(claim: Claim): string | null {
  const times = [claim.lastSeen, ...(claim.receipts ?? []).map((r) => r.seenAt)].filter((t): t is string => typeof t === 'string' && !Number.isNaN(Date.parse(t)));
  if (times.length === 0) return null;
  return times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
}

/** A confirmed claim with receipts that no source quoted for eight weeks. */
export function isFaded(claim: Claim, now: number): boolean {
  if (claim.state !== 'confirmed' || (claim.receipts ?? []).length === 0) return false;
  const seen = lastSeenOf(claim);
  return seen !== null && now - Date.parse(seen) > FADE_MS;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "not seen since 12 Aug", in UTC. */
export function seenSince(at: string): string {
  const d = new Date(at);
  return `not seen since ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export type CheckRow =
  | { kind: 'replacement'; claim: Claim; old: Claim }
  | { kind: 'addition'; claim: Claim; before: Claim[] }
  | { kind: 'answer'; claim: Claim }
  | { kind: 'faded'; claim: Claim; since: string };

/** Everything to check, in order: replacements, additions, answers, then faded claims, each by its id. */
export function checkRows(claims: readonly Claim[], now: number): CheckRow[] {
  const bySeq = [...claims].sort((a, b) => a.seq - b.seq);
  const replacements: CheckRow[] = bySeq.flatMap((c) => {
    if (!waiting(c) || !c.replaces) return [];
    const old = claims.find((o) => o.id === c.replaces);
    return old ? [{ kind: 'replacement' as const, claim: c, old }] : [];
  });
  const additions: CheckRow[] = bySeq.flatMap((c) => {
    const before = joined(c, claims);
    return before.length > 0 ? [{ kind: 'addition' as const, claim: c, before }] : [];
  });
  const answers: CheckRow[] = bySeq.flatMap((c) => (isAnswerToCheck(c) ? [{ kind: 'answer' as const, claim: c }] : []));
  const faded: CheckRow[] = bySeq.flatMap((c) => (isFaded(c, now) ? [{ kind: 'faded' as const, claim: c, since: lastSeenOf(c) as string }] : []));
  return [...replacements, ...additions, ...answers, ...faded];
}

/** The ids of the claims the rows to check hold, the old side of a replacement included. */
export const checkIds = (rows: readonly CheckRow[]): Set<string> =>
  new Set(rows.flatMap((r) => (r.kind === 'replacement' ? [r.claim.id, r.old.id] : [r.claim.id])));

/** An addition as its row says it: `Region`, `Belgium`, `Belgium + France`. */
export function additionText(row: Extract<CheckRow, { kind: 'addition' }>): { label: string; from: string; to: string } {
  const from = row.before.map(valueLabel).join(' + ');
  return { label: KIND_LABEL[row.claim.kind], from, to: `${from} + ${valueLabel(row.claim)}` };
}

/** The claims once `saved` (the row ✓ or ✗ answered) is kept; on a replacement, the old claim takes the
 * other side: rejected when the new one is confirmed, confirmed again when it is rejected. The saved row
 * keeps the receipts and citations the page read. */
export function settled(claims: readonly Claim[], saved: Claim): Claim[] {
  const was = claims.find((c) => c.id === saved.id);
  const replaces = saved.replaces ?? was?.replaces ?? null;
  return claims.map((c) => (c.id === saved.id ? keptAsRead(saved, was) : otherSide(c, replaces, saved)));
}

/** The saved row, with the receipts and citations the page read. */
function keptAsRead(saved: Claim, was: Claim | undefined): Claim {
  if (!was) return saved;
  return { ...saved, cited: was.cited ?? saved.cited, lastBy: was.lastBy ?? saved.lastBy, ...(was.receipts ? { receipts: was.receipts } : {}) };
}

/** The old side of an answered replacement takes the other state; any other claim stays as it is. */
function otherSide(c: Claim, replaces: string | null, saved: Claim): Claim {
  if (!replaces || c.id !== replaces || c.state !== 'contradicted') return c;
  if (saved.state === 'confirmed') return { ...c, state: 'rejected' };
  if (saved.state === 'rejected') return { ...c, state: 'confirmed' };
  return c;
}

/** ✓ Still true: the claim was seen `at`, so it no longer fades. */
export const stillTrue = (claims: readonly Claim[], id: string, at: string): Claim[] =>
  claims.map((c) => (c.id === id ? { ...c, lastSeen: at } : c));
