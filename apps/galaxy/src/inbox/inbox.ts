import type { WaitingApproval, WaitingOutbox, WaitingQuestion, WaitingReview } from '../waiting/waiting';

// The Inbox model (PRD omni-loop-22, s2), pure: what waits on the person in, the sections and their rows
// out. Five sections, each present only when it has a row, oldest first inside each: Questions (the
// rounds a terminal or runner waits on right now first), Your decisions (approvals, product before
// tech, then outbox items), Your reviews, Anyone can answer (the workspace's runner jobs) and Updates
// (new documents, Business checks). Questions, decisions and reviews are counted; runner jobs and
// updates are listed and never counted, so the count is the one the menu, the tab title and the phone's
// Inbox button show. It adds no read: the input is the list the app shell's provider already keeps.

/** One runner job waiting for an answer anyone may give. */
export type InboxRunnerJob = { id: string; title: string; since: number; href?: string };

/** One update: a new spec, plan or before/after, or a Business check. */
export type InboxUpdate = { id: string; title: string; detail: string; since: number; href?: string };

/** What the Inbox draws from. */
export type InboxInput = {
  questions: readonly WaitingQuestion[];
  /** The round ids whose terminal or runner waits right now. */
  blocking?: ReadonlySet<string>;
  approvals: readonly WaitingApproval[];
  outbox: readonly WaitingOutbox[];
  reviews: readonly WaitingReview[];
  runnerJobs: readonly InboxRunnerJob[];
  updates: readonly InboxUpdate[];
};

export const EMPTY_INBOX_INPUT: InboxInput = { questions: [], approvals: [], outbox: [], reviews: [], runnerJobs: [], updates: [] };

export type InboxRow =
  | { key: string; kind: 'question'; item: WaitingQuestion; blocking: boolean; counted: true }
  | { key: string; kind: 'approval'; item: WaitingApproval; counted: true }
  | { key: string; kind: 'outbox'; item: WaitingOutbox; counted: true }
  | { key: string; kind: 'review'; item: WaitingReview; counted: true }
  | { key: string; kind: 'runner'; item: InboxRunnerJob; counted: false }
  | { key: string; kind: 'update'; item: InboxUpdate; counted: false };

export type InboxSectionId = 'questions' | 'decisions' | 'reviews' | 'anyone' | 'updates';

export type InboxSection = { id: InboxSectionId; title: string; counted: boolean; rows: InboxRow[] };

/** The kind chips on Open; `shared` is the separate "Shared with me" chip. */
export type InboxKind = 'all' | 'question' | 'approval' | 'outbox' | 'review';

export type InboxFilter = { kind: InboxKind; shared: boolean };

const NO_FILTER: InboxFilter = { kind: 'all', shared: false };

export type Inbox = {
  sections: InboxSection[];
  /** The rows of every section, in the order drawn. */
  rows: InboxRow[];
  /** What the menu, the tab title and the phone's button show: questions, approvals, outbox items, reviews. */
  count: number;
  /** The row open on landing: the first question, else the first decision; null when neither. */
  opening: InboxRow | null;
};

const TITLES: Record<InboxSectionId, string> = {
  questions: 'Questions',
  decisions: 'Your decisions',
  reviews: 'Your reviews',
  anyone: 'Anyone can answer',
  updates: 'Updates',
};

const byTime = <T extends { id: string }>(time: (item: T) => number) => (a: T, b: T): number => time(a) - time(b) || a.id.localeCompare(b.id);

const keyOf = (kind: InboxRow['kind'], id: string): string => `${kind}:${id}`;

function questionRows(input: InboxInput): InboxRow[] {
  const blocking = input.blocking ?? new Set<string>();
  const rows = [...input.questions].sort(byTime((q) => q.askedAt)).map((item): InboxRow => ({ key: keyOf('question', item.id), kind: 'question', item, blocking: blocking.has(item.id), counted: true }));
  return [...rows.filter((r) => r.kind === 'question' && r.blocking), ...rows.filter((r) => r.kind === 'question' && !r.blocking)];
}

function decisionRows(input: InboxInput): InboxRow[] {
  const tech = (a: WaitingApproval) => (a.approvalKind === 'tech' ? 1 : 0);
  const approvals = [...input.approvals]
    .sort((a, b) => tech(a) - tech(b) || a.askedAt - b.askedAt || a.id.localeCompare(b.id))
    .map((item): InboxRow => ({ key: keyOf('approval', item.id), kind: 'approval', item, counted: true }));
  const outbox = input.outbox.map((item): InboxRow => ({ key: keyOf('outbox', item.id), kind: 'outbox', item, counted: true }));
  return [...approvals, ...outbox];
}

function sectionsOf(input: InboxInput, filter: InboxFilter): InboxSection[] {
  const all = filter.kind === 'all' && !filter.shared;
  const questions = questionRows(input).filter((r) => !filter.shared || (r.kind === 'question' && r.item.sharedBy !== null));
  const decisions = decisionRows(input);
  const wants = (kind: InboxKind) => !filter.shared && (filter.kind === 'all' || filter.kind === kind);
  const parts: InboxSection[] = [
    { id: 'questions', title: TITLES.questions, counted: true, rows: filter.kind === 'all' || filter.kind === 'question' ? questions : [] },
    { id: 'decisions', title: TITLES.decisions, counted: true, rows: decisions.filter((r) => wants(r.kind === 'approval' ? 'approval' : 'outbox')) },
    { id: 'reviews', title: TITLES.reviews, counted: true, rows: wants('review') ? [...input.reviews].sort(byTime((r) => r.since)).map((item): InboxRow => ({ key: keyOf('review', item.id), kind: 'review', item, counted: true })) : [] },
    { id: 'anyone', title: TITLES.anyone, counted: false, rows: all ? [...input.runnerJobs].sort(byTime((j) => j.since)).map((item): InboxRow => ({ key: keyOf('runner', item.id), kind: 'runner', item, counted: false })) : [] },
    { id: 'updates', title: TITLES.updates, counted: false, rows: all ? [...input.updates].sort(byTime((u) => u.since)).map((item): InboxRow => ({ key: keyOf('update', item.id), kind: 'update', item, counted: false })) : [] },
  ];
  return parts.filter((s) => s.rows.length > 0);
}

/** The row open on landing: the first question, else the first decision. */
function openingOf(sections: readonly InboxSection[]): InboxRow | null {
  const first = (id: InboxSectionId) => sections.find((s) => s.id === id)?.rows[0] ?? null;
  return first('questions') ?? first('decisions');
}

/** The Inbox for a person: sections and rows under the filter, the count of what waits on them (never
 * under a filter: the badge does not move when a chip is picked), and the opening row. */
export function inboxOf(input: InboxInput, filter: InboxFilter = NO_FILTER): Inbox {
  const sections = sectionsOf(input, filter);
  const rows = sections.flatMap((s) => s.rows);
  return { sections, rows, count: input.questions.length + input.approvals.length + input.outbox.length + input.reviews.length, opening: openingOf(sections) };
}

/** Which row is open after a read. The open row is kept by its key while it is still listed. When it left
 * (answered elsewhere, closed) the next row opens: the first of those that followed it in `before` and
 * are still listed; with none, the opening row. With nothing open yet, the opening row. */
export function openAfter(before: readonly string[], rows: readonly InboxRow[], open: string | null, opening: InboxRow | null): string | null {
  const now = new Set(rows.map((r) => r.key));
  if (open !== null && now.has(open)) return open;
  if (open !== null) {
    const at = before.indexOf(open);
    const next = at < 0 ? undefined : before.slice(at + 1).find((key) => now.has(key));
    if (next !== undefined) return next;
  }
  return opening?.key ?? null;
}
