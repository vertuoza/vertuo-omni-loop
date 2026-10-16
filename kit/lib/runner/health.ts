// A runner's machine, sampled every 15 s while it runs (PRD 2102, "The runner samples its machine"):
// the busy share of its cores since the last sample, its 1-minute load and core count, its memory and
// the disk that holds the jobs' worktrees. `sample()` is a pure function of the reads it is handed and of
// the previous sample's CPU times, so a test hands it fixed reads; `machineReads()` are the real ones.
//
// A figure that cannot be read is `null`, never a guess: the first sample has no previous CPU times, a
// Linux machine whose `/proc/meminfo` cannot be read has no memory used, a `statfs` that fails has no disk.
// Only numbers come out of here: no path, no name.
import { availableParallelism, cpus, freemem, loadavg, platform, totalmem } from 'node:os';
import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { join } from 'node:path';

/** One core's times, as `os.cpus()` gives them, in milliseconds. */
export type CoreTimes = { user: number; nice: number; sys: number; idle: number; irq: number };

/** The machine's reads. Each may throw: the figure it feeds is then `null`. */
export type MachineReads = {
  /** Each core's times since boot. */
  cpus(): readonly { times: CoreTimes }[];
  /** The 1-, 5- and 15-minute loads. */
  loadavg(): readonly number[];
  /** The cores the runner may use. */
  cores(): number;
  totalmem(): number;
  freemem(): number;
  /** `/proc/meminfo`'s text on Linux; `null` elsewhere, where `freemem()` gives the memory left. */
  meminfo(): string | null;
  /** The disk that holds the jobs' worktrees, in blocks of `bsize` bytes. */
  statfs(): { bsize: number; blocks: number; bavail: number };
};

/** All cores' times added up: the busy and the idle share since boot. */
export type CpuTimes = { idle: number; total: number };

/** One sample of the machine: CPU percent, load, cores, and memory and disk in bytes. */
export type Sample = {
  cpu: number | null;
  load1: number | null;
  cores: number | null;
  memUsed: number | null;
  memTotal: number | null;
  diskFree: number | null;
  diskTotal: number | null;
};

/** `read()`'s value, or `null` when it throws or answers no finite non-negative number. */
function figure(read: () => number): number | null {
  try {
    const value = read();
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

/** The cores' times added up, or `null` when they cannot be read. */
function cpuTimes(reads: MachineReads): CpuTimes | null {
  try {
    const cores = reads.cpus();
    if (cores.length === 0) return null;
    let idle = 0;
    let total = 0;
    for (const { times } of cores) {
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
    }
    return Number.isFinite(total) ? { idle, total } : null;
  } catch {
    return null;
  }
}

/** The busy share of all cores between two readings, one decimal, or `null` without both or a tick between. */
function busyShare(previous: CpuTimes | null, now: CpuTimes | null): number | null {
  if (previous === null || now === null) return null;
  const total = now.total - previous.total;
  const idle = now.idle - previous.idle;
  if (total <= 0 || idle < 0 || idle > total) return null;
  return Math.round((1 - idle / total) * 1000) / 10;
}

/** `MemAvailable` in bytes from `/proc/meminfo`'s text, or `null` when it is not there. */
function memAvailable(meminfo: string): number | null {
  const kb = /^MemAvailable:\s+(\d+)\s*kB$/m.exec(meminfo)?.[1];
  return kb === undefined ? null : Number(kb) * 1024;
}

/** Memory used: total − `MemAvailable` on Linux, so the page cache is not counted; total − free elsewhere. */
function memoryUsed(reads: MachineReads, memTotal: number | null): number | null {
  if (memTotal === null) return null;
  let available: number | null;
  try {
    const meminfo = reads.meminfo();
    available = meminfo === null ? figure(() => reads.freemem()) : memAvailable(meminfo);
  } catch {
    available = null;
  }
  return available === null ? null : Math.max(0, memTotal - available);
}

/** The disk's free and total bytes, or `null`s when `statfs` fails. */
function disk(reads: MachineReads): { diskFree: number | null; diskTotal: number | null } {
  try {
    const { bsize, blocks, bavail } = reads.statfs();
    return { diskFree: figure(() => bavail * bsize), diskTotal: figure(() => blocks * bsize) };
  } catch {
    return { diskFree: null, diskTotal: null };
  }
}

/**
 * One sample of the machine from `reads`, and the CPU times the next sample measures from. The CPU
 * percent is the busy share since `previous`: `null` on the first sample.
 */
export function sample(reads: MachineReads, previous: CpuTimes | null): { sample: Sample; times: CpuTimes | null } {
  const times = cpuTimes(reads);
  const memTotal = figure(() => reads.totalmem());
  return {
    sample: {
      cpu: busyShare(previous, times),
      load1: figure(() => reads.loadavg()[0] ?? Number.NaN),
      cores: figure(() => reads.cores()),
      memUsed: memoryUsed(reads, memTotal),
      memTotal,
      ...disk(reads),
    },
    times,
  };
}

/** The real machine: the disk read is the one that holds `~/wt`, or the home itself before the first job made it. */
export function machineReads(home: string): MachineReads {
  const linux = platform() === 'linux';
  return {
    cpus,
    loadavg,
    cores: availableParallelism,
    totalmem,
    freemem,
    meminfo: () => (linux ? readFileSync('/proc/meminfo', 'utf8') : null),
    statfs: () => {
      const worktrees = join(home, 'wt');
      return statfsSync(existsSync(worktrees) ? worktrees : home);
    },
  };
}
