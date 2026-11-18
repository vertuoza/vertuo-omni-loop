// The mission's store in memory (PRD 2842 s4), for the tests of its job and the fake fleet of s9: one mission, the
// facts of its PRDs, the runner jobs it sent (their keys unique, as `runner_jobs.mission_key` is) with their
// attempts, and its events. Test helpers move what a real fleet would: a job's end, a lost runner and its resume, a
// PRD's facts, a person's Pause. Its repairs (PRD 2980) are kept as `mission_repairs` keeps them: the database's caps
// hold here too, 3 per cause in a round and 9 per mission. Its token budget (PRD 3040): what the mission and its fleet spent,
// the fleet's daily cap, the other missions of the fleet and the budget stops, one open per cap as the database keeps them, each
// answered once, a raise saved with its answer. No database, no model call.
import { parseIssue, type IssueNumber, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { NewJob } from '../jobs/ledger.ts';
import { repairKey, repairSkillLine, type RepairJob, type RepairRow } from './repair.ts';
import { askLine, DEFAULT_BOUND, type ItemCommittee } from './answers.ts';
import { approveLine, committeeKey, type Committee, type Decision, type Recorded } from './committee.ts';
import { pmKey, type PmJob } from './pm.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import type { BudgetAnswer } from 'omni-loop/kit/lib/mission/budget.ts';
import type { StopRow } from './budget.ts';
import { baseOf, lineOf, missionKey, type Attempt, type MissionStatus, type RoomRunner, type NewEvent, type PrdFacts, type Step } from './supervisor.ts';

/** A job the fake queued, as the runner_jobs row it stands for: the build, or the Reviewer and the fix after it (PRD 2871). */
type FakeJob = { id: string; line: string; key: string; toFleet: string | null; sentByApp: string; prd: PrdNumber; run: number; step: Step; attempts: Attempt[] };

/** A recorded event, as its mission_events row. */
type FakeEvent = Omit<NewEvent, 'kind'> & { kind: string; actor: string; at: string };

const NOW_OF_ASKS = Date.parse('2027-01-22T08:00:00Z');

/** The mission's store in memory, seeded with `mission` and the facts of its PRDs. */
export function fakeMissionStore({ mission, facts, fleetRunners = true, planRepository = false, installation = 1, pages = [], now = Date.now }: {
  mission: MissionRecord; facts: PrdFacts[]; fleetRunners?: boolean; planRepository?: boolean; installation?: number | null;
  /** PRDs with a page that are in no scope yet (PRD 2896 s12): read as facts once the mission's scope names them, as a PRD its PM wrote. */
  pages?: PrdFacts[];
  /** The database's clock: when a budget stop is recorded and answered (PRD 3040). */
  now?: () => number;
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
  const committees: (Committee & { key: string; line: string; toFleet: string | null; log: string | null; recorded: Recorded | null })[] = [];
  /** The PM jobs it queued (PRD 2896 s12): their key and log. */
  const pms: (PmJob & { key: string; toFleet: string | null; log: string | null })[] = [];
  /** The item committees it queued (PRD 2896 s10), with no mission key: their line and log. */
  const asks: (Omit<ItemCommittee, 'decision'> & { line: string; toFleet: string | null; log: string | null })[] = [];
  /** What the database decides when the App records a decision: by default, what the App decided. */
  let database: (recorded: Recorded) => Decision = (recorded) => recorded.decision;
  /** The repair jobs it queued (PRD 2980): their key, line and log. */
  const repairs: (RepairJob & { key: string; line: string; toFleet: string | null; log: string | null })[] = [];
  /** The rows `mission_repairs` kept. */
  const rows: RepairRow[] = [];
  /** The Omni Loop bugs `omni_bug_reports` holds, by fingerprint, and the jobs added to the App's ledger. */
  const bugs = new Map<string, { repo: string; issue: IssueNumber }>();
  const added: NewJob[] = [];
  /** The token budget (PRD 3040): what the mission and its fleet spent, the fleet's cap, its other missions and the stops. */
  const spent = { mission: 0, fleet: 0, oldestEnd: null as string | null };
  let fleetCap: number | null = null;
  let fleet: { id: string; status: MissionStatus; waitingOn: string | null }[] = [];
  const stops: StopRow[] = [];
  let made = 0;
  /** Reads of the runs held until this many are waiting: two runs at once read the same state. */
  let together = 0;
  let waiting: (() => void)[] = [];

  const copyOf = (job: FakeJob) => ({ prd: job.prd, run: job.run, step: job.step, job: job.id, attempts: job.attempts.map((one) => ({ ...one })) });

  const store: MissionStore = {
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
    events: () => Promise.resolve(events.map(({ kind, prd, job }) => ({ kind, prd, job }))),
    fleetEvents: () => Promise.resolve(events.filter(({ kind }) => kind === 'decided' || kind === 'overturned').map(({ kind, prd, sentence, link, actor }) => ({ kind, prd, sentence, link, actor }))),
    fleetRunners: () => Promise.resolve(fleetRunners),
    room: () => Promise.resolve(runners.map((one) => ({ ...one }))),
    planRepository: () => Promise.resolve(planRepository),
    installation: () => Promise.resolve(installation),
    send: ({ mission: sent, prd, run, step, toFleet, skill, fix = null }) => {
      const key = missionKey(sent.id, prd, run, step);
      if (jobs.some((job) => job.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      jobs.push({ id, line: lineOf(prd, step, skill, baseOf(sent, skill === 'ultra-yolo'), fix), key, toFleet: toFleet ? sent.fleet : null, sentByApp: 'omni-app', prd, run, step, attempts: [{ id, status: 'queued', outcome: null, reason: null, prUrl: null }] });
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
    committees: () => Promise.resolve(committees.map(({ prd, round, job, attempt, decision }) => ({ prd, round, job, attempt: { ...attempt }, decision }))),
    committeeLog: (job) =>
      Promise.resolve(
        committees.find((one) => one.job === job)?.log ??
          asks.find((one) => one.job === job)?.log ??
          pms.find((one) => one.job === job)?.log ??
          repairs.find((one) => one.attempts.some((each) => each.id === job))?.log ??
          null,
      ),
    pmJobs: () => Promise.resolve(pms.map(({ round, job, line, attempt }) => ({ round, job, line, attempt: { ...attempt } }))),
    pm: ({ mission: sent, round, line, toFleet }) => {
      const key = pmKey(sent.id, round);
      if (pms.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      pms.push({ round, job: id, line, attempt: { id, status: 'queued', outcome: null, reason: null, prUrl: null }, key, toFleet: toFleet ? sent.fleet : null, log: null });
      return Promise.resolve(id);
    },
    decide: (_mission, one, recorded) => {
      const held = committees.find((each) => each.job === one.job);
      if (!held) return Promise.reject(new Error(`no committee job ${one.job}`));
      if (held.decision !== null) return Promise.resolve(held.decision);
      const decision = database(recorded);
      held.decision = decision;
      held.recorded = recorded;
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
    approve: ({ mission: sent, prd, round, toFleet, author = null }) => {
      const key = committeeKey(sent.id, prd, round);
      if (committees.some((one) => one.key === key)) return Promise.resolve(null);
      made += 1;
      const id = `job-${String(made)}`;
      committees.push({ prd, round, job: id, attempt: { id, status: 'queued', outcome: null, reason: null, prUrl: null }, decision: null, key, line: approveLine(prd, author), toFleet: toFleet ? sent.fleet : null, log: null, recorded: null });
      return Promise.resolve(id);
    },
    repairs: () => Promise.resolve({ jobs: repairs.map(({ prd, k, job, failedJob, attempts }) => ({ prd, k, job, failedJob, attempts: attempts.map((one) => ({ ...one })) })), rows: rows.map((one) => ({ ...one })) }),
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
      const kept: RepairRow = { ...row, id: `repair-${String(rows.length + 1)}`, number: cause + 1, outcome: null };
      rows.push(kept);
      return Promise.resolve({ ...kept });
    },
    endRepair: (id, outcome) => {
      const one = rows.find((each) => each.id === id);
      if (one?.outcome === null) one.outcome = outcome;
      return Promise.resolve();
    },
    bugIssue: (fingerprint) => Promise.resolve(bugs.get(fingerprint) ?? null),
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
      record = { ...record, status: next.status, waitingOn: next.waitingOn, nextWakeAt: next.nextWakeAt };
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
    record = { ...record, status: kind === 'paused' ? 'paused' : 'running' };
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
    endRepairJob: (prd: PrdNumber, change: Partial<Attempt>, log: string | null = null) => {
      const one = repairs.filter((each) => each.prd === prd).at(-1);
      const attempt = one?.attempts.at(-1);
      if (!one || !attempt) throw new Error(`no repair of PRD ${String(prd)} was sent`);
      Object.assign(attempt, change);
      one.log = log;
    },
    /** The PRD's latest repair job's runner is lost: it fails `runner lost` and a resume of it is queued (PRD 2809). */
    loseRepair: (prd: PrdNumber) => {
      const one = repairs.filter((each) => each.prd === prd).at(-1);
      const attempt = one?.attempts.at(-1);
      if (!one || !attempt) throw new Error(`no repair of PRD ${String(prd)} was sent`);
      Object.assign(attempt, { status: 'failed', reason: 'runner lost' });
      made += 1;
      one.attempts.push({ id: `job-${String(made)}`, status: 'queued', outcome: null, reason: null, prUrl: null });
    },
    /** The rows `mission_repairs` kept, in order. */
    repairRows: () => rows.map((one) => ({ ...one })),
    /** The App's bug-report job filed the fingerprint as `issue` (PRD 2980 s4). */
    fileBug: (fingerprint: string, filed: number, repo = 'vertuoza/vertuo-omni-loop') => {
      bugs.set(fingerprint, { repo, issue: parseIssue(filed) });
    },
    /** The jobs added to the App's ledger, in order. */
    added: () => added.map((one) => ({ ...one })),
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
      record = { ...record, status };
    },
    /** A person resumes the stopped mission, as the route records it: a `resumed` event, and the mission running. */
    resume: (actor = 'ada') => {
      events.push({ kind: 'resumed', role: 'supervisor', prd: null, job: null, link: null, sentence: `${actor} resumed the mission.`, actor, at: new Date(NOW_OF_ASKS + events.length).toISOString() });
      record = { ...record, status: 'running' };
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
  };
}
