// Where a PRD is, and what to do about it, on its page (PRD 426, made real by PRD 587). The stage, the
// track and the questions badge come from the PRD's stored stages alone (../../stages/stage.ts): the
// header never waits on GitHub for them. The one button and the links line keep PRD 426's rules, read
// from the GitHub summary when there is one: without it, a stage that needs GitHub for its button shows
// none, and the links line is empty. While the feature PR is open, its link carries the health chip
// (PRD 790, s2), from the care state the summary read: none when that read failed.
//
// `stageOf` below is PRD 426's reading of the stage from the GitHub summary alone. Only the page's
// pulse (./live.ts) still uses it, to notice that something moved on GitHub; nothing shows it.
import { openThreads, type CareState } from '../github/care';
import { UNREAD, type GithubSummary, type IssueRef, type PullRef, type Read } from '../github/summary';
import { storedStageOf, type CurrentStage, type OpenOutbox, type StageId, type StageRow } from '../../stages/stage';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

export { STAGES, STAGE_LABELS, type StageId } from '../../stages/stage';

/** The one button: a link that opens GitHub, or a command to copy. */
export type NextAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'copy'; label: string; command: string };

/** PRD 426's stage, read from the GitHub summary: unknown when what decides it could not be read. */
export type Stage = { id: StageId | 'unknown'; action: NextAction | null; caption: string | null };

const unknown: Stage = { id: 'unknown', action: null, caption: null };
const known = <T,>(value: Read<T>): value is T => value !== UNREAD;

/** Where the outbox is answered: the feature PR's outbox comment, else the feature PR; null when neither is known. */
export function outboxAnswerUrl(summary: GithubSummary): string | null {
  const comment = summary.outboxComment ?? null;
  if (known(comment) && comment) return comment;
  return known(summary.feature) && summary.feature ? summary.feature.url : null;
}

/** The feature PR's open outbox items and where they are answered; null when unknown or none is open. */
function openOutboxOf(summary: GithubSummary | null | undefined): OpenOutbox {
  const outbox = summary?.outbox ?? null;
  if (!summary || !outbox || !known(outbox) || outbox.open.length === 0) return null;
  const href = outboxAnswerUrl(summary);
  return href ? { count: outbox.open.length, href } : null;
}

/** The stage from the GitHub summary alone (PRD 426), for the page's pulse. `slices` is the plan's slice count. */
export function stageOf(prd: PrdNumber | null, summary: GithubSummary | null, slices: number | null = null): Stage {
  if (prd === null) return { id: 'idea', action: null, caption: 'Brainstorm in progress' };
  if (!summary) return unknown;
  const { retro, feature, mergedSlices, phase0 } = summary;
  if (!known(retro)) return unknown;
  if (retro) return { id: 'retro', ...actionOf('retro', prd, summary, slices) };
  if (!known(feature)) return unknown;
  if (feature?.state === 'merged') return { id: 'shipped', ...actionOf('shipped', prd, summary, slices) };
  if (!known(mergedSlices)) return unknown;
  if (mergedSlices > 0) {
    const outbox = summary.outbox ?? null;
    if (!known(outbox)) return unknown;
    const ready = feature && !feature.draft && !(outbox && outbox.open.length > 0);
    return { id: 'outbox', ...actionOf(ready ? 'outbox' : 'building', prd, summary, slices) };
  }
  if (!known(phase0)) return unknown;
  if (phase0?.state === 'merged') return { id: 'inbox', ...actionOf('inbox', prd, summary, slices) };
  return { id: 'prd', ...actionOf('prd', prd, summary, slices) };
}

type Action = { action: NextAction | null; caption: string | null };
const none: Action = { action: null, caption: null };

type ActionInput = { prd: PrdNumber | null; read: GithubSummary | null; slices: number | null };

const caption = (text: string): Action => ({ action: null, caption: text });
const link = (label: string, href: string): Action => ({ action: { kind: 'link', label, href }, caption: null });

function specAction({ read }: ActionInput): Action {
  const phase0 = read ? read.phase0 : UNREAD;
  if (!known(phase0)) return none;
  if (phase0 === null) return caption('Spec being written');
  return phase0.state === 'merged' ? none : link('Approve spec', phase0.url);
}

function buildAction({ prd }: ActionInput): Action {
  return prd === null ? none : { action: { kind: 'copy', label: 'Build it', command: `/omni:yolo ${prd}` }, caption: null };
}

/** `2/4 slices`, or `2 slices merged` when the plan's slice count is not known. */
const builtWords = (merged: number, slices: number | null) =>
  slices === null ? `${merged} slice${merged === 1 ? '' : 's'} merged` : `${merged}/${slices} slices`;

function buildingCaption({ read, slices }: ActionInput): Action {
  const merged = read ? read.mergedSlices : UNREAD;
  if (!known(merged) || merged === 0) return caption('Being built');
  return caption(`Being built · ${builtWords(merged, slices)}`);
}

function reviewAction({ read }: ActionInput): Action {
  const feature = read ? read.feature : UNREAD;
  return known(feature) && feature ? link('Review & merge', feature.url) : none;
}

/** Open outbox items come first: the button answers them, whatever the stage would show otherwise. */
const outboxFirst =
  (otherwise: (input: ActionInput) => Action) =>
  (input: ActionInput): Action => {
    const open = openOutboxOf(input.read);
    return open ? link('Answer the outbox', open.href) : otherwise(input);
  };

function retroAction({ read }: ActionInput): Action {
  const retro = read ? read.retro : UNREAD;
  return known(retro) && retro ? link('Read the retro', retro.url) : none;
}

const ACTIONS: Readonly<Record<CurrentStage['id'], (input: ActionInput) => Action>> = {
  idea: () => caption('Brainstorm in progress'),
  brainstorming: () => none,
  syncing: () => none,
  prd: specAction,
  inbox: buildAction,
  building: outboxFirst(buildingCaption),
  outbox: outboxFirst(reviewAction),
  shipped: () => caption('Shipped · the retro is written next'),
  retro: retroAction,
};

/** The one button and the caption of a stage, by PRD 426's rules, from what the GitHub summary holds. */
function actionOf(id: CurrentStage['id'], prd: PrdNumber | null, summary: GithubSummary | null | undefined, slices: number | null = null): Action {
  return ACTIONS[id]({ prd, read: summary ?? null, slices });
}

/** The feature PR's health chip (PRD 790, s2): `CI ✓ · no conflict · 2 open`, red on CI red or a
 * conflict, grey while CI runs. */
export type CareChip = { label: string; tone: 'ok' | 'red' | 'grey' };

const CI_WORDS: Record<CareState['ci'], string> = { green: 'CI ✓', red: 'CI red', running: 'CI running', none: 'no CI' };

export function careChipOf(care: CareState): CareChip {
  const conflict = care.conflict === null ? [] : [care.conflict ? 'conflict' : 'no conflict'];
  const label = [CI_WORDS[care.ci], ...conflict, `${openThreads(care)} open`].join(' · ');
  const tone = care.ci === 'red' || care.conflict ? 'red' : care.ci === 'running' ? 'grey' : 'ok';
  return { label, tone };
}

/** One entry of the links line: `issue #426`, `phase-0 #431`…, done (✓) once merged or closed. The open
 * feature PR's carries its health chip when its care state was read. */
export type StageLink = { label: string; href: string; done: boolean; chip?: CareChip };

export type StageView = CurrentStage & Action & {
  links: StageLink[];
  /** What hovering the stage says: `last synced 29 Sep 2026, 09:15 UTC`, or `not synced yet`; null for a draft. */
  synced: string | null;
};

function linksOf(summary: GithubSummary | null | undefined): StageLink[] {
  if (!summary) return [];
  const links: StageLink[] = [];
  const issue: Read<IssueRef | null> = summary.issue;
  if (known(issue) && issue) links.push({ label: `issue #${issue.number}`, href: issue.url, done: issue.state === 'closed' });
  const pulls: [string, Read<PullRef | null>][] = [['phase-0', summary.phase0], ['feature', summary.feature], ['retro', summary.retro]];
  const care = summary.care ?? null;
  for (const [name, pull] of pulls) {
    if (!known(pull) || !pull) continue;
    links.push(pullLinkOf(name, pull, care));
  }
  return links;
}

/** One pull request's link; the open feature PR's carries its health chip when its care state was read. */
function pullLinkOf(name: string, pull: PullRef, care: Read<CareState | null>): StageLink {
  const link: StageLink = { label: `${name} #${pull.number}`, href: pull.url, done: pull.state === 'merged' };
  if (name === 'feature' && pull.state === 'open' && known(care) && care) link.chip = careChipOf(care);
  return link;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** `last synced 29 Sep 2026, 09:15 UTC`, in UTC: the same on the server and in any browser. */
export function syncedWords(iso: string | null): string {
  if (iso === null) return 'not synced yet';
  const at = new Date(iso);
  return `last synced ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
}

export type StageViewInput = {
  prd: PrdNumber | null;
  /** A draft only: whether any of its questions was answered. */
  answered?: boolean;
  /** The PRD's stored stages; none yet reads Syncing…. */
  rows: readonly StageRow[];
  /** The GitHub summary, for the button, the links and the badge only; null or left out when not read. */
  github?: GithubSummary | null | undefined;
  slices?: number | null;
};

export function stageView({ prd, answered = false, rows, github = null, slices = null }: StageViewInput): StageView {
  const stage = storedStageOf({ prd, answered, rows, openOutbox: openOutboxOf(github) });
  return {
    ...stage,
    ...actionOf(stage.id, prd, github, slices),
    links: prd === null ? [] : linksOf(github),
    synced: prd === null ? null : syncedWords(stage.syncedAt),
  };
}
