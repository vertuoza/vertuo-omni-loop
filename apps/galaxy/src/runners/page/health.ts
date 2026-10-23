import type { Job, Runner, RunnerSample, TokenCounts } from '../runners.contract';
import { couldTake } from './model';

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
 * whether it is past the runner's own limit, the hour's sparkline points (null: none), and its title (null: none). */
export type Gauge = { key: 'cpu' | 'memory' | 'disk' | 'tokens'; label: string; value: string; fill: number | null; over: boolean; spark: string | null; title: string | null };

/** A token figure in the page's words: whole under 1,000, `81k` under a million, then `9.1M` and `1.2B`, one decimal. */
export function tokenFigure(n: number): string {
  if (n < 1000) return String(n);
  if (Math.round(n / 1000) < 1000) return `${String(Math.round(n / 1000))}k`;
  const millions = Math.round(n / 1e5) / 10;
  return millions < 1000 ? `${millions.toFixed(1)}M` : `${(Math.round(n / 1e8) / 10).toFixed(1)}B`;
}

/** A token count's figure: the sum of its four counts, cache reads included. */
export const tokenTotal = (counts: TokenCounts): number => counts.input + counts.output + counts.cacheRead + counts.cacheWrite;

/** The four counts a figure is made of, for a title: `input 81k · output 402k · cache read 9.1M · cache write 611k`. */
export const tokenSplit = (counts: TokenCounts): string =>
  `input ${tokenFigure(counts.input)} · output ${tokenFigure(counts.output)} · cache read ${tokenFigure(counts.cacheRead)} · cache write ${tokenFigure(counts.cacheWrite)}`;

/** A job's tokens beside its status once a report carried them: `1.4M tokens`, and the split for its title; null before. */
export function jobTokensWords(job: Pick<Job, 'tokens'>): { text: string; title: string } | null {
  return job.tokens ? { text: `${tokenFigure(tokenTotal(job.tokens))} tokens`, title: tokenSplit(job.tokens) } : null;
}

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
  return [cpuGauge(h, samples), memoryGauge(h, samples), diskGauge(h, samples), tokensGauge(h, samples)];
}

const loadWords = (h: RunnerHealth): string =>
  h.load1 === null ? '' : ` · load ${String(Math.round(h.load1 * 10) / 10)}${h.cores === null ? '' : ` / ${String(h.cores)}`}`;

const overLoad = (h: RunnerHealth): boolean => !!h.limits && h.load1 !== null && h.cores !== null && h.load1 > h.limits.maxLoad * h.cores;

function cpuGauge(h: RunnerHealth, samples: readonly RunnerSample[]): Gauge {
  return {
    key: 'cpu', label: 'CPU', value: h.cpu === null ? '—' : `${String(Math.round(h.cpu))}%${loadWords(h)}`,
    fill: h.cpu === null ? null : clamp(h.cpu), over: overLoad(h), spark: sparkPoints(samples.map((s) => s.cpu), 100), title: null,
  };
}

function memoryGauge(h: RunnerHealth, samples: readonly RunnerSample[]): Gauge {
  const pct = share(h.memUsed, h.memTotal);
  const { memUsed, memTotal } = h;
  return {
    key: 'memory', label: 'Memory', value: pct === null || memUsed === null || memTotal === null ? '—' : `${gbWords(memUsed)} of ${gbWords(memTotal)} GB`,
    fill: pct === null ? null : clamp(pct), over: !!h.limits && pct !== null && pct > h.limits.maxMemory,
    spark: sparkPoints(samples.map((s) => share(s.memUsed, s.memTotal)), 100), title: null,
  };
}

function diskGauge(h: RunnerHealth, samples: readonly RunnerSample[]): Gauge {
  const free = h.diskFree;
  const used = free !== null && h.diskTotal !== null && h.diskTotal > 0 ? (1 - free / h.diskTotal) * 100 : null;
  return {
    key: 'disk', label: 'Disk', value: free === null ? '—' : `${gbWords(free)} GB free${h.diskTotal === null ? '' : ` of ${gbWords(h.diskTotal)}`}`,
    fill: used === null ? null : clamp(used), over: !!h.limits && free !== null && free < h.limits.minDiskGb * GIB,
    spark: sparkPoints(samples.map((s) => s.diskFree)), title: null,
  };
}

/** The machine's tokens: `10.2M in 5 h · 15.7M today`, each window `—` when the runner could not read it, the split of both in the title. */
function tokensGauge(h: RunnerHealth, samples: readonly RunnerSample[]): Gauge {
  const { last5h, today } = h.tokens ?? { last5h: null, today: null };
  const figure = (counts: TokenCounts | null) => (counts === null ? '—' : tokenFigure(tokenTotal(counts)));
  const split = (label: string, counts: TokenCounts | null) => (counts === null ? [] : [`${label}: ${tokenSplit(counts)}`]);
  const title = [...split('Last 5 h', last5h), ...split('Today', today)].join('\n');
  return {
    key: 'tokens', label: 'Tokens', value: last5h === null && today === null ? '—' : `${figure(last5h)} in 5 h · ${figure(today)} today`, fill: null, over: false,
    spark: sparkPoints(samples.map((s) => s.tokens5h)), title: title === '' ? null : title,
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
  job: Pick<Job, 'status' | 'toRunner' | 'toFleet' | 'repo'>,
  runners: readonly (Pick<Runner, 'id' | 'name' | 'fleet' | 'state' | 'repos'> & Paused)[],
): string | null {
  if (job.status !== 'queued') return null;
  const possible = runners.filter((r) => couldTake(job, r));
  const reasons = possible.map((r) => (r.state === 'offline' ? null : r.health?.paused ?? null));
  const first = reasons[0];
  if (!first || reasons.some((reason) => !reason)) return null;
  const only = possible.length === 1 ? possible[0] : undefined;
  return only ? `Waiting: ${only.name} paused (${first})` : `Waiting: every runner paused (${first})`;
}
