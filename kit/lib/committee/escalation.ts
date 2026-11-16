/**
 * **What the committee may never settle** (PRD 2896 s9, spec "6. The committee, at `alone`"), checked by code before
 * any member runs: the committee's judgement only applies to what this list lets through.
 *
 *   - a PRD approved by its phase-0 pull request (its spec does not say `phase0: server`): only a person merges that;
 *   - an item ranked `human-action`;
 *   - a PRD or an item bearing on a locked law, a Legal entry, or a business law judged red;
 *   - an item whose hard-to-revert score is at or above `mandate.hardToRevert` (an unknown score is never under it);
 *   - a migration that drops or rewrites data.
 *
 * Each line that applies is one reason, in the list's order; none means the vote decides ({@link decide}).
 *
 * Pure: the facts are read by the caller (the kit's `omni committee`, the App's supervisor).
 */
import { tally, type CommitteeRole, type Tally, type Verdict } from './vote.ts';

/** What the list reads of a PRD waiting for approval. */
export type ApprovalFacts = {
  kind: 'approve';
  /** Where its phase 0 is approved: `server`, on its page; `pr`, by its phase-0 pull request. */
  phase0: 'server' | 'pr';
  lockedLaws: readonly string[];
  legal: readonly string[];
  redBusinessLaws: readonly string[];
  /** The migrations it carries that drop or rewrite data. */
  dataMigrations: readonly string[];
};

/** What the list reads of a high outbox item (PRD 2896 s10). */
export type AnswerFacts = {
  kind: 'answer';
  rank: string;
  lockedLaws: readonly string[];
  legal: readonly string[];
  redBusinessLaws: readonly string[];
  /** The business laws the item bears on: no verdict judges an item, so the committee cannot tell whether it breaks one. */
  businessLaws?: readonly string[];
  dataMigrations: readonly string[];
  /** Its hard-to-revert score, 0 to 1; null when it has none. */
  hardToRevert: number | null;
  /** `mandate.hardToRevert`. */
  bound: number;
};

export type CommitteeFacts = ApprovalFacts | AnswerFacts;

const listed = (ids: readonly string[]): string => ids.join(', ');

/** The first line of the list: who alone may act on it, a person merging a phase-0 pull request or acting on a human-action item. */
function whoActs(facts: CommitteeFacts): string[] {
  if (facts.kind === 'approve') return facts.phase0 === 'server' ? [] : ['it is approved by its phase-0 pull request, which only a person merges'];
  return facts.rank === 'human-action' ? ['it is a human-action item: only a person can act on it'] : [];
}

/** One reason naming `ids`, in its one-id or its many-ids words; none when `ids` is empty. */
const naming = (ids: readonly string[], one: (id: string) => string, many: (ids: string) => string): string[] =>
  ids.length === 0 ? [] : [ids.length === 1 ? one(listed(ids)) : many(listed(ids))];

/** The laws it bears on: locked laws, Legal entries, business laws judged red, and the business laws an item bears on (s10). */
function lawsOf(facts: CommitteeFacts): string[] {
  return [
    ...naming(facts.lockedLaws, (id) => `it bears on the locked law ${id}: its owner decides`, (ids) => `it bears on the locked laws ${ids}: their owners decide`),
    ...naming(facts.legal, (id) => `it bears on the Legal entry ${id}`, (ids) => `it bears on the Legal entries ${ids}`),
    ...naming(facts.redBusinessLaws, (id) => `its spec breaks the business law ${id}`, (ids) => `its spec breaks the business laws ${ids}`),
    ...naming(
      facts.kind === 'answer' ? (facts.businessLaws ?? []) : [],
      (id) => `it bears on the business law ${id}: a person decides`,
      (ids) => `it bears on the business laws ${ids}: a person decides`,
    ),
  ];
}

/** An item's hard-to-revert score at or above the mission's bound, or unknown. */
function revertOf(facts: CommitteeFacts): string[] {
  if (facts.kind === 'approve') return [];
  if (facts.hardToRevert === null) return ['its hard-to-revert score is unknown'];
  return facts.hardToRevert >= facts.bound ? [`its hard-to-revert score ${String(facts.hardToRevert)} is at or above the mission's bound ${String(facts.bound)}`] : [];
}

/** Each line of the list that applies to `facts`, one reason each, in the list's order. */
export const escalations = (facts: CommitteeFacts): string[] => [
  ...whoActs(facts),
  ...lawsOf(facts),
  ...revertOf(facts),
  ...facts.dataMigrations.map((file) => `the migration ${file} drops or rewrites data`),
];

/** The decision: escalated by rule when the list names anything, the vote being only recorded; else the vote's. */
export function decide(facts: CommitteeFacts, verdicts: readonly Verdict[], author: CommitteeRole | null): Tally {
  const rule = escalations(facts);
  const vote = tally(verdicts, author);
  return rule.length > 0 ? { outcome: 'escalated', why: rule, verdicts: vote.verdicts } : vote;
}

const LEGAL = /\bL-[A-Z][A-Z0-9]*-[1-9][0-9]*\b/g;
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The locked laws (of `locked`) and the Legal entries `text` names, each once, in the order they first appear. */
export function bearsOn(text: string, locked: readonly string[]): { lockedLaws: string[]; legal: string[] } {
  const at = (id: string): number => new RegExp(`(?<![A-Za-z0-9-])${escape(id)}(?![A-Za-z0-9])`).exec(text)?.index ?? -1;
  const lockedLaws = locked.filter((id) => at(id) >= 0).sort((a, b) => at(a) - at(b));
  const legal = [...new Set(text.match(LEGAL) ?? [])];
  return { lockedLaws, legal };
}

const BUSINESS_LAW = /\bBL-[A-Z][A-Z0-9]*-[1-9][0-9]*\b/g;

/** Jev's line an item's decision ends on when the workspace let Jev answer `hardToRevert` (`/omni:do-work`, step 3). */
const JEV = /^Decided by: Jev \(hardToRevert ([01](?:\.\d+)?)\)/m;

/**
 * An item's hard-to-revert score (PRD 2896 s10): Jev's confidence, when Jev decided its `hardToRevert`; null otherwise, and
 * for a confidence out of 0 to 1. An item carries no other score, so an item no Jev scored is unknown, never under a bound.
 */
export function jevScore(text: string): number | null {
  const match = JEV.exec(text);
  const score = match ? Number(match[1]) : Number.NaN;
  return score >= 0 && score <= 1 ? score : null;
}

/**
 * What the list reads of a high outbox item (PRD 2896 s10), from its text: the locked laws (of `locked`), the Legal entries and
 * the business laws its front matter or its words name, Jev's score, and the mission's `bound`. `dataMigrations` are the
 * migrations of its branch that drop or rewrite data, read by the caller.
 */
export function itemFacts({ text, rank, locked, bound, dataMigrations }: { text: string; rank: string; locked: readonly string[]; bound: number; dataMigrations: readonly string[] }): AnswerFacts {
  const named = bearsOn(text, locked);
  return {
    kind: 'answer',
    rank,
    lockedLaws: named.lockedLaws,
    legal: named.legal,
    redBusinessLaws: [],
    businessLaws: [...new Set(text.match(BUSINESS_LAW) ?? [])],
    dataMigrations,
    hardToRevert: jevScore(text),
    bound,
  };
}

const REWRITES: readonly RegExp[] = [
  /\bdrop\s+(?:table|schema|materialized\s+view)\b/,
  /\balter\s+table\b[^;]*?\bdrop\s+(?:column\b|(?!constraint\b|default\b|not\b|trigger\b|policy\b|index\b)[a-z_"][\w"]*\s*(?:,|;|$))/,
  /\btruncate\b/,
  /\bdelete\s+from\b/,
  /\bupdate\s+(?:only\s+)?[\w."]+(?:\s+(?:as\s+)?\w+)?\s+set\b/,
  /\balter\s+column\b[^;]*?\btype\b/,
];

/** Whether a migration's SQL drops or rewrites data: its comments left out, its words read in any case. */
export function rewritesData(sql: string): boolean {
  const code = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
  return REWRITES.some((shape) => shape.test(code));
}
