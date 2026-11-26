// The `supervisor-watch` job (PRD omni-loop-34 s2): a signal per fingerprint however often it runs, closed when its cause
// is gone; a finding written by the check alone while the seat cannot look; the watcher of the watcher and its one push;
// a dismissal that stays quiet. Over a store in memory that keeps the database's rules (one open signal per fingerprint).
import { describe, expect, it } from 'vitest';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { Fire, WatchJob, WatchSnapshot } from './checks.ts';
import { LOOK_MS, type Seat } from './seat.ts';
import { planWatch, supervisorWatchHandler, watchOnce, type Dismissal, type LinkedFinding, type NewFinding, type OpenSignal, type WatchStore } from './watch.ts';

const WS = '11111111-1111-4111-8111-111111111111';
const RUNNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const JOB_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
const MISSION_ID = 'cccccccc-0000-4000-8000-000000000001';
const MIN = 60_000;
const T0 = Date.parse('2027-01-15T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

type Signal = OpenSignal & { closedAt: string | null; checkLine: string };
type Finding = LinkedFinding & NewFinding & { notifiedAt: string | null };

/** A database in memory: signals, findings, dismissals, and the seat. */
function memory(seat: Seat | null, snapshot: (now: number) => Omit<WatchSnapshot, 'now'>) {
  const signals: Signal[] = [];
  const findings: Finding[] = [];
  const dismissals: Dismissal[] = [];
  let missed = -1;
  let n = 0;
  const id = () => `dddddddd-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
  const open = () => signals.filter((s) => s.closedAt === null);
  const store: WatchStore = {
    seat: () => Promise.resolve(seat),
    snapshot: (_, now) => Promise.resolve({ now, ...snapshot(now) }),
    openSignals: () => Promise.resolve(open().map((s) => ({ id: s.id, fingerprint: s.fingerprint, openedAt: s.openedAt, findingId: s.findingId }))),
    findings: (ids) => Promise.resolve(findings.filter((f) => ids.includes(f.id))),
    dismissals: (_, prints) => Promise.resolve(dismissals.filter((d) => prints.includes(d.fingerprint))),
    setMissed: (_, value) => {
      missed = value;
      return Promise.resolve();
    },
    upsertSignals: (_, fires, at) => {
      for (const fire of fires) {
        const found = open().find((s) => s.fingerprint === fire.fingerprint);
        if (found) found.checkLine = fire.checkLine;
        else signals.push({ id: id(), fingerprint: fire.fingerprint, openedAt: at, findingId: null, closedAt: null, checkLine: fire.checkLine });
      }
      return Promise.resolve(open().filter((s) => fires.some((f) => f.fingerprint === s.fingerprint)));
    },
    closeSignals: (ids, at) => {
      for (const s of signals) if (ids.includes(s.id)) s.closedAt = at;
      return Promise.resolve();
    },
    resolveFindings: (ids) => {
      for (const f of findings) if (ids.includes(f.id)) f.state = 'resolved';
      return Promise.resolve();
    },
    raise: (finding) => {
      const made: Finding = { ...finding, id: id(), state: 'open', raisedBy: 'check', lookedAt: null, notifiedAt: null };
      findings.push(made);
      const signal = signals.find((s) => s.id === finding.signalId);
      if (signal) signal.findingId = made.id;
      return Promise.resolve(made.id);
    },
    notified: (findingId, at) => {
      const found = findings.find((f) => f.id === findingId);
      if (found) found.notifiedAt = at;
      return Promise.resolve();
    },
  };
  const dismiss = (finding: Finding) => {
    finding.state = 'dismissed';
    dismissals.push({ fingerprint: finding.fingerprint, evidenceKey: finding.evidenceKey });
  };
  return { store, signals, findings, dismiss, missed: () => missed };
}

const seatAt = (lastLookAt: number | null, over: Partial<Seat> = {}): Seat => ({
  workspace: WS, runnerId: RUNNER, runnerName: 'atlas-01', paused: false, dailyTokens: 5_000_000, tokensDay: null, tokensUsed: 0,
  lastLookAt: lastLookAt === null ? null : iso(lastLookAt), placedAt: iso(T0 - 60 * MIN), ...over,
});

const silentJob = (now: number, lastLineMinutes = 52): WatchJob => ({
  id: JOB_ID, repo: 'acme/widgets', line: '/omni:wave 7', status: 'running', outcome: null, reason: null, runnerId: RUNNER, toRunner: null,
  toFleet: null, queuedAt: iso(now - 90 * MIN), runningAt: iso(now - 80 * MIN), endedAt: null, resumeAfter: null, attempt: 1,
  lastLineAt: iso(now - lastLineMinutes * MIN), lastLine: null, continued: false,
});

const world = (jobs: (now: number) => WatchJob[]) => (now: number): Omit<WatchSnapshot, 'now'> => ({
  jobs: jobs(now),
  runners: [{ id: RUNNER, name: 'atlas-01', fleet: null, repos: ['acme/widgets'], lastSeenAt: iso(now - 10_000), paused: null, accounts: null, disk: [] }],
  missions: [], errors: [], ledger: { late: 0, scheduledLate: 0, failing: [] }, baselines: { wave: 2.5 },
});

const quiet = () => undefined;

describe('the watch — signals by fingerprint', () => {
  it('AC-1: a running job seen 10 s ago, its last line 52 min old, a 2.5 min usual step, opens one stuck:silent:<job> signal over two runs', async () => {
    const db = memory(seatAt(T0 - MIN), world((now) => [silentJob(now)]));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 2 * MIN, log: quiet });
    expect(db.signals.filter((s) => s.closedAt === null).map((s) => s.fingerprint)).toEqual([`stuck:silent:${JOB_ID}`]);
    expect(db.signals).toHaveLength(1);
    expect(db.signals[0]?.checkLine).toBe('Silent job: no line for 52 min, 3× the 2.5 min usual');
  });

  it('closes the signal once its cause is gone, and a finding the check wrote alone, unlooked, closes as resolved', async () => {
    let lastLine = 52;
    const db = memory(seatAt(null, { paused: true }), world((now) => [silentJob(now, lastLine)]));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    expect(db.findings.map((f) => f.state)).toEqual(['open']);
    lastLine = 1;
    const summary = await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 2 * MIN, log: quiet });
    expect(summary.closed).toBe(1);
    expect(db.signals[0]?.closedAt).not.toBeNull();
    expect(db.findings.map((f) => f.state)).toEqual(['resolved']);
  });

  it('a watching seat raises nothing itself: the seat turns the signals into findings', async () => {
    const db = memory(seatAt(T0 - MIN), world((now) => [silentJob(now)]));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    expect(db.findings).toEqual([]);
  });
});

describe('the watch — a finding by the check alone while the seat cannot look', () => {
  it.each([
    ['paused', seatAt(T0 - MIN, { paused: true })],
    ['past its limit', seatAt(T0 - MIN, { tokensDay: '2027-01-15', tokensUsed: 5_000_000 })],
    ['offline', seatAt(T0 - 7 * MIN)],
  ])('while the seat is %s, the signal becomes a finding with its check first and no look yet', async (_, seat) => {
    const db = memory(seat, world((now) => [silentJob(now)]));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    const finding = db.findings.find((f) => f.fingerprint === `stuck:silent:${JOB_ID}`);
    expect(finding).toMatchObject({ raisedBy: 'check', lookedAt: null, checkLine: 'Silent job: no line for 52 min, 3× the 2.5 min usual', severity: 'medium' });
    expect(db.signals.find((s) => s.fingerprint === `stuck:silent:${JOB_ID}`)?.findingId).toBe(finding?.id);
  });

  it('raises it once however often it runs', async () => {
    const db = memory(seatAt(null, { paused: true }), world((now) => [silentJob(now)]));
    for (let look = 0; look < 3; look += 1) await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + look * 2 * MIN, log: quiet });
    expect(db.findings).toHaveLength(1);
  });

  it('AC-10: a mission sending the same repair 3 times, while the seat is paused, becomes a finding whose suggestions are Pause and Open', async () => {
    const db = memory(seatAt(null, { paused: true }), (now) => ({
      ...world(() => [])(now),
      missions: [{ id: MISSION_ID, number: 4, title: 'Ship the quotes', status: 'running', lastEventAt: iso(now - MIN), updatedAt: iso(now), runFailed: false, repairs: { 'kit:wave:abc': 3 } }],
    }));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    expect(db.findings.map((f) => [f.title, f.suggestions?.map((s) => s.label)])).toEqual([['Mission #4 is not moving', ['Pause the mission', 'Open the mission']]]);
  });

  it('waits for a signal\'s raise time: a runner paused 30 min', async () => {
    const db = memory(seatAt(null, { paused: true }), (now) => {
      const base = world(() => [])(now);
      return { ...base, runners: base.runners.map((r) => ({ ...r, paused: 'memory over 90%' })) };
    });
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 28 * MIN, log: quiet });
    expect(db.findings).toEqual([]);
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 30 * MIN, log: quiet });
    expect(db.findings.map((f) => f.fingerprint)).toEqual([`health:paused:${RUNNER}`]);
  });
});

describe('the watcher of the watcher', () => {
  it('AC-8: a seat that missed 3 looks raises one high offline finding and one push', async () => {
    const pushes: string[] = [];
    const notify = (finding: { title: string }) => {
      pushes.push(finding.title);
      return Promise.resolve(true);
    };
    const lastLook = T0 - 3 * LOOK_MS - 5_000;
    const db = memory(seatAt(lastLook), world(() => []));
    await watchOnce({ store: db.store, notify, workspace: WS, now: T0, log: quiet });
    await watchOnce({ store: db.store, notify, workspace: WS, now: T0 + 2 * MIN, log: quiet });
    expect(db.findings.map((f) => [f.title, f.severity, f.kind, f.raisedBy])).toEqual([['The Supervisor is offline since 2027-01-15 11:53 UTC on atlas-01', 'high', 'health', 'check']]);
    expect(pushes).toEqual(['The Supervisor is offline since 2027-01-15 11:53 UTC on atlas-01']);
    expect(db.findings[0]?.notifiedAt).toBe(iso(T0));
    expect(db.missed()).toBe(4);
  });

  it('two missed looks are no offline yet; a paused seat is never offline', async () => {
    const db = memory(seatAt(T0 - 2 * LOOK_MS - 5_000), world(() => []));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    const paused = memory(seatAt(T0 - 60 * MIN, { paused: true }), world(() => []));
    await watchOnce({ store: paused.store, notify: null, workspace: WS, now: T0, log: quiet });
    expect([...db.findings, ...paused.findings]).toEqual([]);
  });

  it('a watching seat still gets the offline finding from the check, and with no push here it waits with notified_at unset', async () => {
    const said: string[] = [];
    const db = memory(seatAt(T0 - 10 * MIN), world(() => []));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: (line) => said.push(line) });
    expect(db.findings.map((f) => f.notifiedAt)).toEqual([null]);
    expect(said).toEqual(['supervisor watch: a high finding was raised; no push is sent from the App, it waits with notified_at unset']);
  });
});

describe('a dismissal stays quiet', () => {
  it('never raises a dismissed fingerprint again with the same evidence, and raises it when the evidence changes', async () => {
    let lineAt = T0 - 52 * MIN;
    const db = memory(seatAt(null, { paused: true }), world((now) => [{ ...silentJob(now), lastLineAt: iso(lineAt) }]));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    const [first] = db.findings;
    if (!first) throw new Error('no finding');
    db.dismiss(first);
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 2 * MIN, log: quiet });
    expect(db.findings).toHaveLength(1);
    // A new line came, then the job went silent again: the evidence (its last line's time) changed.
    lineAt = T0 + 5 * MIN;
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 30 * MIN, log: quiet });
    expect(db.findings).toHaveLength(2);
  });
});

describe('a finding closes once every signal it holds closed', () => {
  const jobAt = (n: number) => `bbbbbbbb-0000-4000-8000-00000000040${String(n)}`;

  it('AC-8: a grouped finding holding three open signals closes as resolved once all three closed', async () => {
    const silent = new Set([1, 2, 3]);
    const db = memory(seatAt(T0 - MIN), world((now) => [1, 2, 3].map((n) => ({ ...silentJob(now, silent.has(n) ? 52 : 1), id: jobAt(n) }))));
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0, log: quiet });
    expect(db.signals).toHaveLength(3);
    // The seat looked and raised one finding over the three, under a group fingerprint.
    const group: Finding = {
      id: 'eeeeeeee-0000-4000-8000-000000000001', state: 'open', raisedBy: 'supervisor', lookedAt: iso(T0), workspace: WS, signalId: '',
      fingerprint: 'stuck:silent-group:atlas-01', kind: 'stuck', severity: 'medium', title: '3 jobs went silent on atlas-01', checkLine: '',
      figures: { signals: 3 }, evidence: [], evidenceKey: 'k', notifiedAt: null,
    };
    db.findings.push(group);
    for (const signal of db.signals) signal.findingId = group.id;

    silent.delete(1);
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 2 * MIN, log: quiet });
    silent.delete(2);
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 4 * MIN, log: quiet });
    expect(db.signals.filter((s) => s.findingId === group.id && s.closedAt === null)).toHaveLength(1);
    expect(group.state).toBe('open');

    silent.delete(3);
    await watchOnce({ store: db.store, notify: null, workspace: WS, now: T0 + 6 * MIN, log: quiet });
    expect(db.signals.filter((s) => s.findingId === group.id).every((s) => s.closedAt !== null)).toBe(true);
    expect(group.state).toBe('resolved');
  });

  it('closes a finding the seat raised, and one the seat looked at, once its one signal closed', () => {
    const before: OpenSignal[] = [
      { id: 's1', fingerprint: 'stuck:silent:x', openedAt: iso(T0), findingId: 'f1' },
      { id: 's2', fingerprint: 'stuck:silent:y', openedAt: iso(T0), findingId: 'f2' },
    ];
    const linked: LinkedFinding[] = [
      { id: 'f1', state: 'open', raisedBy: 'supervisor', lookedAt: iso(T0) },
      { id: 'f2', state: 'open', raisedBy: 'check', lookedAt: iso(T0) },
    ];
    expect(planWatch({ now: T0, state: 'watching', fires: [], before, after: [], linked, dismissals: [] })).toEqual({ close: ['s1', 's2'], resolve: ['f1', 'f2'], raise: [] });
  });

  it('keeps a finding open while one of its signals is open, and leaves a finding no longer open as it is', () => {
    const before: OpenSignal[] = [
      { id: 's1', fingerprint: 'stuck:silent:x', openedAt: iso(T0), findingId: 'f1' },
      { id: 's2', fingerprint: 'stuck:silent:y', openedAt: iso(T0), findingId: 'f1' },
      { id: 's3', fingerprint: 'stuck:silent:z', openedAt: iso(T0), findingId: 'f2' },
    ];
    const linked: LinkedFinding[] = [
      { id: 'f1', state: 'open', raisedBy: 'supervisor', lookedAt: iso(T0) },
      { id: 'f2', state: 'dismissed', raisedBy: 'check', lookedAt: null },
    ];
    const fires = silentFires('stuck:silent:y');
    expect(planWatch({ now: T0, state: 'watching', fires, before, after: [before[1] as OpenSignal], linked, dismissals: [] })).toEqual({ close: ['s1', 's3'], resolve: [], raise: [] });
  });
});

/** Fires of `fingerprints`, as the checks would answer them. */
function silentFires(...fingerprints: string[]): Fire[] {
  return fingerprints.map((fingerprint) => ({
    fingerprint, check: 'silent-job', kind: 'stuck', severity: 'medium', title: '', checkLine: '', figures: {}, evidence: [], evidenceKey: fingerprint,
  }));
}

describe('supervisorWatchHandler — the ledger\'s job', () => {
  const claimed = (payload: Record<string, unknown>): ClaimedJob => ({ id: 'j', kind: 'supervisor-watch', key: 'k', subject: 'supervisor-watch', payload, tries: 1, claim: 'c', claimedUntil: iso(T0) });

  it('watches the workspace of its lane, and skips a workspace with no seat', async () => {
    const db = memory(seatAt(T0 - MIN), world(() => []));
    const handler = supervisorWatchHandler({ store: db.store, notify: null, clock: () => T0, log: quiet });
    expect(await handler(claimed({ slot: iso(T0), lane: WS }))).toEqual({ outcome: 'done' });
    expect(db.missed()).toBe(0);
    const none = supervisorWatchHandler({ store: memory(null, world(() => [])).store, notify: null, clock: () => T0, log: quiet });
    expect(await none(claimed({ slot: iso(T0), lane: WS }))).toEqual({ outcome: 'skipped', reason: 'the workspace has no Supervisor seat' });
  });

  it('refuses a payload whose lane is not a workspace id, naming the field', async () => {
    const handler = supervisorWatchHandler({ store: memory(null, world(() => [])).store, notify: null, clock: () => T0, log: quiet });
    await expect(handler(claimed({ slot: iso(T0), lane: 'nope' }))).rejects.toThrow(/supervisor-watch job is malformed: lane/);
  });
});
