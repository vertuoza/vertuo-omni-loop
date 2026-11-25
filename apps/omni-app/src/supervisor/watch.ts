// The `supervisor-watch` job (PRD omni-loop-34 s2, spec "2. The checks"): a laned schedule of the ledger
// (../jobs/schedule.ts), every 2 minutes, one lane per workspace with a Supervisor seat. Plain code, no model call. A
// run reads the workspace's seat and snapshot (./store.ts), runs the nine checks (./checks.ts) and the watcher of the
// watcher (./seat.ts), then:
//
//   1. records the looks the seat missed in a row
//   2. upserts one open signal per fire, by fingerprint: a check run twice never doubles a signal
//   3. closes every open signal no check fired again; a finding the check wrote alone and nobody looked at closes with
//      it, as resolved
//   4. while the seat is offline, paused or past its limit, turns each due signal with no finding into a finding written
//      by the check alone: its check and figures first, its evidence, no explanation, `looked_at` null (the page's
//      "No Supervisor look yet"), and the check's suggestions. The offline finding is always the check's. A watching
//      seat raises the rest itself (s4)
//   5. sends one push for each high finding it raised, through `notify`; a sent push stamps `notified_at`, so it is
//      never sent twice
//
// A fingerprint an owner dismissed is never raised again while its evidence is the one dismissed (spec "4. Findings and
// suggestions"). The payload holds the slot and the workspace only, never a token; no evidence is logged.
import { checkPayloadOf, SupervisorWatchDataSchema } from '../jobs/payloads.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import { noteTo } from '../run-log/run-log.ts';
import { runChecks, type Fire, type WatchSnapshot } from './checks.ts';
import { missedLooks, seatOffline, seatState, type Seat, type SeatState } from './seat.ts';

export const SUPERVISOR_WATCH_KIND = 'supervisor-watch';

/** An open signal of the workspace. */
export type OpenSignal = { id: string; fingerprint: string; openedAt: string; findingId: string | null };

/** A finding a signal points at: its state, who raised it, whether the seat looked at it. */
export type LinkedFinding = { id: string; state: 'open' | 'acted' | 'dismissed' | 'resolved'; raisedBy: 'check' | 'supervisor'; lookedAt: string | null };

/** A dismissal: the fingerprint an owner said Not a problem to, and the evidence they dismissed. */
export type Dismissal = { fingerprint: string; evidenceKey: string | null };

/** A finding the check writes alone. */
export type NewFinding = Pick<Fire, 'fingerprint' | 'kind' | 'severity' | 'title' | 'checkLine' | 'figures' | 'evidence' | 'evidenceKey' | 'suggestions'> & { workspace: string; signalId: string };

/** What the watch reads and writes, one workspace at a time, as the service role. */
export type WatchStore = {
  seat: (workspace: string) => Promise<Seat | null>;
  snapshot: (workspace: string, now: number) => Promise<WatchSnapshot>;
  openSignals: (workspace: string) => Promise<OpenSignal[]>;
  findings: (ids: readonly string[]) => Promise<LinkedFinding[]>;
  dismissals: (workspace: string, fingerprints: readonly string[]) => Promise<Dismissal[]>;
  setMissed: (workspace: string, missed: number) => Promise<void>;
  /** Inserts the fires that have no open signal and refreshes the others; answers every fire's open signal. */
  upsertSignals: (workspace: string, fires: readonly Fire[], at: string) => Promise<OpenSignal[]>;
  closeSignals: (ids: readonly string[], at: string) => Promise<void>;
  resolveFindings: (ids: readonly string[], at: string) => Promise<void>;
  /** Writes the finding, its suggestions, and points its signal at it; answers its id. */
  raise: (finding: NewFinding, at: string) => Promise<string>;
  notified: (findingId: string, at: string) => Promise<void>;
};

/** Sends a high finding's one push (and email) to the workspace's owners; true once it went. */
export type Notify = (finding: { id: string; workspace: string; title: string; checkLine: string }) => Promise<boolean>;

/** What a run did. */
export type WatchSummary = { seat: SeatState | 'none'; missed: number; fires: number; opened: number; closed: number; raised: number; pushed: number };

/** What the plan of one run decides, from what it read. */
export type WatchPlan = { close: string[]; resolve: string[]; raise: { fire: Fire; signal: OpenSignal }[] };

/** Whether the check raises `fire`'s finding alone now. */
function raisable({ now, state, fire, signal, findingOf, dismissals }: {
  now: number; state: SeatState; fire: Fire; signal: OpenSignal; findingOf: ReadonlyMap<string, LinkedFinding>; dismissals: readonly Dismissal[];
}): boolean {
  if (state === 'watching' && fire.check !== 'seat-offline') return false;
  if (now - Date.parse(signal.openedAt) < (fire.raiseAfterMs ?? 0)) return false;
  const finding = signal.findingId === null ? undefined : findingOf.get(signal.findingId);
  if (finding && finding.state !== 'dismissed') return false;
  return !dismissals.some((d) => d.fingerprint === fire.fingerprint && d.evidenceKey === fire.evidenceKey);
}

/**
 * The plan of one run: the open signals no fire kept are closed (with the finding the check wrote alone, unlooked); a
 * fire whose signal is due and has no finding (or a dismissed one whose evidence changed) is raised, when the check
 * writes alone or when the fire is the seat's own. Pure.
 */
export function planWatch({ now, state, fires, before, after, linked, dismissals }: {
  now: number;
  state: SeatState;
  fires: readonly Fire[];
  /** The open signals before the upsert. */
  before: readonly OpenSignal[];
  /** Every fire's open signal after the upsert. */
  after: readonly OpenSignal[];
  linked: readonly LinkedFinding[];
  dismissals: readonly Dismissal[];
}): WatchPlan {
  const fired = new Set(fires.map((fire) => fire.fingerprint));
  const findingOf = new Map(linked.map((finding) => [finding.id, finding]));
  const gone = before.filter((signal) => !fired.has(signal.fingerprint));
  const resolve = gone.flatMap((signal) => {
    const finding = signal.findingId === null ? undefined : findingOf.get(signal.findingId);
    return finding?.state === 'open' && finding.raisedBy === 'check' && finding.lookedAt === null ? [finding.id] : [];
  });
  const signalOf = new Map(after.map((signal) => [signal.fingerprint, signal]));
  const raise = fires.flatMap((fire) => {
    const signal = signalOf.get(fire.fingerprint);
    return signal && raisable({ now, state, fire, signal, findingOf, dismissals }) ? [{ fire, signal }] : [];
  });
  return { close: gone.map((signal) => signal.id), resolve, raise };
}

/** The handler of the `supervisor-watch` kind. */
export function supervisorWatchHandler({
  store,
  notify,
  clock = Date.now,
  log = noteTo('supervisor-watch'),
}: {
  store: WatchStore;
  /** Null: no push is sent from here, and the high finding keeps `notified_at` null for whoever sends it. */
  notify: Notify | null;
  clock?: () => number;
  log?: (line: string) => void;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    const { lane: workspace } = checkPayloadOf(SupervisorWatchDataSchema, SUPERVISOR_WATCH_KIND, job.payload);
    const summary = await watchOnce({ store, notify, workspace, now: clock(), log });
    if (summary.seat === 'none') return { outcome: 'skipped', reason: 'the workspace has no Supervisor seat' };
    log(`supervisor watch: seat ${summary.seat}, ${String(summary.fires)} fires, ${String(summary.opened)} opened, ${String(summary.closed)} closed, ${String(summary.raised)} raised, ${String(summary.pushed)} pushed`);
    return { outcome: 'done' };
  };
}

/** One look at one workspace. */
export async function watchOnce({ store, notify, workspace, now, log }: {
  store: WatchStore;
  notify: Notify | null;
  workspace: string;
  now: number;
  log: (line: string) => void;
}): Promise<WatchSummary> {
  const seat = await store.seat(workspace);
  if (!seat) return { seat: 'none', missed: 0, fires: 0, opened: 0, closed: 0, raised: 0, pushed: 0 };
  const at = new Date(now).toISOString();
  const missed = missedLooks(seat, now);
  await store.setMissed(workspace, missed);
  const state = seatState(seat, now);
  const fires = [...runChecks(await store.snapshot(workspace, now)), ...seatOffline(seat, now)];
  const before = await store.openSignals(workspace);
  const after = await store.upsertSignals(workspace, fires, at);
  const linkedIds = [...new Set([...before, ...after].flatMap((signal) => (signal.findingId === null ? [] : [signal.findingId])))];
  const linked = linkedIds.length > 0 ? await store.findings(linkedIds) : [];
  const dismissals = fires.length > 0 ? await store.dismissals(workspace, fires.map((fire) => fire.fingerprint)) : [];
  const plan = planWatch({ now, state, fires, before, after, linked, dismissals });
  if (plan.close.length > 0) await store.closeSignals(plan.close, at);
  if (plan.resolve.length > 0) await store.resolveFindings(plan.resolve, at);
  let pushed = 0;
  for (const { fire, signal } of plan.raise) {
    const id = await store.raise({
      workspace, signalId: signal.id, fingerprint: fire.fingerprint, kind: fire.kind, severity: fire.severity, title: fire.title,
      checkLine: fire.checkLine, figures: fire.figures, evidence: fire.evidence, evidenceKey: fire.evidenceKey, ...(fire.suggestions ? { suggestions: fire.suggestions } : {}),
    }, at);
    if (fire.severity !== 'high') continue;
    if (!notify) {
      log('supervisor watch: a high finding was raised; no push is sent from the App, it waits with notified_at unset');
      continue;
    }
    if (await notify({ id, workspace, title: fire.title, checkLine: fire.checkLine })) {
      await store.notified(id, at);
      pushed += 1;
    }
  }
  const known = new Set(before.map((signal) => signal.fingerprint));
  return {
    seat: state, missed, fires: fires.length, opened: fires.filter((fire) => !known.has(fire.fingerprint)).length,
    closed: plan.close.length, raised: plan.raise.length, pushed,
  };
}
