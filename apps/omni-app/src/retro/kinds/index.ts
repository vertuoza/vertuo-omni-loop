// The registry of the kinds of finding (PRD 72): every kind the retro runs, in the order their
// sections appear in `retro.md`. Each kind is one module beside this one, owning its GitHub reads,
// its detector and its section, so a kind is built or changed without touching this registry, the
// function (`../retro.ts`) or `../render.ts`.
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
import type { DetectContext, Finding, Octokit, Run, Scope } from '../retro.types.ts';
import { afterMerge } from './after-merge.ts';
import { churn } from './churn.ts';
import { ci } from './ci.ts';
import { delivery } from './delivery.ts';
import { timeline } from './timeline.ts';

// The shapes a kind reads are the retro's own (`../retro.types.ts`); the kinds know them by these names.
export type { Evidence, Finding, Octokit, Run } from '../retro.types.ts';
export type {
  FeaturePull as RetroPr,
  PullInto as RetroPull,
  PrdFacts as RetroPrd,
  DetectContext as KindContext,
  Scope as KindScope,
} from '../retro.types.ts';

/**
 * A kind of finding: `Records` is what its `gather` returns, `Facts` what its `detect` keeps. Its
 * three functions are methods, so a kind with its own shapes is still a `Kind` of the registry.
 */
export type Kind<Records = unknown, Facts = unknown> = {
  readonly id: string;
  readonly section: string;
  readonly runs: readonly Run[];
  gather(octokit: Octokit, scope: Scope): Promise<Records>;
  detect(records: Records | null, context: DetectContext): { facts: Facts | null; findings: Finding[] };
  describe(facts: Facts | null): string[] | null;
};

export const KINDS: readonly Kind[] = Object.freeze([timeline, delivery, ci, churn, afterMerge]);

/** The kinds that take part in one run, in registry order. */
export function kindsFor(run: Run, kinds: readonly Kind[] = KINDS): Kind[] {
  return kinds.filter((kind) => kind.runs.includes(run));
}
