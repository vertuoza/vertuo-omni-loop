// The Supervisor end to end (PRD omni-loop-34 s9): the seat of the kit (kit/lib/runner/supervisor.ts, s4) and the App's
// watch (./watch.ts, s2) over one workspace in memory, the app between them standing in for the Supervisor's routes
// (s3) as their contract says: a finding the seat raises carries its first signal's check line, a look counts on its
// check-in, the tokens count on the seat's UTC day. The runner is the kit's own over a fake runner API, the model a stub
// that acts through the seat's API as the model would through its tools. Nothing here calls a real model, the app,
// GitHub or a database.
//
// The steps on the galaxy's side alone (an owner's press, a member's refusal, a memory clear) are `it.todo`: the import
// guard lets apps/omni-app import kit/lib and never apps/galaxy (scripts/import-guard.test.ts), so this file cannot reach
// the routes that carry them; s6's and s7's own tests and supabase/checks/supervisor.sql prove them.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunnerApi, SeatFinding, SeatNote, SupervisorApi, SupervisorSeat } from 'omni-loop/kit/lib/runner/api.ts';
import { runRunner } from 'omni-loop/kit/lib/runner/runner.ts';
import { runSeat } from 'omni-loop/kit/lib/runner/supervisor.ts';
import type { Think, ThinkInput } from 'omni-loop/kit/lib/runner/supervisor-think.ts';
import { describe, expect, it } from 'vitest';
import { baselinesOf } from './baselines.ts';
import type { CheckName, SignalKind, WatchJob, WatchSnapshot } from './checks.ts';
import { LOOK_MS, type Seat } from './seat.ts';
import { watchOnce, type Dismissal, type NewFinding, type Notify, type WatchStore } from './watch.ts';

const MIN = 60_000;
const T0 = Date.parse('2027-01-15T12:00:00.000Z');
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const WS = uuid(800);
const RUNNER = uuid(900);
const iso = (ms: number): string => new Date(ms).toISOString();
const CHECK_LINE = 'Silent job: no line for 52 min, 3× the 2.5 min usual';
const EXPLANATION = 'Its last line was a test run that usually takes 2 min.';
const quiet = (): undefined => undefined;

type Signal = { id: string; fingerprint: string; check: CheckName; kind: SignalKind; checkLine: string; evidenceKey: string; openedAt: string; findingId: string | null; closedAt: string | null };
type Finding = Omit<NewFinding, 'signalId' | 'figures' | 'evidence' | 'suggestions'> & {
  id: string; explanation: string | null; lookedAt: string | null; raisedBy: 'check' | 'supervisor';
  state: 'open' | 'acted' | 'dismissed' | 'resolved'; notifiedAt: string | null;
};
type Note = SeatNote & { cites: string[] };

/** A done `/omni:wave` job that ran `minutes`, ended `endedAgo` before T0: what the seat learns the usual step from. */
const doneWave = (n: number, minutes: number, endedAgo: number): WatchJob => ({
  id: uuid(100 + n), repo: 'acme/widgets', line: `/omni:wave ${String(n)}`, status: 'done', outcome: null, reason: null, runnerId: RUNNER,
  toRunner: null, toFleet: null, queuedAt: iso(T0 - endedAgo - minutes * MIN - MIN), runningAt: iso(T0 - endedAgo - minutes * MIN),
  endedAt: iso(T0 - endedAgo), resumeAfter: null, attempt: 1, lastLineAt: iso(T0 - endedAgo), lastLine: null, continued: false,
});

/** A running job whose last line is `silentMin` old at `now`. */
const silentJob = (n: number, now: number, silentMin = 52): WatchJob => ({
  ...doneWave(n, 0, 0), id: uuid(200 + n), line: `/omni:wave ${String(n)}`, status: 'running', queuedAt: iso(now - 90 * MIN),
  runningAt: iso(now - 80 * MIN), endedAt: null, lastLineAt: iso(now - silentMin * MIN),
});

/**
 * One workspace in memory: its seat, jobs, signals, findings, dismissals and memory notes. The watch reads it through
 * `store` as the App's job does; the seat through `api` as the Supervisor's routes answer it.
 */
function workspace({ jobs = [] as WatchJob[], dailyTokens = 5_000_000 } = {}) {
  const clock = { now: T0 };
  const seat: Seat = {
    workspace: WS, runnerId: RUNNER, runnerName: 'atlas-01', paused: false, dailyTokens, tokensDay: null, tokensUsed: 0, lastLookAt: null, placedAt: iso(T0 - MIN),
  };
  const signals: Signal[] = [];
  const findings: Finding[] = [];
  const dismissals: Dismissal[] = [];
  const notes: Note[] = [];
  let n = 0;
  const id = (): string => uuid(1000 + (n += 1));
  const open = (): Signal[] => signals.filter((s) => s.closedAt === null);
  const today = (): string => iso(clock.now).slice(0, 10);
  const pastLimit = (): boolean => seat.tokensDay === today() && seat.tokensUsed >= seat.dailyTokens;

  const seatView = (): SupervisorSeat => ({
    workspace: WS, runner: RUNNER, paused: seat.paused, thinking: !pastLimit(), dailyTokens: seat.dailyTokens,
    tokensToday: seat.tokensDay === today() ? seat.tokensUsed : 0, missedLooks: 0, lastLookAt: seat.lastLookAt,
  });
  const findingView = (f: Finding): SeatFinding => ({
    id: f.id, fingerprint: f.fingerprint, kind: f.kind, severity: f.severity, title: f.title, checkLine: f.checkLine, explanation: f.explanation,
    lookedAt: f.lookedAt, state: f.state,
  });
  const snapshot = (now: number): WatchSnapshot => ({
    now, jobs,
    runners: [{ id: RUNNER, name: 'atlas-01', fleet: null, repos: ['acme/widgets'], lastSeenAt: iso(now - 10_000), paused: null, accounts: null, disk: [] }],
    missions: [], errors: [], ledger: { late: 0, scheduledLate: 0, failing: [] },
    baselines: baselinesOf(notes.filter((note) => note.scope === 'long').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((note) => note.line)),
  });

  const store: WatchStore = {
    seat: () => Promise.resolve({ ...seat }),
    snapshot: (_, now) => Promise.resolve(snapshot(now)),
    openSignals: () => Promise.resolve(open().map((s) => ({ id: s.id, fingerprint: s.fingerprint, openedAt: s.openedAt, findingId: s.findingId }))),
    findings: (ids) => Promise.resolve(findings.filter((f) => ids.includes(f.id))),
    dismissals: (_, prints) => Promise.resolve(dismissals.filter((d) => prints.includes(d.fingerprint))),
    setMissed: () => Promise.resolve(),
    upsertSignals: (_, fires, at) => {
      for (const fire of fires) {
        const found = open().find((s) => s.fingerprint === fire.fingerprint);
        if (found) Object.assign(found, { checkLine: fire.checkLine, evidenceKey: fire.evidenceKey });
        else signals.push({ id: id(), fingerprint: fire.fingerprint, check: fire.check, kind: fire.kind, checkLine: fire.checkLine, evidenceKey: fire.evidenceKey, openedAt: at, findingId: null, closedAt: null });
      }
      return Promise.resolve(open().filter((s) => fires.some((f) => f.fingerprint === s.fingerprint)).map((s) => ({ id: s.id, fingerprint: s.fingerprint, openedAt: s.openedAt, findingId: s.findingId })));
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
      const made: Finding = {
        id: id(), workspace: WS, fingerprint: finding.fingerprint, kind: finding.kind, severity: finding.severity, title: finding.title, checkLine: finding.checkLine,
        evidenceKey: finding.evidenceKey, explanation: null, lookedAt: null, raisedBy: 'check', state: 'open', notifiedAt: null,
      };
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

  const api: SupervisorApi = {
    seat: () => Promise.resolve(seatView()),
    next: () => Promise.resolve(null),
    checkIn: (_runner, tokens) => {
      if (seat.tokensDay !== today()) {
        seat.tokensDay = today();
        seat.tokensUsed = 0;
      }
      seat.tokensUsed += tokens;
      seat.lastLookAt = iso(clock.now);
      return Promise.resolve(seatView());
    },
    snapshot: () => Promise.resolve({
      at: iso(clock.now), seat: seatView(),
      signals: open().map((s) => ({ id: s.id, fingerprint: s.fingerprint, check: s.check, kind: s.kind, checkLine: s.checkLine, finding: s.findingId })),
      findings: findings.map(findingView),
      jobs: jobs.map((job) => ({ id: job.id, line: job.line, status: job.status, runningAt: job.runningAt, endedAt: job.endedAt })),
      runners: [], missions: [],
    }),
    lines: () => Promise.resolve([]),
    findings: (_runner, onlyOpen) => Promise.resolve(findings.filter((f) => !onlyOpen || f.state === 'open').map(findingView)),
    memory: (_runner, scope) => Promise.resolve(notes.filter((note) => scope === null || note.scope === scope)),
    remember: (_runner, note) => {
      const made: Note = { id: id(), scope: note.scope, line: note.line, cites: note.cites, createdAt: iso(clock.now) };
      notes.push(made);
      return Promise.resolve(made);
    },
    // As the Supervisor's routes write it: the first signal's check line and evidence first, the seat's explanation after,
    // looked at now. The stubbed model always names the signals it raises on.
    raise: (_runner, raise) => {
      const named = new Set(raise.signals);
      const linked = signals.filter((s) => named.has(s.id));
      const [first] = linked;
      if (!first) return Promise.reject(new Error('a raise in this test names its signals'));
      const made: Finding = {
        id: id(), workspace: WS, fingerprint: first.fingerprint, kind: raise.kind, severity: raise.severity, title: raise.title, checkLine: first.checkLine,
        evidenceKey: first.evidenceKey, explanation: raise.explanation, lookedAt: iso(clock.now), raisedBy: 'supervisor', state: 'open', notifiedAt: null,
      };
      findings.push(made);
      for (const s of linked) s.findingId = made.id;
      return Promise.resolve({ finding: findingView(made), raised: true, notified: false });
    },
    messages: () => Promise.resolve([]),
    answer: (_runner, answer) => Promise.resolve({ id: id(), finding: answer.finding, kind: 'supervisor', by: null, body: answer.body, replyTo: answer.replyTo ?? null, at: iso(clock.now) }),
  };

  /** An owner's Not a problem: the finding dismissed with the evidence it carried. */
  const dismiss = (finding: Finding): void => {
    finding.state = 'dismissed';
    dismissals.push({ fingerprint: finding.fingerprint, evidenceKey: finding.evidenceKey === '' ? null : finding.evidenceKey });
  };

  /** One run of the `supervisor-watch` job at the workspace's time. */
  const watch = (notify: Notify | null = null) => watchOnce({ store, notify, workspace: WS, now: clock.now, log: quiet });

  return { clock, seat, jobs, signals, findings, notes, store, api, dismiss, watch };
}

/** A stubbed model: records each prompt, and raises a finding on every signal no finding holds, through the seat's API. */
function stubModel(api: SupervisorApi, tokens = 1200) {
  const prompts: string[] = [];
  const think: Think = async (input: ThinkInput) => {
    prompts.push(input.prompt);
    const snapshot = await api.snapshot(RUNNER);
    for (const signal of snapshot.signals.filter((s) => s.finding === null)) {
      await api.raise(RUNNER, { kind: 'stuck', severity: 'medium', title: 'A wave job has written nothing for 52 min', signals: [signal.id], explanation: EXPLANATION });
    }
    return { tokens, ok: true, line: 'thought' };
  };
  return { think, prompts };
}

/** Runs the seat until it checked in `looks` times more; a sleep never moves the workspace's clock, and waits for the stop. */
async function seatLooks(api: SupervisorApi, think: Think, looks: number) {
  const stop = new AbortController();
  const printed: string[] = [];
  const checkIns: number[] = [];
  const counted: SupervisorApi = {
    ...api,
    checkIn: async (runner, tokens) => {
      const seat = await api.checkIn(runner, tokens);
      checkIns.push(tokens);
      if (checkIns.length >= looks) stop.abort();
      return seat;
    },
  };
  await runSeat({
    api: counted, runner: RUNNER, think, halt: stop.signal, print: (line) => printed.push(line), lookEveryMs: 0,
    sleep: (_ms, signal) => new Promise((resolve) => {
      if (!signal || signal.aborted) {
        setImmediate(resolve);
        return;
      }
      signal.addEventListener('abort', () => {
        resolve();
      }, { once: true });
    }),
  });
  return { printed, checkIns };
}

/** Nine done wave jobs of 2.5 min: the step's usual time the seat learns. */
const nineWaves = (): WatchJob[] => Array.from({ length: 9 }, (_, i) => doneWave(i + 1, 2.5, (i + 2) * 10 * MIN));

/** The story up to a silent job's finding: the seat learns the usual step, the watch opens a signal, the seat raises its finding. */
async function silentStory(dailyTokens = 5_000_000, tokens = 1200) {
  const w = workspace({ jobs: nineWaves(), dailyTokens });
  const model = stubModel(w.api, tokens);
  const learnt = await seatLooks(w.api, model.think, 1);
  w.jobs.push(silentJob(1, w.clock.now));
  const first = await w.watch();
  const raised = await seatLooks(w.api, model.think, 1);
  w.clock.now += 2 * MIN;
  const second = await w.watch();
  return { w, model, learnt, first, raised, second };
}

describe('the Supervisor end to end — a seat on a runner', () => {
  it('AC-6: a seat placed on a 4-slot runner runs 3 jobs at once, and the seat keeps checking in', async () => {
    const w = workspace();
    const stop = new AbortController();
    let checkIns = 0;
    let holding = 0;
    let most = 0;
    const supervisor: SupervisorApi = {
      ...w.api,
      checkIn: async (runner, tokens) => {
        const seat = await w.api.checkIn(runner, tokens);
        if ((checkIns += 1) >= 5) stop.abort();
        return seat;
      },
    };
    const api: RunnerApi = {
      register: () => Promise.resolve({ id: RUNNER }),
      // The fake runner API: each slot that opens `next` holds a job until the runner stops.
      next: (_runner, signal) => {
        holding += 1;
        most = Math.max(most, holding);
        return new Promise((resolve) => {
          signal?.addEventListener('abort', () => {
            holding -= 1;
            resolve(null);
          }, { once: true });
        });
      },
      update: () => Promise.resolve({ cancel: false }),
      health: () => Promise.resolve(),
      githubToken: () => Promise.reject(new Error('none')),
      supervisor,
    };
    const printed: string[] = [];
    const model = stubModel(w.api);
    const code = await runRunner({
      name: 'atlas-01', slots: 4, timeoutMs: 60_000, version: '0.0.710', checkouts: new Map(), api,
      terminal: { start: () => undefined, stop: () => undefined, alive: () => false },
      exec: () => '', home: mkdtempSync(join(tmpdir(), 'omni-seat-e2e-')), wrapper: [], env: {},
      print: (line) => printed.push(line), stop: stop.signal, seatThink: model.think, seatLookMs: 0,
      sleep: (ms, signal) => new Promise((resolve) => {
        if (signal?.aborted || ms >= 15_000) {
          signal?.addEventListener('abort', () => {
            resolve();
          }, { once: true });
          if (signal?.aborted) resolve();
          return;
        }
        setImmediate(resolve);
      }),
      machine: {
        cpus: () => [{ times: { user: 1, nice: 0, sys: 0, idle: 9, irq: 0 } }], loadavg: () => [0, 0, 0], cores: () => 1,
        totalmem: () => 8e9, freemem: () => 6e9, meminfo: () => null, statfs: () => ({ bsize: 1024, blocks: 1e8, bavail: 9e7 }),
      },
    });
    expect(code).toBe(0);
    expect(most).toBe(3);
    expect(checkIns).toBeGreaterThanOrEqual(5);
    expect(w.seat.lastLookAt).toBe(iso(T0));
    expect(printed).toContain('Supervisor seat placed on this runner: one slot is kept for it');
    expect(model.prompts).toEqual([]);
  });
});

describe('the Supervisor end to end — the watch and the seat over one workspace', () => {
  it('AC-1: a silent job becomes one signal and one finding, its check line first, the usual step learnt by the seat', async () => {
    const { w, model, learnt, first, raised, second } = await silentStory();
    // The seat learnt the step's usual time from the done jobs, plain code: no model call for it.
    expect(learnt.checkIns).toEqual([0]);
    expect(w.notes.map((note) => note.line)).toEqual(['Baseline wave: 2.5 min (median of the last 9)']);
    // The watch read it back: the signal names the 2.5 min usual; a watching seat leaves the finding to the seat.
    expect(first).toMatchObject({ seat: 'watching', fires: 1, opened: 1, raised: 0 });
    expect(model.prompts).toHaveLength(1);
    expect(model.prompts[0]).toContain(`stuck:silent:${uuid(201)} — ${CHECK_LINE}`);
    expect(raised.checkIns).toEqual([1200]);
    // One signal, one finding, however often the watch runs: the seat's, the check line before its explanation.
    expect(second).toMatchObject({ seat: 'watching', fires: 1, opened: 0, raised: 0 });
    expect(w.signals).toHaveLength(1);
    expect(w.findings).toHaveLength(1);
    expect(w.findings[0]).toMatchObject({ raisedBy: 'supervisor', checkLine: CHECK_LINE, explanation: EXPLANATION, state: 'open' });
    expect(w.signals[0]?.findingId).toBe(w.findings[0]?.id);
    const line = raised.printed.find((each) => each.startsWith('Supervisor raised: ')) ?? '';
    expect(line.indexOf(CHECK_LINE)).toBeGreaterThan(0);
    expect(line.indexOf(CHECK_LINE)).toBeLessThan(line.indexOf(EXPLANATION));
  });

  it('AC-2: a finding an owner dismissed stays quiet: no new finding, no push, no think while its evidence is the same', async () => {
    const { w, model } = await silentStory();
    const [finding] = w.findings;
    if (!finding) throw new Error('no finding');
    w.dismiss(finding);
    const pushes: string[] = [];
    const notify: Notify = (raised) => {
      pushes.push(raised.title);
      return Promise.resolve(true);
    };
    for (let look = 0; look < 3; look += 1) {
      w.clock.now += 2 * MIN;
      await w.watch(notify);
      await seatLooks(w.api, model.think, 1);
    }
    // Paused, the check writes alone: still nothing for the dismissed fingerprint.
    w.seat.paused = true;
    w.clock.now += 2 * MIN;
    await w.watch(notify);
    expect(w.findings.map((f) => f.state)).toEqual(['dismissed']);
    expect(pushes).toEqual([]);
    expect(model.prompts).toHaveLength(1);
  });

  it('AC-7: past the daily token limit the seat checks in without a model call, and the next finding is the check\'s alone', async () => {
    const { w, model } = await silentStory(5_000_000, 5_000_000);
    expect(w.seat.tokensUsed).toBe(5_000_000);
    // A second job goes silent: the watch reads the seat past its limit and writes the finding itself.
    w.jobs.push(silentJob(2, w.clock.now));
    const summary = await w.watch();
    const looked = await seatLooks(w.api, model.think, 2);
    expect(summary.seat).toBe('limit');
    expect(model.prompts).toHaveLength(1);
    expect(looked.checkIns).toEqual([0, 0]);
    expect(looked.printed).toContain('Supervisor: thinking paused until midnight (UTC): 5000000 of 5000000 tokens used');
    const byCheck = w.findings.find((f) => f.fingerprint === `stuck:silent:${uuid(202)}`);
    expect(byCheck).toMatchObject({ raisedBy: 'check', lookedAt: null, explanation: null, checkLine: CHECK_LINE, severity: 'medium' });
  });

  it('AC-8: the seat silent 3 looks raises the high offline finding and one push, once', async () => {
    const w = workspace();
    await seatLooks(w.api, stubModel(w.api).think, 1);
    expect(w.seat.lastLookAt).toBe(iso(T0));
    const pushes: string[] = [];
    const notify: Notify = (raised) => {
      pushes.push(raised.title);
      return Promise.resolve(true);
    };
    w.clock.now = T0 + 2 * LOOK_MS + 5_000;
    expect((await w.watch(notify)).seat).toBe('watching');
    w.clock.now = T0 + 3 * LOOK_MS + 5_000;
    expect((await w.watch(notify)).seat).toBe('offline');
    w.clock.now += 2 * MIN;
    await w.watch(notify);
    expect(w.findings.map((f) => [f.title, f.severity, f.kind, f.raisedBy])).toEqual([['The Supervisor is offline since 2027-01-15 12:00 UTC on atlas-01', 'high', 'health', 'check']]);
    expect(pushes).toEqual(['The Supervisor is offline since 2027-01-15 12:00 UTC on atlas-01']);
  });

  // On the galaxy's side alone: apps/omni-app may not import apps/galaxy (scripts/import-guard.test.ts), so these steps
  // are proven by s7's apps/galaxy/src/supervisor/proposals/proposals.controller.test.ts, s6's memory tests and s1's
  // supabase/checks/supervisor.sql, not here.
  it.todo('AC-3: an owner presses Stop and resume and the job resumes, the result in its thread (galaxy routes: not importable from apps/omni-app)');
  it.todo('AC-3: a member\'s press is refused (galaxy routes: not importable from apps/omni-app)');
  it.todo('AC-5: memory cleared by an owner keeps findings and messages (galaxy routes and supervisor_memory_clear(): not importable from apps/omni-app)');
});
