import { isAddition } from './check';
import { byOrder, sentence, BLANK, type Claim, type ClaimReceipt, type SentencePart } from './model';

// The draft on Settings › Business as pure data (PRD 774 s3). "What we found" lists the proposed claims
// a draft read (source `evidence`), each with its receipts; a replacement of a confirmed claim, and an
// addition beside confirmed claims of its kind, are the weekly recheck's (./check.ts, s4) and are not
// listed here. While they wait, the title reads "We think you sell …"
// with them in it, less the rows marked ✗. That's us confirms every found row not marked ✗ and rejects
// the marked ones (claims_confirm_proposed() in the database). The reveal's state says what the page
// shows: the scan while a draft runs, the reveal, thin evidence (one row), nothing found, nothing new,
// the saved line after That's us, or why the draft failed.

/** A public.business_drafts row as the page reads it (src/business/draft/run.ts DraftRow). */
export interface DraftView {
  id: string;
  kind: 'draft' | 'recheck';
  state: 'running' | 'done' | 'failed';
  counts: Partial<Record<'readmes' | 'docs' | 'prds' | 'pages' | 'kept' | 'added' | 'seen', number>>;
  scanned: Array<{ source: string; state: 'read' | 'skipped'; why?: string }>;
  reason: string | null;
}

/** A web page pasted on the business (public.business_sources). */
export interface WebPage {
  id: string;
  url: string;
}

/** The most web pages a business keeps (decision 3). */
export const MAX_PAGES = 3;

/** ✓ Right or ✗ Wrong on a found row, before That's us saves anything. */
export type Mark = 'right' | 'wrong';
export type Marks = Readonly<Record<string, Mark>>;

/** A proposed Never line (PRD 839) is not a found row: it waits in the Never lines list, with its receipt,
 * and That's us leaves it as it is. */
export const isFound = (claim: Claim) => claim.state === 'proposed' && claim.source === 'evidence' && !claim.replaces && claim.kind !== 'never';

/** The rows of "What we found", in the sentence's order. An addition beside confirmed claims of its
 * kind is not one: it waits on top of the page with the recheck's other rows (./check.ts, s4). */
export const foundRows = (claims: readonly Claim[]) => claims.filter((c) => isFound(c) && !isAddition(c, claims)).sort(byOrder);

/** The claims as the title reads them while the finds wait: each found row not marked ✗ counts. */
const thought = (claims: readonly Claim[], marks: Marks) =>
  claims.map((c) => (isFound(c) && marks[c.id] !== 'wrong' ? { ...c, state: 'confirmed' as const } : c));

const THINK = 'We think you sell ';

export const thinkSentence = (claims: readonly Claim[], marks: Marks): SentencePart[] => sentence(thought(claims, marks), THINK);

export const thinkText = (claims: readonly Claim[], marks: Marks) =>
  thinkSentence(claims, marks).map((p) => ('text' in p ? p.text : p.filled ?? BLANK)).join('');

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 READMEs · 14 PRDs · 1 web page": what the draft read, by kind. */
export function sourcesUsed(counts: DraftView['counts']): string {
  const parts = [
    [counts.readmes ?? 0, 'README', 'READMEs'],
    [counts.docs ?? 0, 'doc', 'docs'],
    [counts.prds ?? 0, 'PRD', 'PRDs'],
    [counts.pages ?? 0, 'web page', 'web pages'],
  ] as const;
  const said = parts.filter(([n]) => n > 0).map(([n, one, many]) => counted(n, one, many));
  return said.length === 0 ? 'nothing' : said.join(' · ');
}

/** One source of the scan: `✓ vertuo-app · README.md`, `– example.com/about · skipped (why)`. */
export const scanLine = (s: DraftView['scanned'][number]) =>
  s.state === 'read' ? `✓ ${s.source}` : `– ${s.source} · skipped${s.why ? ` (${s.why})` : ''}`;

/** Where a receipt chip says a quote is: a file without its owner, a web page without https://. */
export const receiptLabel = (r: ClaimReceipt) =>
  r.kind === 'link' ? r.where.replace(/^https:\/\//i, '').replace(/\/$/, '') : r.where.split('/').slice(1).join('/') || r.where;

/** That's us: the found rows marked ✗ are rejected, every other found row confirmed. */
export function thatsUs(claims: readonly Claim[], marks: Marks): { rejected: string[]; claims: Claim[] } {
  const rejected = claims.filter((c) => isFound(c) && marks[c.id] === 'wrong').map((c) => c.id);
  return {
    rejected,
    claims: claims.map((c) => (isFound(c) ? { ...c, state: marks[c.id] === 'wrong' ? 'rejected' as const : 'confirmed' as const } : c)),
  };
}

/** How many more web pages may be pasted. */
export const pagesLeft = (pages: readonly WebPage[]) => Math.max(0, MAX_PAGES - pages.length);

export type Reveal =
  | { kind: 'none' }
  | { kind: 'scan' }
  | { kind: 'reveal'; found: number }
  | { kind: 'thin'; found: number }
  | { kind: 'nothing' }
  | { kind: 'known' }
  | { kind: 'saved' }
  | { kind: 'failed'; reason: string };

export interface RevealInput {
  claims: readonly Claim[];
  /** The business's latest draft, or null when none ever ran. */
  draft: DraftView | null;
  /** The page watched this draft run (or started it): only then does it say what it found or failed. */
  watched: boolean;
  /** That's us was pressed. */
  saved: boolean;
}

/** Which of the reveal's states the page shows. Found rows show on any visit; the lines that say
 * nothing was found, or why a draft failed, only after a draft the page watched. */
export function revealOf({ claims, draft, watched, saved }: RevealInput): Reveal {
  if (draft?.state === 'running') return { kind: 'scan' };
  const found = foundRows(claims).length;
  if (saved && found === 0) return { kind: 'saved' };
  if (found >= 2) return { kind: 'reveal', found };
  if (found === 1) return { kind: 'thin', found };
  if (!watched || !draft) return { kind: 'none' };
  if (draft.state === 'failed') return { kind: 'failed', reason: draft.reason ?? 'The draft stopped.' };
  return (draft.counts.kept ?? 0) > 0 ? { kind: 'known' } : { kind: 'nothing' };
}
