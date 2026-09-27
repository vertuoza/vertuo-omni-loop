// /prd/<id>, the page to share (PRD 216's spec, "The pages"), as pure functions of the rows the viewer
// may read, the workspace's members and what the address picks: the header (PRD #n or DRAFT, the
// title, the repository chips, who opened it and when), the artifact tabs, and each artifact's
// versions, newest first, as the version picker lists them (`v3 · 27 Sep · Pierre (kit)`,
// `v4 · 28 Sep · commit a1b2c3d (github)`). A version's number is its place among its kind's versions,
// oldest first, as the version rule numbers it. The tab and the version live in the address
// (`?tab=spec&v=2`), so every view is a link and the page works before any script runs.
//
// The Questions tab (PRD 216, step 3) lists the rounds that shaped the PRD, in the order they were
// asked: each question with its options, the answer, who answered and after how long, its category
// (PRD 144), and whether the brainstorm or the delivery asked it. Its label counts the rounds answered
// out of those asked.
//
// The Outbox tab (PRD 251) comes after Questions: the questions the PRD's feature pull request still
// asks, beside a context rail — Before/after, Spec or Brainstorm, picked by `?context=` — and its
// label says `n open`. Its cards are src/outbox/tab.ts's, built by the tab on the server: this model is
// imported by a browser component too (DeleteDraft), so it holds the outbox as read, never the kit.
import { openCount, type OutboxRead } from '../../outbox/count';
import { readQuestions, shownLabel } from '../../ask/answer-model';
import { CATEGORY_LABELS, isCategory, type Category } from '../../ask/classify';
import { nameOf, type Member } from '../../ask/page/question';
import { duration } from '../../ask/page/view';
import { isDossierKind, type DossierKind, type DossierRoundRow, type DossierRow, type DossierVersionRow, type RoundRule } from '../store';

/** The page's tabs: an artifact's, the questions that shaped it, or those its outbox still asks. */
export type DossierTab = DossierKind | 'questions' | 'outbox';

/** The tabs, in order: the page to look at first, then what to read, then how it was decided, then
 * what is still to decide. */
export const TABS: readonly DossierTab[] = ['before-after', 'spec', 'plan', 'questions', 'outbox'];

export const TAB_LABELS: Readonly<Record<DossierTab, string>> = {
  'before-after': 'Before/after', spec: 'Spec', plan: 'Plan', questions: 'Questions', outbox: 'Outbox',
};

const isDossierTab = (value: unknown): value is DossierTab => value === 'questions' || value === 'outbox' || isDossierKind(value);

/** What the Outbox tab's context rail shows beside the questions. */
export type ContextKind = 'before-after' | 'spec' | 'brainstorm';
export const CONTEXTS: readonly ContextKind[] = ['before-after', 'spec', 'brainstorm'];
export const CONTEXT_LABELS: Readonly<Record<ContextKind, string>> = { 'before-after': 'Before/after', spec: 'Spec', brainstorm: 'Brainstorm' };
const isContext = (value: unknown): value is ContextKind => CONTEXTS.includes(value as ContextKind);

/** What the address picks: a tab, a version of its artifact (null: the latest), and on the Outbox tab
 * its context (Before/after when not given). */
export type DossierPick = { tab: DossierTab; version: number | null; context?: ContextKind };

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
const VERSION = /^[1-9]\d{0,8}$/;

export function readPick(query: Query): DossierPick {
  const tab = one(query.tab);
  const version = one(query.v);
  const context = one(query.context);
  return {
    tab: isDossierTab(tab) ? tab : 'before-after',
    version: version !== null && VERSION.test(version) ? Number(version) : null,
    ...(isContext(context) ? { context } : {}),
  };
}

/** The page's own address, the one Copy link gives. */
export const dossierPath = (id: string) => `/prd/${encodeURIComponent(id)}`;

/** Where a version of the before/after page is served, sandboxed. */
export const sandboxPath = (id: string, number: number) => `${dossierPath(id)}/v/${number}/page`;

/** The dossier's Outbox tab, where /prd/at/… and the outbox route send people. */
export const outboxPath = (id: string) => `${dossierPath(id)}?tab=outbox`;

function hrefOf(id: string, tab: DossierTab, version: number | null, context: ContextKind | null = null) {
  const query = new URLSearchParams();
  if (tab !== 'before-after') query.set('tab', tab);
  if (version !== null) query.set('v', String(version));
  if (context !== null && context !== 'before-after') query.set('context', context);
  return String(query) ? `${dossierPath(id)}?${query}` : dossierPath(id);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** `27 Sep`, in UTC: the same on the server and in any browser. */
export function shortDay(iso: string): string {
  const at = new Date(iso);
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

/** `27 Sep 2026, 09:12 UTC`. */
export function stamp(iso: string): string {
  const at = new Date(iso);
  return `${shortDay(iso)} ${at.getUTCFullYear()}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}

/** Who sent a version: the member who pushed it (kit), or the commit the fallback read it at (github). */
export function versionSource(version: Pick<DossierVersionRow, 'source' | 'uploaded_by' | 'commit_sha'>, members: Member[]): string {
  return version.source === 'github'
    ? `commit ${(version.commit_sha ?? '').slice(0, 7)} (github)`
    : `${nameOf(version.uploaded_by, members)} (kit)`;
}

/** What the page reads: the dossier, its versions, its workspace's members, its rounds (null when they
 * could not be read), and its repositories as the history lists them (its home repository alone when
 * they are not given, or could not be read). */
export type DossierRead = {
  dossier: DossierRow; versions: DossierVersionRow[]; members: Member[]; rounds: DossierRoundRow[] | null; repos?: string[] | null;
  /** Its latest outbox (PRD 251); left out, it reads as none. */
  outbox?: OutboxRead;
};

/** A tab and what its label adds: an artifact's latest version (`v3`), or the questions answered out
 * of asked (`11/12 answered`); null when there is nothing yet. */
export type TabEntry = { kind: DossierTab; label: string; badge: string | null; href: string; current: boolean };

export type VersionEntry = {
  id: string;
  number: number;
  label: string;
  href: string;
  current: boolean;
  /** The sandboxed route of a before/after version; null for the others. */
  frame: string | null;
};

export type DossierView = {
  id: string;
  /** `PRD #216`, or `DRAFT`. */
  heading: string;
  draft: boolean;
  title: string;
  repos: string[];
  /** `opened by Pierre · 27 Sep 2026, 09:12 UTC`, or `read from GitHub · …` when the fallback made it. */
  opened: string;
  /** The page's own path, for Copy link. */
  link: string;
  /** The viewer opened this draft: they may delete it. Nobody deletes a numbered dossier. */
  canDelete: boolean;
  tabs: TabEntry[];
  tab: DossierTab;
  /** The tab's versions, newest first; none on Questions. */
  versions: VersionEntry[];
  /** The version the tab shows: the picked one, else the latest; null when there is none yet, and on Questions. */
  shown: VersionEntry | null;
  /** The questions that shaped it. */
  questions: QuestionsView;
  /** On the Outbox tab: its questions and the context rail beside them; null on every other tab. */
  outbox: OutboxPane | null;
};

/** One question the brainstorm asked, and its answer as given. */
export type BrainstormAnswer = { question: string; answer: string | null };

/** The context rail of the Outbox tab: its three switches, and what the current one shows. */
export type ContextView = {
  current: ContextKind;
  links: Array<{ kind: ContextKind; label: string; href: string; current: boolean }>;
  /** The latest before/after version's sandboxed route; null when there is none. */
  frame: string | null;
  /** The latest spec's version id, which the page reads and renders when Spec is current; null when none. */
  specId: string | null;
  /** The brainstorm's questions and answers; null when the rounds could not be read. */
  brainstorm: BrainstormAnswer[] | null;
};

/** The Outbox tab: the outbox as read (src/outbox/tab.ts turns it into cards), and the rail. */
export type OutboxPane = { read: OutboxRead; context: ContextView };

/** One option of a question, as it was offered: its label without "(Recommended)", which becomes a
 * badge, and whether the answer chose it. */
export type RoundOption = { label: string; recommended: boolean; description: string; chosen: boolean };

/** One question of a round, with its answer exactly as given (the chosen labels, or the text typed). */
export type RoundQuestion = { header: string; question: string; multiSelect: boolean; options: RoundOption[]; answer: string | null };

export type RoundEntry = {
  id: string;
  rule: RoundRule;
  /** The question on its own page, where any member may change its category. */
  href: string;
  questions: RoundQuestion[];
  /** `answered by Pierre after 1 min 35 s, on the page`, `moved to the terminal, no answer recorded`, or `not answered yet`. */
  outcome: string;
  /** `asked by Pierre · 27 Sep 2026, 09:15 UTC`. */
  asked: string;
  /** The category's label, or `unsorted`. */
  category: string;
  categoryValue: Category | null;
  /** Where it came from: repository · branch · PRD #n · skill, each left out when unknown. */
  context: string[];
};

/** The rounds, in the order they were asked (null when they could not be read), and how many were asked and answered. */
export type QuestionsView = { rounds: RoundEntry[] | null; asked: number; answered: number };

/** Whether `label` is part of `answer`: the label itself, or one of several joined with ", ". */
function chose(label: string, answer: string | null, multiSelect: boolean) {
  return answer !== null && (answer === label || (multiSelect && answer.split(', ').includes(label)));
}

function roundQuestions(row: DossierRoundRow): RoundQuestion[] {
  const asked = readQuestions(row.questions);
  const answers = row.answers ?? {};
  const named = new Set(asked.map((q) => q.question));
  return [
    ...asked.map((q): RoundQuestion => {
      const answer = answers[q.question] ?? null;
      const options = q.options.map((o): RoundOption => {
        const shown = shownLabel(o.label);
        return { label: shown.text, recommended: shown.recommended, description: o.description, chosen: chose(o.label, answer, q.multiSelect) };
      });
      return { header: q.header, question: q.question, multiSelect: q.multiSelect, options, answer };
    }),
    // An answer to a question the round does not name (an older kit's) is still shown.
    ...Object.entries(answers).filter(([question]) => !named.has(question))
      .map(([question, answer]): RoundQuestion => ({ header: '', question, multiSelect: false, options: [], answer })),
  ];
}

function outcomeOf(row: DossierRoundRow, members: Member[]): string {
  if (row.status === 'answered') {
    const by = row.answered_by ? ` by ${nameOf(row.answered_by, members)}` : '';
    const after = row.answered_at ? ` after ${duration(Date.parse(row.answered_at) - Date.parse(row.created_at))}` : '';
    const where = row.answered_via === 'page' ? ', on the page' : row.answered_via === 'terminal' ? ', in the terminal' : '';
    return `answered${by}${after}${where}`;
  }
  return row.status === 'abandoned' ? 'moved to the terminal, no answer recorded' : 'not answered yet';
}

const askedOrder = (a: DossierRoundRow, b: DossierRoundRow) =>
  Date.parse(a.created_at) - Date.parse(b.created_at) || a.round_id.localeCompare(b.round_id);

export function questionsView(rows: DossierRoundRow[] | null, members: Member[]): QuestionsView {
  if (rows === null) return { rounds: null, asked: 0, answered: 0 };
  const rounds = [...rows].sort(askedOrder).map((row): RoundEntry => ({
    id: row.round_id,
    rule: row.rule,
    href: `/ask/q/${encodeURIComponent(row.round_id)}`,
    questions: roundQuestions(row),
    outcome: outcomeOf(row, members),
    asked: `asked by ${nameOf(row.asked_by, members)} · ${stamp(row.created_at)}`,
    category: isCategory(row.category) ? CATEGORY_LABELS[row.category] : 'unsorted',
    categoryValue: isCategory(row.category) ? row.category : null,
    context: [row.repo, row.branch, row.prd ? `PRD #${row.prd}` : null, row.skill].filter((part): part is string => typeof part === 'string' && part !== ''),
  }));
  return { rounds, asked: rows.length, answered: rows.filter((row) => row.status === 'answered').length };
}

function contextView(id: string, versions: DossierVersionRow[], questions: QuestionsView, current: ContextKind): ContextView {
  const pages = versions.filter((v) => v.kind === 'before-after');
  return {
    current,
    links: CONTEXTS.map((kind) => ({ kind, label: CONTEXT_LABELS[kind], href: hrefOf(id, 'outbox', null, kind), current: kind === current })),
    frame: pages.length ? sandboxPath(id, pages.length) : null,
    specId: versions.filter((v) => v.kind === 'spec').at(-1)?.id ?? null,
    brainstorm: questions.rounds === null ? null : questions.rounds
      .filter((round) => round.rule === 'brainstorm')
      .flatMap((round) => round.questions.map((q) => ({ question: q.question, answer: q.answer }))),
  };
}

export function dossierView(read: DossierRead, me: string | null, pick: DossierPick): DossierView {
  const { dossier, versions, members, rounds, repos } = read;
  const ofKind = (kind: DossierKind) => versions.filter((v) => v.kind === kind);
  const tab = pick.tab;
  const mine = tab === 'questions' || tab === 'outbox' ? [] : ofKind(tab);
  const questions = questionsView(rounds, members);
  const outbox: OutboxRead = read.outbox ?? { row: null };
  const open = openCount(outbox);
  const badgeOf = (kind: DossierTab) => {
    if (kind === 'outbox') return open > 0 ? `${open} open` : null;
    if (kind !== 'questions') return ofKind(kind).length ? `v${ofKind(kind).length}` : null;
    return questions.asked ? `${questions.answered}/${questions.asked} answered` : null;
  };
  const picked = pick.version !== null && pick.version <= mine.length ? pick.version : mine.length;
  const entries = mine.map((version, i): VersionEntry => {
    const number = i + 1;
    return {
      id: version.id,
      number,
      label: `v${number} · ${shortDay(version.created_at)} · ${versionSource(version, members)}`,
      href: hrefOf(dossier.id, tab, number),
      current: number === picked,
      frame: tab === 'before-after' ? sandboxPath(dossier.id, number) : null,
    };
  }).reverse();
  const opener = dossier.opened_by === null ? 'read from GitHub' : `opened by ${nameOf(dossier.opened_by, members)}`;
  return {
    id: dossier.id,
    heading: dossier.prd === null ? 'DRAFT' : `PRD #${dossier.prd}`,
    draft: dossier.prd === null,
    title: dossier.title,
    repos: repos?.length ? repos : [dossier.home_repo],
    opened: `${opener} · ${stamp(dossier.created_at)}`,
    link: dossierPath(dossier.id),
    canDelete: dossier.prd === null && me !== null && dossier.opened_by === me,
    tabs: TABS.map((kind) => ({
      kind,
      label: TAB_LABELS[kind],
      badge: badgeOf(kind),
      href: hrefOf(dossier.id, kind, null),
      current: kind === tab,
    })),
    tab,
    versions: entries,
    shown: entries.find((e) => e.current) ?? null,
    questions,
    outbox: tab === 'outbox'
      ? { read: outbox, context: contextView(dossier.id, versions, questions, pick.context ?? 'before-after') }
      : null,
  };
}
