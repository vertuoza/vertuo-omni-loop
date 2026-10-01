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
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { afterMerge } from './after-merge.ts';
import { churn } from './churn.ts';
import { ci } from './ci.ts';
import { delivery } from './delivery.ts';
import { timeline } from './timeline.ts';

/** One link a finding cites; a red run whose log was read also carries its last lines. */
export type Evidence = { label: string; url: string | null; excerpt?: string };

export type Finding = { id: string; kind: string; title: string; happened: string; evidence: Evidence[] };

/** The one Octokit seam: what a kind sends, and the answer it parses before use. */
export type Octokit = { request: (route: string, params?: Record<string, unknown>) => Promise<{ data: unknown }> };

/** The feature pull request, as `../github.ts` `readPull` reads it (and `qualify` adds the merge commit). */
export type RetroPr = {
  number: number;
  title?: string;
  url: string | null;
  merged?: boolean;
  baseRef?: string;
  headRef?: string;
  headSha?: string;
  openedAt: string;
  mergedAt: string | null;
  mergeSha?: string | null;
  labels?: string[];
};

/** A pull request into the feature branch, as `../github.ts` `listPullsInto` reads it. */
export type RetroPull = {
  number: number;
  title?: string;
  url: string | null;
  state?: string;
  draft?: boolean;
  headRef: string;
  headSha?: string;
  openedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  labels?: string[];
};

/** The PRD the feature PR closes, as `../qualify.ts` reads it at the merge. */
export type RetroPrd = {
  number: number;
  topic: string;
  title?: string;
  problem?: string | null;
  state: 'inbox' | 'shipped';
  folder: string;
  plan?: string | null;
  settled?: string | null;
};

/** What the merge run kept that the day-14 run reads back: the churn ranges it found. */
export type AtMerge = { kinds?: { churn?: { ranges?: { path: string; from: number; to: number }[] } | null } } | null;

export type Run = 'merge' | 'day-14';

/** What every kind's `detect` is given beside its records. */
export type KindContext = { pr: RetroPr; prd: RetroPrd; config: Config; pulls: RetroPull[] };

/** What every kind's `gather` is given. */
export type KindScope = KindContext & {
  owner: string;
  repo: string;
  mergeSha: string;
  mergedAt: string;
  atMerge?: AtMerge;
};

/**
 * A kind of finding: `Records` is what its `gather` returns, `Facts` what its `detect` keeps. Its
 * three functions are methods, so a kind with its own shapes is still a `Kind` of the registry.
 */
export type Kind<Records = unknown, Facts = unknown> = {
  readonly id: string;
  readonly section: string;
  readonly runs: readonly Run[];
  gather(octokit: Octokit, scope: KindScope): Promise<Records>;
  detect(records: Records | null, context: KindContext): { facts: Facts | null; findings: Finding[] };
  describe(facts: Facts | null): string[] | null;
};

export const KINDS: readonly Kind[] = Object.freeze([timeline, delivery, ci, churn, afterMerge]);

/** The kinds that take part in one run, in registry order. */
export function kindsFor(run: Run, kinds: readonly Kind[] = KINDS): Kind[] {
  return kinds.filter((kind) => kind.runs.includes(run));
}
