import { missionBranch } from '../mission-branch';
import { CAUSE_REPAIRS, leftOf, MISSION_REPAIRS, OUTCOME_WORDS, pullOf, type Linked, type RepairRow } from '../repair';
import type { ItemAnswer, MissionStatus } from '../missions.contract';

// What a mission's retros and own outbox look like on the Missions tab (PRD 3065 s5, the `mission-start` screen's 1.A to 1.E),
// pure so each state is tested without a page: `Stuck: 5 jobs, nothing moved` while a stuck repair works, `Paused: stuck` with
// the question asked once, the Retros cards and the Questions cards. A card holds the sentences a retro cited and nothing else:
// no log, no login. Adopt records the answer; the card then says the one line that applies the change, which a person runs.

export const RETRO_WORDS = {
  stuck: 'Stuck: 5 jobs, nothing moved',
  pausedStuck: 'Paused: stuck',
  cause: 'Cause',
  tried: 'Repairs tried',
  proposedFix: 'Proposed fix',
  stopMission: 'Stop the mission',
  retros: 'Retros',
  questions: 'Questions',
  wentWell: 'Went well',
  toChange: 'To change',
  keptHere: 'Kept on this page only',
  onBranch: 'on the mission branch',
  proposed: 'Proposed wording',
  evidence: 'Evidence',
  adopt: 'Adopt',
  decline: 'Decline',
  noRecord: 'No record that could be read.',
  member: 'a member',
} as const;

/** One cited sentence of a retro: what it says and what it cites (an event, a PRD, a pull request or a repair of its mission). */
export interface CitedRow {
  text: string;
  cites: readonly { kind: 'event' | 'prd' | 'pr' | 'repair'; ref: number }[];
}

/** A milestone retro as the repository read it: its milestone (`mission` or a roadmap's number), its sentences or why it was skipped. */
export interface RetroRow {
  id: string;
  mission: string;
  milestone: string;
  retro: { wentWell: readonly CitedRow[]; toChange: readonly CitedRow[] } | null;
  skipped: string | null;
  file: string | null;
  at: string;
}

/** A mission item as the repository read it: what it proposes to change, the wording, the evidence and its answer. */
export interface ItemRow {
  id: string;
  mission: string;
  target: string;
  wording: string;
  evidence: readonly string[];
  answer: ItemAnswer | null;
  note: string | null;
  /** The member who answered, by name; null when nobody did or the name is not known. */
  answeredBy: string | null;
  at: string;
}

/** What the tab reads of the retros: the retros, the items, and the repairs the mission kept (a stuck repair is one). */
export interface RetroRead {
  repairs: readonly RepairRow[];
  retros: readonly RetroRow[];
  items: readonly ItemRow[];
}

export const NO_RETROS: RetroRead = { repairs: [], retros: [], items: [] };

export interface CiteView {
  label: string;
  href: string | null;
}

export interface SentenceView {
  text: string;
  cites: CiteView[];
}

/** The file a retro kept on the mission branch, linked. */
export interface RetroFile {
  path: string;
  href: string;
  words: string;
}

/** One milestone retro: `Roadmap #2790 delivered` or `Mission delivered`, its two sides and where it is kept. */
export interface RetroCard {
  id: string;
  headline: string;
  wentWell: SentenceView[];
  toChange: SentenceView[];
  file: RetroFile | null;
  /** `Kept on this page only`, for a retro with no file (at `with-you`). */
  keptHere: string | null;
  /** `Retro skipped: budget reached`, for a retro that was not written; read as not done. */
  skipped: string | null;
}

/** An answered item: who, what, the note, and the one line that applies the change (null once declined). */
export interface ItemAnswered {
  by: string;
  words: string;
  note: string | null;
  apply: string | null;
}

/** One question of the mission's own outbox. */
export interface ItemCard {
  id: string;
  title: string;
  wording: string;
  evidence: readonly string[];
  /** Null while it waits for Adopt or Decline. */
  answered: ItemAnswered | null;
}

/** The stuck line of a mission whose stuck repair works. */
export interface StuckGoing {
  headline: string;
  /** `Repairing (1 of 3) · 7 left in this mission`. */
  repairing: string;
  fix: Linked | null;
  cause: string | null;
}

/** One repair a stuck mission tried, in words. */
export interface StuckTried {
  fix: Linked | null;
  words: string;
}

/** The question a mission paused by stuck asks, once. */
export interface StuckPaused {
  headline: string;
  cause: string;
  tried: StuckTried[];
  proposedFix: string | null;
  /** `Each cause gets 3 more · 6 of 9 left`. */
  left: string;
}

const own = (rows: readonly RepairRow[], mission: string): RepairRow[] => rows.filter((row) => row.mission === mission).toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));

/** What a stuck repair did when it left no fix pull request: the way its class took. */
const WAY: Readonly<Record<string, string>> = { flake: 'Retried as a flake', 'omni-loop': 'Reported to Omni Loop', person: 'Needs a person' };

/** The stuck line of a running or waiting mission whose stuck repair is at work; null otherwise. */
export function stuckGoingOf(mission: { id: string; status: MissionStatus }, rows: readonly RepairRow[]): StuckGoing | null {
  if (mission.status !== 'running' && mission.status !== 'waiting') return null;
  const mine = own(rows, mission.id);
  const working = mine.findLast((row) => row.trigger === 'stuck' && row.outcome === null);
  if (working === undefined) return null;
  return {
    headline: RETRO_WORDS.stuck,
    repairing: `Repairing (${String(working.number)} of ${String(CAUSE_REPAIRS)}) · ${String(leftOf(mine))} left in this mission`,
    fix: pullOf(working.fixPr),
    cause: working.retro?.cause ?? null,
  };
}

/** The question of a mission the supervisor paused by stuck: the cause, the repairs tried, the proposed fix and what is left; null for any other mission. */
export function stuckPausedOf(mission: { id: string; status: MissionStatus; pausedBy: 'stuck' | null }, rows: readonly RepairRow[]): StuckPaused | null {
  if (mission.status !== 'paused' || mission.pausedBy !== 'stuck') return null;
  const mine = own(rows, mission.id);
  const stuck = mine.filter((row) => row.trigger === 'stuck');
  const last = stuck.findLast((row) => row.retro !== null) ?? stuck.at(-1);
  const tried = last === undefined ? [] : stuck.filter((row) => row.round === last.round && row.fingerprint === last.fingerprint).map((row): StuckTried => ({
    fix: pullOf(row.fixPr),
    words: `${row.fixPr === null ? (WAY[row.retro?.class ?? ''] ?? 'No fix') : 'Fix'}${row.outcome === null ? '' : ` · ${OUTCOME_WORDS[row.outcome].toLowerCase()}`}`,
  }));
  return {
    headline: RETRO_WORDS.pausedStuck,
    cause: last?.retro?.cause ?? RETRO_WORDS.noRecord,
    tried,
    proposedFix: last?.retro?.proposedFix ?? null,
    left: `Each cause gets ${String(CAUSE_REPAIRS)} more · ${String(Math.max(0, MISSION_REPAIRS - mine.filter((row) => row.outcome !== 'lost').length))} of ${String(MISSION_REPAIRS)} left`,
  };
}

const issueHref = (repo: string, kind: 'issues' | 'pull', n: number) => `https://github.com/${repo}/${kind}/${String(n)}`;

function citeOf(repo: string, cite: CitedRow['cites'][number]): CiteView {
  if (cite.kind === 'prd') return { label: `PRD ${String(cite.ref)}`, href: issueHref(repo, 'issues', cite.ref) };
  if (cite.kind === 'pr') return { label: `PR ${String(cite.ref)}`, href: issueHref(repo, 'pull', cite.ref) };
  return { label: `${cite.kind} ${String(cite.ref)}`, href: null };
}

const sentencesOf = (repo: string, rows: readonly CitedRow[]): SentenceView[] => rows.map((row) => ({ text: row.text, cites: row.cites.map((cite) => citeOf(repo, cite)) }));

/** `Roadmap #2790 delivered`, or `Mission delivered`. */
const headlineOf = (milestone: string): string => (milestone === 'mission' ? 'Mission delivered' : `Roadmap #${milestone} delivered`);

/** The file a retro kept on its mission's branch, linked; null when it kept none (at `with-you`). */
function fileOf(mission: { repo: string; number: number; title: string }, retro: RetroRow): RetroFile | null {
  if (retro.file === null) return null;
  return { path: retro.file.slice(Math.max(0, retro.file.lastIndexOf('retros/'))), href: `https://github.com/${mission.repo}/blob/${missionBranch(mission)}/${retro.file}`, words: RETRO_WORDS.onBranch };
}

/** A retro that was not written, or that cannot be read whole here, reads as not done, never as done (BL-GATE-1). */
const skippedOf = (retro: RetroRow): string | null => (retro.skipped === null && retro.retro !== null ? null : `Retro skipped: ${retro.skipped ?? 'it could not be read'}`);

/** A mission's retro cards, in the order the milestones were reached. Each file is linked on the mission's branch. */
export function retroCardsOf(mission: { id: string; repo: string; number: number; title: string }, retros: readonly RetroRow[]): RetroCard[] {
  return retros
    .filter((retro) => retro.mission === mission.id)
    .toSorted((a, b) => a.at.localeCompare(b.at))
    .map((retro): RetroCard => ({
      id: retro.id,
      headline: headlineOf(retro.milestone),
      wentWell: sentencesOf(mission.repo, retro.retro?.wentWell ?? []),
      toChange: sentencesOf(mission.repo, retro.retro?.toChange ?? []),
      file: fileOf(mission, retro),
      keptHere: retro.file === null && retro.retro !== null ? RETRO_WORDS.keptHere : null,
      skipped: skippedOf(retro),
    }));
}

/** The one line that applies an adopted change: a law's goes through its owner, anything else is a docs pull request a person merges. */
export function applyLine(target: string): string {
  const law = /^law (\S+)$/.exec(target)?.[1];
  return law === undefined ? `open a docs pull request on ${target}, and merge it.` : `/omni:knowledge-add amend ${law} (only its owner approves).`;
}

/** What an answered item says: who, what, the note, and the one line that applies the change. */
function answeredOf(item: ItemRow): ItemAnswered | null {
  if (item.answer === null) return null;
  return { by: item.answeredBy ?? RETRO_WORDS.member, words: item.answer === 'adopted' ? 'Adopted' : 'Declined', note: item.note, apply: item.answer === 'adopted' ? applyLine(item.target) : null };
}

/** A mission's question cards, oldest first. An adopted one says it is not applied yet and how to apply it; nothing applies it for a person. */
export function itemCardsOf(mission: string, items: readonly ItemRow[]): ItemCard[] {
  return items
    .filter((item) => item.mission === mission)
    .toSorted((a, b) => a.at.localeCompare(b.at))
    .map((item): ItemCard => ({ id: item.id, title: `Change ${item.target}`, wording: item.wording, evidence: item.evidence, answered: answeredOf(item) }));
}
