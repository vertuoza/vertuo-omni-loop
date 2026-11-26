import { parsePrd, type IssueNumber, type PrdNumber, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { jobHref } from '../../runners/send/targets';
import type { Card, CardSource } from './commander.contract';
import { ACTIVE, prdHref } from './commander';

// The Waiting on you rail (PRD 3107 s2, the `fleet-commander` screen): one card per question of this fleet that waits on
// a person, each built from its question's own record and never from the model (AC-13): a runner job's questions, a
// mission item, an item of a PRD's outbox, an approval request. A job's single question with one pick, and a mission
// item (Adopt or Decline), are answered from the card; an outbox item, a job asking several questions or several picks,
// and an approval are answered on their own page, which the card links (approving stays on the PRD's page). A card
// answered in the last 24 hours stays, read `Answered by` whoever answered it, wherever they did (AC-12). Pure, so each
// rule is tested without a database; every word the rail shows is here.

export const RAIL_WORDS = {
  rail: 'Waiting on you',
  nothing: 'Nothing waits on you.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  notSent: 'Not sent: try again.',
  approve: 'Approve on its page.',
  onItsPage: 'Answer on its page',
  adopt: 'Adopt',
  decline: 'Decline',
  you: 'you',
  someone: 'a member',
} as const;

const SOURCE_WORDS: Record<CardSource, string> = { job: 'Question', item: 'Mission item', outbox: 'Outbox', approval: 'Approval' };

/** The most cards the rail holds. */
const MAX_CARDS = 50;
/** How long an answered card stays in the rail. */
const ANSWERED_STAYS_MS = 24 * 60 * 60 * 1000;

// ── The records ──────────────────────────────────────────────────────────────

export interface RailMission {
  id: string;
  number: number;
  repo: string;
  status: string;
  /** A repository PRD's number or a product PRD's id. */
  prds: readonly (PrdNumber | ProductPrdId)[];
}

/** One question of a job, in the shape `omni ask question --file` reads. */
export interface JobQuestion {
  question: string;
  options: readonly { label: string }[];
  multiSelect: boolean;
}

/** A job's questions (runner_job_questions), with the mission that sent the job. */
export interface JobQuestionsRow {
  job: string;
  mission: string;
  issue: IssueNumber;
  questions: readonly JobQuestion[];
  answers: Readonly<Record<string, string>> | null;
  closedBy: string | null;
  closedAt: string | null;
  askedAt: string;
}

/** A mission item (mission_items): a change a retro or a repair proposes, adopted or declined once. */
export interface MissionItemRow {
  id: string;
  mission: string;
  target: string;
  wording: string;
  answer: 'adopted' | 'declined' | null;
  answeredBy: string | null;
  answeredAt: string | null;
  createdAt: string;
}

/** What a PRD's outbox holds waiting on a person (prd_outbox). */
export interface OutboxRow {
  repository: string;
  prd: PrdNumber;
  waiting: readonly { id: string; question: string }[];
  syncedAt: string;
}

/** An approval request waiting on the signed-in member (approval_requests_waiting()). */
export interface ApprovalRow {
  id: string;
  repo: string;
  prd: PrdNumber;
  title: string;
  askedAt: string;
}

/** What the rail reads of one fleet: never another fleet's. Logins by account id, for who answered. */
export interface RailRecord {
  fleet: string;
  missions: readonly RailMission[];
  jobs: readonly JobQuestionsRow[];
  items: readonly MissionItemRow[];
  outbox: readonly OutboxRow[];
  approvals: readonly ApprovalRow[];
  logins: ReadonlyMap<string, string>;
}

// ── Words ────────────────────────────────────────────────────────────────────

export const railHeading = (open: number): string => `${RAIL_WORDS.rail} · ${String(open)}`;
export const answersAs = (login: string | null): string => `Answers as ${login ?? RAIL_WORDS.you}`;
export const answerAs = (login: string | null): string => `Answer as ${login ?? RAIL_WORDS.you}?`;
export const openPrd = (prd: PrdNumber): string => `Open PRD ${String(prd)}`;
/** `Answered by paul-n · 08:58 · `, the choice drawn after it. */
export const answeredBy = (answered: NonNullable<Card['answered']>): string => `Answered by ${answered.login} · ${new Date(answered.at).toISOString().slice(11, 16)} · `;
/** Where a card's question comes from: `Question · job 4f2a1b2c · PRD 2817`. */
export const sourceLine = (card: Pick<Card, 'source' | 'ref' | 'prd'>): string =>
  [SOURCE_WORDS[card.source], card.ref, card.prd === null ? null : `PRD ${String(card.prd)}`].filter((part) => part !== null).join(' · ');
/** How many cards wait. */
export const openCount = (cards: readonly Card[]): number => cards.filter((c) => c.answered === null).length;

// ── Links ────────────────────────────────────────────────────────────────────

const missionsTab = (fleet: string): string => `/app/ai-fleet?fleet=${encodeURIComponent(fleet)}&tab=missions`;
const cut = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

// ── The cards ────────────────────────────────────────────────────────────────

/** A mission item's choices and the answer each sends. */
export const ITEM_CHOICES: Readonly<Record<string, 'adopted' | 'declined'>> = { [RAIL_WORDS.adopt]: 'adopted', [RAIL_WORDS.decline]: 'declined' };
const ITEM_WORDS = { adopted: RAIL_WORDS.adopt, declined: RAIL_WORDS.decline } as const;

/** Whether a record answered at `at` still shows: open, or answered in the last 24 hours. */
const stays = (at: string | null, now: Date): boolean => at === null || new Date(at).getTime() >= now.getTime() - ANSWERED_STAYS_MS;

/** A job's card: its question and picks when it asks one question with one pick; otherwise answered on its page. */
function jobCard(row: JobQuestionsRow, logins: ReadonlyMap<string, string>): Card {
  const [only, ...more] = row.questions;
  const one = only !== undefined && more.length === 0 && !only.multiSelect;
  const answered = row.answers === null || row.closedAt === null ? null : {
    login: (row.closedBy === null ? undefined : logins.get(row.closedBy)) ?? RAIL_WORDS.someone,
    at: row.closedAt,
    choice: cut(Object.values(row.answers).join(' · '), 200),
  };
  return {
    source: 'job', id: row.job, ref: `job ${row.job.slice(0, 8)}`, prd: parsePrd(row.issue),
    question: cut(row.questions.map((q) => q.question).join(' '), 1000),
    choices: one ? only.options.map((o) => cut(o.label, 200)).slice(0, 6) : [],
    href: jobHref(row.job), at: row.askedAt, answered,
  };
}

function itemCard(row: MissionItemRow, mission: RailMission | undefined, fleet: string, logins: ReadonlyMap<string, string>): Card {
  const answered = row.answer === null || row.answeredAt === null ? null : {
    login: (row.answeredBy === null ? undefined : logins.get(row.answeredBy)) ?? RAIL_WORDS.someone,
    at: row.answeredAt,
    choice: ITEM_WORDS[row.answer],
  };
  return {
    source: 'item', id: row.id, ref: mission ? `mission ${String(mission.number)}` : null, prd: null,
    question: cut(`${row.target}: ${row.wording}`, 1000), choices: [RAIL_WORDS.adopt, RAIL_WORDS.decline],
    href: missionsTab(fleet), at: row.createdAt, answered,
  };
}

/** The repositories of the fleet's missions that run, wait or are paused: the outboxes the rail reads. */
export const activeRepos = (missions: readonly RailMission[]): string[] => [...new Set(missions.filter((m) => ACTIVE.includes(m.status)).map((m) => m.repo))];

/** The PRDs the fleet's missions that run, wait or are paused work on, as `repo#prd`. */
const activePrds = (missions: readonly RailMission[]): Set<string> =>
  new Set(missions.filter((m) => ACTIVE.includes(m.status)).flatMap((m) => m.prds.map((prd) => `${m.repo}#${String(prd)}`)));

/** The rail's cards: the open ones first, oldest first, then the ones answered in the last 24 hours, newest first. */
export function cardsOf(record: RailRecord, now: Date): Card[] {
  const ours = new Set(record.missions.map((m) => m.id));
  const byId = new Map(record.missions.map((m) => [m.id, m]));
  const prds = activePrds(record.missions);
  const cards: Card[] = [
    ...record.jobs.filter((j) => ours.has(j.mission) && (j.closedAt === null || (j.answers !== null && stays(j.closedAt, now)))).map((j) => jobCard(j, record.logins)),
    ...record.items.filter((i) => ours.has(i.mission) && stays(i.answeredAt, now)).map((i) => itemCard(i, byId.get(i.mission), record.fleet, record.logins)),
    ...record.outbox.filter((o) => prds.has(`${o.repository}#${String(o.prd)}`)).flatMap((o) => o.waiting.map((w): Card => ({
      source: 'outbox', id: `${o.repository}#${String(o.prd)}/${w.id}`, ref: null, prd: o.prd, question: cut(w.question, 1000), choices: [],
      href: prdHref(o.repository, o.prd), at: o.syncedAt, answered: null,
    }))),
    ...record.approvals.filter((a) => prds.has(`${a.repo}#${String(a.prd)}`)).map((a): Card => ({
      source: 'approval', id: a.id, ref: null, prd: a.prd, question: cut(a.title, 1000), choices: [], href: prdHref(a.repo, a.prd), at: a.askedAt, answered: null,
    })),
  ];
  const open = cards.filter((c) => c.answered === null).sort((a, b) => a.at.localeCompare(b.at));
  const done = cards.filter((c) => c.answered !== null).sort((a, b) => (b.answered?.at ?? '').localeCompare(a.answered?.at ?? ''));
  return [...open, ...done].slice(0, MAX_CARDS);
}

/** Whether a card is answered from the rail: a job's single question or a mission item, while it waits. */
export const answerable = (card: Card): boolean => card.answered === null && card.choices.length > 0 && (card.source === 'job' || card.source === 'item');
