// The mission's store in memory (PRD 2842 s4), for the tests of its job and the fake fleet of s9: one mission, the
// facts of its PRDs, the runner jobs it sent (their keys unique, as `runner_jobs.mission_key` is) with their
// attempts, and its events. Test helpers move what a real fleet would: a job's end, a lost runner and its resume, a
// PRD's facts, a person's Pause. Its repairs (PRD 2980) are kept as `mission_repairs` keeps them: the database's caps
// hold here too, 3 per cause in a round and 9 per mission. Its token budget (PRD 3040): what the mission and its fleet spent,
// the fleet's daily cap, the other missions of the fleet and the budget stops, one open per cap as the database keeps them, each
// answered once, a raise saved with its answer. The Omni Loop bug team's bugs and bug-fix jobs (PRD 3088), the database's cap of 3
// tries held. At `alone` for a product roadmap (PRD omni-loop-21): a step's resumes under their own keys, the mission's branch
// kept once per repository, an item committee's decision recorded once (escalated off `alone`, as mission_decide_item() does) and
// every decision of the committee listed in order. A product PRD's events, repairs and item decisions kept under its id, read as the
// store reads them (PRD omni-loop-21 s3b). The PM's own product PRDs (PRD omni-loop-26): their pages read once the mission names them,
// the Architect's reviews under their keys, the `plan` and `tech` decisions kept once per job as mission_decide_plan() keeps them
// (escalated with no record, the pair on the latest plan version approving the PRD in the fleet's name), and where the mission's
// repository approves its phase 0. No database, no model call.
import { parseIssue, type IssueNumber, type PrdNumber, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import type { NewJob } from '../jobs/ledger.ts';
import { bugFixOf, repairKey, repairSkillLine, type RepairJob, type RepairRow, type StuckJob } from './repair.ts';
import { retroKey, retroSkillLine, type ItemRow, type MissionRetro, type RetroJob, type RetroRow, type RoadmapScope } from './milestone.ts';
import { stuckJobsOf, stuckKey, stuckSkillLine } from './stuck.ts';
import { askLine, DEFAULT_BOUND, type ItemCommittee } from './answers.ts';
import { approveLine, committeeKey, type Committee, type Decision, type Recorded } from './committee.ts';
import { pmKey, type Home, type PmJob } from './pm.ts';
import { techKey, type PlanDecision, type TechJob } from './tech.ts';
import { numberedOf, type MissionPrd } from './store.prd.ts';
import { resumeKey, type MissionProducts, type StoredProduct, type NewStoredEvent, type StoredRepair, type MissionDecision, type MissionBranch, type MissionBugTeam, type MissionRecord, type MissionRetros, type MissionStore, type PlanDecide } from './store.ts';
import { BUG_TRIES, bugFixLine, bugKey, type Bug, type BugJob } from './bug-team.ts';
import type { BudgetAnswer } from 'omni-loop/kit/lib/mission/budget.ts';
import type { StopRow } from './budget.ts';
import { baseOf, lineOf, missionKey, type Attempt, type ProductRun, type MissionStatus, type RoomRunner, type PrdFacts, type Step } from './supervisor.ts';

/** A job the fake queued, as the runner_jobs row it stands for: the build, or the Reviewer and the fix after it (PRD 2871). */
type FakeJob = { id: string; line: string; key: string; toFleet: string | null; sentByApp: string; prd: PrdNumber; run: number; step: Step; attempts: Attempt[]; resume: number };

/** `{ resume }` for a step's resume (PRD omni-loop-21), nothing for its first job, as the store reads it. */
const resumedOf = (resume: number) => (resume === 0 ? {} : { resume });

/** A recorded event, as its mission_events row: its PRD a repository's number or a product's id (PRD omni-loop-21 s3b). */
type FakeEvent = Omit<NewStoredEvent, 'kind'> & { kind: string; actor: string; at: string };

/** A kept repair, as its mission_repairs row: its PRD a repository's number or a product's id (PRD omni-loop-21 s3b). */
type FakeRepair = Omit<RepairRow, 'prd'> & { prd: MissionPrd | null };

/** A kept repair as the store reads it: its PRD a repository's number or a product's id (bug #3302). */
const storedRepairOf = (row: FakeRepair): StoredRepair => ({ ...row });

const NOW_OF_ASKS = Date.parse('2027-01-22T08:00:00Z');

/** A plan or tech decision as mission_decide_plan() reads it: no record escalates, and an approved one off `alone` escalates too. */
function fakeDecided(mission: MissionRecord, { kind, record, why }: PlanDecide): { reasons: string[]; outcome: PlanDecision['outcome']; plan: string | null; settled: string[] } {
  if (record === null) return { reasons: [`no record of the ${kind === 'plan' ? 'plan approval' : 'tech review'}`, ...why], outcome: 'escalated', plan: null, settled: [] };
  const reasons = [...('open' in record ? record.open : []), ...why];
  if (record.outcome === 'approved' && mission.level !== 'alone') reasons.push('the mission is not at alone: a person approves its PRDs');
  const outcome = record.outcome === 'approved' && reasons.length === 0 ? 'approved' : 'escalated';
  return { reasons, outcome, plan: record.plan, settled: 'settled' in record ? record.settled : [] };
}

/** The mission's store in memory, seeded with `mission` and the facts of its PRDs. */
export function fakeMissionStore({ mission, facts, fleetRunners = true, planRepository = false, installation = 1, pages = [], now = Date.now, retros: milestones, team, products: seeded, productPages = [], home: seededHome }: {
  mission: MissionRecord; facts: PrdFacts[]; fleetRunners?: boolean; planRepository?: boolean; installation?: number | null;
  /** PRDs with a page that are in no scope yet (PRD 2896 s12): read as facts once the mission's scope names them, as a PRD its PM wrote. */
  pages?: PrdFacts[];
  /** The database's clock: when a budget stop is recorded and answered (PRD 3040). */
  now?: () => number;
  /**
   * PRD 3065: the store keeps stuck repairs and milestone retros, its scope's roadmaps these. Absent, it has none, and the
   * supervisor runs no stuck count and no milestone retro, as before.
   */
  retros?: { roadmaps: RoadmapScope[] };
  /**
   * PRD 3088: the store keeps the Omni Loop bug team's bugs, these, and its bug-fix jobs; `holders`, the paused or stopped missions the
   * team is to tell that a bug moved (s5). Absent, it has none.
   */
  team?: { bugs: Bug[]; holders?: { id: string; repo: string }[] };
  /**
   * PRD omni-loop-21 s9b: the store reads the scope's product PRDs, these (expanded from its product roadmaps, in order), and keeps the
   * builds sent for them. Absent, it has none, and the mission runs its repository's PRDs only, as before.
   */
  products?: StoredProduct[];
  /** PRD omni-loop-26: product PRDs with a page that are in no scope yet, read once the mission's products name them, as a PRD its PM wrote. */
  productPages?: StoredProduct[];
  /** PRD omni-loop-26: where the mission's repository approves its phase 0, and its product; absent, `pr` and none. */
  home?: Home;
}) {
  let record: MissionRecord & { nextWakeAt: string | null } = { ...mission, nextWakeAt: null };
  let current = facts.map((fact) => ({ ...fact }));
  const jobs: FakeJob[] = [];
  /** The runners of the mission's target the room is read from (PRD 2949): none holds the repository, so there is room. */
  let runners: RoomRunner[] = [];
  /** The care jobs it queued (PRD 2896 s5), with no mission key. */
  const cares: { id: string; line: string; queuedAt: string; toFleet: string | null }[] = [];
  const events: FakeEvent[] = [];
  /** The committees it queued (PRD 2896 s9): their key, line and log, and what the database recorded for each. */
  const committees: (Committee & { key: string; line: string; toFleet: string | null; log: string | null; recorded: Recorded | null; resume: number })[] = [];
  /** The PM jobs it queued (PRD 2896 s12): their key and log. */
  const pms: (PmJob & { key: string; toFleet: string | null; log: string | null; resume: number })[] = [];
  /** The item committees it queued (PRD 2896 s10), with no mission key: their line and log. */
  const asks: (Omit<ItemCommittee, 'decision'> & { line: string; toFleet: string | null; log: string | null })[] = [];
  /** What the database decides when the App records a decision: by default, what the App decided. */
  let database: (recorded: Recorded) => Decision = (recorded) => recorded.decision;
  /** The repair jobs it queued (PRD 2980): their key, line and log. */
  const repairs: (RepairJob & { key: string; line: string; toFleet: string | null; log: string | null })[] = [];
  /** The rows `mission_repairs` kept. */
  const rows: FakeRepair[] = [];
  /** The Omni Loop bugs `omni_bug_reports` holds, by fingerprint, where each stands (PRD 3088), and the jobs added to the App's ledger. */
  const bugs = new Map<string, { repo: string; issue: IssueNumber; state: string; fixedIn: string | null }>();
  const added: NewJob[] = [];
  /** The token budget (PRD 3040): what the mission and its fleet spent, the fleet's cap, its other missions and the stops. */
  const spent: { mission: number; fleet: number; oldestEnd: string | null } = { mission: 0, fleet: 0, oldestEnd: null };
  let fleetCap: number | null = null;
  let fleet: { id: string; status: MissionStatus; waitingOn: string | null }[] = [];
  const stops: StopRow[] = [];
  let made = 0;
  /** Reads of the runs held until this many are waiting: two runs at once read the same state. */
  let together = 0;
  let waiting: (() => void)[] = [];

  const copyOf = (job: FakeJob) => ({ prd: job.prd, run: job.run, step: job.step, job: job.id, attempts: job.attempts.map((one) => ({ ...one })), ...resumedOf(job.resume) });
  /** PRD omni-loop-21: the mission's branches `mission_branches` kept, and every decision the committee recorded, in order. */
  const branches: MissionBranch[] = [];
  const decided: MissionDecision[] = [];
  const decidedAt = (): string => new Date(NOW_OF_ASKS + decided.length).toISOString();

  /** PRD 3065: the stuck repairs and milestone retros it queued, their key, line and log; the retros and items the database kept. */
  const stucks: (StuckJob & { key: string; line: string; toFleet: string | null; log: string | null })[] = [];
  const retroJobs: (RetroJob & { key: string; line: string; toFleet: string | null; log: string | null })[] = [];
  const retroRows: (RetroRow & { retro: MissionRetro | null })[] = [];
  const items: (ItemRow & { retro: string })[] = [];
  const queued = (id: string): Attempt => ({ id, status: 'queued', outcome: null, reason: null, prUrl: null });

  /** The log of job `job`: a committee's, an item's, a PM's by its job; a repair's, a stuck repair's or a retro's by any attempt. */
  const logOf = (job: string): string | null => {
    const own = [...committees, ...asks, ...pms, ...techs].find((one) => one.job === job);
    if (own !== undefined) return own.log;
    return [...repairs, ...stucks, ...retroJobs].find((one) => one.attempts.some((each) => each.id === job))?.log ?? null;
  };

  /** The mission moved to `status`: paused by stuck only while paused, as missions_paused_by() keeps it. */
  const moveTo = (status: MissionStatus, by?: 'stuck'): void => {
    record = { ...record, status };
    if (status === 'paused' && by !== undefined) record.pausedBy = by;
    else delete record.pausedBy;
  };

  const retros: MissionRetros = {
    milestones: () => Promise.resolve((milestones?.roadmaps ?? []).map((one) => ({ ...one, prds: [...one.prds] }))),
    stucks: () => Promise.resolve(stucks.map(({ k, job, jobs: named, attempts }) => ({ k, job, jobs: [...named], attempts: attempts.map((one) => ({ ...one })) }))),
    stuck: ({ mission: sent, k, jobs: named, toFleet }) => {
      const key = stuckKey(sent.id, k);
      if (stucks.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      stucks.push({ k, job: id, jobs: stuckJobsOf(stuckSkillLine(sent.number, named)) ?? [], attempts: [queued(id)], key, line: stuckSkillLine(sent.number, named), toFleet: toFleet ? sent.fleet : null, log: null });
      return Promise.resolve(id);
    },
    retros: () => Promise.resolve({ jobs: retroJobs.map(({ milestone, job, attempts }) => ({ milestone, job, attempts: attempts.map((one) => ({ ...one })) })), rows: retroRows.map(({ id, milestone, job, skipped, file }) => ({ id, milestone, job, skipped, file })) }),
    retro: ({ mission: sent, milestone, toFleet }) => {
      const key = retroKey(sent.id, milestone);
      if (retroJobs.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      retroJobs.push({ milestone, job: id, attempts: [queued(id)], key, line: retroSkillLine(sent.number, milestone), toFleet: toFleet ? sent.fleet : null, log: null });
      return Promise.resolve(id);
    },
    keepRetro: (_mission, row) => {
      // One per milestone (mission_retros_milestone_key).
      if (retroRows.some((one) => one.milestone === row.milestone)) return Promise.resolve(null);
      const id = `retro-${String(retroRows.length + 1)}`;
      retroRows.push('retro' in row ? { id, milestone: row.milestone, job: row.job, skipped: null, file: row.file, retro: row.retro } : { id, milestone: row.milestone, job: row.job, skipped: row.skipped, file: null, retro: null });
      return Promise.resolve(id);
    },
    keepItems: (_mission, retro, list) => {
      // One per number of a retro (mission_items_retro_number).
      const kept = list.filter((one) => !items.some((each) => each.retro === retro && each.number === one.number));
      items.push(...kept.map((one) => ({ ...one, evidence: [...one.evidence], retro })));
      return Promise.resolve(kept.map((one) => one.number));
    },
  };

  /** PRD 3088: the bugs `omni_bug_reports` holds, and the bug-fix jobs the team queued, their key, line and target. */
  let teamBugs: Bug[] = (team?.bugs ?? []).map((one) => ({ ...one }));
  const bugJobs: (BugJob & { key: string; line: string; toFleet: string | null })[] = [];
  const bugTeam: MissionBugTeam = {
    bugs: () => Promise.resolve(teamBugs.filter((one) => ['open', 'fixing', 'asked'].includes(one.state)).map((one) => ({ ...one }))),
    jobs: () => Promise.resolve(bugJobs.map(({ issue, k, job, attempts }) => ({ issue, k, job, attempts: attempts.map((one) => ({ ...one })) }))),
    send: ({ mission: sent, issue, k, toFleet, line = bugFixLine(issue) }) => {
      const key = bugKey(sent.id, issue, k);
      if (bugJobs.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      bugJobs.push({ issue, k, job: id, attempts: [queued(id)], key, line, toFleet: toFleet ? sent.fleet : null });
      return Promise.resolve(id);
    },
    move: (bug, to) => {
      // omni_bug_reports_attempts: a 4th try is refused (23514), and the run fails.
      if (to.attempts > BUG_TRIES) return Promise.reject(new Error('omni_bug_reports_attempts: a 4th try is refused'));
      const held = teamBugs.find((one) => one.fingerprint === bug.fingerprint);
      if (held?.state !== bug.state || held.attempts !== bug.attempts) return Promise.resolve(false);
      Object.assign(held, { state: to.state, attempts: to.attempts, fixPr: to.fixPr, askedJob: to.askedJob });
      return Promise.resolve(true);
    },
    holders: () => Promise.resolve((team?.holders ?? []).map((one) => ({ ...one }))),
  };

  /** PRD omni-loop-21 s9b: the scope's product PRDs as the store reads them (expanded, in order), and the builds queued for them. */
  let productFacts: StoredProduct[] = [...(seeded ?? []), ...productPages].map((one) => ({ ...one }));
  const pagedOnly = new Set(productPages.map((one) => one.prd));
  /** PRD omni-loop-26: the Architect's reviews queued, their key, line and log, and the plan and tech decisions kept, in order. */
  const techs: (TechJob & { key: string; line: string; toFleet: string | null; log: string | null })[] = [];
  const planDecisions: (PlanDecision & { techApproval: boolean; approval: boolean })[] = [];
  let home: Home = seededHome ?? { phase0: 'pr', product: null };
  const productJobs: (ProductRun & { key: string; line: string; toFleet: string | null })[] = [];
  const productStore: MissionProducts = {
    facts: (read) => Promise.resolve(productFacts.filter((one) => !pagedOnly.has(one.prd) || (read.products?.prds ?? []).includes(one.prd)).map((one) => ({ ...one, blockers: [...one.blockers], targets: [...one.targets] }))),
    runs: () => Promise.resolve(productJobs.map(({ prd, run, job, attempts }) => ({ prd, run, job, attempts: attempts.map((one) => ({ ...one })) }))),
    send: ({ mission: sent, prd, run, line, toFleet }) => {
      const key = missionKey(sent.id, prd, run);
      if (productJobs.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      productJobs.push({ prd, run, job: id, attempts: [queued(id)], key, line, toFleet: toFleet ? sent.fleet : null });
      return Promise.resolve(id);
    },
    reviews: () => Promise.resolve({
      techs: techs.map(({ prd, k, job, attempt }) => ({ prd, k, job, attempt: { ...attempt } })),
      decisions: planDecisions.map(({ kind, prd, job, plan, outcome, why, settled }) => ({ kind, prd, job, plan, outcome, why: [...why], settled: [...settled] })),
    }),
    review: ({ mission: sent, prd, k, line, toFleet }) => {
      const key = techKey(sent.id, prd, k);
      if (techs.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      techs.push({ prd, k, job: id, attempt: queued(id), key, line, toFleet: toFleet ? sent.fleet : null, log: null });
      return Promise.resolve(id);
    },
    decidePlan: (sent, one) => {
      const { prd, job, kind } = one;
      const kept = planDecisions.find((each) => each.job === job);
      const latest = productFacts.find((each) => each.prd === prd)?.plan ?? null;
      if (kept !== undefined) return Promise.resolve({ outcome: kept.outcome, why: [...kept.why], plan: kept.plan, latest: null });
      const { reasons, outcome, plan, settled } = fakeDecided(sent, one);
      const onLatest = outcome === 'approved' && plan === latest;
      const pair = onLatest && planDecisions.some((each) => each.prd === prd && each.kind !== kind && each.outcome === 'approved' && each.plan === latest);
      planDecisions.push({ kind, prd, job, plan, outcome, why: reasons, settled, techApproval: onLatest && kind === 'tech', approval: pair });
      if (pair) productFacts = productFacts.map((one) => (one.prd === prd ? { ...one, approval: 'standing' } : one));
      return Promise.resolve({ outcome, why: [...reasons], plan, latest: plan === null ? false : plan === latest });
    },
    home: () => Promise.resolve({ ...home }),
  };

  const store: MissionStore = {
    ...(milestones === undefined ? {} : { retros }),
    ...(team === undefined ? {} : { bugTeam }),
    ...(seeded === undefined ? {} : { products: productStore }),
    mission: (id) => Promise.resolve(id === record.id ? { ...record } : null),
    facts: (read) => Promise.resolve([...current, ...pages.filter((page) => read.scope.prds.includes(page.prd) && !current.some((fact) => fact.prd === page.prd))].map((fact) => ({ ...fact }))),
    runs: () => {
      const snapshot = jobs.map(copyOf);
      if (together <= 1) return Promise.resolve(snapshot);
      return new Promise((resolve) => {
        waiting.push(() => {
          resolve(snapshot);
        });
        if (waiting.length >= together) {
          const release = waiting;
          waiting = [];
          together = 0;
          for (const go of release) go();
        }
      });
    },
    events: () => Promise.resolve(events.map(({ kind, prd, job }) => ({ kind, ...numberedOf(prd), job }))),
    fleetEvents: () => Promise.resolve(events.filter(({ kind }) => kind === 'decided' || kind === 'overturned').map(({ kind, prd, sentence, link, actor }) => ({ kind, ...numberedOf(prd), sentence, link, actor }))),
    fleetRunners: () => Promise.resolve(fleetRunners),
    room: () => Promise.resolve(runners.map((one) => ({ ...one }))),
    planRepository: () => Promise.resolve(planRepository),
    installation: () => Promise.resolve(installation),
    send: ({ mission: sent, prd, run, step, toFleet, skill, fix = null, resume = 0 }) => {
      const key = resumeKey(missionKey(sent.id, prd, run, step), resume);
      if (jobs.some((job) => job.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      jobs.push({ id, line: lineOf(prd, step, skill, baseOf(sent, skill === 'ultra-yolo'), fix), key, toFleet: toFleet ? sent.fleet : null, sentByApp: 'omni-app', prd, run, step, attempts: [{ id, status: 'queued', outcome: null, reason: null, prUrl: null }], resume });
      return Promise.resolve(id);
    },
    care: ({ mission: sent, line, since, toFleet }) => {
      // A job queued since `since` counts as sent: the fake queues each at the time it was asked for.
      if (cares.some((one) => one.line === line && one.queuedAt >= since)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      cares.push({ id, line, queuedAt: since, toFleet: toFleet ? sent.fleet : null });
      return Promise.resolve(id);
    },
    committees: () => Promise.resolve(committees.map(({ prd, round, job, attempt, decision, resume }) => ({ prd, round, job, attempt: { ...attempt }, decision, ...resumedOf(resume) }))),
    committeeLog: (job) => Promise.resolve(logOf(job)),
    pmJobs: () => Promise.resolve(pms.map(({ round, job, line, attempt, resume }) => ({ round, job, line, attempt: { ...attempt }, ...resumedOf(resume) }))),
    pm: ({ mission: sent, round, line, toFleet, resume = 0 }) => {
      const key = resumeKey(pmKey(sent.id, round), resume);
      if (pms.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      pms.push({ round, job: id, line, attempt: { id, status: 'queued', outcome: null, reason: null, prUrl: null }, key, toFleet: toFleet ? sent.fleet : null, log: null, resume });
      return Promise.resolve(id);
    },
    decide: (_mission, one, recorded) => {
      const held = committees.find((each) => each.job === one.job);
      if (!held) return Promise.reject(new Error(`no committee job ${one.job}`));
      if (held.decision !== null) return Promise.resolve(held.decision);
      const decision = database(recorded);
      held.decision = decision;
      held.recorded = recorded;
      decided.push({ kind: 'approve', prd: one.prd, item: null, job: one.job, outcome: decision.outcome, why: [...decision.why], option: null, decidedAt: decidedAt() });
      if (decision.outcome === 'carried') current = current.map((fact) => (fact.prd === one.prd ? { ...fact, approval: 'standing' } : fact));
      return Promise.resolve(decision);
    },
    asks: () => Promise.resolve(asks.map(({ prd, item, job, attempt }) => ({ prd, item, job, attempt: { ...attempt } }))),
    ask: ({ mission: sent, prd, item, toFleet }) => {
      if (asks.some((one) => one.prd === prd && one.item === item)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      asks.push({ prd, item, job: id, attempt: { id, status: 'queued', outcome: null, reason: null, prUrl: null }, line: askLine(prd, item, sent.hardToRevert ?? DEFAULT_BOUND), toFleet: toFleet ? sent.fleet : null, log: null });
      return Promise.resolve(id);
    },
    approve: ({ mission: sent, prd, round, toFleet, author = null, resume = 0 }) => {
      const key = resumeKey(committeeKey(sent.id, prd, round), resume);
      if (committees.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      committees.push({ prd, round, job: id, attempt: { id, status: 'queued', outcome: null, reason: null, prUrl: null }, decision: null, key, line: approveLine(prd, author), toFleet: toFleet ? sent.fleet : null, log: null, recorded: null, resume });
      return Promise.resolve(id);
    },
    repairs: () => Promise.resolve({ jobs: repairs.map(({ prd, k, job, failedJob, attempts }) => ({ prd, k, job, failedJob, attempts: attempts.map((one) => ({ ...one })) })), rows: rows.map(storedRepairOf) }),
    repair: ({ mission: sent, prd, k, failedJob, toFleet }) => {
      const key = repairKey(sent.id, prd, k);
      if (repairs.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      repairs.push({ prd, k, job: id, failedJob, attempts: [{ id, status: 'queued', outcome: null, reason: null, prUrl: null }], key, line: repairSkillLine(sent.number, prd, failedJob), toFleet: toFleet ? sent.fleet : null, log: null });
      return Promise.resolve(id);
    },
    keepRepair: (_mission, row) => {
      // The budget, as mission_repairs_budget() holds it: every round's repairs for the mission, this round's for the cause.
      const counted = rows.filter((one) => one.outcome !== 'lost');
      if (counted.length >= 9) return Promise.resolve({ spent: 'mission' });
      const cause = counted.filter((one) => one.round === row.round && one.fingerprint === row.fingerprint).length;
      if (cause >= 3) return Promise.resolve({ spent: 'cause' });
      const kept: FakeRepair = { ...row, id: `repair-${String(rows.length + 1)}`, number: cause + 1, outcome: null };
      rows.push(kept);
      return Promise.resolve(storedRepairOf(kept));
    },
    endRepair: (id, outcome) => {
      const one = rows.find((each) => each.id === id);
      if (one?.outcome === null) one.outcome = outcome;
      return Promise.resolve();
    },
    bugIssue: (fingerprint) => {
      const filed = bugs.get(fingerprint);
      return Promise.resolve(filed === undefined ? null : { repo: filed.repo, issue: filed.issue, fix: bugFixOf(filed.state, filed.fixedIn) });
    },
    addJob: (job) => {
      if (added.some((one) => one.kind === job.kind && one.key === job.key)) return Promise.resolve(false);
      added.push(job);
      return Promise.resolve(true);
    },
    names: (read) => Promise.resolve([read.repo, ...read.repo.split('/'), ...new Set(events.map((event) => event.actor).filter((actor) => actor !== 'agent'))]),
    record: (_id, list, at) => {
      for (const [n, event] of list.entries()) events.push({ ...event, actor: 'agent', at: new Date(at.getTime() + n).toISOString() });
      return Promise.resolve();
    },
    update: (_id, from, next) => {
      if (record.status !== from) return Promise.resolve(false);
      // Paused by stuck says so, and leaving `paused` clears it (missions_paused_by, PRD 3065).
      const by = next.pausedBy ?? (next.status === 'paused' ? record.pausedBy : undefined);
      moveTo(next.status, by);
      record = { ...record, waitingOn: next.waitingOn, nextWakeAt: next.nextWakeAt };
      return Promise.resolve(true);
    },
    budget: (read) => {
      // A mission's own Pause and Resume, newest first: a person's, or the supervisor's (`agent`).
      const own = events.filter((event) => event.prd === null && (event.kind === 'paused' || event.kind === 'resumed')).sort((a, b) => b.at.localeCompare(a.at));
      const first = (kind: string, byAgent: boolean): string | null => own.find((event) => event.kind === kind && (event.actor === 'agent') === byAgent)?.at ?? null;
      return Promise.resolve({
        missionSpent: spent.mission,
        missionCap: read.tokens ?? null,
        fleetSpent24h: spent.fleet,
        fleetCap,
        oldestEnd: spent.oldestEnd,
        named: stops.filter((one) => one.missions.includes(read.id)).at(-1) ?? null,
        open: stops.filter((one) => one.cap === 'fleet' && one.answer === null).at(-1) ?? null,
        personPausedAt: first('paused', false),
        personResumedAt: first('resumed', false),
        agentPausedAt: first('paused', true),
      });
    },
    fleetMissions: (read) => Promise.resolve([read.id, ...fleet.filter((one) => one.status === 'running' || one.status === 'waiting').map((one) => one.id)]),
    stop: (read, { cap, capTokens, spent: used, missions }) => {
      // One open stop per mission's cap and per fleet's cap (mission_budget_stops_open_mission, _open_fleet).
      if (stops.some((one) => one.answer === null && one.cap === cap && (cap === 'fleet' || one.missions.includes(read.id)))) return Promise.resolve(null);
      const id = `stop-${String(stops.length + 1)}`;
      stops.push({ id, cap, capTokens, spent: used, missions: [...missions], answer: null, raisedTo: null, createdAt: new Date(now()).toISOString(), answeredAt: null });
      return Promise.resolve(id);
    },
    pause: (ids, waitingOn) => {
      fleet = fleet.map((one) => (ids.includes(one.id) && (one.status === 'running' || one.status === 'waiting') ? { ...one, status: 'paused', waitingOn } : one));
      return Promise.resolve();
    },
    branches: () => Promise.resolve(branches.map((one) => ({ ...one }))),
    keepBranch: (_mission, { repo, branch }) => {
      // One per repository (mission_branches' primary key), the repository lowercase.
      const at = repo.toLowerCase();
      if (branches.some((one) => one.repo === at)) return Promise.resolve(false);
      branches.push({ repo: at, branch, cutAt: new Date(now()).toISOString() });
      return Promise.resolve(true);
    },
    decideItem: (read, { prd, item, job, decision }) => {
      // Once per job; off `alone` a person answers the item, as mission_decide_item() rules.
      const kept = decided.find((one) => one.job === job);
      if (kept !== undefined) return Promise.resolve({ outcome: kept.outcome, why: [...kept.why], option: kept.option });
      const alone = decision.outcome === 'escalated' || read.level === 'alone';
      const recorded = alone
        ? { ...decision, why: [...decision.why], option: decision.outcome === 'deferred' ? decision.option : null }
        : { outcome: 'escalated' as const, why: [...decision.why, 'the mission is not at alone: a person answers its items'], option: null };
      decided.push({ kind: 'answer', prd, item, job, ...recorded, decidedAt: decidedAt() });
      return Promise.resolve({ ...recorded, why: [...recorded.why] });
    },
    decisions: () => Promise.resolve(decided.map((one) => ({ ...one, why: [...one.why] }))),
  };

  /** The latest attempt of the PRD's latest run. */
  const lastOf = (prd: PrdNumber): Attempt => {
    const job = jobs.filter((one) => one.prd === prd).at(-1);
    const attempt = job?.attempts.at(-1);
    if (!attempt) throw new Error(`no job of PRD ${String(prd)} was sent`);
    return attempt;
  };

  /** A person's own move of the mission at `at`, as the route records it: their event, and the mission moved. */
  const byHand = (kind: 'paused' | 'resumed', at: number, actor = 'ada') => {
    events.push({ kind, role: 'supervisor', prd: null, job: null, link: null, sentence: `${actor} ${kind} the mission.`, actor, at: new Date(at).toISOString() });
    moveTo(kind === 'paused' ? 'paused' : 'running');
  };

  return {
    store,
    /** What the mission spent, and its fleet over the last 24 hours, the oldest counted job's end with it (PRD 3040). */
    spend: (counted: { mission?: number; fleet?: number; oldestEnd?: string | null }) => {
      Object.assign(spent, counted);
    },
    /** The fleet's daily cap from now on, null for none (PRD 3040). */
    fleetCap: (cap: number | null) => {
      fleetCap = cap;
    },
    /** The other missions of the fleet (PRD 3040), as they stand. */
    fleet: (others?: { id: string; status: MissionStatus }[]) => {
      if (others !== undefined) fleet = others.map((one) => ({ ...one, waitingOn: null }));
      return fleet.map((one) => ({ ...one }));
    },
    /** The budget stops recorded, in order (PRD 3040). */
    stops: () => stops.map((one) => ({ ...one, missions: [...one.missions] })),
    /**
     * A person answers the latest stop, once, as answer_mission_budget_stop() does: a raise saved with it (the mission's budget or the
     * fleet's cap), their own `budget-answer` event recorded on the mission.
     */
    answer: (answer: BudgetAnswer, raisedTo: number | null = null, actor = 'ada') => {
      const one = stops.at(-1);
      if (!one || one.answer !== null) throw new Error('no stop waits for an answer');
      Object.assign(one, { answer, raisedTo, answeredAt: new Date(now()).toISOString() });
      if (answer === 'raised' && one.cap === 'mission') record = { ...record, tokens: raisedTo };
      if (answer === 'raised' && one.cap === 'fleet') fleetCap = raisedTo;
      events.push({ kind: 'budget-answer', role: 'supervisor', prd: null, job: null, link: null, sentence: `${actor} answered the budget stop: ${answer}.`, actor, at: new Date(now()).toISOString() });
    },
    /** A person pauses or resumes the mission at `at` (PRD 3040's tests: dated, unlike `resume`). */
    byHand,
    /** The committees queued (PRD 2896 s9), in order, with what the database recorded for each. */
    committees: () => committees.map((one) => ({ ...one })),
    /** The PRD's latest committee job ends as `change` says, its log `log`. */
    endCommittee: (prd: PrdNumber, change: Partial<Attempt>, log: string | null = null) => {
      const one = committees.filter((each) => each.prd === prd).at(-1);
      if (!one) throw new Error(`no committee of PRD ${String(prd)} was sent`);
      Object.assign(one.attempt, change);
      one.log = log;
    },
    /** The PM jobs queued (PRD 2896 s12), in order. */
    pms: () => pms.map((one) => ({ ...one, attempt: { ...one.attempt } })),
    /** The mission's latest PM job ends as `change` says, its log `log`. */
    endPm: (change: Partial<Attempt>, log: string | null = null) => {
      const one = pms.at(-1);
      if (!one) throw new Error('no PM job was sent');
      Object.assign(one.attempt, change);
      one.log = log;
    },
    /** The item committees queued (PRD 2896 s10), in order. */
    asks: () => asks.map((one) => ({ ...one, attempt: { ...one.attempt } })),
    /** The item's latest committee job ends as `change` says, its log `log`. */
    endAsk: (item: string, change: Partial<Attempt>, log: string | null = null) => {
      const one = asks.filter((each) => each.item === item).at(-1);
      if (!one) throw new Error(`no committee of item ${item} was sent`);
      Object.assign(one.attempt, change);
      one.log = log;
    },
    /** What the database decides from now on, as mission_decide_approval() would (a phase-0 PRD, a file changed since). */
    database: (decides: (recorded: Recorded) => Decision) => {
      database = decides;
    },
    /** The target's runners from now on (PRD 2949): what its room is read from. */
    runners: (next: RoomRunner[]) => {
      runners = next;
    },
    /** The PRD's latest job ends on a provider limit that lifts at `until`, and its resume is queued (PRD 2949), as the database does on a limited report. */
    limit: (prd: PrdNumber, until: string, { guessed = false }: { guessed?: boolean } = {}) => {
      const job = jobs.filter((one) => one.prd === prd).at(-1);
      if (!job) throw new Error(`no job of PRD ${String(prd)} was sent`);
      Object.assign(lastOf(prd), { status: 'failed', reason: 'no tokens left: every account is out', limitedUntil: until, guessed });
      made += 1;
      job.attempts.push({ id: `job-${String(made)}`, status: 'queued', outcome: null, reason: null, prUrl: null });
    },
    /** The jobs queued, in order. */
    jobs: () => jobs.map((job) => ({ ...job })),
    /** The repair jobs queued (PRD 2980), in order. */
    repairJobs: () => repairs.map((one) => ({ ...one, attempts: one.attempts.map((each) => ({ ...each })) })),
    /** The PRD's latest repair job ends as `change` says, its log `log`. */
    endRepairJob: (prd: MissionPrd, change: Partial<Attempt>, log: string | null = null) => {
      const one = repairs.filter((each) => each.prd === prd).at(-1);
      const attempt = one?.attempts.at(-1);
      if (!one || !attempt) throw new Error(`no repair of PRD ${String(prd)} was sent`);
      Object.assign(attempt, change);
      one.log = log;
    },
    /** The PRD's latest repair job's runner is lost: it fails `runner lost` and a resume of it is queued (PRD 2809). */
    loseRepair: (prd: MissionPrd) => {
      const one = repairs.filter((each) => each.prd === prd).at(-1);
      const attempt = one?.attempts.at(-1);
      if (!one || !attempt) throw new Error(`no repair of PRD ${String(prd)} was sent`);
      Object.assign(attempt, { status: 'failed', reason: 'runner lost' });
      made += 1;
      one.attempts.push({ id: `job-${String(made)}`, status: 'queued', outcome: null, reason: null, prUrl: null });
    },
    /** The rows `mission_repairs` kept, in order, as the store reads them. */
    repairRows: () => rows.map(storedRepairOf),
    /** The stuck repairs queued (PRD 3065), in order. */
    stuckJobs: () => stucks.map((one) => ({ ...one, attempts: one.attempts.map((each) => ({ ...each })) })),
    /** The latest stuck repair ends as `change` says, its log `log`. */
    endStuck: (change: Partial<Attempt>, log: string | null = null) => {
      const one = stucks.at(-1);
      const attempt = one?.attempts.at(-1);
      if (!one || !attempt) throw new Error('no stuck repair was sent');
      Object.assign(attempt, change);
      one.log = log;
    },
    /** The milestone retros queued (PRD 3065), in order. */
    retroJobs: () => retroJobs.map((one) => ({ ...one, attempts: one.attempts.map((each) => ({ ...each })) })),
    /** The milestone's retro job ends as `change` says, its log `log`. */
    endRetro: (milestone: string, change: Partial<Attempt>, log: string | null = null) => {
      const one = retroJobs.find((each) => each.milestone === milestone);
      const attempt = one?.attempts.at(-1);
      if (!one || !attempt) throw new Error(`no retro of ${milestone} was sent`);
      Object.assign(attempt, change);
      one.log = log;
    },
    /** The retros `mission_retros` kept, and the items `mission_items` kept, in order (PRD 3065). */
    retroRows: () => retroRows.map((one) => ({ ...one })),
    items: () => items.map((one) => ({ ...one, evidence: [...one.evidence] })),
    /** The App's bug-report job filed the fingerprint as `issue` (PRD 2980 s4). */
    fileBug: (fingerprint: string, filed: number, repo = 'vertuoza/vertuo-omni-loop') => {
      bugs.set(fingerprint, { repo, issue: parseIssue(filed), state: 'open', fixedIn: null });
    },
    /** PRD 3088 s5: the filed bug moves, as the App's following of its issue and release moves it: fixed in `fixedIn`, or won't fix. */
    moveBug: (fingerprint: string, state: 'open' | 'merged' | 'fixed' | 'wont-fix', fixedIn: string | null = null) => {
      const filed = bugs.get(fingerprint);
      if (filed === undefined) throw new Error(`no bug was filed for ${fingerprint}`);
      bugs.set(fingerprint, { ...filed, state, fixedIn });
    },
    /** The jobs added to the App's ledger, in order. */
    added: () => added.map((one) => ({ ...one })),
    /** PRD 3088: the bugs as `omni_bug_reports` holds them now, every state. */
    bugs: () => teamBugs.map((one) => ({ ...one })),
    /** PRD 3088: a bug's row changes, as a webhook or a person would move it. */
    setBug: (filed: number, change: Partial<Bug>) => {
      teamBugs = teamBugs.map((one) => (one.issue === filed ? { ...one, ...change } : one));
    },
    /** PRD 3088: the bug-fix jobs the team queued, in order. */
    bugJobs: () => bugJobs.map((one) => ({ ...one, attempts: one.attempts.map((each) => ({ ...each })) })),
    /** PRD 3088: the bug's latest bug-fix job ends (or runs) as `change` says. */
    endBug: (filed: number, change: Partial<Attempt>) => {
      const attempt = bugJobs.filter((one) => one.issue === filed).at(-1)?.attempts.at(-1);
      if (!attempt) throw new Error(`no bug fix of #${String(filed)} was sent`);
      Object.assign(attempt, change);
    },
    /** PRD 3088: the bug's latest bug-fix job's runner is lost: it fails `runner lost` and a resume of it is queued (PRD 2809). */
    loseBug: (filed: number) => {
      const one = bugJobs.filter((each) => each.issue === filed).at(-1);
      const attempt = one?.attempts.at(-1);
      if (!one || !attempt) throw new Error(`no bug fix of #${String(filed)} was sent`);
      Object.assign(attempt, { status: 'failed', reason: 'runner lost' });
      made += 1;
      one.attempts.push(queued(`job-${String(made)}`));
    },
    /** The care jobs queued, in order (PRD 2896 s5). */
    cares: () => cares.map((one) => ({ ...one })),
    /** The events recorded, in order. */
    events: () => [...events],
    /** A member asked to drop the PRD from the mission branch (PRD 2896 s7), as the route records it. */
    asked: (prd: PrdNumber, { keep = false, actor = 'ada' }: { keep?: boolean; actor?: string } = {}) => {
      events.push({ kind: keep ? 'drop-asked-keep' : 'drop-asked', role: 'supervisor', prd, job: null, link: null, sentence: `${actor} asked to drop PRD ${String(prd)}.`, actor, at: new Date(NOW_OF_ASKS + events.length).toISOString() });
    },
    /** The mission as it stands. */
    mission: () => ({ ...record }),
    /** The PRD's latest job ends (or runs) as `change` says: a Reviewer's verdict with what it `posted` (PRD 2871). */
    end: (prd: PrdNumber, change: Partial<Attempt>) => {
      Object.assign(lastOf(prd), change);
    },
    /** The PRD's latest job's runner is lost: the job fails `runner lost` and a resume of it is queued (PRD 2809). */
    lose: (prd: PrdNumber) => {
      const job = jobs.filter((one) => one.prd === prd).at(-1);
      if (!job) throw new Error(`no job of PRD ${String(prd)} was sent`);
      Object.assign(lastOf(prd), { status: 'failed', reason: 'runner lost' });
      made += 1;
      job.attempts.push({ id: `job-${String(made)}`, status: 'queued', outcome: null, reason: null, prUrl: null });
    },
    /** The PRD's facts change: a merge, a new approval, a voiding push. */
    set: (prd: PrdNumber, change: Partial<PrdFacts>) => {
      current = current.map((fact) => (fact.prd === prd ? { ...fact, ...change } : fact));
    },
    /** A person moves the mission (Start, Pause, Resume). */
    status: (status: MissionStatus) => {
      moveTo(status, status === 'paused' ? record.pausedBy : undefined);
    },
    /** A person resumes the stopped mission, as the route records it: a `resumed` event, and the mission running. */
    resume: (actor = 'ada') => {
      events.push({ kind: 'resumed', role: 'supervisor', prd: null, job: null, link: null, sentence: `${actor} resumed the mission.`, actor, at: new Date(NOW_OF_ASKS + events.length).toISOString() });
      moveTo('running');
    },
    /**
     * A person picks on `Decide the bugs` (PRD 3001), as the mission page records it: a `resumed` of the PRD (Send on to the
     * Reviewer) or a `stopped` of it (Stop this PRD), naming QA's round-2 job, signed with their login.
     */
    pickBugs: (prd: PrdNumber, job: string, pick: 'review' | 'stop', actor = 'ada') => {
      const kind = pick === 'review' ? 'resumed' : 'stopped';
      const sentence = pick === 'review' ? `${actor} sent PRD ${String(prd)} on to the Reviewer.` : `${actor} stopped PRD ${String(prd)}.`;
      events.push({ kind, role: 'supervisor', prd, job, link: null, sentence, actor, at: new Date(NOW_OF_ASKS + events.length).toISOString() });
    },
    /** The next `count` reads of the runs wait for one another, as two runs at once would read. */
    together: (count: number) => {
      together = count;
    },
    /** PRD omni-loop-21 s9b: the builds queued for the product PRDs, in order. */
    productJobs: () => productJobs.map((one) => ({ ...one, attempts: one.attempts.map((each) => ({ ...each })) })),
    /** PRD omni-loop-21 s9b: the product PRD's latest build ends (or runs) as `change` says. */
    endProduct: (prd: ProductPrdId, change: Partial<Attempt>) => {
      const attempt = productJobs.filter((one) => one.prd === prd).at(-1)?.attempts.at(-1);
      if (!attempt) throw new Error(`no build of PRD ${prd} was sent`);
      Object.assign(attempt, change);
    },
    /** PRD omni-loop-26: the Architect's reviews queued, in order. */
    techJobs: () => techs.map((one) => ({ ...one, attempt: { ...one.attempt } })),
    /** PRD omni-loop-26: the product PRD's latest review ends as `change` says, its log `log`. */
    endTech: (prd: ProductPrdId, change: Partial<Attempt>, log: string | null = null) => {
      const one = techs.filter((each) => each.prd === prd).at(-1);
      if (!one) throw new Error(`no review of PRD ${prd} was sent`);
      Object.assign(one.attempt, change);
      one.log = log;
    },
    /**
     * Bug #3302: a person sends PM product PRD `prd` back to the PM, as the route records it: their own `sent-back` event naming the
     * PRD's last plan or tech decision's job, signed with their login.
     */
    sendBack: (prd: ProductPrdId, actor = 'ada') => {
      const job = planDecisions.filter((one) => one.prd === prd).at(-1)?.job ?? null;
      events.push({ kind: 'sent-back', role: 'supervisor', prd, job, link: null, sentence: `${actor} sent PRD ${prd} back to the PM.`, actor, at: new Date(NOW_OF_ASKS + events.length).toISOString() });
    },
    /** PRD omni-loop-26: the plan and tech decisions kept, in order, with whether each gave the Tech Approval or the product approval. */
    planDecisions: () => planDecisions.map((one) => ({ ...one, why: [...one.why], settled: [...one.settled] })),
    /** PRD omni-loop-26: where the mission's repository approves its phase 0 from now on. */
    setHome: (next: Home) => {
      home = next;
    },
    /** PRD omni-loop-21 s9b: the product PRD's facts change, as its page would (an approval, an item answered). */
    setProduct: (prd: ProductPrdId, change: Partial<StoredProduct>) => {
      productFacts = productFacts.map((one) => (one.prd === prd ? { ...one, ...change } : one));
    },
  };
}
