/**
 * **The guard grades a range** (PRD #1044, slice s3).
 *
 * Two modules already do the reading: `decision-coverage.mjs`'s `riskyChanges` names the ground a
 * range's diff touches; `account.mjs`'s `readAccounts` and `compare` say whether that ground was
 * accounted for. This file adds nothing to either — it turns their two readings into one grade per
 * PRD, plus the one check that needs no range at all.
 *
 * **Two shapes, because a bare gate run genuinely cannot know a PRD.** {@link findFormatViolations}
 * grades every account file already on disk, for every PRD `ctx.layout.outboxDirs()` names, with no
 * branch or PRD in the picture — the shape a repository-wide check needs, since it may run on the
 * default branch, on an unrelated branch, or on a branch for a PRD nobody named. That is
 * deliberately the only thing a contextless run can safely say: comparing some range against
 * another PRD's accounts would flag every risky change on every branch forever, because a past
 * PRD's `accounts/` directory never empties.
 *
 * {@link gradePrd} takes one PRD and a range's already-computed `riskyChanges` — the shape a
 * caller who already knows both (a CLI given `<base> <prd>`, Task 15; a slice's own tooling) needs.
 * `unaccounted` is the only fatal list; `stale` is reported and never fails the run — a rebased
 * account is a planner being wrong about the ground, not a breach.
 *
 * Either shape refuses a malformed account file by name.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/check-decision-coverage.mjs — changes in kit/porting/outbox--check-decision-coverage.md.
import type { Context } from '../context.ts';
import { compare, readAccounts } from './account.ts';
import type { RiskyChange } from './decision-coverage.ts';
import type { PrdNumber } from '../ids.ts';

/** `git diff --name-status` output as `{ path, status }[]` — one implementation, in `kit/lib/git.ts`. */
export { parseNameStatus } from '../git.ts';

/** Every PRD `ctx.layout.outboxDirs()` names — in-flight and shipped — as numbers, sorted. An
 * outbox tree with no PRD in it reads as `[]`. */
export function discoveredPrds({ ctx }: { ctx: Pick<Context, 'layout'> }): PrdNumber[] {
  return ctx.layout
    .outboxDirs()
    .map(({ prd }) => prd)
    .sort((a, b) => a - b);
}

/**
 * Every account file's format, for every PRD found on disk — the "not only at gate time" half.
 * Never reads a range or compares anything against it; a malformed account is refused whether or
 * not this run knows what is risky right now.
 */
export function findFormatViolations({ ctx }: { ctx: Context }): string[] {
  return discoveredPrds({ ctx }).flatMap((prd) =>
    readAccounts(prd, { ctx }).flatMap((result) => (result.ok ? [] : result.errors)),
  );
}

/**
 * Grades one PRD's accounts against a range's already-computed risky changes. Splits
 * `readAccounts`' results into the malformed ones (refused by name, same as `findFormatViolations`)
 * and the well-formed ones, which alone are handed to `compare`.
 *
 * @param {string | number} prd
 * @param {{ path: string, status: string, rule: string }[]} risky
 * @param {{ ctx: object }} options
 */
export function gradePrd(prd: PrdNumber, risky: readonly RiskyChange[], { ctx }: { ctx: Context }) {
  const results = readAccounts(prd, { ctx });
  const malformed = results.flatMap((result) => (result.ok ? [] : result.errors));
  const accounts = results.flatMap((result) => (result.ok ? [result.account] : []));
  const { accounted, unaccounted, stale } = compare(risky, accounts);
  return { prd, malformed, accounted, unaccounted, stale };
}

/** One unaccounted change's line — names both the path and the rule that flagged it, and, when an
 * account named it but could not answer it (PRD 1342), why. */
export function describeUnaccounted(
  prd: PrdNumber,
  change: Pick<RiskyChange, 'path' | 'rule'> & { refused?: string },
): string {
  const why = change.refused ?? 'no account names it';
  return `PRD #${prd}: \`${change.path}\` is risky (${change.rule}) and ${why}.`;
}
