// The Fixes rows of a product bug record as its page shows them (PRD 2011, s8): one line per fix with its
// repository, pull request and state (`open`, `merged`, `closed, not merged`), `Ships on the last merge.`
// while a row is not merged, and each merge that named the record but matched no row (`unmatched merge
// <repo>#<n>`). A pure function of the rows fix_bug_push() and fix_row_stamp() keep
// (supabase/migrations/20261211090000_fix_rows.sql), read as the signed-in member. The page merges nothing.
import type { FixPageView } from './timeline';

export type BugRowState = 'open' | 'merged' | 'closed';

/** One stored Fixes row. */
export type BugRowRead = { position: number; repository: string; pull: number | null; state: string; changes: string };
/** One stored unmatched merge. */
export type UnmatchedRead = { repository: string; pull: number };

const ROW_WORDS: Readonly<Record<BugRowState, string>> = { open: 'open', merged: 'merged', closed: 'closed, not merged' };
const SHIPS_ON_LAST_MERGE = 'Ships on the last merge.';

export type BugRowView = { position: number; repository: string; pull: number | null; href: string | null; state: BugRowState; words: string; changes: string };

export type BugRowsView = {
  rows: BugRowView[];
  shipped: boolean;
  /** `Ships on the last merge.` while the record is not shipped, else null. */
  ships: string | null;
  unmatched: Array<{ label: string; href: string }>;
  /** The first row not merged that has a pull request: the page's one action. */
  next: { href: string; label: string } | null;
};

const stateOf = (state: string): BugRowState => (state === 'merged' || state === 'closed' ? state : 'open');
const pullHref = (repository: string, pull: number) => `https://github.com/${repository}/pull/${pull}`;

export function bugRowsView(rows: readonly BugRowRead[], unmatched: readonly UnmatchedRead[]): BugRowsView {
  const views = [...rows].sort((a, b) => a.position - b.position).map((row): BugRowView => {
    const state = stateOf(row.state);
    return {
      position: row.position, repository: row.repository, pull: row.pull,
      href: row.pull === null ? null : pullHref(row.repository, row.pull), state, words: ROW_WORDS[state], changes: row.changes,
    };
  });
  const shipped = views.length > 0 && views.every((r) => r.state === 'merged');
  const open = views.find((r) => r.state === 'open' && r.href !== null);
  return {
    rows: views,
    shipped,
    ships: shipped ? null : SHIPS_ON_LAST_MERGE,
    unmatched: unmatched.map((u) => ({ label: `unmatched merge ${u.repository}#${u.pull}`, href: pullHref(u.repository, u.pull) })),
    next: open?.href ? { href: open.href, label: `Open ${open.repository}#${open.pull}` } : null,
  };
}

/** The page view of a product bug: the header's state and the rows the Timeline tab draws. */
export function bugRecordPage(view: BugRowsView): FixPageView {
  return { state: view.shipped ? 'merged' : 'in-review', stateLabel: view.shipped ? 'Shipped' : 'Open', links: [], timeline: [], bugRows: view };
}
