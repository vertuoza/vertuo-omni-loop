// The targets a context reads (PRD 2011, s13): a plan repository's `plan.targets` (the product's
// links, when the context came through `withProductTargets`), none in any other repository. The one
// place the `kit/` readers outside the records code take them from
// (`kit/test/plan-targets-readers.test.ts`). It imports types only, so a command on the loop's path
// can read it without pulling the targets reader (and its `gh` calls) along.
import type { Context } from '../context.ts';

/** One target of a config's `plan.targets`, as the loop's commands need it. */
export type ListedTarget = { repo: string; role: string; knowledge: string; readAt?: string | null };

export function targetsOf(ctx: Pick<Context, 'config'>): readonly ListedTarget[] | undefined {
  return ctx.config.plan?.targets;
}
