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
// (PRD 144), and whether the brainstorm or the delivery asked it. PRD 498 counts questions, not rounds:
// its label reads the questions answered out of those asked, and how many are left to answer (a moved
// round's count only as asked); each round has a line (its state, its headers, its count, when it was
// asked) for the folded list. Each round links to its own page with the dossier it came from
// (`/ask/q/<round>?from=<dossier id>`), and `wayBack` says where that page goes once it is answered:
// back to this Questions tab, at the next round still open. Each round carries its id as its element's
// id, so that way back lands on it. A quick round (`isQuick`: open, one single-choice question with no
// preview, time left) is answered with one click on the list by whoever may answer it — its session's
// owner or a member it is shared with, decided on the server when the page is read (`answerable`) —
// and reads "Waiting for <owner>" to anyone else.
//
// The stage header (PRD 426): "PRD #n" links to its issue on the dossier's home repository (no GitHub
// call needed). PRD 587: the stage comes from the PRD's stored stages the route read, never from GitHub;
// its one button and its links are worked out from the GitHub summary when there is one (./stage.ts). A
// draft reads Brainstorming until a question is answered, then idea, without any read; demo mode shows
// its built-in stages and sample summary (./demo.ts).
//
// The Outbox tab (PRD 426, s2) comes after Plan: the open decisions, highest rank first, then the
// settled ones in the order settled.md holds them, read from the GitHub summary. Its badge counts
// the open ones, else the settled ones; empty, it stays in the bar, dimmed, and says why. PRD 251 (s9)
// makes it the place to answer (./outbox-view.ts): cards in the pull request's numbering, the pending
// answers, the Adopted and Settled groups, and a context rail beside them — Before/after, Spec or
// Brainstorm, picked by `?context=` (Before/after when not given). While the rail shows the spec,
// `shown` is the spec's latest version, so the route renders it as it renders the Spec tab.
//
// The Retro tab (PRD 426, s3) comes last: retro.md as the GitHub summary holds it (from the retro
// branch while its PR is open, from the default branch once merged), with the retro PR on top. Its
// badge says whether that PR is open or merged; with no retro.md yet, it is dimmed and says why.
//
// The PR care tab (PRD 790, s4) comes after Outbox, only while the PRD has a feature PR: its CI (with
// the failed run's link while red), whether it conflicts with its base, the review threads counted by
// verdict, then one line per thread (the reviewer's face and login, the comment's first line, the
// verdict with Claude's reason, a link to it on GitHub), asked threads first. Under them, the watcher
// line: `Claude is watching · last round N min ago` while the status comment's last round is under 15
// minutes old, else `Nobody is watching`, with `/omni:pr-care <n>` to copy. All of it read from the
// feature PR's care state (../github/care.ts); a merged feature PR has nothing left to watch.
//
// PRD 627: a fix is a dossier with a kind, read on its own route (./work.ts) by this same page, its tabs
// chosen by its kind — a visual fix's Before/after, Variations (a round each, picked as *Round k*, each
// on its own sandboxed route) and Questions; a bug fix's Bug record (markdown) and Questions — with no
// stage. Its header reads `#n` with a *Visual* or *Bug* badge, linked to its issue. A PRD keeps exactly
// its tabs.
//
// PRD 627, s5: a fix's page opens on its Timeline — Asked, Picked (a visual fix only), Approved, Merged,
// Released, each with who and when, read live from GitHub and the pick line (../../fixes/timeline.ts)
// — and its header carries the fix's state (Asked, In review, Merged, or `—`) and its issue and PR.
//
// PRD 798, s4: a PRD's Proof tab (./proof.ts) sits between Outbox and Retro once the dossier holds a
// proof run, and is not there before; `?tab=proof&v=1` picks an older run.
//
// PRD 859, s3: a PRD's Pitch tab (./pitch.ts) sits after Proof (after PR care when there is no proof)
// once the dossier holds a pitch, and is not there before; `?tab=pitch&pitch=<id>` picks an older pitch
// of its audience.
import type { FixPageView } from '../../fixes/timeline';
import type { Face } from '../../people/face';
import { peopleOf, type People } from '../../people/load';
import type { Person } from '../../people/types';
import { readQuestions, shownLabel } from '../../ask/answer-model';
import { CATEGORY_LABELS, isCategory, type Category } from '../../ask/classify';
import { nameOf, type Member } from '../../ask/page/question';
import { duration, HOOK_WAIT_MS } from '../../ask/page/view';
import { isArtifactKind, type ArtifactKind, type DossierKind, type DossierRoundRow, type DossierRow, type DossierVersionRow, type RoundRule, type WorkKind } from '../store';
import { UNREAD, type GithubSummary } from '../github/summary';
import { WATCH_FRESH_MS, type CareCi, type CareVerdict } from '../github/care';
import {
  CONTEXT_LABELS, CONTEXTS, GITHUB_UNREAD, isContext, OUTBOX_EMPTY, outboxView, type ContextKind, type ContextView, type OutboxView,
} from './outbox-view';
import { isDossierId } from './source';
import { GITHUB_PENDING } from './stream/pending';
import type { StageRow } from '../../stages/stage';
import { stageView, type StageView } from './stage';
import { kindOf, WORK_NAMES, workPath } from './work';
import { reworkCommand } from './voice';
import { pad, shortDay, stamp } from './dates';
import { proofView, runsBadge, type ProofRead, type ProofView } from './proof';
import { pitchesBadge, pitchView, type PitchRead, type PitchView } from './pitch';

export { GITHUB_UNREAD, OUTBOX_EMPTY, outboxView, type OutboxView };

/** The page's tabs: an artifact's, the questions that shaped it, or the decisions taken while it was built. */
export type DossierTab = ArtifactKind | 'questions' | 'outbox' | 'care' | 'retro' | 'timeline' | 'proof' | 'pitch';

/** The tabs the dossier itself keeps, in the order a PRD is made (PRD 384): the questions first, then
 * the before/after, the spec and the plan. The history lists these. */
export const TABS: readonly (DossierKind | 'questions')[] = ['questions', 'before-after', 'spec', 'plan'];

/** Every tab of the page, in order: the dossier's, the User voice beside them (PRD 822), then what
 * GitHub holds (PRD 426). */
export const PAGE_TABS: readonly DossierTab[] = [...TABS, 'voice', 'outbox', 'care', 'retro'];

/** Each kind's tabs, in order (PRD 627): a PRD's every tab; a fix's own artifacts, then its questions. */
export const KIND_TABS: Readonly<Record<WorkKind, readonly DossierTab[]>> = {
  prd: PAGE_TABS,
  visual: ['timeline', 'before-after', 'variations', 'questions'],
  bug: ['timeline', 'bug-record', 'questions'],
};

export const TAB_LABELS: Readonly<Record<DossierTab, string>> = {
  'before-after': 'Before/after', spec: 'Spec', plan: 'Plan', questions: 'Questions', outbox: 'Outbox', care: 'PR care', retro: 'Retro',
  variations: 'Variations', 'bug-record': 'Bug record', timeline: 'Timeline', voice: 'User voice', proof: 'Proof',
  pitch: 'Pitch',
};

/** A PRD's tabs once it holds a proof run (PRD 798): Proof after Outbox, before Retro. */
const withProof = (tabs: readonly DossierTab[]): DossierTab[] => tabs.flatMap((t) => (t === 'retro' ? ['proof', t] : [t]));

/** A PRD's tabs once it holds a pitch (PRD 859): Pitch after Proof, before Retro. */
const withPitch = (tabs: readonly DossierTab[]): DossierTab[] => tabs.flatMap((t) => (t === 'retro' ? ['pitch', t] : [t]));

/** A PRD's tabs, with Proof and Pitch once it holds a proof run and a pitch. */
function prdTabs(read: DossierRead): readonly DossierTab[] {
  const proofed = read.proofs?.runs.length ? withProof(KIND_TABS.prd) : KIND_TABS.prd;
  return read.pitches?.runs.length ? withPitch(proofed) : proofed;
}

/** The tabs that hold no artifact of the dossier's own. */
const NOT_ARTIFACTS: readonly DossierTab[] = ['questions', 'outbox', 'care', 'retro', 'timeline', 'proof', 'pitch'];

/** Whether a tab shows versions of an artifact the dossier keeps. */
export const isArtifactTab = (tab: DossierTab): tab is ArtifactKind => !NOT_ARTIFACTS.includes(tab);

const isDossierTab = (value: unknown): value is DossierTab =>
  (typeof value === 'string' && NOT_ARTIFACTS.includes(value as DossierTab)) || isArtifactKind(value);

/** An empty Retro tab says why. */
export const RETRO_EMPTY = 'The retro is written when the feature PR merges.';

/** What the address picks: a tab (null: none named, the page's default), a version of its artifact
 * (null: the latest), and on the Outbox tab what its context rail shows (left out: Before/after). */
export type DossierPick = {
  tab: DossierTab | null; version: number | null; context?: ContextKind;
  /** The pitch the Pitch tab's picker names (PRD 859): a run's id, shown in its audience's place. */
  pitch?: string;
};

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
const VERSION = /^[1-9]\d{0,8}$/;
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPick(query: Query): DossierPick {
  const tab = one(query.tab);
  const version = one(query.v);
  const context = one(query.context);
  const pitch = one(query.pitch);
  return {
    tab: isDossierTab(tab) ? tab : null,
    version: version !== null && VERSION.test(version) ? Number(version) : null,
    ...(isContext(context) ? { context } : {}),
    ...(pitch !== null && RUN_ID.test(pitch) ? { pitch: pitch.toLowerCase() } : {}),
  };
}

/** The tab the page opens on when the address names none: Questions once a round was asked, else
 * Before/after, so nobody lands on an empty tab. */
export const defaultTab = (rounds: readonly unknown[] | null): DossierTab => (rounds?.length ? 'questions' : 'before-after');

/** A PRD's issue on GitHub: its number is the issue's. */
export const issueUrl = (repo: string, prd: number) =>
  `https://github.com/${repo.split('/').map(encodeURIComponent).join('/')}/issues/${prd}`;

/** The page's own address, the one Copy link gives: a PRD's, or a fix's on its kind's route (PRD 627). */
export const dossierPath = (id: string, kind: WorkKind = 'prd') => workPath(kind, id);

/** Where a version of the before/after page is served, sandboxed; a round of variations on `r/` (PRD 627). */
export const sandboxPath = (id: string, number: number, kind: WorkKind = 'prd', artifact: 'before-after' | 'variations' = 'before-after') =>
  `${dossierPath(id, kind)}/${artifact === 'variations' ? 'r' : 'v'}/${number}/page`;

/** A view's link; the default tab leaves `tab` out, and the default context (Before/after) `context`. */
function hrefOf(id: string, tab: DossierTab, version: number | null, fallback: DossierTab, context: ContextKind | null = null, kind: WorkKind = 'prd') {
  const query = new URLSearchParams();
  if (tab !== fallback) query.set('tab', tab);
  if (version !== null) query.set('v', String(version));
  if (context !== null && context !== 'before-after') query.set('context', context);
  return String(query) ? `${dossierPath(id, kind)}?${query}` : dossierPath(id, kind);
}

export { shortDay, stamp };

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
  /** The GitHub summary (PRD 426): null when it could not be read, left out when it was not asked for. */
  github?: GithubSummary | null;
  /** The slices of the dossier's latest plan version; null or left out when not known. */
  slices?: number | null;
  /** The PRD's stored stages (PRD 587): none yet reads Syncing…; left out when they were not asked for. */
  stages?: readonly StageRow[] | null;
  /** The demo dossier (PRD 251, s9): its outbox cannot send. */
  demo?: boolean;
  /** A fix's state, links and Timeline (PRD 627, s5); left out for a PRD. */
  fix?: FixPageView;
  /** The workspace's people directory (PRD 652), for the faces; left out, everyone falls back to
   * their GitHub photo or their initial. */
  people?: People;
  /** The proof runs (PRD 798): null when they could not be read, left out when not asked for; the
   * Proof tab shows only with one. */
  proofs?: ProofRead | null;
  /** The pitches (PRD 859): null when they could not be read, left out when not asked for; the Pitch
   * tab shows only with one. */
  pitches?: PitchRead | null;
};

/** Nobody known: every face is the GitHub photo of a login, or the name's initial (PRD 652). */
const NOBODY: People = peopleOf([], []);

/** A tab and what its label adds: an artifact's latest version (`v3`), or the questions answered out
 * of asked (`7/10`, or `10/10 answered` once none is left); null when there is nothing yet. `alert` is
 * what is left to answer (`3 to answer`), null when nothing is. */
export type TabEntry = { kind: DossierTab; label: string; badge: string | null; alert: string | null; href: string; current: boolean;
  /** Nothing to show yet: the tab stays in the bar, dimmed. */
  empty: boolean };

/** The Retro tab: retro.md as markdown (`text`), none yet (`empty`), or GitHub unread; `words` says why
 * it is empty, and `prUrl` is the retro PR (null when there is none). */
export type RetroView = { state: 'text' | 'empty' | 'unread'; words: string | null; prUrl: string | null; text: string | null };

/** One review thread on the PR care tab (PRD 790, s4): who wrote it, its first line, the verdict in
 * words with Claude's reason (null before care replied), and its link on GitHub. */
export type CareThreadView = {
  login: string; person: Person; firstLine: string; verdict: CareVerdict; verdictWords: string; reason: string | null; url: string;
};

/** The PR care tab (PRD 790, s4): the feature PR's health (`care`), nothing left to watch once it is
 * merged (`done`), GitHub not asked yet (`pending`), or GitHub unread; `words` says why when it
 * is not `care`. */
export type CareView = {
  state: 'care' | 'done' | 'pending' | 'unread';
  words: string | null;
  /** The feature PR; null when it could not be read. */
  prUrl: string | null;
  ci: { state: CareCi; words: string; href: string | null };
  conflict: { state: 'none' | 'conflict' | 'unknown'; words: string };
  /** The threads by verdict: open (nobody handled it yet), fixed, pushed back, asked. */
  counts: Record<CareVerdict, number>;
  /** Asked first, then open, then the handled ones. */
  threads: CareThreadView[];
  /** The watcher line: whether a round ran under 15 minutes ago, its words, and the command to start one. */
  watcher: { watching: boolean; words: string; command: string };
};

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
  /** What the dossier is of (PRD 627). */
  kind: WorkKind;
  /** `PRD #216`, `DRAFT`, or a fix's `#548`. */
  heading: string;
  /** A fix's kind, as its header badges it (`Visual`, `Bug`); null for a PRD. */
  badge: string | null;
  draft: boolean;
  /** The PRD's issue on the home repository; null for a draft. */
  issueUrl: string | null;
  /** Where the PRD is and what to do next; null for a numbered PRD whose stages were not asked for. */
  stage: StageView | null;
  title: string;
  repos: string[];
  /** `opened by Pierre · 27 Sep 2026, 09:12 UTC`, or `read from GitHub · …` when the fallback made it. */
  opened: string;
  /** Who opened it, with their face (PRD 652); null when the fallback made it. */
  openedBy: Person | null;
  /** When it was opened: `27 Sep 2026, 09:12 UTC`. */
  openedAt: string;
  /** The page's own path, for Copy link. */
  link: string;
  /** The viewer opened this draft: they may delete it. Nobody deletes a numbered dossier. */
  canDelete: boolean;
  tabs: TabEntry[];
  tab: DossierTab;
  /** The tab's versions, newest first; none on Questions. */
  versions: VersionEntry[];
  /** The version the tab shows: the picked one, else the latest; null when there is none yet, and on
   * Questions. On Outbox, the spec's latest while the context rail shows the spec, else null. */
  shown: VersionEntry | null;
  /** The questions that shaped it. */
  questions: QuestionsView;
  /** The decisions taken while it was built (PRD 426). */
  outbox: OutboxView;
  /** The retro, once written (PRD 426, s3). */
  retro: RetroView;
  /** The feature PR's care (PRD 790, s4); null when the PRD is known to have no feature PR. */
  care: CareView | null;
  /** A fix's state, links and Timeline (PRD 627, s5); null for a PRD, and for a fix the route read none of. */
  fix: FixPageView | null;
  /** What the User voice tab's Rework with this feedback copies (PRD 822); null for a draft or a fix. */
  rework: string | null;
  /** The Proof tab's run (PRD 798): null with no run, and on a fix. */
  proof: ProofView | null;
  /** The Pitch tab's pitches, one per audience (PRD 859): null with none, and on a fix. */
  pitch: PitchView | null;
  /** The demo dossier (PRD 859): its Pitch panel opens disabled. Left out on any other dossier. */
  demo?: true;
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

/** One option of a quick round, as its button shows it (`label`, `recommended`, `description`) and as
 * the answer records it (`value`: the label exactly as the question offered it). */
export type QuickChoice = { label: string; recommended: boolean; description: string; value: string };

/** A quick round, answered on the list: its one question, a button per option for a viewer who may
 * answer it, "Waiting for <owner>" for anyone else, and the next round still open, to scroll to once
 * it is answered. `names` names the workspace's members, so "Already answered by …" can say who came
 * first; empty for a viewer who may not answer. */
export type QuickRound = {
  question: string; choices: QuickChoice[]; canAnswer: boolean; owner: string; next: string | null; names: Record<string, string>;
  /** The owner's face, and each named member's by account id (PRD 652). */
  ownerFace: Face; faces: Record<string, Face>;
};

export type RoundEntry = {
  /** The round's id, also its element's id on the list, so `#<round id>` lands on it. */
  id: string;
  rule: RoundRule;
  /** Open (never folded), answered or moved to the terminal (both folded) (PRD 498). */
  state: QuestionShape;
  /** Its question headers in lower case, joined: `shape, checks`; empty when none has one. */
  headers: string;
  /** `3/3` answered, `2 to answer` open, or `moved to the terminal`. */
  count: string;
  /** When it was asked, for its line: `27 Sep, 09:15`. */
  when: string;
  /** The question on its own page, where any member may change its category, carrying the dossier it came from. */
  href: string;
  questions: RoundQuestion[];
  /** `answered by Pierre after 1 min 35 s, on the page`, `moved to the terminal, no answer recorded`, or `not answered yet`. */
  outcome: string;
  /** `asked by Pierre · 27 Sep 2026, 09:15 UTC`. */
  asked: string;
  /** Who asked it, with their face, and when: `27 Sep 2026, 09:15 UTC` (PRD 652). */
  askedBy: Person;
  askedAt: string;
  /** An answer someone is named for: who, with their face, and what `outcome` says after their name
   * (` after 1 min 35 s, on the page`); null when nobody is named (PRD 652). */
  answeredBy: { person: Person; rest: string } | null;
  /** The category's label, or `unsorted`. */
  category: string;
  categoryValue: Category | null;
  /** Where it came from: repository · branch · PRD #n · skill, each left out when unknown. */
  context: string[];
  /** Set when the round is quick (PRD 384): it is answered on the list; null otherwise. */
  quick: QuickRound | null;
};

/** The rounds, in the order they were asked (null when they could not be read), and how many questions
 * were asked, answered, and are still open (PRD 498): a moved round's questions count only as asked. */
export type QuestionsView = { rounds: RoundEntry[] | null; asked: number; answered: number; open: number };

/** What the tab and the strip read (PRD 498): `4/7` and `3 to answer`, or `4/4 answered` and nothing left. */
export function questionsCount({ asked, answered, open }: Pick<QuestionsView, 'asked' | 'answered' | 'open'>): { badge: string | null; alert: string | null } {
  if (!asked) return { badge: null, alert: null };
  return open ? { badge: `${answered}/${asked}`, alert: `${open} to answer` } : { badge: `${answered}/${asked} answered`, alert: null };
}

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

/** Who answered a round, with their face, and the rest of its outcome after their name. */
function answeredByOf(row: DossierRoundRow, members: Member[], people: People, outcome: string): RoundEntry['answeredBy'] {
  if (row.status !== 'answered' || !row.answered_by) return null;
  const person = people.byId(row.answered_by, nameOf(row.answered_by, members));
  return { person, rest: outcome.slice(`answered by ${person.name}`.length) };
}

function quickOf(
  row: DossierRoundRow, rows: readonly DossierRoundRow[], members: Member[], answerable: readonly string[], now: number, people: People,
): QuickRound | null {
  if (!isQuick(row, now)) return null;
  const [only] = readQuestions(row.questions);
  const canAnswer = answerable.includes(row.round_id);
  return {
    question: only.question,
    choices: only.options.map((o) => {
      const shown = shownLabel(o.label);
      return { label: shown.text, recommended: shown.recommended, description: o.description, value: o.label };
    }),
    canAnswer,
    owner: nameOf(row.asked_by, members),
    next: nextOpen(rows, row.round_id),
    names: canAnswer ? Object.fromEntries(members.map((m) => [m.user_id, nameOf(m.user_id, members)])) : {},
    ownerFace: people.byId(row.asked_by, nameOf(row.asked_by, members)).face,
    faces: canAnswer ? Object.fromEntries(members.map((m) => [m.user_id, people.byId(m.user_id, nameOf(m.user_id, members)).face])) : {},
  };
}

/** A round's own page, carrying the dossier it is opened from, so that page can bring the person back. */
export const roundPath = (roundId: string, dossierId: string) =>
  `/ask/q/${encodeURIComponent(roundId)}?from=${encodeURIComponent(dossierId)}`;

/** The Outbox tab's context rail: its three switches, the latest before/after page, the latest spec,
 * and the brainstorm's questions with their answers. */
function contextView(id: string, versions: DossierVersionRow[], questions: QuestionsView, current: ContextKind, fallback: DossierTab): ContextView {
  const pages = versions.filter((v) => v.kind === 'before-after').length;
  const specs = versions.filter((v) => v.kind === 'spec').length;
  return {
    current,
    links: CONTEXTS.map((kind) => ({ kind, label: CONTEXT_LABELS[kind], href: hrefOf(id, 'outbox', null, fallback, kind), current: kind === current })),
    frame: pages ? sandboxPath(id, pages) : null,
    spec: specs || null,
    brainstorm: questions.rounds === null ? null : questions.rounds
      .filter((round) => round.rule === 'brainstorm')
      .flatMap((round) => round.questions.map((q) => ({ question: q.question, answer: q.answer }))),
  };
}

/** `27 Sep, 09:15`, in UTC. */
const whenOf = (iso: string) => {
  const at = new Date(iso);
  return `${shortDay(iso)}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
};

/** How many questions a round holds: those it shows, and never fewer than one, so no round goes uncounted. */
const sizeOf = (questions: readonly RoundQuestion[]) => Math.max(1, questions.length);

function countOf(state: QuestionShape, size: number): string {
  if (state === 'answered') return `${size}/${size}`;
  return state === 'open' ? `${size} to answer` : 'moved to the terminal';
}

export function questionsView(
  rows: DossierRoundRow[] | null, members: Member[], dossierId: string, answerable: readonly string[] = [], now: number = Date.now(),
  people: People = NOBODY,
): QuestionsView {
  if (rows === null) return { rounds: null, asked: 0, answered: 0, open: 0 };
  const rounds = [...rows].sort(askedOrder).map((row): RoundEntry => {
    const questions = roundQuestions(row);
    const state = shapeOf(row);
    const outcome = outcomeOf(row, members);
    return {
      id: row.round_id,
      rule: row.rule,
      state,
      headers: questions.map((q) => q.header.trim().toLowerCase()).filter(Boolean).join(', '),
      count: countOf(state, sizeOf(questions)),
      when: whenOf(row.created_at),
      href: roundPath(row.round_id, dossierId),
      questions,
      outcome,
      asked: `asked by ${nameOf(row.asked_by, members)} · ${stamp(row.created_at)}`,
      askedBy: people.byId(row.asked_by, nameOf(row.asked_by, members)),
      askedAt: stamp(row.created_at),
      answeredBy: answeredByOf(row, members, people, outcome),
      category: isCategory(row.category) ? CATEGORY_LABELS[row.category] : 'unsorted',
      categoryValue: isCategory(row.category) ? row.category : null,
      context: [row.repo, row.branch, row.prd ? `PRD #${row.prd}` : null, row.skill].filter((part): part is string => typeof part === 'string' && part !== ''),
      quick: quickOf(row, rows, members, answerable, now, people),
    };
  });
  const total = (state: QuestionShape | null) =>
    rounds.filter((r) => state === null || r.state === state).reduce((sum, r) => sum + sizeOf(r.questions), 0);
  return { rounds, asked: total(null), answered: total('answered'), open: total('open') };
}

/** What the page is read for: the rows, the viewer, the dossier's kind and tabs, the tab picked (its
 * default the `fallback`), the links between its views, and the GitHub summary a numbered PRD reads
 * (left out for a draft). */
type Page = {
  read: DossierRead; me: string | null; people: People; work: WorkKind; tabs: readonly DossierTab[]; tab: DossierTab; fallback: DossierTab;
  href: (to: DossierTab, version?: number | null) => string;
  numbered: GithubSummary | null | undefined;
};

function pageOf(read: DossierRead, me: string | null, pick: DossierPick): Page {
  const work = kindOf(read.dossier);
  const numbered = read.dossier.prd === null ? undefined : read.github;
  const kindTabs = work === 'prd' ? prdTabs(read) : KIND_TABS[work];
  const tabs = kindTabs.filter((t) => t !== 'care' || !noFeature(read.dossier.prd, numbered));
  const fallback = work === 'prd' ? defaultTab(read.rounds) : tabs[0];
  const tab = pick.tab !== null && tabs.includes(pick.tab) ? pick.tab : fallback;
  const href = (to: DossierTab, version: number | null = null) => hrefOf(read.dossier.id, to, version, fallback, null, work);
  return { read, me, people: read.people ?? NOBODY, work, tabs, tab, fallback, href, numbered };
}

/** Whether the PRD is known to have no feature PR: a draft, or GitHub answered there is none. While
 * GitHub is being read, or could not be, the PR care tab stays, so the tab bar does not move. */
const noFeature = (prd: number | null, github: GithubSummary | null | undefined) => prd === null || (!!github && github.feature === null);

/** The PRD's feature PR, open or merged; null when it has none, or it could not be read. */
function featureOf(github: GithubSummary | null | undefined) {
  const feature = github ? github.feature : null;
  return feature && feature !== UNREAD ? feature : null;
}

/** The Outbox tab, with its context rail while it is the tab shown. */
function outboxOf({ read, me, people, tab, fallback, numbered }: Page, questions: QuestionsView, context: ContextKind): OutboxView {
  return outboxView(numbered, {
    canAnswer: me !== null,
    demo: read.demo ?? false,
    people,
    sender: me === null ? null : people.byId(me, nameOf(me, read.members)).face,
    context: tab === 'outbox' ? contextView(read.dossier.id, read.versions, questions, context, fallback) : null,
  });
}

/** The tab's versions, newest first, the picked one (else the latest) current. */
function versionEntries({ read, tab, work, href }: Page, version: number | null): VersionEntry[] {
  const mine = isArtifactTab(tab) ? read.versions.filter((v) => v.kind === tab) : [];
  const picked = version !== null && version <= mine.length ? version : mine.length;
  return mine.map((row, i): VersionEntry => {
    const number = i + 1;
    return {
      id: row.id,
      number,
      label: `${tab === 'variations' ? `Round ${number}` : `v${number}`} · ${shortDay(row.created_at)} · ${versionSource(row, read.members)}`,
      href: href(tab, number),
      current: number === picked,
      frame: tab === 'before-after' || tab === 'variations' ? sandboxPath(read.dossier.id, number, work, tab) : null,
    };
  }).reverse();
}

/** The rail's spec is rendered by the route, as the Spec tab's is: its latest version; null with none. */
function railSpecOf({ read, href }: Page): VersionEntry | null {
  const specs = read.versions.filter((v) => v.kind === 'spec');
  if (!specs.length) return null;
  return { id: specs[specs.length - 1].id, number: specs.length, label: `v${specs.length}`, href: href('spec'), current: true, frame: null };
}

/** `DRAFT`, `PRD #216`, or a fix's `#548`. */
const headingOf = (prd: number | null, work: WorkKind) => (prd === null ? 'DRAFT' : `${work === 'prd' ? 'PRD ' : ''}#${prd}`);

/** A PRD's stage: a draft's from its questions, a numbered one's from its stored stages when they were
 * asked for; none for a fix. */
function stageOf({ read: { dossier, stages, github, slices = null }, work }: Page, questions: QuestionsView): StageView | null {
  if (work !== 'prd') return null;
  if (dossier.prd === null) return stageView({ prd: null, answered: questions.answered > 0, rows: [] });
  return stages !== undefined ? stageView({ prd: dossier.prd, rows: stages ?? [], github, slices }) : null;
}

type DossierHeader = Pick<DossierView,
  'id' | 'kind' | 'heading' | 'badge' | 'draft' | 'issueUrl' | 'stage' | 'title' | 'repos' | 'opened' | 'openedBy' | 'openedAt' | 'link' | 'canDelete'>;

function headerOf(page: Page, questions: QuestionsView): DossierHeader {
  const { read: { dossier, members, repos }, work, me, people } = page;
  const opener = dossier.opened_by === null ? 'read from GitHub' : `opened by ${nameOf(dossier.opened_by, members)}`;
  return {
    id: dossier.id,
    kind: work,
    heading: headingOf(dossier.prd, work),
    badge: WORK_NAMES[work].badge,
    draft: dossier.prd === null,
    issueUrl: dossier.prd === null ? null : issueUrl(dossier.home_repo, dossier.prd),
    stage: stageOf(page, questions),
    title: dossier.title,
    repos: repos?.length ? repos : [dossier.home_repo],
    opened: `${opener} · ${stamp(dossier.created_at)}`,
    openedBy: dossier.opened_by === null ? null : people.byId(dossier.opened_by, nameOf(dossier.opened_by, members)),
    openedAt: stamp(dossier.created_at),
    link: dossierPath(dossier.id, work),
    canDelete: dossier.prd === null && me !== null && dossier.opened_by === me,
  };
}

/** What the tabs' badges read from: the retro PR's, the outbox, the questions' count, and how many
 * versions each artifact has. */
type Badges = {
  retro: string | null; care: string | null; outbox: OutboxView; counted: { badge: string | null; alert: string | null };
  count: (kind: ArtifactKind) => number; runs: number; pitches: number;
};

/** The Retro tab's badge: whether the retro PR is open or merged; null with none, or GitHub unread. */
function retroBadge(github: GithubSummary | null | undefined): string | null {
  const pr = github && github.retro !== UNREAD ? github.retro : null;
  if (!pr) return null;
  return pr.state === 'open' ? 'open PR' : 'merged';
}

/** The Outbox tab's badge: the open decisions, else the settled ones; null with none. */
const outboxBadge = ({ open, ledger }: OutboxView) => (open.length ? `${open.length} open` : ledger ? `${ledger} settled` : null);

function badgeOf(kind: DossierTab, badges: Badges): string | null {
  if (kind === 'retro') return badges.retro;
  if (kind === 'care') return badges.care;
  if (kind === 'outbox') return outboxBadge(badges.outbox);
  if (kind === 'proof') return badges.runs ? runsBadge(badges.runs) : null;
  if (kind === 'pitch') return badges.pitches ? pitchesBadge(badges.pitches) : null;
  if (kind === 'variations') return roundsBadge(badges.count(kind));
  if (kind === 'questions') return badges.counted.badge;
  if (!isArtifactTab(kind)) return null;
  return badges.count(kind) ? `v${badges.count(kind)}` : null;
}

/** The tabs drawn dimmed while they hold nothing; any other tab never is. */
const EMPTY_WHEN: Partial<Record<DossierTab, (badges: Badges, retro: RetroView, care: CareView | null) => boolean>> = {
  outbox: (badges) => badges.outbox.state !== 'items',
  retro: (_badges, retro) => retro.state !== 'text',
  care: (_badges, _retro, care) => care?.state !== 'care',
  voice: (badges) => badges.count('voice') === 0,
};

function tabEntry(kind: DossierTab, { tab, href }: Page, badges: Badges, retro: RetroView, care: CareView | null): TabEntry {
  return {
    kind,
    label: TAB_LABELS[kind],
    badge: badgeOf(kind, badges),
    alert: kind === 'questions' ? badges.counted.alert : null,
    href: href(kind),
    current: kind === tab,
    empty: EMPTY_WHEN[kind]?.(badges, retro, care) ?? false,
  };
}

export function dossierView(read: DossierRead, me: string | null, pick: DossierPick, now: number = Date.now()): DossierView {
  const page = pageOf(read, me, pick);
  const questions = questionsView(read.rounds, read.members, read.dossier.id, read.answerable ?? [], now, page.people);
  const context = pick.context ?? 'before-after';
  const outbox = outboxOf(page, questions, context);
  const retro = retroView(page.numbered);
  const care = careView(page.numbered, read.dossier.prd, page.people, now);
  const count = (kind: ArtifactKind) => read.versions.filter((v) => v.kind === kind).length;
  const runs = page.tabs.includes('proof') ? read.proofs?.runs.length ?? 0 : 0;
  const pitches = page.tabs.includes('pitch') ? read.pitches?.runs.length ?? 0 : 0;
  const badges: Badges = { retro: retroBadge(page.numbered), care: careBadge(care), outbox, counted: questionsCount(questions), count, runs, pitches };
  const versions = versionEntries(page, pick.version);
  const railSpec = page.tab === 'outbox' && context === 'spec' ? railSpecOf(page) : null;
  return {
    ...headerOf(page, questions),
    tabs: page.tabs.map((kind) => tabEntry(kind, page, badges, retro, care)),
    tab: page.tab,
    versions,
    shown: railSpec ?? versions.find((e) => e.current) ?? null,
    questions,
    outbox,
    retro,
    care,
    fix: page.work === 'prd' ? null : read.fix ?? null,
    rework: page.work === 'prd' && read.dossier.prd !== null ? reworkCommand(read.dossier.prd) : null,
    proof: runs && read.proofs ? proofView(read.proofs, page.tab === 'proof' ? pick.version : null, (n) => page.href('proof', n), read.members) : null,
    pitch: pitches && read.pitches ? pitchView(read.pitches, pick.pitch ?? null, read.members) : null,
    ...(read.demo ? { demo: true as const } : {}),
  };
}

/** The Variations tab's badge: how many rounds were shown (`2 rounds`); null with none. */
const roundsBadge = (count: number) => (count ? `${count} round${count === 1 ? '' : 's'}` : null);

const retroUnread = (prUrl: string | null = null): RetroView => ({ state: 'unread', words: GITHUB_UNREAD, prUrl, text: null });

/** The Retro tab, from the GitHub summary: null when it could not be read, left out when it was not asked for. */
export function retroView(github: GithubSummary | null | undefined): RetroView {
  if (github === null) return retroUnread();
  return github === undefined ? retroOf(null, null) : retroOf(github.retro ?? null, github.retroText ?? null);
}

/** The Retro tab from its PR and its retro.md, either unread from GitHub, or null when there is none. */
function retroOf(pr: NonNullable<GithubSummary['retro']> | null, text: NonNullable<GithubSummary['retroText']> | null): RetroView {
  if (pr === UNREAD) return retroUnread();
  if (text === UNREAD) return retroUnread(pr?.url ?? null);
  if (!pr || text === null) return { state: 'empty', words: RETRO_EMPTY, prUrl: pr?.url ?? null, text: null };
  return { state: 'text', words: null, prUrl: pr.url, text };
}

/** A merged feature PR's PR care tab says why it is empty. */
const CARE_DONE = 'The feature PR is merged: nothing is left to look after.';

const CI_WORDS: Record<CareCi, string> = { green: 'green', red: 'red', running: 'running', none: 'no check reported' };
const VERDICT_WORDS: Record<CareVerdict, string> = { open: 'not handled yet', fixed: 'fixed', 'pushed-back': 'pushed back', asked: 'asked: the PM decides' };

/** The PR care tab's badge: the threads still waiting, when there are any. */
const careBadge = (care: CareView | null) => (care?.state === 'care' && care.counts.open + care.counts.asked ? `${care.counts.open + care.counts.asked} open` : null);

/** The watcher line (PRD 790): `Claude is watching · last round 3 min ago` under 15 minutes, else nobody. */
export function watcherOf(lastRound: string | null, prd: number, now: number): CareView['watcher'] {
  const command = `/omni:pr-care ${prd}`;
  const ago = lastRound === null ? NaN : now - Date.parse(lastRound);
  if (!(ago < WATCH_FRESH_MS)) return { watching: false, words: 'Nobody is watching', command };
  const minutes = Math.max(0, Math.floor(ago / 60_000));
  return { watching: true, words: `Claude is watching · last round ${minutes} min ago`, command };
}

const NO_CARE = { ci: { state: 'none' as const, words: CI_WORDS.none, href: null }, conflict: { state: 'unknown' as const, words: 'unknown' },
  counts: { open: 0, fixed: 0, 'pushed-back': 0, asked: 0 }, threads: [] };

/** The PR care tab, from the GitHub summary: null when the PRD is known to have no feature PR (the tab
 * is not shown); pending while GitHub was not asked, unread when it did not answer. */
function careView(github: GithubSummary | null | undefined, prd: number | null, people: People, now: number): CareView | null {
  if (prd === null || noFeature(prd, github)) return null;
  const watcher = watcherOf(null, prd, now);
  if (github === undefined) return { state: 'pending', words: GITHUB_PENDING, prUrl: null, ...NO_CARE, watcher };
  const feature = featureOf(github);
  if (!github || !feature) return { state: 'unread', words: GITHUB_UNREAD, prUrl: null, ...NO_CARE, watcher };
  if (feature.state !== 'open') return { state: 'done', words: CARE_DONE, prUrl: feature.url, ...NO_CARE, watcher };
  const care = github.care;
  if (!care || care === UNREAD) return { state: 'unread', words: GITHUB_UNREAD, prUrl: feature.url, ...NO_CARE, watcher };
  const counts = { open: 0, fixed: 0, 'pushed-back': 0, asked: 0 };
  for (const t of care.threads) counts[t.verdict] += 1;
  return {
    state: 'care',
    words: null,
    prUrl: feature.url,
    ci: { state: care.ci, words: CI_WORDS[care.ci], href: care.ci === 'red' ? care.failedUrl : null },
    conflict: care.conflict === null ? { state: 'unknown', words: 'GitHub is still checking' }
      : care.conflict ? { state: 'conflict', words: `conflicting with ${care.base}` } : { state: 'none', words: 'none' },
    counts,
    threads: care.threads.map((t): CareThreadView => {
      const known = people.byLogin(t.login);
      const person = known.login || !t.avatar ? known : { ...known, face: { kind: 'photo' as const, url: t.avatar } };
      return { login: t.login, person, firstLine: t.firstLine, verdict: t.verdict, verdictWords: VERDICT_WORDS[t.verdict], reason: t.reason, url: t.url };
    }),
    watcher: watcherOf(care.lastRound, prd, now),
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
