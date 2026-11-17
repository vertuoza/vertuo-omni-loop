// What one run of a mission reads and lands of the QA pair (PRD 3001 s4, spec sections 3 and 4), before ./supervisor.ts decides:
// plain code over the joins' GitHub reads and squash-merge (./join.ts), as the mission's installation. No model call.
//
//   the picks    a person's pick on `Decide the bugs`, read from the mission's events (./qa.ts › picksOf)
//   the branch   for each PRD in the fix phase (QA's round 1 found bugs, or a fix ended), its feature branch: the head of the feature
//                pull request QA checked, read once a run. The Engineer's fix is sent `--base` it, and its fix lands on it
//   the landing  each fix job that opened a fix pull request: read and, once green, squash-merged into that feature branch, as a
//                repair's fix lands on the mission branch (PRD 2980); never into the default branch (N-PRODUCT-15). A fix that
//                is red, closed, a draft or refused by GitHub is refused, and the PRD's next bug goes
//   a plan       a plan repository's PRD skips the pair: nothing is read
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { MissionJoins } from './join.ts';
import { featureOf, judgeBugFix, needsFeature, NO_QA, picksOf, type Feature, type QaView } from './qa.ts';
import type { FixLanding } from './repair.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import { after, type RecordedEvent, type Run } from './supervisor.ts';

/** What a run reads the QA pair with. */
export type QaRunAt = {
  store: MissionStore;
  mission: MissionRecord;
  runs: readonly Run[];
  recorded: readonly RecordedEvent[];
  /** The installation the mission branch was prepared as; null at `with-you`, where it is read only when a fix needs it. */
  installation: number | null;
  joins: MissionJoins | null;
  inPlan: boolean;
};

const NO_ACCESS = 'the app has no GitHub access here';

/** The feature branch of PRD `prd`, read from its feature pull request `pr`, or why not. */
async function featureAt(at: QaRunAt, installation: number | null, prd: PrdNumber, pr: PrNumber): Promise<Feature> {
  if (at.joins === null || installation === null) return { why: NO_ACCESS };
  return featureOf(await at.joins.read({ installation, repo: at.mission.repo, prd, pr }));
}

/** A fix pull request on its way to feature branch `branch`: read, judged, and squash-merged once green. */
async function land(at: QaRunAt, installation: number | null, { prd, pr, branch }: { prd: PrdNumber; pr: PrNumber; branch: string }): Promise<FixLanding> {
  if (at.joins === null || installation === null) return { state: 'waits', lacks: [NO_ACCESS] };
  const where = { installation, repo: at.mission.repo, prd, pr };
  const pull = await at.joins.read(where);
  const judged = judgeBugFix(pull, branch);
  if (judged.state !== 'merge') return judged;
  const merged = await at.joins.merge({ ...where, head: pull.head, title: pull.title, base: pull.base, defaultBranch: pull.defaultBranch });
  return merged.ok ? { state: 'landed' } : { state: 'refused', why: merged.why };
}

/** What one run reads of the QA pair: the picks, each fix-phase PRD's feature branch, each ended fix landed or refused. */
export async function readQa(at: QaRunAt): Promise<QaView> {
  const picks = picksOf(at.recorded);
  if (at.inPlan) return { ...NO_QA, skip: true, picks };
  const features = new Map<PrdNumber, Feature>();
  const landings = new Map<string, FixLanding>();
  let installation = at.installation;
  let asked = installation !== null;
  for (const prd of new Set(at.runs.map((one) => one.prd))) {
    const need = needsFeature(at.runs, prd, after);
    if (need === null) continue;
    if (!asked) {
      installation = await at.store.installation(at.mission);
      asked = true;
    }
    const feature = await featureAt(at, installation, prd, need.pr);
    features.set(prd, feature);
    if (need.fix === null) continue;
    landings.set(need.fix.job, 'why' in feature ? { state: 'waits', lacks: [feature.why] } : await land(at, installation, { prd, pr: need.fix.pr, branch: feature.branch }));
  }
  return { skip: false, features, landings, picks };
}
