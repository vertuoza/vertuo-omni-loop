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
import { compare, readAccounts } from './account.mjs';

/** `git diff --name-status` output as `{ path, status }[]` — one implementation, in `kit/lib/git.mjs`. */
export { parseNameStatus } from '../git.mjs';

/** Every PRD `ctx.layout.outboxDirs()` names — in-flight and shipped — as numbers, sorted. An
 * outbox tree with no PRD in it reads as `[]`. */
export function discoveredPrds({ ctx }) {
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
export function findFormatViolations({ ctx }) {
  return discoveredPrds({ ctx }).flatMap((prd) =>
    readAccounts(prd, { ctx })
      .filter((result) => !result.ok)
      .flatMap((result) => result.errors),
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
export function gradePrd(prd, risky, { ctx }) {
  const results = readAccounts(prd, { ctx });
  const malformed = results.filter((result) => !result.ok).flatMap((result) => result.errors);
  const accounts = results.filter((result) => result.ok).map((result) => result.account);
  const { accounted, unaccounted, stale } = compare(risky, accounts);
  return { prd, malformed, accounted, unaccounted, stale };
}

/** One unaccounted change's line — names both the path and the rule that flagged it. */
export function describeUnaccounted(prd, change) {
  return `PRD #${prd}: \`${change.path}\` is risky (${change.rule}) and no account names it.`;
}
