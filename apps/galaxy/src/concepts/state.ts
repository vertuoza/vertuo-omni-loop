// A concept's state (PRD 1272, s4), read from its facts in fix_facts (../fixes/facts/store.ts): in review
// while its concept PR is open, in the inbox once that PR has merged, and state unknown when the pull
// request could not be read, or none open or merged was found on the concept's branch. PRD 2213: a merged
// concept reads shipped once every area names a PRD and each one's stored stage is shipped or retro (the
// stages of ../stages/store.ts, never GitHub). The list's cards and the concept's page show it as a chip
// (./state-chip.tsx); the page links the concept PR it read.
import type { ConceptFacts } from '../dossier/github/fix';
import { UNREAD } from '../dossier/github/summary';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { prdKey } from '../stages/store';
import type { StoredStage } from '../stages/stage';

export type ConceptState = 'in-review' | 'in-inbox' | 'shipped' | 'unknown';

export const CONCEPT_STATE_LABELS: Readonly<Record<ConceptState, string>> = {
  'in-review': 'in review',
  'in-inbox': 'in the inbox',
  shipped: 'shipped',
  unknown: 'state unknown',
};

/** The concept PR its facts name; null with no facts, a pull request not read, or none found. */
export function conceptPull(facts: ConceptFacts | null): { number: PrNumber; url: string } | null {
  const pull = facts?.pull;
  return pull && pull !== UNREAD ? { number: pull.number, url: pull.url } : null;
}

/** What decides whether a merged concept shipped by itself: its areas, the repository their PRDs are in,
 * and the stored stage of each PRD of the workspace (keyed by `prdKey`). */
export type ConceptProgress = {
  repo: string;
  areas: readonly { prd: PrdNumber | null }[];
  stages: ReadonlyMap<string, StoredStage>;
};

/** The stored stage of PRD `prd` in `repo`; null when none is stored. */
export const storedStage = (stages: ReadonlyMap<string, StoredStage>, repo: string, prd: PrdNumber): StoredStage | null =>
  stages.get(prdKey({ repository: repo, prd })) ?? null;

const DONE: readonly (StoredStage | null)[] = ['shipped', 'retro'];

/** Whether a PRD at `stage` has shipped: shipped, or past it with its retro. */
export const hasShipped = (stage: StoredStage | null) => DONE.includes(stage);

/** Whether every area names a PRD and each one has shipped (or has its retro). */
function allShipped({ repo, areas, stages }: ConceptProgress): boolean {
  return areas.length > 0 && areas.every((area) => area.prd !== null && hasShipped(storedStage(stages, repo, area.prd)));
}

/** Whether the concept's stored issue is closed, however it was closed (PRD 2213, s3). */
const issueClosed = (facts: ConceptFacts | null): boolean => {
  const issue = facts?.issue;
  return !!issue && issue !== UNREAD && issue.state === 'closed';
};

/** A merged concept reads shipped by itself (every area's PRD shipped) or by a person (its issue closed,
 * whatever its areas); one in review never does, whatever its issue (PRD 2213). */
export function conceptState(facts: ConceptFacts | null, progress: ConceptProgress | null = null): ConceptState {
  const pull = facts?.pull;
  if (!pull || pull === UNREAD) return 'unknown';
  if (pull.state === 'open') return 'in-review';
  return (progress && allShipped(progress)) || issueClosed(facts) ? 'shipped' : 'in-inbox';
}

/** Whether a person shipped the concept: it reads shipped but not by itself, so its issue was closed on
 * the page or on GitHub and an area may be left unbuilt (PRD 2213, s3). */
export const shippedByPerson = (facts: ConceptFacts | null, progress: ConceptProgress | null = null): boolean =>
  conceptState(facts, progress) === 'shipped' && !(progress && allShipped(progress));
