import type { Job, Runner, RunnerSample } from '../runners.contract';

// The health line of the Runners page (PRD 2102 s3), as words and numbers: pure, so each gauge, each state of the line and
// each queued reason is tested without a page. The figures are the runner's last report and its hour of samples; a figure
// it could not read is `—` with no bar, and a gauge past the runner's own limit is `over`.

type RunnerHealth = NonNullable<Runner['health']>;
type Paused = { health?: Pick<RunnerHealth, 'paused'> | null | undefined };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const GIB = 1024 ** 3;

/** The class a runner's state is drawn with: its state, or `paused` while an online or busy runner's last report names a pressure. */
export const stateTone = (runner: Pick<Runner, 'state'> & Paused): string =>
  runner.state !== 'offline' && runner.health?.paused ? 'paused' : runner.state;

/** Gigabytes in the page's words: bytes divided by 1024³, one decimal under 100 GB, whole above. */
export const gbWords = (bytes: number): string => {
  const gb = bytes / GIB;
  return gb < 100 ? gb.toFixed(1) : String(Math.round(gb));
};

/** One gauge of a runner's health line: its label, its value (`—` when unread), how far its bar fills (null: no bar),
 * whether it is past the runner's own limit, and the hour's sparkline points (null: none). */
export type Gauge = { key: 'cpu' | 'memory' | 'disk' | 'tokens'; label: string; value: string; fill: number | null; over: boolean; spark: string | null };

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** The `points` of a sparkline in a 100 × 18 box from at least two readings, oldest first; null with fewer. With `max` the
 * scale runs from 0 to it, else from the least reading to the greatest. */
export function sparkPoints(values: readonly (number | null)[], max?: number): string | null {
  const read = values.filter((v): v is number => v !== null);
  if (read.length < 2) return null;
  const lo = max === undefined ? Math.min(...read) : 0;
  const span = (max ?? Math.max(...read)) - lo || 1;
  return read.map((v, i) => `${(i * 100 / (read.length - 1)).toFixed(1)},${(16 - clamp((v - lo) / span * 100) * 0.14).toFixed(1)}`).join(' ');
}

const share = (used: number | null, total: number | null): number | null => (used === null || total === null || total === 0 ? null : used / total * 100);

/** The four gauges of a runner's health line, from its last report and its hour of samples; null for a runner that never reported. */
export function gaugesOf(runner: Pick<Runner, 'health' | 'samples'>): Gauge[] | null {
  const h = runner.health;
  if (!h) return null;
  const samples = runner.samples ?? [];
  return [cpuGauge(h, samples), memoryGauge(h, samples), diskGauge(h, samples), { key: 'tokens', label: 'Tokens', value: '—', fill: null, over: false, spark: sparkPoints(samples.map((s) => s.tokens5h)) }];
}

const loadWords = (h: RunnerHealth): string =>
  h.load1 === null ? '' : ` · load ${String(Math.round(h.load1 * 10) / 10)}${h.cores === null ? '' : ` / ${String(h.cores)}`}`;

const overLoad = (h: RunnerHealth): boolean => !!h.limits && h.load1 !== null && h.cores !== null && h.load1 > h.limits.maxLoad * h.cores;

function cpuGauge(h: RunnerHealth, samples: readonly RunnerSample[]): Gauge {
  return {
    key: 'cpu', label: 'CPU', value: h.cpu === null ? '—' : `${String(Math.round(h.cpu))}%${loadWords(h)}`,
    fill: h.cpu === null ? null : clamp(h.cpu), over: overLoad(h), spark: sparkPoints(samples.map((s) => s.cpu), 100),
  };
}

function memoryGauge(h: RunnerHealth, samples: readonly RunnerSample[]): Gauge {
  const pct = share(h.memUsed, h.memTotal);
  const { memUsed, memTotal } = h;
  return {
    key: 'memory', label: 'Memory', value: pct === null || memUsed === null || memTotal === null ? '—' : `${gbWords(memUsed)} of ${gbWords(memTotal)} GB`,
    fill: pct === null ? null : clamp(pct), over: !!h.limits && pct !== null && pct > h.limits.maxMemory,
    spark: sparkPoints(samples.map((s) => share(s.memUsed, s.memTotal)), 100),
  };
}

function diskGauge(h: RunnerHealth, samples: readonly RunnerSample[]): Gauge {
  const free = h.diskFree;
  const used = free !== null && h.diskTotal !== null && h.diskTotal > 0 ? (1 - free / h.diskTotal) * 100 : null;
  return {
    key: 'disk', label: 'Disk', value: free === null ? '—' : `${gbWords(free)} GB free${h.diskTotal === null ? '' : ` of ${gbWords(h.diskTotal)}`}`,
    fill: used === null ? null : clamp(used), over: !!h.limits && free !== null && free < h.limits.minDiskGb * GIB,
    spark: sparkPoints(samples.map((s) => s.diskFree)),
  };
}

/** Under an offline runner's greyed figures, when they were taken: `as of 12 min ago`. */
export function asOfWords(runner: Pick<Runner, 'state' | 'health'>, now: Date): string | null {
  if (runner.state !== 'offline' || !runner.health) return null;
  const ms = Math.max(0, now.getTime() - Date.parse(runner.health.at));
  if (ms < MIN) return 'as of now';
  if (ms < HOUR) return `as of ${String(Math.floor(ms / MIN))} min ago`;
  if (ms < DAY) return `as of ${String(Math.floor(ms / HOUR))} h ago`;
  return `as of ${String(Math.floor(ms / DAY))} d ago`;
}

/** The line of a runner from before PRD 2102, which never reported, and the command that updates it, to copy. */
export const OLD_RUNNER_WORDS = 'Update this runner to see its health.';
export const UPDATE_COMMAND = 'omni update';

/** Why a queued job waits: every runner it could go to (any, its fleet's, or its one runner) is online and paused. Null when
 * some other runner could take it, or when none could. */
export function waitingWords(
  job: Pick<Job, 'status' | 'toRunner' | 'toFleet'>,
  runners: readonly (Pick<Runner, 'id' | 'name' | 'fleet' | 'state'> & Paused)[],
): string | null {
  if (job.status !== 'queued') return null;
  const possible = runners.filter((r) => (job.toRunner !== null ? r.id === job.toRunner : job.toFleet !== null ? r.fleet === job.toFleet : true));
  const reasons = possible.map((r) => (r.state === 'offline' ? null : r.health?.paused ?? null));
  const first = reasons[0];
  if (!first || reasons.some((reason) => !reason)) return null;
  const only = possible.length === 1 ? possible[0] : undefined;
  return only ? `Waiting: ${only.name} paused (${first})` : `Waiting: every runner paused (${first})`;
}
