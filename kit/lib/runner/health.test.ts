// The runner's machine sample (PRD 2102, s1): `sample()` on injected reads, never the real machine.
import { describe, expect, it } from 'vitest';
import { sample } from './health.ts';
import type { CoreTimes, MachineReads } from './health.ts';

const GB = 1024 ** 3;

/** Two cores, each with these times. */
const twoCores = (times: CoreTimes) => [{ times }, { times }];

/** A Linux machine with 8 cores, 16 GB of which 3 GB available, a 233 GB disk with 39 GB free. */
function reads(over: Partial<MachineReads> = {}): MachineReads {
  return {
    cpus: () => twoCores({ user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 }),
    loadavg: () => [7.9, 6.1, 5.0],
    cores: () => 8,
    totalmem: () => 16 * GB,
    freemem: () => 1 * GB,
    meminfo: () => 'MemTotal:       16777216 kB\nMemFree:         1048576 kB\nMemAvailable:    3145728 kB\nBuffers:          123 kB\n',
    statfs: () => ({ bsize: 4096, blocks: (233 * GB) / 4096, bavail: (39 * GB) / 4096 }),
    ...over,
  };
}

describe('sample()', () => {
  it('reads the load, the cores, the memory and the disk, and no CPU on the first sample', () => {
    const { sample: first, times } = sample(reads(), null);
    expect(first).toEqual({ cpu: null, load1: 7.9, cores: 8, memUsed: 13 * GB, memTotal: 16 * GB, diskFree: 39 * GB, diskTotal: 233 * GB });
    expect(times).toEqual({ idle: 17_000, total: 20_000 });
  });

  it('computes the CPU from the delta with the previous sample', () => {
    const before = sample(reads(), null).times;
    // Each core: 600 ms busy and 400 ms idle since: 60 % busy.
    const after = reads({ cpus: () => twoCores({ user: 1400, nice: 0, sys: 700, idle: 8900, irq: 0 }) });
    expect(sample(after, before).sample.cpu).toBe(60);
    // A third of a percent rounds to one decimal.
    const third = reads({ cpus: () => twoCores({ user: 1001, nice: 0, sys: 500, idle: 8799, irq: 0 }) });
    expect(sample(third, before).sample.cpu).toBe(0.3);
  });

  it('gives no CPU when no time passed, or the times went back', () => {
    const before = sample(reads(), null).times;
    expect(sample(reads(), before).sample.cpu).toBeNull();
    expect(sample(reads({ cpus: () => twoCores({ user: 10, nice: 0, sys: 5, idle: 85, irq: 0 }) }), before).sample.cpu).toBeNull();
  });

  it('counts memory used as total − MemAvailable on Linux, so the page cache is not used', () => {
    expect(sample(reads(), null).sample.memUsed).toBe(13 * GB);
  });

  it('counts memory used as total − free where there is no /proc/meminfo to read', () => {
    expect(sample(reads({ meminfo: () => null }), null).sample.memUsed).toBe(15 * GB);
  });

  it('gives each figure it cannot read as null', () => {
    const fails = (): never => {
      throw new Error('EACCES');
    };
    const { sample: blind, times } = sample(reads({ cpus: fails, loadavg: fails, cores: fails, totalmem: fails, meminfo: fails, statfs: fails }), { idle: 1, total: 2 });
    expect(blind).toEqual({ cpu: null, load1: null, cores: null, memUsed: null, memTotal: null, diskFree: null, diskTotal: null });
    expect(times).toBeNull();
  });

  it('gives no memory used on Linux when /proc/meminfo has no MemAvailable, nor when it cannot be read', () => {
    expect(sample(reads({ meminfo: () => 'MemTotal: 16777216 kB\n' }), null).sample).toMatchObject({ memUsed: null, memTotal: 16 * GB });
    expect(sample(reads({ meminfo: () => { throw new Error('ENOENT'); } }), null).sample).toMatchObject({ memUsed: null, memTotal: 16 * GB });
  });

  it('gives a figure that is no finite non-negative number, or no cores at all, as null', () => {
    const odd = sample(reads({ loadavg: () => [], cores: () => Number.NaN, totalmem: () => -1, cpus: () => [] }), null);
    expect(odd.sample).toMatchObject({ load1: null, cores: null, memTotal: null, memUsed: null });
    expect(odd.times).toBeNull();
  });
});
