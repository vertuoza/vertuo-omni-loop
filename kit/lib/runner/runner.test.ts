// The runner's health reports (PRD 2102, s1): `runRunner()` on a fake app, a fake clock and a fixed
// machine. A report goes right after registering, then every 15 s, and one the app refuses or never
// answers prints one line while the runner keeps polling for jobs. Nothing here reads the real machine.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RunnerRefused, RunnerUnreachable } from './api.ts';
import type { HealthReport, RunnerApi } from './api.ts';
import type { MachineReads } from './health.ts';
import { runRunner } from './runner.ts';

const GB = 1024 ** 3;
const T0 = Date.parse('2026-10-16T12:00:00.000Z');

/** A machine whose cores each spend 300 ms busy and 700 ms idle between two samples. */
function machine(): MachineReads {
  let samples = 0;
  return {
    cpus: () => {
      samples += 1;
      const times = { user: 300 * samples, nice: 0, sys: 0, idle: 700 * samples, irq: 0 };
      return [{ times }, { times }];
    },
    loadavg: () => [1.5, 1, 1],
    cores: () => 2,
    totalmem: () => 8 * GB,
    freemem: () => 2 * GB,
    meminfo: () => null,
    statfs: () => ({ bsize: 1024, blocks: (100 * GB) / 1024, bavail: (40 * GB) / 1024 }),
  };
}

/**
 * A fake app: registers `r1`, holds every `next` until the runner stops, and answers health reports
 * with `answers` in turn (`ok`, or the error it throws), each taking `reportMs` of the fake clock.
 */
function fakeApp(answers: ('ok' | Error)[], { reportMs = 0 } = {}) {
  const reports: HealthReport[] = [];
  const nexts: number[] = [];
  const clock = { now: T0 };
  const stop = new AbortController();
  const api: RunnerApi = {
    register: () => Promise.resolve({ id: 'r1' }),
    next: (_runner, signal) => {
      nexts.push(clock.now);
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve(null);
        }, { once: true });
      });
    },
    update: () => Promise.resolve({ cancel: false }),
    health: (runner, report) => {
      expect(runner).toBe('r1');
      reports.push(report);
      clock.now += reportMs;
      const answer = answers[reports.length - 1] ?? 'ok';
      if (reports.length >= answers.length) stop.abort();
      return answer === 'ok' ? Promise.resolve() : Promise.reject(answer);
    },
  };
  return { api, reports, nexts, clock, stop };
}

/** Runs the runner on `app` until it stops itself: its exit code, what it printed, and every wait the health loop took. */
async function run(app: ReturnType<typeof fakeApp>) {
  const printed: string[] = [];
  const waits: number[] = [];
  const code = await runRunner({
    name: 'box-1', slots: 2, timeoutMs: 60_000, version: '0.0.442', checkouts: new Map(), api: app.api,
    terminal: { start: () => undefined, stop: () => undefined, alive: () => false },
    exec: () => '', home: mkdtempSync(join(tmpdir(), 'omni-runner-health-')), wrapper: [], env: {},
    print: (line) => printed.push(line), stop: app.stop.signal, now: () => app.clock.now,
    // Once stopped, no wait; the hour between sweeps waits for the stop; every other wait passes at once,
    // on the fake clock.
    sleep: (ms, signal) => new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      if (ms === 60 * 60 * 1000) {
        signal?.addEventListener('abort', () => {
          resolve();
        }, { once: true });
        return;
      }
      waits.push(ms);
      app.clock.now += ms;
      setImmediate(resolve);
    }),
    machine: machine(),
  });
  return { code, printed, waits };
}

describe('the runner\'s health reports', () => {
  it('sends the machine\'s sample right after registering, then every 15 s, the CPU from the second on', async () => {
    const app = fakeApp(['ok', 'ok', 'ok']);
    const { code, printed, waits } = await run(app);
    expect(code).toBe(0);
    expect(app.reports).toEqual([
      { cpu: null, load1: 1.5, cores: 2, memUsed: 6 * GB, memTotal: 8 * GB, diskFree: 40 * GB, diskTotal: 100 * GB },
      { cpu: 30, load1: 1.5, cores: 2, memUsed: 6 * GB, memTotal: 8 * GB, diskFree: 40 * GB, diskTotal: 100 * GB },
      { cpu: 30, load1: 1.5, cores: 2, memUsed: 6 * GB, memTotal: 8 * GB, diskFree: 40 * GB, diskTotal: 100 * GB },
    ]);
    expect(waits).toEqual([15_000, 15_000]);
    expect(printed.filter((line) => line.startsWith('health'))).toEqual([]);
  });

  it('keeps 15 s between two samples when a report is slow', async () => {
    const app = fakeApp(['ok', 'ok', 'ok'], { reportMs: 4000 });
    const { waits } = await run(app);
    expect(waits).toEqual([11_000, 11_000]);
  });

  it('prints one line for a refused report and one for a report that timed out, and runs on', async () => {
    const app = fakeApp([new RunnerRefused('refused (404)'), new RunnerUnreachable('POST /api/runners/r1/health: timed out'), 'ok', 'ok']);
    const { code, printed } = await run(app);
    expect(code).toBe(0);
    expect(app.reports).toHaveLength(4);
    expect(printed.filter((line) => line.startsWith('health'))).toEqual([
      'health not sent: refused (404)',
      'health not sent: POST /api/runners/r1/health: timed out',
    ]);
    // Neither stopped the slots: both kept their `next` open, and the runner ended only when stopped.
    expect(app.nexts).toHaveLength(2);
    expect(printed.at(-1)).toBe('runner box-1 stopped');
  });

  it('carries on after a report fails in a way it did not expect', async () => {
    const app = fakeApp([new TypeError('fetch failed'), 'ok']);
    const { code, printed } = await run(app);
    expect(code).toBe(0);
    expect(printed).toContain('health not sent: fetch failed');
    expect(app.reports).toHaveLength(2);
  });
});
