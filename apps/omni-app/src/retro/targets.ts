// `planTargets`: the target repositories a multi-repository PRD's retro reads (PRD 1130). Pure: the
// plan repository's config at the merge and the PRD's `plan.md` in, the targets out.
//
// A PRD is multi-repository when the config has a `plan` section and the plan a `## Repositories`
// table. Each row of that table but the plan repository's own is a target, in the table's order;
// its `owner/name` is the `plan.targets` entry of that short name, or `null` when the config lists
// none (the retro then says it could not read it). Its feature branches are the ones
// `/omni:ultra-yolo` opened there: `branches.feature`, or one `branches.landing` per landing the
// target has slices in.
import { landingPlan } from 'vertuo-omni-plan/kit/lib/landings/landing-plan.ts';
import { parsePlanLandings, parsePlanRepositories, parsePlanSlices } from 'vertuo-omni-plan/kit/lib/inbox/territory.ts';
import type { Config } from './retro.types.ts';

/** One target of the plan: its short name, its `owner/name` (`null`: not a target of the config), its feature branches. */
export type PlanTarget = { name: string; slug: string | null; branches: string[] };

/** A repository's short name: the part of `owner/name` after the slash. */
export const shortName = (slug: string): string => slug.split('/').at(-1) ?? slug;

/** The targets to read, in `## Repositories` order; `[]` for a PRD of one repository. */
export function planTargets({ config, plan, planSlug, topic }: { config: Config; plan: string | null; planSlug: string; topic: string }): PlanTarget[] {
  const targets = config.plan?.targets ?? [];
  if (targets.length === 0 || plan === null) return [];
  const own = shortName(planSlug);
  return parsePlanRepositories(plan)
    .filter((row) => shortName(row.repo) !== own)
    .map((row) => {
      const name = shortName(row.repo);
      const slug = targets.find((target) => target.repo === row.repo || shortName(target.repo) === name)?.repo ?? null;
      return { name, slug, branches: featureBranches({ config, plan, topic, name }) };
    });
}

/** The target's feature branches: one per landing it has slices in, or the feature branch alone. */
function featureBranches({ config, plan, topic, name }: { config: Config; plan: string; topic: string; name: string }): string[] {
  const slices = slicesOf(plan);
  const named = parsePlanLandings(plan);
  const numbers = [...new Set(slices.map((slice) => slice.landing))].sort((a, b) => a - b);
  const landings = numbers.map((landing) => ({
    landing,
    name: named.find((row) => row.landing === landing)?.name ?? `landing-${landing}`,
    mergeWhen: null,
    slices: [],
    waves: [],
  }));
  const chain = landingPlan({ landings, slices, branches: config.branches, defaultBranch: config.repo.defaultBranch, topic, repo: name });
  const fallback = config.branches.feature.replace('{topic}', topic);
  return chain.length > 0 ? chain.map((step) => step.branch) : [fallback];
}

/** The plan's slices, or none for a plan whose slice table does not parse: its feature branch is then the one read. */
function slicesOf(plan: string): ReturnType<typeof parsePlanSlices> {
  try {
    return parsePlanSlices(plan);
  } catch {
    return [];
  }
}
