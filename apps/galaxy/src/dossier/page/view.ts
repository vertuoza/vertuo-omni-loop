// /prd/<id>, the page to share (PRD 216's spec, "The pages"), as pure functions of the rows the viewer
// may read, the workspace's members and what the address picks: the header (PRD #n or DRAFT, the
// title, the repository chips, who opened it and when), the artifact tabs, and each artifact's
// versions, newest first, as the version picker lists them (`v3 · 27 Sep · Pierre (kit)`,
// `v4 · 28 Sep · commit a1b2c3d (github)`). A version's number is its place among its kind's versions,
// oldest first, as the version rule numbers it. The tab and the version live in the address
// (`?tab=spec&v=2`), so every view is a link and the page works before any script runs.
//
// The Questions tab (PRD 216, step 3) lists the rounds that shaped the PRD, in the order they were
// asked: each question with the options it shows (PRD 384: an answered one only what was chosen, an
// open one every option, a moved one none), the answer, who answered and after how long, its category
// (PRD 144), and whether the brainstorm or the delivery asked it. Its label counts the rounds answered
// out of those asked. Each round links to its own page with the dossier it came from
// (`/ask/q/<round>?from=<dossier id>`), and `wayBack` says where that page goes once it is answered:
// back to this Questions tab, at the next round still open. Each round carries its id as its element's
// id, so that way back lands on it. A quick round (`isQuick`: open, one single-choice question with no
// preview, time left) is answered with one click on the list by whoever may answer it — its session's
// owner or a member it is shared with, decided on the server when the page is read (`answerable`) —
// and reads "Waiting for <owner>" to anyone else.
import { readQuestions, shownLabel } from '../../ask/answer-model';
import { CATEGORY_LABELS, isCategory, type Category } from '../../ask/classify';
import { nameOf, type Member } from '../../ask/page/question';
import { duration, HOOK_WAIT_MS } from '../../ask/page/view';
import { isDossierKind, type DossierKind, type DossierRoundRow, type DossierRow, type DossierVersionRow, type RoundRule } from '../store';
import { isDossierId } from './source';

/** The page's tabs: an artifact's, or the questions that shaped it. */
export type DossierTab = DossierKind | 'questions';

/** The tabs, in the order a PRD is made (PRD 384): the questions first, then the before/after, the spec and the plan. */
export const TABS: readonly DossierTab[] = ['questions', 'before-after', 'spec', 'plan'];

export const TAB_LABELS: Readonly<Record<DossierTab, string>> = {
  'before-after': 'Before/after', spec: 'Spec', plan: 'Plan', questions: 'Questions',
};

const isDossierTab = (value: unknown): value is DossierTab => value === 'questions' || isDossierKind(value);

/** What the address picks: a tab (null: none named, the page's default), and a version of its artifact (null: the latest). */
export type DossierPick = { tab: DossierTab | null; version: number | null };

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
const VERSION = /^[1-9]\d{0,8}$/;

export function readPick(query: Query): DossierPick {
  const tab = one(query.tab);
  const version = one(query.v);
  return { tab: isDossierTab(tab) ? tab : null, version: version !== null && VERSION.test(version) ? Number(version) : null };
}

/** The tab the page opens on when the address names none: Questions once a round was asked, else
 * Before/after, so nobody lands on an empty tab. */
export const defaultTab = (rounds: readonly unknown[] | null): DossierTab => (rounds?.length ? 'questions' : 'before-after');

/** The page's own address, the one Copy link gives. */
export const dossierPath = (id: string) => `/prd/${encodeURIComponent(id)}`;

/** Where a version of the before/after page is served, sandboxed. */
export const sandboxPath = (id: string, number: number) => `${dossierPath(id)}/v/${number}/page`;

/** A view's link; the default tab leaves `tab` out. */
function hrefOf(id: string, tab: DossierTab, version: number | null, fallback: DossierTab) {
  const query = new URLSearchParams();
  if (tab !== fallback) query.set('tab', tab);
  if (version !== null) query.set('v', String(version));
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
 * could not be read), its repositories as the history lists them (its home repository alone when
 * they are not given, or could not be read), and the rounds the viewer may answer, as the server
 * decided them (none when not given). */
export type DossierRead = {
  dossier: DossierRow; versions: DossierVersionRow[]; members: Member[]; rounds: DossierRoundRow[] | null; repos?: string[] | null;
  answerable?: readonly string[];
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
};

/** One option of a question, as it was offered: its label without "(Recommended)", which becomes a
 * badge, and whether the answer chose it. */
export type RoundOption = { label: string; recommended: boolean; description: string; chosen: boolean };

/** How a question reads (PRD 384): answered, with only what was chosen; open, with every option it
 * offers; or moved to the terminal, with no option. */
export type QuestionShape = 'answered' | 'open' | 'moved';

/** One question of a round: the options it shows (only the chosen ones once answered, none once
 * moved), its answer exactly as given (the chosen labels, or the text typed), and what of that answer
 * matches no option, shown as the text written. */
export type RoundQuestion = {
  header: string; question: string; multiSelect: boolean; shape: QuestionShape; options: RoundOption[]; answer: string | null; written: string | null;
};

/** One option of a quick round, as its button shows it (`label`, `recommended`) and as the answer
 * records it (`value`: the label exactly as the question offered it). */
export type QuickChoice = { label: string; recommended: boolean; value: string };

/** A quick round, answered on the list: its one question, a button per option for a viewer who may
 * answer it, "Waiting for <owner>" for anyone else, and the next round still open, to scroll to once
 * it is answered. */
export type QuickRound = { question: string; choices: QuickChoice[]; canAnswer: boolean; owner: string; next: string | null };

export type RoundEntry = {
  /** The round's id, also its element's id on the list, so `#<round id>` lands on it. */
  id: string;
  rule: RoundRule;
  /** The question on its own page, where any member may change its category, carrying the dossier it came from. */
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
  /** Set when the round is quick (PRD 384): it is answered on the list; null otherwise. */
  quick: QuickRound | null;
};

/** The rounds, in the order they were asked (null when they could not be read), and how many were asked and answered. */
export type QuestionsView = { rounds: RoundEntry[] | null; asked: number; answered: number };

/** Whether `label` is part of `answer`: the label itself, or one of several joined with ", ". */
function chose(label: string, answer: string | null, multiSelect: boolean) {
  return answer !== null && (answer === label || (multiSelect && answer.split(', ').includes(label)));
}

const shapeOf = (row: DossierRoundRow): QuestionShape =>
  row.status === 'answered' ? 'answered' : row.status === 'abandoned' ? 'moved' : 'open';

/** What of an answer matches no option: the whole answer of a single choice, or the parts of a
 * multi-select no option names; null when every part is an option. */
function writtenOf(answer: string | null, labels: string[], multiSelect: boolean): string | null {
  if (answer === null || labels.includes(answer)) return null;
  if (!multiSelect) return answer;
  const rest = answer.split(', ').filter((part) => !labels.includes(part));
  return rest.length ? rest.join(', ') : null;
}

function roundQuestions(row: DossierRoundRow): RoundQuestion[] {
  const asked = readQuestions(row.questions);
  const answers = row.answers ?? {};
  const named = new Set(asked.map((q) => q.question));
  const shape = shapeOf(row);
  const shows = (option: RoundOption) => shape === 'open' || (shape === 'answered' && option.chosen);
  return [
    ...asked.map((q): RoundQuestion => {
      const answer = answers[q.question] ?? null;
      const options = q.options.map((o): RoundOption => {
        const shown = shownLabel(o.label);
        return { label: shown.text, recommended: shown.recommended, description: o.description, chosen: chose(o.label, answer, q.multiSelect) };
      });
      const written = shape === 'answered' ? writtenOf(answer, q.options.map((o) => o.label), q.multiSelect) : null;
      return { header: q.header, question: q.question, multiSelect: q.multiSelect, shape, options: options.filter(shows), answer, written };
    }),
    // An answer to a question the round does not name (an older kit's) is still shown, as its text.
    ...Object.entries(answers).filter(([question]) => !named.has(question))
      .map(([question, answer]): RoundQuestion => ({ header: '', question, multiSelect: false, shape, options: [], answer, written: answer })),
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

type Asked = Pick<DossierRoundRow, 'round_id' | 'created_at'>;
const askedOrder = (a: Asked, b: Asked) =>
  Date.parse(a.created_at) - Date.parse(b.created_at) || a.round_id.localeCompare(b.round_id);

/** Whether a round is answered with one click on the list (PRD 384): open, exactly one question,
 * single choice, with options and none of them a preview, and time left before it moves to the terminal. */
export function isQuick(row: Pick<DossierRoundRow, 'status' | 'questions' | 'created_at'>, now: number): boolean {
  if (row.status !== 'open' || now >= Date.parse(row.created_at) + HOOK_WAIT_MS) return false;
  const asked = readQuestions(row.questions);
  if (asked.length !== 1) return false;
  const [only] = asked;
  return !only.multiSelect && only.options.length > 0 && only.options.every((o) => o.preview === null);
}

type Opened = Pick<DossierRoundRow, 'round_id' | 'status' | 'created_at'>;

/** The first round still open in the order asked, other than `roundId`; null when none is. */
function nextOpen(rows: readonly Opened[], roundId: string): string | null {
  return [...rows].filter((row) => row.status === 'open' && row.round_id !== roundId).sort(askedOrder)[0]?.round_id ?? null;
}

function quickOf(row: DossierRoundRow, rows: readonly DossierRoundRow[], members: Member[], answerable: readonly string[], now: number): QuickRound | null {
  if (!isQuick(row, now)) return null;
  const [only] = readQuestions(row.questions);
  return {
    question: only.question,
    choices: only.options.map((o) => {
      const shown = shownLabel(o.label);
      return { label: shown.text, recommended: shown.recommended, value: o.label };
    }),
    canAnswer: answerable.includes(row.round_id),
    owner: nameOf(row.asked_by, members),
    next: nextOpen(rows, row.round_id),
  };
}

/** A round's own page, carrying the dossier it is opened from, so that page can bring the person back. */
export const roundPath = (roundId: string, dossierId: string) =>
  `/ask/q/${encodeURIComponent(roundId)}?from=${encodeURIComponent(dossierId)}`;

export function questionsView(
  rows: DossierRoundRow[] | null, members: Member[], dossierId: string, answerable: readonly string[] = [], now: number = Date.now(),
): QuestionsView {
  if (rows === null) return { rounds: null, asked: 0, answered: 0 };
  const rounds = [...rows].sort(askedOrder).map((row): RoundEntry => ({
    id: row.round_id,
    rule: row.rule,
    href: roundPath(row.round_id, dossierId),
    questions: roundQuestions(row),
    outcome: outcomeOf(row, members),
    asked: `asked by ${nameOf(row.asked_by, members)} · ${stamp(row.created_at)}`,
    category: isCategory(row.category) ? CATEGORY_LABELS[row.category] : 'unsorted',
    categoryValue: isCategory(row.category) ? row.category : null,
    context: [row.repo, row.branch, row.prd ? `PRD #${row.prd}` : null, row.skill].filter((part): part is string => typeof part === 'string' && part !== ''),
    quick: quickOf(row, rows, members, answerable, now),
  }));
  return { rounds, asked: rows.length, answered: rows.filter((row) => row.status === 'answered').length };
}

export function dossierView(
  { dossier, versions, members, rounds, repos, answerable = [] }: DossierRead, me: string | null, pick: DossierPick, now: number = Date.now(),
): DossierView {
  const ofKind = (kind: DossierKind) => versions.filter((v) => v.kind === kind);
  const fallback = defaultTab(rounds);
  const tab = pick.tab ?? fallback;
  const mine = tab === 'questions' ? [] : ofKind(tab);
  const questions = questionsView(rounds, members, dossier.id, answerable, now);
  const badgeOf = (kind: DossierTab) => {
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
      href: hrefOf(dossier.id, tab, number, fallback),
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
      href: hrefOf(dossier.id, kind, null, fallback),
      current: kind === tab,
    })),
    tab,
    versions: entries,
    shown: entries.find((e) => e.current) ?? null,
    questions,
  };
}

/** What the way back from a round's own page needs: the `from` it was opened with (null: none), the
 * round's session and id, and the rounds of that dossier as read after the answer (null: not read). */
export type WayBack = {
  from: string | null;
  sessionId: string;
  roundId: string;
  rounds: readonly Opened[] | null;
};

/** Where the question page goes once its round is answered (PRD 384): the dossier's Questions tab at
 * the first round still open in the order asked (`/prd/<id>?tab=questions#<round>`), or that tab alone
 * when none is left; the ask page of the round's session when `from` names no dossier, so the
 * parameter can never send anyone to another site. */
export function wayBack({ from, sessionId, roundId, rounds }: WayBack): string {
  if (from === null || !isDossierId(from)) return `/ask/${encodeURIComponent(sessionId)}`;
  const tab = `${dossierPath(from)}?tab=questions`;
  const next = nextOpen(rounds ?? [], roundId);
  return next ? `${tab}#${encodeURIComponent(next)}` : tab;
}
