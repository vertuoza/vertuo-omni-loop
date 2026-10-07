// A PRD's landings as the skills build and open them: for each landing, its branch, the branch it is
// cut from and its pull request targets, the suffix its title carries and the line its body says it
// is merged after. Pure: a graded plan's landings and a config's branch templates in, the chain out.
// `omni plan landings <prd>` prints it, so that `/omni:plan`, `/omni:yolo` and `/omni:pr-care` read
// the stacked branches from one place instead of working them out.
//
// A PRD of one landing gets one entry on `branches.feature`, based on the default branch, with no
// suffix and no merge-after line: what it always had. With more than one, landing 1 is cut from the
// default branch and landing n from landing n-1's branch, each on `branches.landing`, titled with the
// suffix ` (n/N)`; landing n says to merge it after landing n-1 is deployed.
//
// In a plan repository's plan, `repo` keeps only the landings with a slice in that repository, and
// numbers them within it: a target that has slices in landings 2 and 3 of the plan gets a chain of
// two there, and a target with slices in one landing only gets a single feature branch.
import { landingBranches } from '../board.ts';
import type { GradedLanding } from '../inbox/plan-grade.ts';
import type { Slice } from '../types.ts';

/** One landing of the chain, as the skills open it. */
export type LandingStep = {
  /** Its number within the chain (1 to `count`). */
  landing: number;
  /** Its number in the plan, which differs from `landing` only within one repository of a plan repository's plan. */
  planLanding: number;
  count: number;
  name: string;
  mergeWhen: string | null;
  branch: string;
  /** The branch it is cut from, and its pull request's base while the landing before it is open. */
  base: string;
  /** ` (n/N)` with more than one landing, `''` with one. */
  titleSuffix: string;
  /** The landing it is merged after, once deployed: `null` for the first. */
  mergeAfter: { landing: number; name: string } | null;
  slices: { id: string; title: string }[];
};

/**
 * The chain of landings a PRD is opened as. `repo` narrows a plan repository's plan to the slices of
 * that short name; `null` takes every slice.
 */
export function landingPlan({
  landings,
  slices,
  branches,
  defaultBranch,
  topic,
  repo = null,
}: {
  landings: readonly GradedLanding[];
  slices: readonly Pick<Slice, 'id' | 'title' | 'repo' | 'landing'>[];
  branches: { feature: string; landing: string };
  defaultBranch: string;
  topic: string;
  repo?: string | null;
}): LandingStep[] {
  const mine = slices.filter((slice) => repo === null || slice.repo === repo);
  const kept = landings.filter((landing) => mine.some((slice) => slice.landing === landing.landing));
  const chain = landingBranches(branches, {
    topic,
    landings: kept.map((landing, index) => ({ landing: index + 1, name: landing.name })),
  });
  return kept.map((landing, index) => ({
    landing: index + 1,
    planLanding: landing.landing,
    count: kept.length,
    name: landing.name,
    mergeWhen: landing.mergeWhen,
    branch: chain[index]?.branch ?? '',
    base: index === 0 ? defaultBranch : (chain[index - 1]?.branch ?? defaultBranch),
    titleSuffix: kept.length > 1 ? ` (${index + 1}/${kept.length})` : '',
    mergeAfter: mergeAfterOf(kept, index),
    slices: mine.filter((slice) => slice.landing === landing.landing).map(({ id, title }) => ({ id, title })),
  }));
}

/** The landing the one at `index` of `kept` is merged after: `null` for the first. */
function mergeAfterOf(kept: readonly GradedLanding[], index: number): LandingStep['mergeAfter'] {
  const before = kept[index - 1];
  return index === 0 || before === undefined ? null : { landing: index, name: before.name };
}

/** The line a landing pull request's body carries when it has a landing before it, or `null`. */
export function mergeAfterLine(step: Pick<LandingStep, 'mergeAfter'>): string | null {
  if (step.mergeAfter === null) return null;
  return `Merge after landing ${step.mergeAfter.landing} (${step.mergeAfter.name}) is deployed.`;
}
