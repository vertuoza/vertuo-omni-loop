// The supervisor's decisions (PRD 2842 s4, spec "3. The supervisor"): pure functions over what one run of a
// mission read, and a clock. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   the reads     a PRD's approval in force stands, or there is none, or a push voided it (BL-APPROVALS-1); its
//                 stage is merged (shipped or retro), ready (outbox) or open; its plan's territory is every
//                 slice's, read with the kit's plan parser, none when it has no plan or one that cannot be read;
//                 a roadmap in scope is its PRDs, each blocker row read as its PRD
//   outcome       the spec's table: a job's end to the PRD's next step
//
//                   Ready                  waits for a person to merge it
//                   Waiting on answers     waits for a person to answer; the page's auto-fix carries on
//                   Need human             waits for a person to act on its runner job
//                   Held, Stopped mid-way  sent again once (run 2); a second time stops that PRD, saying why
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
//                 job's end `engineer` (the Engineer hero's work); both by `agent`, never in a person's name.
//                 An event links to a pull request; it never holds a person's words, a credential or a log line
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { parsePlanSlices, sharedGround } from 'omni-loop/kit/lib/inbox/territory.ts';

export type MissionStatus = 'draft' | 'running' | 'waiting' | 'paused' | 'delivered' | 'stopped';
export type RunnerJobStatus = 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'cancelled';

/** The mission as a run reads it. */
export type Mission = { id: string; fleet: string; status: MissionStatus; parallel: number; waitingOn: string | null };

export type Approval = 'standing' | 'none' | 'voided';
export type Stage = 'merged' | 'ready' | 'open';

/** One PRD of the scope, as a run read it. `territory` is null when it has no plan to read: it runs alone. */
export type PrdFacts = { prd: PrdNumber; approval: Approval; stage: Stage; blockers: PrdNumber[]; territory: string[] | null };

/** One runner job of a run: the job the mission sent, or a resume of it (PRD 2809). */
export type Attempt = { id: string; status: RunnerJobStatus; outcome: string | null; reason: string | null; prUrl: string | null };

/** One run of a PRD the mission sent: its key's run number, its job, and its attempts in order, the job's first. */
export type Run = { prd: PrdNumber; run: number; job: string; attempts: Attempt[] };

/** How a runner job ended, as the table reads it. */
export type JobEnd = 'ready' | 'answers' | 'human' | 'held' | 'stopped' | 'lost' | 'cancelled' | 'failed';

/** What a person must do for a PRD to carry on. */
export type WaitsOn = 'approve' | 'approve-again' | 'answer' | 'merge' | 'act';

/** A job's end, as the PRD's next step. */
export type Next = { next: 'waits'; on: 'merge' | 'answer' | 'act' } | { next: 'again' } | { next: 'stops'; why: string } | { next: 'paused' } | { next: 'records' };

export type PrdState =
  | { state: 'merged' }
  | { state: 'running'; run: number }
  | { state: 'waits'; on: WaitsOn }
  | { state: 'blocked'; by: PrdNumber[] }
  | { state: 'stopped'; why: string }
  | { state: 'paused' }
  | { state: 'startable'; run: number };

/** A PRD to send, and the run it is. */
export type Send = { prd: PrdNumber; run: number };

/** What a run sets on the mission. */
export type Concluded = { status: MissionStatus; waitingOn: string | null; nextWakeAt: string | null };

export type EventKind = 'dispatched' | 'job-ended' | 'waits' | 'prd-ready' | 'prd-merged' | 'held' | 'stopped' | 'delivered';
export type EventRole = 'supervisor' | 'engineer';

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

const KEY = /^mission:([0-9a-f-]{36}):prd:([1-9][0-9]*):run:([1-9][0-9]*)$/;

/** The key a mission's job is sent under: never twice for one PRD and run. */
export const missionKey = (mission: string, prd: PrdNumber, run: number): string => `mission:${mission}:prd:${String(prd)}:run:${String(run)}`;

/** The PRD and run a mission key names; null for any other text. */
export function runOfKey(key: string): { prd: PrdNumber; run: number } | null {
  const match = KEY.exec(key);
  const prd = PrdNumberSchema.safeParse(Number(match?.[2]));
  return match && prd.success ? { prd: prd.data, run: Number(match[3]) } : null;
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
  if (word === 'ready' || word === 'answers' || word === 'human' || word === 'held') return word;
  return 'stopped';
}

/** The spec's table: a job's end, in run `run`, as the PRD's next step. */
export function outcome(end: JobEnd, run: number, reason: string | null = null): Next {
  switch (end) {
    case 'ready':
      return { next: 'waits', on: 'merge' };
    case 'answers':
      return { next: 'waits', on: 'answer' };
    case 'human':
      return { next: 'waits', on: 'act' };
    case 'held':
      return run >= LAST_RUN ? { next: 'stops', why: 'it was held twice' } : { next: 'again' };
    case 'stopped':
      return run >= LAST_RUN ? { next: 'stops', why: 'it stopped mid-way twice' } : { next: 'again' };
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

/** Where each PRD of the scope is, by PRD. */
export function prdStates(facts: readonly PrdFacts[], runs: readonly Run[]): Map<PrdNumber, PrdState> {
  const merged = new Set(facts.filter((fact) => fact.stage === 'merged').map((fact) => fact.prd));
  return new Map(facts.map((fact) => [fact.prd, stateOf(fact, runs.filter((one) => one.prd === fact.prd), merged)]));
}

function stateOf(fact: PrdFacts, runs: readonly Run[], merged: ReadonlySet<PrdNumber>): PrdState {
  if (fact.stage === 'merged') return { state: 'merged' };
  const latest = runs.reduce<Run | null>((last, one) => (last === null || one.run > last.run ? one : last), null);
  const last = latest ? lastOf(latest) : undefined;
  if (latest && last && endOf(last) === null) return { state: 'running', run: latest.run };
  if (fact.stage === 'ready') return { state: 'waits', on: 'merge' };
  return latest && last ? afterEnd(fact, latest, last, merged) : gate(fact, 1, merged);
}

/** Where a PRD is once its latest run ended: the table's next step. */
function afterEnd(fact: PrdFacts, latest: Run, last: Attempt, merged: ReadonlySet<PrdNumber>): PrdState {
  const next = outcome(endOf(last) ?? 'stopped', latest.run, last.reason);
  if (next.next === 'waits') return { state: 'waits', on: next.on };
  if (next.next === 'stops') return { state: 'stopped', why: next.why };
  if (next.next === 'paused') return { state: 'paused' };
  if (next.next === 'again') return gate(fact, latest.run + 1, merged);
  return { state: 'running', run: latest.run };
}

/** Run `run` of the PRD, once its approval stands and every blocker is merged. */
function gate(fact: PrdFacts, run: number, merged: ReadonlySet<PrdNumber>): PrdState {
  if (fact.approval === 'none') return { state: 'waits', on: 'approve' };
  if (fact.approval === 'voided') return { state: 'waits', on: 'approve-again' };
  const by = fact.blockers.filter((blocker) => !merged.has(blocker));
  return by.length > 0 ? { state: 'blocked', by } : { state: 'startable', run };
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
      sends.push({ prd: fact.prd, run: state.run });
      break;
    }
    const territory = fact.territory;
    if (busy.some((other) => other !== null && sharedGround({ territory: other }, { territory }).length > 0)) continue;
    sends.push({ prd: fact.prd, run: state.run });
    busy.push(territory);
  }
  return sends;
}

// ── Conclude ─────────────────────────────────────────────────────────────────────

const WAITS_WORDS: Readonly<Record<WaitsOn, string>> = {
  approve: 'approve it',
  'approve-again': 'approve it again',
  answer: 'answer its questions',
  merge: 'merge it',
  act: 'act on its runner job',
};

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
    return state?.state === 'waits' ? [`PRD ${String(fact.prd)}: ${WAITS_WORDS[state.on]}`] : [];
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

/** What a job's end says of its PRD (`n`), in run `run`: its event's kind, role and sentence. */
const END_WORDS: Readonly<Record<JobEnd, (n: string, run: number, reason: string | null) => EndWords>> = {
  ready: (n) => ({ kind: 'prd-ready', role: 'engineer', sentence: `${n} is ready for review: it waits for a person to merge it.` }),
  answers: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n} waits on answers: the page's auto-fix carries on once a person answers.` }),
  human: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s job needs a person: act on it on the Runners page.` }),
  held: (n, run) => ({ kind: 'held', role: 'supervisor', sentence: againWords(n, 'was held', run) }),
  stopped: (n, run) => ({ kind: 'held', role: 'supervisor', sentence: againWords(n, 'stopped mid-way', run) }),
  lost: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s runner was lost: its resume carries the work on.` }),
  cancelled: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s job was cancelled: the mission never sends it again.` }),
  failed: (n, _run, reason) => ({ kind: 'job-ended', role: 'engineer', sentence: reason ? `${n}'s job failed: ${reason}.` : `${n}'s job failed.` }),
};

/** The event of a job's end. */
const endEvent = (prd: PrdNumber, run: number, last: Attempt, end: JobEnd): NewEvent => ({
  prd,
  job: last.id,
  link: linkOf(last.prUrl),
  ...END_WORDS[end](`PRD ${String(prd)}`, run, last.reason),
});

/** What each run says: its dispatch, each runner lost along the way, and its end. */
function runEvents(runs: readonly Run[], where: string, skill: string): NewEvent[] {
  return runs.flatMap((one) => {
    const last = lastOf(one);
    const end = last ? endOf(last) : null;
    const sent: NewEvent = { kind: 'dispatched', role: 'supervisor', prd: one.prd, job: one.job, link: null, sentence: `Sent /omni:${skill} ${String(one.prd)} to ${where} (run ${String(one.run)}).` };
    return [sent, ...one.attempts.slice(0, -1).map((lost) => endEvent(one.prd, one.run, lost, 'lost')), ...(last && end !== null ? [endEvent(one.prd, one.run, last, end)] : [])];
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
  skill = 'yolo',
  recorded,
}: {
  mission: Mission;
  facts: readonly PrdFacts[];
  states: ReadonlyMap<PrdNumber, PrdState>;
  runs: readonly Run[];
  next: Concluded;
  toFleet: boolean;
  skill?: 'yolo' | 'ultra-yolo';
  recorded: ReadonlySet<string>;
}): NewEvent[] {
  const keys = new Set(recorded);
  const where = toFleet ? `the ${mission.fleet} fleet's runners` : 'any runner of the workspace';
  const all = [...runEvents(runs, where, skill), ...prdEvents(facts, states), ...missionEvents(mission, next)];
  return all.flatMap((event) => {
    const own = keysOf(event);
    if (own.some((key) => keys.has(key))) return [];
    for (const key of own) keys.add(key);
    return [{ ...event, sentence: cut(event.sentence) }];
  });
}
