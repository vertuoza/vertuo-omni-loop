// The registry of the kinds of finding (PRD 72): every kind the retro runs, in the order their
// sections appear in `retro.md`. Each kind is one module beside this one, owning its GitHub reads,
// its detector and its section, so a kind is built or changed without touching this registry, the
// function (`../retro.mjs`) or `../render.mjs`.
//
// A kind:
//   - `gather(octokit, scope)` reads GitHub and returns plain records (JSON), in its own step,
//     "gather-<id>", so each fits the function's time limit and is retried on its own. `scope` holds
//     `{ owner, repo, mergeSha, mergedAt, pr, prd, config, pulls }`: the feature PR, the PRD (its
//     plan and settled file included), the config at the merge and the sub-PRs.
//   - `detect(records, context)` is pure: its records and `{ pr, prd, config, pulls }` in, `{ facts,
//     findings }` out. Every number `retro.md` shows is in `facts` or in a finding, which
//     `retro.json` keeps. A finding is `{ id, kind, title, happened, evidence: [{ label, url }] }`:
//     its id is built from what it found (`repeated-red:e2e`), its kind is one `rules` ranks, its
//     title a plain default the model may replace, and `happened` the sentence `render` writes under
//     "What happened".
//   - `describe(facts)` is pure: the markdown lines of its section, or `null` to leave it out.
//     `render` adds the kind's findings below them.
//   - `runs` names the runs it takes part in: `merge`, `day-14`.
import { afterMerge } from './after-merge.mjs';
import { churn } from './churn.mjs';
import { ci } from './ci.mjs';
import { delivery } from './delivery.mjs';
import { timeline } from './timeline.mjs';

/**
 * @typedef {{ label: string, url: string }} Evidence
 * @typedef {{ id: string, kind: string, title: string, happened: string, evidence: Evidence[] }} Finding
 * @typedef {{
 *   id: string,
 *   section: string,
 *   runs: readonly ('merge' | 'day-14')[],
 *   gather: (octokit: { request: Function }, scope: object) => Promise<unknown>,
 *   detect: (records: unknown, context: object) => { facts: object | null, findings: Finding[] },
 *   describe: (facts: object | null) => string[] | null,
 * }} Kind
 */

/** @type {readonly Kind[]} */
export const KINDS = Object.freeze([timeline, delivery, ci, churn, afterMerge]);

/** The kinds that take part in one run, in registry order. */
export function kindsFor(run, kinds = KINDS) {
  return kinds.filter((kind) => kind.runs.includes(run));
}
