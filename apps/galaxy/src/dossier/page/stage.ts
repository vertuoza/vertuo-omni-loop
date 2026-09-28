// Where a PRD is, and what to do about it (PRD 426, part 2): a pure function of the dossier and its
// GitHub summary. The rows of the spec's table are tried from the latest stage down, and the first
// whose condition holds wins. A summary that could not be read, or a part the deciding row needs that
// could not be read, gives the stage unknown: nothing is guessed. The track, the words, the one
// button and the links line of the header are worked out here too, so the header only renders.
import { UNREAD, type GithubSummary, type IssueRef, type PullRef, type Read } from '../github/summary';

export type StageId = 'idea' | 'prd' | 'inbox' | 'outbox' | 'shipped' | 'retro';

/** The track, in the order a PRD goes. */
export const STAGES: readonly StageId[] = ['idea', 'prd', 'inbox', 'outbox', 'shipped', 'retro'];

export const STAGE_LABELS: Readonly<Record<StageId, string>> = {
  idea: 'idea', prd: 'PRD', inbox: 'inbox', outbox: 'outbox', shipped: 'shipped', retro: 'retro',
};

/** The one button: a link that opens GitHub, or a command to copy. */
export type NextAction =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'copy'; label: string; command: string };

export type Stage = { id: StageId | 'unknown'; action: NextAction | null; caption: string | null };

export const UNKNOWN_WORDS = 'Stage unknown: GitHub did not answer.';

const unknown: Stage = { id: 'unknown', action: null, caption: null };
const known = <T,>(value: Read<T>): value is T => value !== UNREAD;

/** The stage and its next action. `slices` is the plan's slice count; null when it is not known. */
export function stageOf(prd: number | null, summary: GithubSummary | null, slices: number | null = null): Stage {
  if (prd === null) return { id: 'idea', action: null, caption: 'Brainstorm in progress' };
  if (!summary) return unknown;
  const { retro, feature, mergedSlices, phase0 } = summary;
  if (!known(retro)) return unknown;
  if (retro) return { id: 'retro', action: { kind: 'link', label: 'Read the retro', href: retro.url }, caption: null };
  if (!known(feature)) return unknown;
  if (feature?.state === 'merged') return { id: 'shipped', action: null, caption: 'Shipped · the retro is written next' };
  if (!known(mergedSlices)) return unknown;
  if (mergedSlices > 0) {
    if (feature && !feature.draft) return { id: 'outbox', action: { kind: 'link', label: 'Review & merge', href: feature.url }, caption: null };
    const built = slices === null ? `${mergedSlices} slice${mergedSlices === 1 ? '' : 's'} merged` : `${mergedSlices}/${slices} slices`;
    return { id: 'outbox', action: null, caption: `Being built · ${built}` };
  }
  if (!known(phase0)) return unknown;
  if (phase0?.state === 'merged') return { id: 'inbox', action: { kind: 'copy', label: 'Build it', command: `/omni:yolo ${prd}` }, caption: null };
  if (phase0) return { id: 'prd', action: { kind: 'link', label: 'Approve spec', href: phase0.url }, caption: null };
  return { id: 'prd', action: null, caption: 'Spec being written' };
}

/** One stop of the track: passed (✓), the current one (lit), or ahead (dim). */
export type TrackStop = { id: StageId; label: string; state: 'passed' | 'current' | 'ahead' };

/** One entry of the links line: `issue #426`, `phase-0 #431`…, done (✓) once merged or closed. */
export type StageLink = { label: string; href: string; done: boolean };

export type StageView = Stage & {
  track: TrackStop[];
  /** The stage in words: `Stage: outbox`, or the unknown line. */
  words: string;
  links: StageLink[];
};

function trackOf(id: Stage['id']): TrackStop[] {
  const at = id === 'unknown' ? -1 : STAGES.indexOf(id);
  return STAGES.map((stop, i) => ({
    id: stop,
    label: STAGE_LABELS[stop],
    state: at === -1 ? 'ahead' : i < at ? 'passed' : i === at ? 'current' : 'ahead',
  }));
}

function linksOf(summary: GithubSummary | null): StageLink[] {
  if (!summary) return [];
  const links: StageLink[] = [];
  const issue: Read<IssueRef | null> = summary.issue;
  if (known(issue) && issue) links.push({ label: `issue #${issue.number}`, href: issue.url, done: issue.state === 'closed' });
  const pulls: [string, Read<PullRef | null>][] = [['phase-0', summary.phase0], ['feature', summary.feature], ['retro', summary.retro]];
  for (const [name, pull] of pulls) {
    if (known(pull) && pull) links.push({ label: `${name} #${pull.number}`, href: pull.url, done: pull.state === 'merged' });
  }
  return links;
}

export function stageView(prd: number | null, summary: GithubSummary | null, slices: number | null = null): StageView {
  const stage = stageOf(prd, summary, slices);
  return {
    ...stage,
    track: trackOf(stage.id),
    words: stage.id === 'unknown' ? UNKNOWN_WORDS : `Stage: ${STAGE_LABELS[stage.id]}`,
    links: linksOf(summary),
  };
}
