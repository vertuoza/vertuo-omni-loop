import { isOneOf } from 'omni-loop/kit/lib/narrow.ts';
import { kindWords, waitedFor } from '../nav/bell';
import { BUSINESS_HREF } from '../waiting/business';
import type { DocumentGroup } from '../waiting/documents';
import type { WaitingApproval, WaitingList, WaitingReview } from '../waiting/waiting';
import type { Inbox, InboxFilter, InboxInput, InboxKind, InboxRow, InboxSection, InboxSectionId, InboxUpdate } from './inbox';

// The Inbox screen's model (PRD omni-loop-22, s5), as pure functions over what the app shell's waiting
// provider already keeps (src/waiting/WaitingProvider.tsx): the page adds no read. Every question it holds
// is one the page can still answer, so its terminal or runner waits on it: each is blocking. The
// workspace's runner jobs waiting for an answer are held as a count, so they are one row, opening
// Runners. The New documents part (one group per PRD) and the Business count are the Updates. A part
// whose last read failed says so in its own section, drawn even when it holds no row, so a failed read
// never reads as nothing waiting (BL-GATE-1).

/** What the Open tab draws from: the provider's parts, as `useWaiting()` gives them. */
export type InboxParts = {
  list: WaitingList;
  approvals: readonly WaitingApproval[];
  reviews: readonly WaitingReview[];
  documents: readonly DocumentGroup[];
  business: number;
  /** How many of the workspace's runner jobs wait for an answer. */
  runners: number;
  unread: { questions: boolean; outbox: boolean; documents: boolean; business: boolean; approvals: boolean; reviews: boolean; runners: boolean };
  unreadPrds: number;
};

const RUNNERS_HREF = '/app/runners';

const runnerTitle = (n: number) => (n === 1 ? '1 runner job waits for an answer' : `${n} runner jobs wait for an answer`);

const documentUpdate = (group: DocumentGroup): InboxUpdate => ({
  id: `docs-${group.dossierId}`, title: `PRD ${group.prd} · ${group.title}`, detail: `New ${kindWords(group.kinds)}`, since: group.newestAt, href: `/prd/${encodeURIComponent(group.dossierId)}`,
});

/** The Inbox's input: the provider's parts, less the updates cleared on this visit (by row key). */
export function inputOf(parts: InboxParts, now: number, cleared: ReadonlySet<string> = new Set()): InboxInput {
  const updates = [
    ...parts.documents.map(documentUpdate),
    ...(parts.business > 0 ? [{ id: 'business', title: 'Business checks', detail: `${parts.business} to check`, since: now, href: BUSINESS_HREF }] : []),
  ].filter((u) => !cleared.has(`update:${u.id}`));
  return {
    questions: parts.list.questions,
    blocking: new Set(parts.list.questions.map((q) => q.id)),
    approvals: parts.approvals,
    outbox: parts.list.outbox,
    reviews: parts.reviews,
    runnerJobs: parts.runners > 0 ? [{ id: 'runners', title: runnerTitle(parts.runners), since: now, href: RUNNERS_HREF }] : [],
    updates,
  };
}

const KINDS = ['question', 'approval', 'outbox', 'review'] as const satisfies readonly InboxKind[];

type Query = Readonly<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The filter a query asks: `?kind=question|approval|outbox|review`, `?from=shared` (Shared with me); else All. */
export function filterOf(query: Query): InboxFilter {
  const kind = first(query.kind);
  return { kind: isOneOf(KINDS, kind) ? kind : 'all', shared: first(query.from) === 'shared' };
}

/** What the header says beside the title. While a counted part could not be read, it never says nothing waits. */
export function countWords(count: number, unreadCounted: boolean): string {
  if (count === 1) return '1 waits on you';
  if (count > 1) return `${count} wait on you`;
  return unreadCounted ? 'Some of what waits on you couldn’t be read' : 'Nothing waits on you';
}

/** A row as it reads: what it is about, what waits, how long, and its badges. */
export type RowWords = { context: string; text: string; age: string; badges: string[] };

const REVIEW_WORDS: Readonly<Record<WaitingReview['kind'], { badge: string; text: string }>> = {
  review: { badge: 'Review', text: 'your review' }, merge: { badge: 'Merge', text: 'merge it' }, law: { badge: 'Law', text: 'a law to approve' },
};

export function rowWords(row: InboxRow, now: number): RowWords {
  switch (row.kind) {
    case 'question': {
      const q = row.item;
      return {
        context: q.sharedBy ? `${q.sessionTitle} · shared by ${q.sharedBy}` : q.sessionTitle,
        text: q.question, age: waitedFor(now - q.askedAt),
        badges: [...(row.blocking ? ['Blocking'] : []), ...(q.sharedBy ? ['Shared'] : [])],
      };
    }
    case 'approval': {
      const a = row.item;
      const tech = a.approvalKind === 'tech';
      return { context: `${a.repo} · PRD ${a.prd}`, text: tech ? `Tech approval · ${a.title}` : `${a.title} waits for your approval`, age: waitedFor(now - a.askedAt), badges: [tech ? 'Tech approval' : 'Approval'] };
    }
    case 'outbox':
      return { context: `PRD ${row.item.prd} · ${row.item.title} · outbox item`, text: row.item.question, age: '', badges: [row.item.rank] };
    case 'review': {
      const r = row.item;
      const words = REVIEW_WORDS[r.kind];
      return { context: `${r.repo} · #${r.pr}`, text: r.prd === null ? `Pull request #${r.pr}: ${words.text}` : `PRD ${r.prd}: ${words.text}`, age: waitedFor(now - r.since), badges: [words.badge] };
    }
    case 'runner':
      return { context: 'Runners', text: row.item.title, age: '', badges: ['Anyone'] };
    case 'update':
      return { context: row.item.title, text: row.item.detail, age: row.item.id === 'business' ? '' : waitedFor(now - row.item.since), badges: ['Update'] };
  }
}

/** The item's own page: where `o` goes, and the row's link. */
export function hrefOf(row: InboxRow): string {
  switch (row.kind) {
    case 'question': return `/ask/q/${encodeURIComponent(row.item.id)}`;
    case 'approval': return `/prd/${encodeURIComponent(row.item.dossierId)}`;
    case 'outbox': return `/prd/${encodeURIComponent(row.item.dossierId)}?tab=outbox`;
    case 'review': return `https://github.com/${row.item.repo}/pull/${row.item.pr}`;
    case 'runner': return row.item.href ?? RUNNERS_HREF;
    case 'update': return row.item.href ?? '/app';
  }
}

const retrying = (what: string) => `${what} couldn’t be read — retrying.`;

/** What each section says when a part it draws from could not be read. */
export function problemsOf(unread: InboxParts['unread'], unreadPrds: number): Partial<Record<InboxSectionId, string>> {
  const problems: Partial<Record<InboxSectionId, string>> = {};
  if (unread.questions) problems.questions = retrying('Questions');
  if (unread.approvals) problems.decisions = retrying('Approvals');
  else if (unread.outbox) problems.decisions = retrying('The outbox');
  else if (unreadPrds > 0) problems.decisions = retrying(unreadPrds === 1 ? '1 PRD’s outbox' : `${unreadPrds} PRDs’ outbox`);
  if (unread.reviews) problems.reviews = retrying('Reviews');
  if (unread.runners) problems.anyone = retrying('Runner jobs');
  if (unread.documents) problems.updates = retrying('New documents');
  else if (unread.business) problems.updates = retrying('Business checks');
  return problems;
}

/** Whether a part the count is made of could not be read. */
export const unreadCounted = (problems: Partial<Record<InboxSectionId, string>>): boolean =>
  problems.questions !== undefined || problems.decisions !== undefined || problems.reviews !== undefined;

const ORDER: readonly InboxSectionId[] = ['questions', 'decisions', 'reviews', 'anyone', 'updates'];
const TITLES: Readonly<Record<InboxSectionId, string>> = { questions: 'Questions', decisions: 'Your decisions', reviews: 'Your reviews', anyone: 'Anyone can answer', updates: 'Updates' };
const COUNTED: Readonly<Record<InboxSectionId, boolean>> = { questions: true, decisions: true, reviews: true, anyone: false, updates: false };

export type DrawnSection = InboxSection & { problem: string | null };

/** The sections drawn: the Inbox's own, and a section whose part failed even with no row, each in its place. */
export function drawnSections(inbox: Inbox, problems: Partial<Record<InboxSectionId, string>>): DrawnSection[] {
  return ORDER.flatMap((id): DrawnSection[] => {
    const section = inbox.sections.find((s) => s.id === id);
    const problem = problems[id] ?? null;
    if (section) return [{ ...section, problem }];
    return problem ? [{ id, title: TITLES[id], counted: COUNTED[id], rows: [], problem }] : [];
  });
}

const isDecision = (row: InboxRow) => row.kind === 'approval' || row.kind === 'outbox';

/** The row open after a read or a send: the open one while it is listed and not sent; else the next of
 * those that followed it in `before` still listed and not sent; else the first question, else the first
 * decision, not sent; else none. */
export function nextOpen(before: readonly string[], inbox: Inbox, open: string | null, sent: ReadonlySet<string>): string | null {
  const live = inbox.rows.filter((r) => !sent.has(r.key));
  const listed = new Set(live.map((r) => r.key));
  if (open !== null && listed.has(open)) return open;
  if (open !== null) {
    const at = before.indexOf(open);
    const next = at < 0 ? undefined : before.slice(at + 1).find((key) => listed.has(key));
    if (next !== undefined) return next;
  }
  return (live.find((r) => r.kind === 'question') ?? live.find(isDecision))?.key ?? null;
}
