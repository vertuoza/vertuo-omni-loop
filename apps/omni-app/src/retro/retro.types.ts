// The shapes the retro's units hand one another (PRD 725, s22): the GitHub seam, the pull requests
// and the PRD as `qualify` reads them, the fact sheet `detect` makes, the prose `guard` keeps, and the
// run records `retro.json` holds. Types only: this file holds no value. What is read from outside
// (GitHub's answers, a `retro.json` on a branch) is parsed by the schemas in `github.schema.ts`.
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import type { rulesSheet } from './rules.ts';

export type { Config };

/** The two runs of a retro: at the merge, and fourteen days later. */
export type Run = 'merge' | 'day-14';

/** The one Octokit seam the app's units share: `octokit.request(route, params)`. */
export type Octokit = {
  request(route: string, params?: Record<string, unknown>): Promise<{ data: unknown }>;
};

/** A pull request as the retro reads it (`readPull`). */
export type Pull = {
  number: number;
  title: string;
  url: string | null;
  merged: boolean;
  baseRef: string;
  headRef: string;
  headSha: string;
  openedAt: string | null;
  mergedAt: string | null;
  mergeSha: string | null;
  labels: string[];
};

/** The merged feature PR once `qualify` kept it: its merge SHA is the one the event named. */
export type FeaturePull = Pull & { mergeSha: string };

/** A pull request into the feature branch, as the kinds read it (`listPullsInto`). */
export type PullInto = {
  number: number;
  title: string;
  url: string | null;
  state: string;
  draft: boolean;
  headRef: string;
  headSha: string;
  openedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  labels: string[];
};

/** The PRD a feature PR delivered, as `qualify` reads it at the merge. */
export type PrdFacts = {
  number: number;
  topic: string;
  title: string;
  problem: string;
  state: 'shipped' | 'inbox';
  folder: string;
  plan: string | null;
  settled: string | null;
};

/** What every kind's detector is given beside its own records. */
export type DetectContext = { pr: FeaturePull; prd: PrdFacts; config: Config; pulls: PullInto[] };

/** What every kind's `gather` is given: the detector's context, the repository and the merge. */
export type Scope = DetectContext & {
  owner: string;
  repo: string;
  mergeSha: string;
  mergedAt: string | null;
  /** The merge run's fact sheet, given to the day-14 run's kinds. */
  atMerge?: FactSheet;
};

/** One link a finding cites; a red run whose log was read also carries its last lines. */
export type Evidence = { label: string; url: string | null; excerpt?: string };

/** A finding as a kind's detector gives it. */
export type Finding = { id: string; kind: string; title: string; happened: string; evidence: Evidence[] };

/** A finding on the fact sheet: the kind it came from (`source`) and its rank (`ref`, F1, F2…). */
export type SheetFinding = Finding & { source: string; ref: string };

/** A kind of finding: its contract lives with the registry. */
export type { Kind } from './kinds/index.ts';

export type RulesSheet = ReturnType<typeof rulesSheet>;

/** The fact sheet `detect` makes: every number `retro.md` shows. */
export type FactSheet = {
  run: Run;
  rules: RulesSheet;
  prd: { number: number; title: string; topic: string; state: string; folder: string };
  featurePr: {
    number: number;
    title: string;
    url: string | null;
    openedAt: string | null;
    mergedAt: string | null;
    mergeSha: string;
  };
  kinds: Record<string, unknown>;
  findings: SheetFinding[];
};

/** A field `guard` refused, written by `render` as one line naming the reason. */
export type Dropped = { dropped: string };

/** A prose field: its text, or why it was dropped. */
export type ProseField = string | Dropped;

export type ProseFinding = {
  title?: ProseField;
  whyItMatters?: ProseField;
  lesson?: ProseField;
  keep?: boolean;
  why?: string;
};

export type Lesson = { text: string; findings: string[] };

/** The judge's verdict as `guard` kept it, or why it was dropped. */
export type Verdict = { worthIt: boolean; reason: string } | Dropped;

/** The prose `guard` accepted. */
export type Prose = {
  summary?: ProseField;
  findings: Record<string, ProseFinding>;
  lessons: Lesson[];
  verdict?: Verdict;
};

export type Narration = { model: string | null; reason: string | null; dropped: { field: string; reason: string }[] };

/** One issue a finding was published as. */
export type IssueLink = { number: number; url: string; state: 'open' | 'closed' };
export type IssueLinks = Record<string, IssueLink>;

/** A fact sheet, plus the narration's outcome, the verdict, the lessons kept and the issues published. */
export type RunRecord = FactSheet & {
  narration?: Narration;
  verdict?: Verdict | null;
  lessons?: Lesson[];
  issues?: IssueLinks;
};

/** What `retro.json` holds. */
export type RetroDoc = { prd: number; runs: RunRecord[] };

/** What the judge compares a retro with (`gatherKnowledge`). */
export type Known = {
  knowledge: { principles: unknown[]; laws: unknown[]; decisions: unknown[] };
  lessons: string[];
};
