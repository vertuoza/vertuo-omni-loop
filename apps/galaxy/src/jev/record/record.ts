import { JEV_DECISIONS } from '../decisions';
import type { JevCallRow } from '../store';

// Each decision's record on Settings › Jev (PRD 812 s4, decision 12): over the last 30 days, how many
// times Jev was called, how often it agreed with today's path, and the last ten disagreements, newest
// first, with both answers and a link to what the call was about.
//
// Every logged call counts as a call. Only a call where Jev answered inside the question (answered or
// under the floor) and today's path gave an answer can agree or disagree: a failure, no key, or an
// answer outside the options compares nothing. Pure: the page reads the rows (../store.ts) and draws
// the result (../settings/JevView.tsx).

export const RECORD_DAYS = 30;
const LAST_DISAGREEMENTS = 10;

/** What a call was about, as the page shows it: a link when the ref is recognised, text otherwise. */
export interface RefLink {
  text: string;
  href: string | null;
}

export interface Disagreement {
  calledAt: string;
  jevAnswer: string;
  oldAnswer: string;
  decidedBy: 'jev' | 'old';
  confidence: number | null;
  ref: RefLink | null;
}

export interface DecisionRecord {
  /** Every logged call in the window. */
  calls: number;
  /** The calls where Jev and today's path both answered. */
  compared: number;
  agreed: number;
  /** agreed / compared, or null when nothing could be compared. */
  agreement: number | null;
  /** The last ten, newest first. */
  disagreements: Disagreement[];
}

export type JevRecords = Record<string, DecisionRecord>;

const DAY = 86_400_000;

/** The start of the window, as an ISO date: 30 days before `now`. */
export const recordSince = (now: Date): string => new Date(now.getTime() - RECORD_DAYS * DAY).toISOString();

const time = (at: string) => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? -Infinity : t;
};

const compares = (c: JevCallRow): c is JevCallRow & { jevAnswer: string; oldAnswer: string } =>
  (c.outcome === 'answered' || c.outcome === 'under-floor') && c.jevAnswer !== null && c.oldAnswer !== null;

export function decisionRecord(rows: readonly JevCallRow[], decision: string, now: Date): DecisionRecord {
  const since = now.getTime() - RECORD_DAYS * DAY;
  const calls = rows.filter((c) => c.decision === decision && time(c.calledAt) >= since);
  const compared = calls.filter(compares);
  const agreed = compared.filter((c) => c.jevAnswer === c.oldAnswer).length;
  const disagreements = compared
    .filter((c) => c.jevAnswer !== c.oldAnswer)
    .sort((a, b) => time(b.calledAt) - time(a.calledAt) || b.id - a.id)
    .slice(0, LAST_DISAGREEMENTS)
    .map((c): Disagreement => ({
      calledAt: c.calledAt, jevAnswer: c.jevAnswer, oldAnswer: c.oldAnswer, decidedBy: c.decidedBy, confidence: c.confidence, ref: refLink(c.ref),
    }));
  return { calls: calls.length, compared: compared.length, agreed, agreement: compared.length ? agreed / compared.length : null, disagreements };
}

/** Every decision's record, in the page's order: a decision with no call has an empty one. */
export function jevRecords(rows: readonly JevCallRow[], now: Date): JevRecords {
  return Object.fromEntries(JEV_DECISIONS.map((d) => [d.name, decisionRecord(rows, d.name, now)]));
}

const ROUND = /^round:([A-Za-z0-9-]{1,64})$/;
const SLUG = '[A-Za-z0-9][A-Za-z0-9._-]{0,99}';
const ISSUE = new RegExp(`^(${SLUG})/(${SLUG})#(\\d{1,9})$`);
const GITHUB = new RegExp(`^https://github\\.com/(${SLUG})/(${SLUG})/(?:issues|pull)/(\\d{1,9})(?:[/?#].*)?$`);

/**
 * What a call was about (`jev_calls.ref`): a round (`round:<id>`) links to its page, an issue or pull
 * request (`owner/repo#n`, or its GitHub address) to GitHub; anything else, an outbox item's id or free
 * text passed to `omni decide --ref`, is shown as text.
 */
export function refLink(ref: string | null): RefLink | null {
  const text = ref?.trim();
  if (!text) return null;
  const round = ROUND.exec(text);
  if (round) return { text: 'the round', href: `/ask/q/${round[1]}` };
  const issue = ISSUE.exec(text);
  if (issue) return { text, href: `https://github.com/${issue[1]}/${issue[2]}/issues/${issue[3]}` };
  const url = GITHUB.exec(text);
  if (url) return { text: `${url[1]}/${url[2]}#${url[3]}`, href: text };
  return { text, href: null };
}
