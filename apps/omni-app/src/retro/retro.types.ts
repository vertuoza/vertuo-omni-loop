// The shapes the retro's units hand one another (PRD 725, s22): the GitHub seam, the pull requests
// and the PRD as `qualify` reads them, the fact sheet `detect` makes, the prose `guard` keeps, and the
// run records `retro.json` holds. Types only: this file holds no value. Each shape a step saves, or
// `retro.json` keeps, is the type its schema in `retro.schema.ts` parses to (PRD 1030), so what is read
// back is what the retro wrote; what is read from GitHub is parsed by the schemas in `github.schema.ts`.
import type { z } from 'zod';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type {
  DroppedSchema,
  EvidenceSchema,
  FactSheetSchema,
  FeaturePullSchema,
  FindingSchema,
  IssueLinkSchema,
  IssueLinksSchema,
  KnownSchema,
  LessonSchema,
  NarrationSchema,
  PrdFactsSchema,
  ProseFieldSchema,
  ProseFindingSchema,
  ProseSchema,
  PullIntoSchema,
  PullSchema,
  RepositoryFactsSchema,
  RulesSheetSchema,
  RunRecordSchema,
  RunSchema,
  SheetFindingSchema,
  TargetReadSchema,
  VerdictSchema,
} from './retro.schema.ts';

export type { Config };

/** The two runs of a retro: at the merge, and fourteen days later. */
export type Run = z.infer<typeof RunSchema>;

/** The one Octokit seam the app's units share: `octokit.request(route, params)`. */
export type Octokit = {
  request(route: string, params?: Record<string, unknown>): Promise<{ data: unknown }>;
};

/** A pull request as the retro reads it (`readPull`). */
export type Pull = z.infer<typeof PullSchema>;

/** The merged feature PR once `qualify` kept it: its merge SHA is the one the event named. */
export type FeaturePull = z.infer<typeof FeaturePullSchema>;

/** A pull request into the feature branch, as the kinds read it (`listPullsInto`). */
export type PullInto = z.infer<typeof PullIntoSchema>;

/** The PRD a feature PR delivered, as `qualify` reads it at the merge. */
export type PrdFacts = z.infer<typeof PrdFactsSchema>;

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
  /** The targets of a multi-repository PRD, as the merge run read them (PRD 1130); absent for one repository. */
  targets?: TargetRead[];
};

/** A target of a multi-repository PRD, as its step read it: its feature PRs and sub-PRs, or why not. */
export type TargetRead = z.infer<typeof TargetReadSchema>;

/** One repository of a multi-repository PRD's fact sheet. */
export type RepositoryFacts = z.infer<typeof RepositoryFactsSchema>;

/** One link a finding cites; a red run whose log was read also carries its last lines. */
export type Evidence = z.infer<typeof EvidenceSchema>;

/** A finding as a kind's detector gives it. */
export type Finding = z.infer<typeof FindingSchema>;

/** A finding on the fact sheet: the kind it came from (`source`) and its rank (`ref`, F1, F2…). */
export type SheetFinding = z.infer<typeof SheetFindingSchema>;

export type RulesSheet = z.infer<typeof RulesSheetSchema>;

/** The fact sheet `detect` makes: every number `retro.md` shows. */
export type FactSheet = z.infer<typeof FactSheetSchema>;

/** A field `guard` refused, written by `render` as one line naming the reason. */
export type Dropped = z.infer<typeof DroppedSchema>;

/** A prose field: its text, or why it was dropped. */
export type ProseField = z.infer<typeof ProseFieldSchema>;

export type ProseFinding = z.infer<typeof ProseFindingSchema>;

export type Lesson = z.infer<typeof LessonSchema>;

/** The judge's verdict as `guard` kept it, or why it was dropped. */
export type Verdict = z.infer<typeof VerdictSchema>;

/** The prose `guard` accepted. */
export type Prose = z.infer<typeof ProseSchema>;

export type Narration = z.infer<typeof NarrationSchema>;

/** One issue a finding was published as. */
export type IssueLink = z.infer<typeof IssueLinkSchema>;
export type IssueLinks = z.infer<typeof IssueLinksSchema>;

/** A fact sheet, plus the narration's outcome, the verdict, the lessons kept and the issues published. */
export type RunRecord = z.infer<typeof RunRecordSchema>;

/** What `retro.json` holds. */
export type RetroDoc = { prd: PrdNumber; runs: RunRecord[] };

/** What the judge compares a retro with (`gatherKnowledge`). */
export type Known = z.infer<typeof KnownSchema>;
