// The Supervisor's seat (PRD omni-loop-34 s4): `omni supervisor`'s loop against a stubbed API and a stubbed model, and the
// runner that keeps a slot for it. Nothing here calls a real model, the app or GitHub.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RunnerApi, SeatFinding, SeatMessage, SeatNote, SeatRaise, SeatSignal, SeatSnapshot, SupervisorApi, SupervisorSeat } from './api.ts';
import { runRunner } from './runner.ts';
import { keepSeat, runSeat } from './supervisor.ts';
import type { SeatOptions } from './supervisor.ts';
import type { Think, ThinkInput } from './supervisor-think.ts';

const T0 = Date.parse('2026-11-25T08:00:00.000Z');
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const RUNNER = uuid(900);
const JOB = uuid(1);
const SIGNAL = uuid(2);
const CHECK_LINE = 'Silent job: no line for 52 min, 3× the 2.5 min usual';

const SEAT: SupervisorSeat = { workspace: uuid(800), runner: RUNNER, paused: false, dailyTokens: 5_000_000, tokensToday: 0, thinking: true, lastLookAt: null, missedLooks: 0 };

const silentSignal: SeatSignal = { id: SIGNAL, fingerprint: `stuck:silent:${JOB}`, check: 'silent-job', kind: 'stuck', checkLine: CHECK_LINE, finding: null };

/** A stubbed Supervisor API: a fake app that writes findings as s3's service does (the first signal's check line first). */
function fakeApi(over: { seat?: SupervisorSeat; signals?: SeatSignal[]; messages?: SeatMessage[]; notes?: SeatNote[]; nexts?: ('moved' | null)[] } = {}) {
  const calls = { checkIns: [] as number[], raises: [] as SeatRaise[], remembered: [] as string[], nexts: 0, snapshots: 0 };
  const seat = over.seat ?? SEAT;
  const signals = over.signals ?? [];
  const findings: SeatFinding[] = [];
  const nexts = [...(over.nexts ?? [])];
  const api: SupervisorApi = {
    seat: () => Promise.resolve(seat),
    next: () => {
      calls.nexts += 1;
      const answer = nexts.shift();
      return Promise.resolve(answer === undefined ? null : answer);
    },
    checkIn: (_runner, tokens) => {
      calls.checkIns.push(tokens);
      return Promise.resolve(seat);
    },
    snapshot: (): Promise<SeatSnapshot> => {
      calls.snapshots += 1;
      return Promise.resolve({ at: new Date(T0).toISOString(), seat, signals, findings, jobs: [], runners: [], missions: [] });
    },
    lines: () => Promise.resolve([]),
    findings: () => Promise.resolve(findings),
    memory: () => Promise.resolve(over.notes ?? []),
    remember: (_runner, note) => {
      calls.remembered.push(note.line);
      return Promise.resolve({ id: uuid(700), scope: note.scope, line: note.line, createdAt: new Date(T0).toISOString() });
    },
    raise: (_runner, raise) => {
      calls.raises.push(raise);
      const first = signals.find((signal) => raise.signals?.includes(signal.id) === true);
      const finding: SeatFinding = {
        id: uuid(500 + findings.length), fingerprint: first?.fingerprint ?? raise.fingerprint ?? null, kind: raise.kind, severity: raise.severity,
        title: raise.title, checkLine: first?.checkLine ?? null, explanation: raise.explanation, lookedAt: new Date(T0).toISOString(), state: 'open',
      };
      findings.push(finding);
      if (first) first.finding = finding.id;
      return Promise.resolve({ finding, raised: true, notified: false });
    },
    messages: (_runner, finding) => Promise.resolve((over.messages ?? []).filter((message) => message.finding === finding)),
    answer: (_runner, answer) => Promise.resolve({ id: uuid(600), finding: answer.finding, kind: 'supervisor', by: null, body: answer.body, replyTo: answer.replyTo ?? null, at: new Date(T0).toISOString() }),
  };
  return { api, calls, findings };
}

/** A stubbed model: records each prompt, and acts through `act` as the model would through its tools. */
function stubModel(act: (input: ThinkInput) => Promise<void> = () => Promise.resolve(), tokens = 1200) {
  const prompts: string[] = [];
  const think: Think = async (input) => {
    prompts.push(input.prompt);
    await act(input);
    return { tokens, ok: true, line: 'thought' };
  };
  return { think, prompts };
}

/** Runs the seat until it has checked in `looks` times. */
async function runLooks(api: SupervisorApi, calls: { checkIns: number[] }, think: Think | string, looks: number, over: Partial<SeatOptions> = {}) {
  const stop = new AbortController();
  const printed: string[] = [];
  const clock = { now: T0 };
  const counted: SupervisorApi = {
    ...api,
    checkIn: async (runner, tokens) => {
      const seat = await api.checkIn(runner, tokens);
      if (calls.checkIns.length >= looks) stop.abort();
      return seat;
    },
  };
  const ended = await runSeat({
    api: counted, runner: RUNNER, think, halt: stop.signal, print: (line) => printed.push(line), now: () => clock.now,
    sleep: (ms) => {
      clock.now += ms;
      return new Promise((resolve) => setImmediate(resolve));
    },
    lookEveryMs: 0, ...over,
  });
  return { ended, printed };
}

describe('the seat\'s loop', () => {
  it('AC-1: the finding the seat raises carries "Silent job: no line for 52 min, 3× the 2.5 min usual" before its explanation', async () => {
    const { api, calls, findings } = fakeApi({ signals: [{ ...silentSignal }] });
    const model = stubModel(async () => {
      await api.raise(RUNNER, { kind: 'stuck', severity: 'medium', title: 'A wave job has written nothing for 52 min', signals: [SIGNAL], explanation: 'Its last line was a test run that usually takes 2 min.' });
    });
    const { printed } = await runLooks(api, calls, model.think, 1);
    expect(model.prompts[0]).toContain(`${SIGNAL} · stuck · stuck:silent:${JOB} — ${CHECK_LINE}`);
    expect(calls.raises[0]?.signals).toEqual([SIGNAL]);
    expect(findings).toHaveLength(1);
    const raised = printed.find((line) => line.startsWith('Supervisor raised: ')) ?? '';
    expect(raised).toContain(CHECK_LINE);
    expect(raised.indexOf(CHECK_LINE)).toBeLessThan(raised.indexOf('Its last line'));
    expect(calls.checkIns).toEqual([1200]);
  });

  it('AC-7: past 5,000,000 tokens the seat checks in without a model call, and raises nothing: the next finding is the check\'s alone', async () => {
    const spent = { ...SEAT, tokensToday: 5_000_000, thinking: false };
    const { api, calls } = fakeApi({ seat: spent, signals: [{ ...silentSignal }] });
    const model = stubModel();
    const { printed } = await runLooks(api, calls, model.think, 3);
    expect(model.prompts).toEqual([]);
    expect(calls.raises).toEqual([]);
    expect(calls.checkIns).toEqual([0, 0, 0]);
    expect(printed).toEqual(['Supervisor: thinking paused until midnight (UTC): 5000000 of 5000000 tokens used']);
  });

  it('thinks nothing while an owner paused it, and nothing when the look found nothing to judge', async () => {
    const paused = fakeApi({ seat: { ...SEAT, paused: true }, signals: [{ ...silentSignal }] });
    const quiet = fakeApi();
    const model = stubModel();
    await runLooks(paused.api, paused.calls, model.think, 1);
    await runLooks(quiet.api, quiet.calls, model.think, 2);
    expect(model.prompts).toEqual([]);
    expect(paused.calls.checkIns).toEqual([0]);
  });

  it('answers an owner\'s message waiting in a thread, and gives it to the model twice at most', async () => {
    const asked: SeatMessage = { id: uuid(300), finding: null, kind: 'owner', by: 'ada', body: 'Why is atlas-01 slow?', replyTo: null, at: new Date(T0).toISOString() };
    const { api, calls } = fakeApi({ messages: [asked] });
    const model = stubModel();
    await runLooks(api, calls, model.think, 4);
    expect(model.prompts).toHaveLength(2);
    expect(model.prompts[0]).toContain(`${asked.id} · thread general · ada: Why is atlas-01 slow?`);
  });

  it('says why it cannot think here, and still checks in', async () => {
    const { api, calls } = fakeApi({ signals: [{ ...silentSignal }] });
    const { printed } = await runLooks(api, calls, 'the runner has no Claude account', 2);
    expect(calls.checkIns).toEqual([0, 0]);
    expect(printed).toEqual(['Supervisor: cannot think here: the runner has no Claude account']);
  });

  it('ends `moved` once the app says the seat left this runner, and looks only on a wake or every 2 min', async () => {
    const { api, calls } = fakeApi({ nexts: [null, null, 'moved'] });
    const { ended } = await runLooks(api, calls, stubModel().think, 99, { lookEveryMs: 120_000 });
    expect(ended).toBe('moved');
    expect(calls.nexts).toBe(3);
    expect(calls.snapshots).toBe(1);
  });
});

describe('the seat on a runner', () => {
  it('AC-6: holding the seat, a 4-slot runner runs at most 3 jobs and the seat keeps checking in', async () => {
    const stop = new AbortController();
    const { api: seatApi, calls } = fakeApi();
    let holding = 0;
    let most = 0;
    const supervisor: SupervisorApi = {
      ...seatApi,
      checkIn: async (runner, tokens) => {
        const seat = await seatApi.checkIn(runner, tokens);
        if (calls.checkIns.length >= 5) stop.abort();
        return seat;
      },
    };
    const api: RunnerApi = {
      register: () => Promise.resolve({ id: RUNNER }),
      // Each slot that opens `next` gets a job it holds until the runner stops: the count is the jobs running at once.
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
    const code = await runRunner({
      name: 'atlas-01', slots: 4, timeoutMs: 60_000, version: '0.0.710', checkouts: new Map(), api,
      terminal: { start: () => undefined, stop: () => undefined, alive: () => false },
      exec: () => '', home: mkdtempSync(join(tmpdir(), 'omni-seat-')), wrapper: [], env: {},
      print: (line) => printed.push(line), stop: stop.signal, seatThink: stubModel().think, seatLookMs: 0,
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
    expect(calls.checkIns.length).toBeGreaterThanOrEqual(5);
    expect(printed).toContain('Supervisor seat placed on this runner: one slot is kept for it');
  });

  it('opens the seat\'s slot again once the seat moved off the runner', async () => {
    const stop = new AbortController();
    const here: boolean[] = [];
    const { api } = fakeApi({ nexts: ['moved'] });
    const seat = { ...api, seat: () => Promise.resolve(null) };
    await keepSeat({
      api: seat, runner: RUNNER, think: stubModel().think, first: SEAT, halt: stop.signal, print: () => undefined,
      onSeat: (value) => {
        here.push(value);
        if (!value) stop.abort();
      },
      sleep: () => new Promise((resolve) => setImmediate(resolve)),
    });
    expect(here).toEqual([true, false]);
  });
});
