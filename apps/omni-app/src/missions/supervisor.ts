// The supervisor's decisions (PRD 2842 s4, spec "3. The supervisor"): pure functions over what one run of a
// mission read, and a clock. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   the reads     a PRD's approval in force stands, or there is none, or a push voided it (BL-APPROVALS-1); its
//                 stage is merged (shipped or retro), ready (outbox) or open; its plan's territory is every
//                 slice's, read with the kit's plan parser, none when it has no plan or one that cannot be read;
//                 a roadmap in scope is its PRDs, each blocker row read as its PRD
//   outcome       the spec's table: a job's end, at its step, to the PRD's next step
//
//                   Ready                  waits for a person to merge it (a build's, a fix's, or the Reviewer's pass)
//                   Review                 the build sends the Reviewer's round 1, the fix its round 2 (PRD 2871)
//                   Changes                round 1 sends the fix; round 2 waits for a person to decide the findings
//                   Waiting on answers     waits for a person to answer; the page's auto-fix carries on
//                   Need human             waits for a person to act on its runner job
//                   Held, Stopped mid-way  sent again once (run 2, at the same step); a second time stops that PRD
//                   Runner lost            recorded: PRD 2809's resume carries it
//                   Cancelled              never sent again: that PRD is paused
//                   Failed                 stops that PRD, saying why
//
//   prdStates     where each PRD of the scope is: merged, running (a job of it queued, claimed or running,
//                 resumes followed), waiting on a person, blocked by an unmerged PRD, stopped, paused, or
//                 startable. A stage of ready or merged wins over the mission's own runs: a PRD a person took
//                 to ready by hand carries on from there
//   pick          the startable PRDs to send, in scope order, while fewer than `mandate.parallel` run: never one
//                 whose plan's territory meets a running PRD's, or one picked before it; a PRD with no plan runs
//                 alone. Nothing while paused, a draft or delivered
//   conclude      the mission's status (delivered only when every PRD is merged), what it waits on (at most 300
//                 characters) and its next wake, a minute on while it runs or waits
//   eventsOf      each decision as a mission event, once: the events already recorded are read back as keys, so
//                 a replayed run records nothing twice. The supervisor's own rows are signed `supervisor`, a
//                 job's end `engineer` (the Engineer hero's work), a Reviewer job's `reviewer`, its verdict a
//                 `reviewed` row linking its review; all by `agent`, never in a person's name. An event links to a
//                 pull request or its review; it never holds a person's words, a credential or a log line
//
// The steps of a run (PRD 2871): the build `/omni:yolo <n> --for-review` under the run's key, then the Reviewer
// `/omni:review <n>` under `…:review:1`, the fix `/omni:yolo-fix <n> --for-review` under `…:fix:1`, and the
// Reviewer again under `…:review:2`. Each key is unique, so a replay sends each once; there is no third round.
import { PrdNumberSchema, PrNumberSchema, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { parsePlanSlices, sharedGround } from 'omni-loop/kit/lib/inbox/territory.ts';

export type MissionStatus = 'draft' | 'running' | 'waiting' | 'paused' | 'delivered' | 'stopped';
export type RunnerJobStatus = 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'cancelled';

/** The mission as a run reads it. */
export type Mission = { id: string; fleet: string; status: MissionStatus; parallel: number; waitingOn: string | null };

export type Approval = 'standing' | 'none' | 'voided';
export type Stage = 'merged' | 'ready' | 'open';

/** One PRD of the scope, as a run read it. `territory` is null when it has no plan to read: it runs alone. */
export type PrdFacts = { prd: PrdNumber; approval: Approval; stage: Stage; blockers: PrdNumber[]; territory: string[] | null };

/** What a Reviewer job's log says it posted (PRD 2871): how many findings, when it says, and its review's link. */
export type Posted = { findings: number | null; url: string | null };

/** One runner job of a run: the job the mission sent, or a resume of it (PRD 2809). A Reviewer job's carries what it posted. */
export type Attempt = { id: string; status: RunnerJobStatus; outcome: string | null; reason: string | null; prUrl: string | null; posted?: Posted | null };

/** A step of a run, in order (PRD 2871): the build, the Reviewer's round 1, the fix after it, the Reviewer's round 2. */
export type Step = 'build' | 'review:1' | 'fix:1' | 'review:2';
const STEPS: readonly Step[] = ['build', 'review:1', 'fix:1', 'review:2'];

/** One job the mission sent for a PRD: its key's run number and step, its job, and its attempts in order, the job's first. */
export type Run = { prd: PrdNumber; run: number; step: Step; job: string; attempts: Attempt[] };

/** How a runner job ended, as the table reads it. */
export type JobEnd = 'ready' | 'answers' | 'human' | 'held' | 'stopped' | 'review' | 'changes' | 'lost' | 'cancelled' | 'failed';

/** What a person must do for a PRD to carry on: `decide` the Reviewer's findings after round 2 (PRD 2871). */
export type WaitsOn = 'approve' | 'approve-again' | 'answer' | 'merge' | 'act' | 'decide';

/** A job's end, as the PRD's next step: `send` the run's next step (PRD 2871). */
export type Next =
  | { next: 'waits'; on: 'merge' | 'answer' | 'act' | 'decide' }
  | { next: 'send'; step: Step }
  | { next: 'again' }
  | { next: 'stops'; why: string }
  | { next: 'paused' }
  | { next: 'records' };

export type PrdState =
  | { state: 'merged' }
  | { state: 'running'; run: number }
  | { state: 'waits'; on: Exclude<WaitsOn, 'decide'> }
  | { state: 'waits'; on: 'decide'; pr: PrNumber | null }
  | { state: 'blocked'; by: PrdNumber[] }
  | { state: 'stopped'; why: string }
  | { state: 'paused' }
  | { state: 'startable'; run: number; step: Step };

/** A PRD to send: the run it is, and its step. */
export type Send = { prd: PrdNumber; run: number; step: Step };

/** What a run sets on the mission. */
export type Concluded = { status: MissionStatus; waitingOn: string | null; nextWakeAt: string | null };

export type EventKind = 'dispatched' | 'job-ended' | 'waits' | 'prd-ready' | 'prd-merged' | 'held' | 'stopped' | 'delivered' | 'reviewed';
export type EventRole = 'supervisor' | 'engineer' | 'reviewer';

/** An event to record, signed by its role and `agent`. */
export type NewEvent = { kind: EventKind; role: EventRole; prd: PrdNumber | null; job: string | null; link: string | null; sentence: string };

/** An event already recorded, as a run reads it back. */
export type RecordedEvent = { kind: string; prd: PrdNumber | null; job: string | null };

/** How often a running or waiting mission checks again, when nothing wakes it first. */
export const WAKE_MS = 60_000;
/** The longest `waiting_on`, and the longest event sentence, the database keeps. */
const WORDS_MAX = 300;
/** The run a held or stopped-mid-way PRD stops at: sent again once, never a third time. */
const LAST_RUN = 2;

/** The rounds the Reviewer reviews at most (PRD 2871): a third has no key. */
const ROUNDS = 2;

const KEY = /^mission:([0-9a-f-]{36}):prd:([1-9][0-9]*):run:([1-9][0-9]*)(?::(review:[12]|fix:1))?$/;

/** The key a mission's job is sent under: never twice for one PRD, run and step. The build's is the run's own. */
export const missionKey = (mission: string, prd: PrdNumber, run: number, step: Step = 'build'): string =>
  `mission:${mission}:prd:${String(prd)}:run:${String(run)}${step === 'build' ? '' : `:${step}`}`;

const isStep = (text: string): text is Step => (STEPS as readonly string[]).includes(text);

/** The PRD, run and step a mission key names; null for any other text. */
export function runOfKey(key: string): { prd: PrdNumber; run: number; step: Step } | null {
  const match = KEY.exec(key);
  const prd = PrdNumberSchema.safeParse(Number(match?.[2]));
  const step = match?.[4] ?? 'build';
  return match && prd.success && isStep(step) ? { prd: prd.data, run: Number(match[3]), step } : null;
}

/** The line a step is sent as (PRD 2871): the build and the fix sent for review, the Reviewer between them. */
export function lineOf(prd: PrdNumber, step: Step): string {
  const n = String(prd);
  if (step === 'build') return `/omni:yolo ${n} --for-review`;
  if (step === 'fix:1') return `/omni:yolo-fix ${n} --for-review`;
  return `/omni:review ${n}`;
}

/** The Reviewer's round a step is; null for the build and the fix. */
const roundOf = (step: Step): number | null => (step === 'review:1' ? 1 : step === 'review:2' ? 2 : null);

/** A review's link as GitHub gives it: a pull request of a repository, or one review on it. */
const REVIEW_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:#pullrequestreview-\d+)?$/;
/** `omni review post`'s line (kit/bin/commands/review.ts): posted, with its verdict and count, or a round already posted. */
const POSTED = /omni review: posted round [12] \((pass|changes, (\d+) findings?)\) on PR #\d+: (\S+)$/;
const ALREADY = /omni review: round [12] is already posted on PR #\d+: (\S+?)\. Nothing posted\.$/;

/**
 * What a Reviewer job's log says it posted: its last `omni review post` line, read for its count of findings (none
 * when it found the round already posted) and its review's link (none unless it is GitHub's). Only those two are
 * kept: never a line of the log (L-GDPR-2). Null when the log has no such line.
 */
export function postedOf(log: string): Posted | null {
  for (const line of log.split('\n').reverse()) {
    const posted = POSTED.exec(line.trimEnd());
    if (posted) return { findings: posted[1] === 'pass' ? 0 : Number(posted[2]), url: reviewUrl(posted[3]) };
    const already = ALREADY.exec(line.trimEnd());
    if (already) return { findings: null, url: reviewUrl(already[1]) };
  }
  return null;
}

const reviewUrl = (url: string | undefined): string | null => (url !== undefined && REVIEW_URL.test(url) ? url : null);

/** The pull request a link names; null when it names none. */
function prOfUrl(url: string | null): PrNumber | null {
  const number = /\/pull\/(\d+)/.exec(url ?? '')?.[1];
  const pr = PrNumberSchema.safeParse(Number(number));
  return number !== undefined && pr.success ? pr.data : null;
}

// ── The reads, made plain ────────────────────────────────────────────────────────

/** A PRD's latest approval, as standing or voided, or none. */
export const approvalOf = (latest: { voided: boolean } | null): Approval => (latest === null ? 'none' : latest.voided ? 'voided' : 'standing');

/** A PRD's stage, from the stages it reached. */
export function stageOf(stages: readonly string[]): Stage {
  if (stages.includes('shipped') || stages.includes('retro')) return 'merged';
  return stages.includes('outbox') ? 'ready' : 'open';
}

/** Every path its plan's slices declare, once each; null when there is no plan, or none the parser reads. */
export function territoryOf(plan: string | null): string[] | null {
  if (plan === null) return null;
  try {
    const paths = [...new Set(parsePlanSlices(plan).flatMap((slice) => slice.territory))];
    return paths.length > 0 ? paths : null;
  } catch {
    return null;
  }
}

/** A roadmap row: its PRD (null for a product's), its row id, and the row ids it waits on. */
export type RoadmapRow = { prd: PrdNumber | null; rowId: string; blockers: string[] };

/** The scope's PRDs, in order, each with the PRDs it waits on: the PRDs named alone first, then each roadmap's. */
export function expandScope(prds: readonly PrdNumber[], roadmaps: readonly (readonly RoadmapRow[])[]): { prd: PrdNumber; blockers: PrdNumber[] }[] {
  const scope = new Map<PrdNumber, Set<PrdNumber>>(prds.map((prd) => [prd, new Set()]));
  for (const rows of roadmaps) {
    const byRow = new Map(rows.map((row) => [row.rowId, row.prd]));
    for (const row of rows) {
      if (row.prd === null) continue;
      const blockers = scope.get(row.prd) ?? new Set<PrdNumber>();
      for (const id of row.blockers) {
        const blocker = byRow.get(id);
        if (blocker !== undefined && blocker !== null && blocker !== row.prd) blockers.add(blocker);
      }
      scope.set(row.prd, blockers);
    }
  }
  return [...scope].map(([prd, blockers]) => ({ prd, blockers: [...blockers] }));
}

// ── The table ────────────────────────────────────────────────────────────────────

/** How a runner job ended; null while it is queued, claimed or running. A done job with no hand-off stopped mid-way. */
export function endOf({ status, outcome: word }: Attempt): JobEnd | null {
  if (status === 'queued' || status === 'claimed' || status === 'running') return null;
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'failed';
  if (word === 'ready' || word === 'answers' || word === 'human' || word === 'held' || word === 'review' || word === 'changes') return word;
  return 'stopped';
}

/** A step that stopped mid-way, in run `run`: sent again once, stopped the second time. */
const stoppedAt = (run: number): Next => (run >= LAST_RUN ? { next: 'stops', why: 'it stopped mid-way twice' } : { next: 'again' });

/** The spec's table: a job's end, at step `step` of run `run`, as the PRD's next step. A hand-off its step never ends on stopped mid-way. */
export function outcome(end: JobEnd, run: number, reason: string | null = null, step: Step = 'build'): Next {
  switch (end) {
    case 'ready':
      return { next: 'waits', on: 'merge' };
    case 'answers':
      return { next: 'waits', on: 'answer' };
    case 'human':
      return { next: 'waits', on: 'act' };
    case 'review':
      if (step === 'build') return { next: 'send', step: 'review:1' };
      return step === 'fix:1' ? { next: 'send', step: 'review:2' } : stoppedAt(run);
    case 'changes':
      if (step === 'review:1') return { next: 'send', step: 'fix:1' };
      return step === 'review:2' ? { next: 'waits', on: 'decide' } : stoppedAt(run);
    case 'held':
      return run >= LAST_RUN ? { next: 'stops', why: 'it was held twice' } : { next: 'again' };
    case 'stopped':
      return stoppedAt(run);
    case 'lost':
      return { next: 'records' };
    case 'cancelled':
      return { next: 'paused' };
    case 'failed':
      return { next: 'stops', why: reason ? `its job failed: ${reason}` : 'its job failed' };
  }
}

// ── Where each PRD is ────────────────────────────────────────────────────────────

/** A run's latest attempt: the resume that carries it, or the job itself. */
const lastOf = (run: Run): Attempt | undefined => run.attempts.at(-1);

/** Whether job `a` comes after job `b`: a later run, or a later step of the same run. */
const after = (a: Run, b: Run): boolean => a.run > b.run || (a.run === b.run && STEPS.indexOf(a.step) > STEPS.indexOf(b.step));

/** Where each PRD of the scope is, by PRD. */
export function prdStates(facts: readonly PrdFacts[], runs: readonly Run[]): Map<PrdNumber, PrdState> {
  const merged = new Set(facts.filter((fact) => fact.stage === 'merged').map((fact) => fact.prd));
  return new Map(facts.map((fact) => [fact.prd, stateOf(fact, runs.filter((one) => one.prd === fact.prd), merged)]));
}

function stateOf(fact: PrdFacts, runs: readonly Run[], merged: ReadonlySet<PrdNumber>): PrdState {
  if (fact.stage === 'merged') return { state: 'merged' };
  const latest = runs.reduce<Run | null>((last, one) => (last === null || after(one, last) ? one : last), null);
  const last = latest ? lastOf(latest) : undefined;
  if (latest && last && endOf(last) === null) return { state: 'running', run: latest.run };
  if (fact.stage === 'ready') return { state: 'waits', on: 'merge' };
  return latest && last ? afterEnd(fact, latest, last, merged) : gate(fact, 1, 'build', merged);
}

/** Where a PRD is once its latest job ended: the table's next step, the next step of a run under the same run. */
function afterEnd(fact: PrdFacts, latest: Run, last: Attempt, merged: ReadonlySet<PrdNumber>): PrdState {
  const next = outcome(endOf(last) ?? 'stopped', latest.run, last.reason, latest.step);
  if (next.next === 'waits') return next.on === 'decide' ? { state: 'waits', on: 'decide', pr: prOfUrl(last.prUrl) } : { state: 'waits', on: next.on };
  if (next.next === 'send') return { state: 'startable', run: latest.run, step: next.step };
  if (next.next === 'stops') return { state: 'stopped', why: next.why };
  if (next.next === 'paused') return { state: 'paused' };
  if (next.next === 'again') return gate(fact, latest.run + 1, latest.step, merged);
  return { state: 'running', run: latest.run };
}

/**
 * Step `step` of run `run` of the PRD. A build waits for its approval to stand and every blocker to be merged; a
 * later step (the Reviewer, the fix) carries on a build already sent, and waits on neither.
 */
function gate(fact: PrdFacts, run: number, step: Step, merged: ReadonlySet<PrdNumber>): PrdState {
  if (step !== 'build') return { state: 'startable', run, step };
  if (fact.approval === 'none') return { state: 'waits', on: 'approve' };
  if (fact.approval === 'voided') return { state: 'waits', on: 'approve-again' };
  const by = fact.blockers.filter((blocker) => !merged.has(blocker));
  return by.length > 0 ? { state: 'blocked', by } : { state: 'startable', run, step };
}

// ── Pick ─────────────────────────────────────────────────────────────────────────

/** The PRDs this run sends, in scope order. */
export function pick({ mission, facts, states }: { mission: Mission; facts: readonly PrdFacts[]; states: ReadonlyMap<PrdNumber, PrdState> }): Send[] {
  if (mission.status === 'draft' || mission.status === 'paused' || mission.status === 'delivered') return [];
  const running = facts.filter((fact) => states.get(fact.prd)?.state === 'running');
  const busy = running.map((fact) => fact.territory);
  if (busy.includes(null)) return [];
  const slots = mission.parallel - running.length;
  const sends: Send[] = [];
  for (const fact of facts) {
    const state = states.get(fact.prd);
    if (sends.length >= slots) break;
    if (state?.state !== 'startable') continue;
    if (fact.territory === null) {
      if (busy.length > 0) continue;
      sends.push({ prd: fact.prd, run: state.run, step: state.step });
      break;
    }
    const territory = fact.territory;
    if (busy.some((other) => other !== null && sharedGround({ territory: other }, { territory }).length > 0)) continue;
    sends.push({ prd: fact.prd, run: state.run, step: state.step });
    busy.push(territory);
  }
  return sends;
}

// ── Conclude ─────────────────────────────────────────────────────────────────────

const WAITS_WORDS: Readonly<Record<Exclude<WaitsOn, 'decide'>, string>> = {
  approve: 'approve it',
  'approve-again': 'approve it again',
  answer: 'answer its questions',
  merge: 'merge it',
  act: 'act on its runner job',
};

/** What a PRD waits on a person for, in words: after round 2, the Reviewer's findings on its PR (PRD 2871). */
function waitWords(state: Extract<PrdState, { state: 'waits' }>): string {
  if (state.on !== 'decide') return WAITS_WORDS[state.on];
  return `decide the Reviewer's findings on ${state.pr === null ? 'its feature PR' : `PR #${String(state.pr)}`}`;
}

/** How a stopped mission carries on. */
const CARRY_ON = 'Take it to ready by hand and the mission carries on.';

/** `parts` joined by `glue`, as many as fit in `max` characters, an ellipsis when some were left out. */
function fitted(parts: readonly string[], glue: string, max = WORDS_MAX): string {
  let text = '';
  for (const [n, part] of parts.entries()) {
    const longer = text === '' ? part : `${text}${glue}${part}`;
    const room = n === parts.length - 1 ? max : max - 1;
    if (longer.length > room) return `${(text || part.slice(0, max - 1)).slice(0, max - 1)}…`;
    text = longer;
  }
  return text;
}

/** `text`, cut to `max` characters. */
const cut = (text: string, max = WORDS_MAX): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** What the mission waits on a person for, PRD by PRD; null when nothing. */
function waitsOf(facts: readonly PrdFacts[], states: ReadonlyMap<PrdNumber, PrdState>): string | null {
  const parts = facts.flatMap((fact) => {
    const state = states.get(fact.prd);
    return state?.state === 'waits' ? [`PRD ${String(fact.prd)}: ${waitWords(state)}`] : [];
  });
  return parts.length > 0 ? fitted(parts, ' · ') : null;
}

/** Why a mission stopped: each PRD that stopped or was paused, and how to carry on. */
function stoppedWhy(facts: readonly PrdFacts[], states: ReadonlyMap<PrdNumber, PrdState>): string {
  const parts = facts.flatMap((fact) => {
    const state = states.get(fact.prd);
    if (state?.state === 'stopped') return [`PRD ${String(fact.prd)} stopped: ${state.why}`];
    if (state?.state === 'paused') return [`PRD ${String(fact.prd)} was cancelled`];
    return [];
  });
  const why = parts.length > 0 ? parts.join(' · ') : 'no PRD of its scope can start';
  return cut(`${why}. ${CARRY_ON}`);
}

/** The mission's status, what it waits on, and when it checks again. */
export function conclude({ mission, facts, states, sent, now }: { mission: Mission; facts: readonly PrdFacts[]; states: ReadonlyMap<PrdNumber, PrdState>; sent: number; now: number }): Concluded {
  const at = new Date(now + WAKE_MS).toISOString();
  if (mission.status === 'draft' || mission.status === 'delivered') return { status: mission.status, waitingOn: mission.waitingOn, nextWakeAt: null };
  const all = [...states.values()];
  if (facts.length > 0 && all.every((state) => state.state === 'merged')) return { status: 'delivered', waitingOn: null, nextWakeAt: null };
  if (mission.status === 'paused') return { status: 'paused', waitingOn: mission.waitingOn, nextWakeAt: null };
  const waitingOn = waitsOf(facts, states);
  if (sent > 0 || all.some((state) => state.state === 'running' || state.state === 'startable')) return { status: 'running', waitingOn, nextWakeAt: at };
  if (waitingOn !== null) return { status: 'waiting', waitingOn, nextWakeAt: at };
  return { status: 'stopped', waitingOn: stoppedWhy(facts, states), nextWakeAt: null };
}

// ── The events ───────────────────────────────────────────────────────────────────

/** A job's key, when the event names one. */
const jobKey = (prefix: string, job: string | null): string[] => (job === null ? [] : [`${prefix}:${job}`]);

/** The keys each kind of event stands for: a run of the same state finds them and records nothing again. */
const KEYS: Readonly<Partial<Record<string, (prdKey: string | null, job: string | null) => string[]>>> = {
  dispatched: (_prdKey, job) => jobKey('dispatched', job),
  'job-ended': (_prdKey, job) => jobKey('end', job),
  held: (_prdKey, job) => jobKey('end', job),
  reviewed: (_prdKey, job) => jobKey('end', job),
  'prd-ready': (prdKey, job) => [`ready:${prdKey ?? 'mission'}`, ...jobKey('end', job)],
  'prd-merged': (prdKey) => [`merged:${prdKey ?? 'mission'}`],
  stopped: (prdKey) => (prdKey === null ? [] : [`stopped:${prdKey}`]),
  delivered: () => ['delivered'],
};

/** The keys an event recorded stands for; none for a kind recorded on every change (waits, Start, Pause). */
const keysOf = ({ kind, prd, job }: RecordedEvent): string[] => KEYS[kind]?.(prd === null ? null : String(prd), job) ?? [];

/** Every key the recorded events stand for. */
export const recordedKeys = (events: readonly RecordedEvent[]): Set<string> => new Set(events.flatMap(keysOf));

/** A link an event may carry: a web address of at most 500 characters, else none. */
const linkOf = (url: string | null): string | null => (url !== null && /^https?:\/\//.test(url) && url.length <= 500 ? url : null);

/** A held or stopped-mid-way PRD: sent again once, stopped the second time. */
const againWords = (n: string, what: string, run: number): string =>
  run >= LAST_RUN ? `${n} ${what} a second time: it stops here.` : `${n} ${what}: the mission sends it again, once.`;

type EndWords = Pick<NewEvent, 'kind' | 'role' | 'sentence'>;

/** What a job's end says of its PRD (`n`), in run `run`: its event's kind, role and sentence. A Reviewer job's says it as the Reviewer. */
const END_WORDS: Readonly<Record<Exclude<JobEnd, 'review' | 'changes'>, (n: string, run: number, reason: string | null) => EndWords>> = {
  ready: (n) => ({ kind: 'prd-ready', role: 'engineer', sentence: `${n} is ready for review: it waits for a person to merge it.` }),
  answers: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n} waits on answers: the page's auto-fix carries on once a person answers.` }),
  human: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s job needs a person: act on it on the Runners page.` }),
  held: (n, run) => ({ kind: 'held', role: 'supervisor', sentence: againWords(n, 'was held', run) }),
  stopped: (n, run) => ({ kind: 'held', role: 'supervisor', sentence: againWords(n, 'stopped mid-way', run) }),
  lost: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s runner was lost: its resume carries the work on.` }),
  cancelled: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s job was cancelled: the mission never sends it again.` }),
  failed: (n, _run, reason) => ({ kind: 'job-ended', role: 'engineer', sentence: reason ? `${n}'s job failed: ${reason}.` : `${n}'s job failed.` }),
};

/** `1 finding`, `2 findings`. */
const findingsWords = (count: number): string => `${String(count)} finding${count === 1 ? '' : 's'}`;

/**
 * The Reviewer's verdict in round `round` (PRD 2871), signed `reviewer`, linking its review (else its PR): `Changes
 * asked: 2 findings, round 1/2.`, without the count when its log gave none; `Passed, round 2 of 2: marked ready.`
 */
function verdictEvent(prd: PrdNumber, round: number, last: Attempt, end: 'changes' | 'ready'): NewEvent {
  const of = `${String(round)}/${String(ROUNDS)}`;
  const count = last.posted?.findings ?? null;
  const sentence =
    end === 'ready' ? `Passed, round ${String(round)} of ${String(ROUNDS)}: marked ready.` : count === null || count === 0 ? `Changes asked, round ${of}.` : `Changes asked: ${findingsWords(count)}, round ${of}.`;
  return { kind: 'reviewed', role: 'reviewer', prd, job: last.id, link: linkOf(last.posted?.url ?? last.prUrl), sentence };
}

/** What a fix shipped for review says it settled: round 1's findings, by their count when its log gave one. */
const fixedWords = (asked: number | null): string => (asked === null || asked === 0 ? 'the findings' : findingsWords(asked));

/**
 * A build or a fix shipped for review (PRD 2871), its PR left a draft for the Reviewer, in the before/after's words:
 * `Shipped; waits for review.`, then `Fixed 2 findings; shipped again.`, `asked` being round 1's count.
 */
const shippedEvent = (prd: PrdNumber, one: Run, last: Attempt, asked: number | null): NewEvent => ({
  kind: 'job-ended',
  role: 'engineer',
  prd,
  job: last.id,
  link: linkOf(last.prUrl),
  sentence: one.step === 'build' ? 'Shipped; waits for review.' : `Fixed ${fixedWords(asked)}; shipped again.`,
});

/** Any other end, in END_WORDS's words (a hand-off its step never ends on reads as stopped mid-way's), a Reviewer job's signed by it. */
function plainEndEvent(prd: PrdNumber, one: Run, last: Attempt, end: JobEnd): NewEvent {
  const words = END_WORDS[end === 'review' || end === 'changes' ? 'stopped' : end](`PRD ${String(prd)}`, one.run, last.reason);
  const role = roundOf(one.step) !== null && words.role === 'engineer' ? 'reviewer' : words.role;
  return { prd, job: last.id, link: linkOf(last.prUrl), ...words, role };
}

/** The event of a job's end, at its step: a Reviewer's verdict is `reviewed`; a build or fix shipped for review waits for it. */
function endEvent(prd: PrdNumber, one: Run, last: Attempt, end: JobEnd, asked: number | null = null): NewEvent {
  const round = roundOf(one.step);
  if (round !== null && (end === 'changes' || end === 'ready')) return verdictEvent(prd, round, last, end);
  return end === 'review' && round === null ? shippedEvent(prd, one, last, asked) : plainEndEvent(prd, one, last, end);
}

/** How many findings the Reviewer's round 1 raised before fix `one`, when its log said: the latest round 1 of its PRD up to its run. */
function askedBefore(runs: readonly Run[], one: Run): number | null {
  if (one.step !== 'fix:1') return null;
  const rounds = runs.filter((other) => other.prd === one.prd && other.step === 'review:1' && other.run <= one.run);
  const latest = rounds.reduce<Run | null>((last, other) => (last === null || other.run > last.run ? other : last), null);
  return (latest ? lastOf(latest)?.posted?.findings : null) ?? null;
}

/** What a dispatch says: the line sent, where, and its run (and round, for the Reviewer). */
function sentWords(one: Run, where: string): string {
  const round = roundOf(one.step);
  return `Sent ${lineOf(one.prd, one.step)} to ${where} (run ${String(one.run)}${round === null ? '' : `, round ${String(round)}`}).`;
}

/** What each job says: its dispatch, each runner lost along the way, and its end. */
function runEvents(runs: readonly Run[], where: string): NewEvent[] {
  return runs.flatMap((one) => {
    const last = lastOf(one);
    const end = last ? endOf(last) : null;
    const sent: NewEvent = { kind: 'dispatched', role: 'supervisor', prd: one.prd, job: one.job, link: null, sentence: sentWords(one, where) };
    const ending = last && end !== null ? [endEvent(one.prd, one, last, end, askedBefore(runs, one))] : [];
    return [sent, ...one.attempts.slice(0, -1).map((lost) => endEvent(one.prd, one, lost, 'lost')), ...ending];
  });
}

/** What each PRD's state says: merged, ready by its stage, stopped. */
function prdEvents(facts: readonly PrdFacts[], states: ReadonlyMap<PrdNumber, PrdState>): NewEvent[] {
  return facts.flatMap((fact) => {
    const n = `PRD ${String(fact.prd)}`;
    const state = states.get(fact.prd);
    const said = (kind: EventKind, sentence: string): NewEvent => ({ kind, role: 'supervisor', prd: fact.prd, job: null, link: null, sentence });
    return [
      ...(fact.stage === 'merged' ? [said('prd-merged', `${n} is merged: delivered.`)] : []),
      ...(fact.stage === 'ready' ? [said('prd-ready', `${n} reads ready for review: it waits for a person to merge it.`)] : []),
      ...(state?.state === 'stopped' ? [said('stopped', `${n} stops: ${state.why}.`)] : []),
    ];
  });
}

/** What the mission's own change says: delivered, stopped, or a new wait on a person. */
function missionEvents(mission: Mission, next: Concluded): NewEvent[] {
  const said = (kind: EventKind, sentence: string): NewEvent => ({ kind, role: 'supervisor', prd: null, job: null, link: null, sentence });
  if (next.status === 'delivered') return [said('delivered', 'Every PRD of the mission is merged: delivered.')];
  if (next.status === 'stopped') return mission.status === 'stopped' ? [] : [said('stopped', `The mission stopped: ${next.waitingOn ?? 'nothing can move'}`)];
  const waits = newWait(mission, next);
  return waits === null ? [] : [said('waits', `Waits on a person: ${waits}`)];
}

/** What the mission now waits on a person for, when it changed while it runs or waits; else null. */
function newWait(mission: Mission, next: Concluded): string | null {
  if (next.status !== 'running' && next.status !== 'waiting') return null;
  return next.waitingOn !== mission.waitingOn ? next.waitingOn : null;
}

/** The events this run records, in the order they happened, none already recorded. */
export function eventsOf({
  mission,
  facts,
  states,
  runs,
  next,
  toFleet,
  recorded,
}: {
  mission: Mission;
  facts: readonly PrdFacts[];
  states: ReadonlyMap<PrdNumber, PrdState>;
  runs: readonly Run[];
  next: Concluded;
  toFleet: boolean;
  recorded: ReadonlySet<string>;
}): NewEvent[] {
  const keys = new Set(recorded);
  const where = toFleet ? `the ${mission.fleet} fleet's runners` : 'any runner of the workspace';
  const all = [...runEvents(runs, where), ...prdEvents(facts, states), ...missionEvents(mission, next)];
  return all.flatMap((event) => {
    const own = keysOf(event);
    if (own.some((key) => keys.has(key))) return [];
    for (const key of own) keys.add(key);
    return [{ ...event, sentence: cut(event.sentence) }];
  });
}
