// A fix's state and its Timeline (PRD 627, s5), as pure functions of what GitHub said of it
// (../dossier/github/fix.ts, cached 60 s) and of the pick line its latest before/after page carries.
//
// The state, as its list row's pill and its page's header read it: Asked while the issue is open and no
// `fix/<n>-…` PR is open or merged, In review while one is open, Merged once it merged; `—` when GitHub
// did not answer. The Timeline lists, in order: Asked (the issue's author and time), Picked X (a visual
// fix only, from the pick line), Approved (one line per approving review), Merged (who and when) and
// Released (the first release published after the merge, linked). A moment not reached reads *not
// yet*; one GitHub could not answer, *unknown*; a before/after page with no pick line, *not recorded*.
import type { FixSummary } from '../dossier/github/fix';
import { UNREAD, type Read } from '../dossier/github/summary';
import { stamp } from '../dossier/page/view';
import type { FixKind } from './list';

/** The pick, as `/omni:visual-fix` writes it in before-after.html: `<p data-omni-pick>Picked C by @login on 2026-09-29</p>`. */
export type Pick = { letter: string; login: string; date: string };

/** The pick line of a fix's latest before/after page: read; `none` (the page has no such line);
 * `no-page` (no before/after version yet); UNREAD (the page could not be read). */
export type PickRead = Pick | 'none' | 'no-page' | typeof UNREAD;

const PICK_LINE = /<p data-omni-pick>Picked ([A-Z]) by @([A-Za-z0-9](?:[A-Za-z0-9-]{0,38})) on (\d{4}-\d{2}-\d{2})<\/p>/;

/** The pick line of a before/after page, in its one fixed shape; `none` for any other shape. */
export function readPickLine(html: string): Pick | 'none' {
  const match = PICK_LINE.exec(html);
  return match ? { letter: match[1], login: match[2], date: match[3] } : 'none';
}

export type FixState = 'asked' | 'in-review' | 'merged';

export const STATE_LABELS: Readonly<Record<FixState | 'unknown', string>> = {
  asked: 'Asked', 'in-review': 'In review', merged: 'Merged', unknown: '—',
};

/** The fix's state; null (`—`) when GitHub did not answer, or the issue is closed with no fix PR. */
export function fixState(fix: FixSummary | null): FixState | null {
  if (fix === null || fix.pull === UNREAD) return null;
  if (fix.pull?.state === 'merged') return 'merged';
  if (fix.pull?.state === 'open') return 'in-review';
  return fix.issue !== UNREAD && fix.issue?.state === 'open' ? 'asked' : null;
}

export type MomentId = 'asked' | 'picked' | 'approved' | 'merged' | 'released';
export type MomentState = 'done' | 'not-yet' | 'unknown' | 'not-recorded';

/** One line of the Timeline: `Picked C`, by `@login`, on `29 Sep 2026`, linked where GitHub has a page. */
export type Moment = { id: MomentId; label: string; state: MomentState; who: string | null; when: string | null; href: string | null };

export const MOMENT_WORDS: Readonly<Record<Exclude<MomentState, 'done'>, string>> = {
  'not-yet': 'not yet', unknown: 'unknown', 'not-recorded': 'not recorded',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-09-29` as `29 Sep 2026`. */
const day = (date: string) => {
  const [year, month, dayOf] = date.split('-').map(Number);
  return `${dayOf} ${MONTHS[month - 1]} ${year}`;
};

const at = (id: MomentId, label: string, state: Exclude<MomentState, 'done'>): Moment => ({ id, label, state, who: null, when: null, href: null });
const done = (id: MomentId, label: string, who: string | null, when: string, href: string | null): Moment =>
  ({ id, label, state: 'done', who: who === null ? null : `@${who}`, when, href });

/** Whether a part was read: UNREAD, or no summary at all, is unknown. */
const known = <T,>(fix: FixSummary | null, part: (f: FixSummary) => Read<T>): T | typeof UNREAD => (fix === null ? UNREAD : part(fix));

function picked(pick: PickRead): Moment {
  if (pick === UNREAD) return at('picked', 'Picked', 'unknown');
  if (pick === 'none') return at('picked', 'Picked', 'not-recorded');
  if (pick === 'no-page') return at('picked', 'Picked', 'not-yet');
  return done('picked', `Picked ${pick.letter}`, pick.login, day(pick.date), null);
}

/** The Timeline of a fix of `kind`, in the spec's order; a bug fix has no Picked moment. */
export function timelineOf(kind: FixKind, fix: FixSummary | null, pick: PickRead): Moment[] {
  const issue = known(fix, (f) => f.issue);
  const pull = known(fix, (f) => f.pull);
  const approvals = known(fix, (f) => f.approvals);
  const release = known(fix, (f) => f.release);
  const moments: Moment[] = [
    issue === UNREAD || issue === null ? at('asked', 'Asked', 'unknown') : done('asked', 'Asked', issue.author, stamp(issue.createdAt), issue.url),
  ];
  if (kind === 'visual') moments.push(picked(pick));
  if (approvals === UNREAD) moments.push(at('approved', 'Approved', 'unknown'));
  else if (!approvals.length) moments.push(at('approved', 'Approved', 'not-yet'));
  else {
    const url = pull !== UNREAD && pull !== null ? pull.url : null;
    moments.push(...approvals.map((a) => done('approved', 'Approved', a.login, stamp(a.at), url)));
  }
  if (pull === UNREAD) moments.push(at('merged', 'Merged', 'unknown'));
  else if (pull?.state !== 'merged' || pull.mergedAt === null) moments.push(at('merged', 'Merged', 'not-yet'));
  else moments.push(done('merged', 'Merged', pull.mergedBy, stamp(pull.mergedAt), pull.url));
  if (release === UNREAD) moments.push(at('released', 'Released', 'unknown'));
  else if (release === null) moments.push(at('released', 'Released', 'not-yet'));
  else moments.push(done('released', `Released ${release.tag}`, null, stamp(release.at), release.url));
  return moments;
}

/** What a fix's page shows of GitHub (PRD 627, s5): its state, its issue and PR links, and its Timeline. */
export type FixPageView = {
  state: FixState | null;
  stateLabel: string;
  /** The issue and the fix PR, when GitHub gave them: `Issue #548`, `PR #562`, each open or ✓. */
  links: { label: string; href: string; done: boolean }[];
  timeline: Moment[];
};

export function fixPageView(kind: FixKind, fix: FixSummary | null, pick: PickRead): FixPageView {
  const state = fixState(fix);
  const links: FixPageView['links'] = [];
  if (fix && fix.issue !== UNREAD && fix.issue) links.push({ label: `Issue #${fix.issue.number}`, href: fix.issue.url, done: fix.issue.state === 'closed' });
  if (fix && fix.pull !== UNREAD && fix.pull) links.push({ label: `PR #${fix.pull.number}`, href: fix.pull.url, done: fix.pull.state === 'merged' });
  return { state, stateLabel: STATE_LABELS[state ?? 'unknown'], links, timeline: timelineOf(kind, fix, pick) };
}
