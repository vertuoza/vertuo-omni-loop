// @ts-nocheck
/**
 * **Two PRDs that would fight over the same files are found before the second one starts** (PRD
 * #1015).
 *
 * PRD #985 taught one plan's *slices* to declare the ground they own, and `sharedGround()`
 * (`territory.mjs`) computes which two slices claim the same path. Nothing did that *across*
 * PRDs: two features both reaching into the same shared library were found out only when the
 * second one's sub-PR conflicted with the first.
 *
 * `planCollisions` is that same question lifted one level: instead of comparing two slices of one
 * plan, it compares the combined territory of two whole plans (PRDs). It reuses `sharedGround()`
 * rather than restating prefix matching — a plan's "territory" is just the union of what its
 * slices already declare, in the same shape `sharedGround` already knows how to compare.
 *
 * **It reports; it never blocks.** Two PRDs may legitimately want the same file — this names the
 * pair and the paths, and stops there. Nothing here throws on a collision, exits non-zero, or
 * gates anything.
 *
 * It performs no I/O: the caller hands it already-parsed plan data — a list of slices per PRD, the
 * same shape `parsePlanSlices()` returns. `planFromMarkdown` is a thin convenience for building
 * that shape out of a plan's markdown (or a fixture), by composing `parsePlanSlices` — it is not a
 * second way of reading a slice table.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/inbox-collisions.mjs — changes in kit/porting/inbox--collisions.md.
import { parsePlanSlices, sharedGround } from './territory.ts';

/**
 * @typedef {{ id: string, territory: string[] }} PlanSlice
 * @typedef {{ prd: number|string, slices: PlanSlice[] }} Plan
 */

/** A plan built from its markdown, by reusing the one parser that reads a slice table. */
export function planFromMarkdown(prd, markdown) {
  return { prd, slices: parsePlanSlices(markdown) };
}

/** The ground a whole plan claims: the union of every one of its slices' declared prefixes. */
function planTerritory(plan) {
  const territory = new Set();
  for (const slice of plan.slices ?? []) {
    for (const prefix of slice.territory ?? []) territory.add(prefix);
  }
  return { territory: [...territory] };
}

/**
 * Every pair of plans whose declared territory intersects, in the order the plans were given.
 *
 * Composes `sharedGround()` over each plan's combined territory instead of its slices' — the same
 * function PRD #985 already tests, asked a question one level up. A path only one plan declares,
 * or a slice that declares nothing, cannot appear here: `sharedGround` only ever names ground both
 * sides actually claim.
 */
export function planCollisions(plans) {
  const found = [];
  for (let i = 0; i < plans.length; i += 1) {
    for (let j = i + 1; j < plans.length; j += 1) {
      const shared = sharedGround(planTerritory(plans[i]), planTerritory(plans[j]));
      if (shared.length > 0) {
        found.push({ left: plans[i].prd, right: plans[j].prd, shared });
      }
    }
  }
  return found;
}
