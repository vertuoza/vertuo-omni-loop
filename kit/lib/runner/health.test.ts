// The runner's machine sample (PRD 2102, s1): `sample()` on injected reads, never the real machine. And
// the pause (s2): `pressure()` on a sample and the runner's limits, and `nextPause()`, which pauses on one
// sample under pressure and resumes on two quiet ones in a row.
import { describe, expect, it } from 'vitest';
import { accountsReport, DEFAULT_LIMITS, nextPause, noTokensReason, pressure, sample } from './health.ts';
import { accountBook } from './accounts.ts';
import type { Account } from './accounts.ts';
import type { AccountReport } from './api.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CoreTimes, MachineReads, PauseState, Sample } from './health.ts';

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

/** A quiet machine: 8 cores at load 4, 8 of 16 GB used, 39 GB free. */
const quiet: Sample = { cpu: 50, load1: 4, cores: 8, memUsed: 8 * GB, memTotal: 16 * GB, diskFree: 39 * GB, diskTotal: 233 * GB };

describe('pressure()', () => {
  it('pauses at 85 % of memory, 10 GB of disk and 1.5 × the cores unless told otherwise', () => {
    expect(DEFAULT_LIMITS).toEqual({ maxMemory: 85, minDiskGb: 10, maxLoad: 1.5 });
    expect(pressure(quiet, DEFAULT_LIMITS)).toBeNull();
  });

  it('names memory used above its limit, 85 % not pausing and 85.1 % pausing', () => {
    expect(pressure({ ...quiet, memUsed: 0.91 * 16 * GB }, DEFAULT_LIMITS)).toBe('memory 91%');
    expect(pressure({ ...quiet, memUsed: 0.85 * 16 * GB }, DEFAULT_LIMITS)).toBeNull();
    expect(pressure({ ...quiet, memUsed: 0.851 * 16 * GB }, DEFAULT_LIMITS)).toBe('memory 85.1%');
    expect(pressure({ ...quiet, memUsed: 16 * GB }, DEFAULT_LIMITS)).toBe('memory 100%');
  });

  it('names disk free below its limit, 10 GB not pausing', () => {
    expect(pressure({ ...quiet, diskFree: 6 * GB }, DEFAULT_LIMITS)).toBe('disk 6 GB free');
    expect(pressure({ ...quiet, diskFree: 10 * GB }, DEFAULT_LIMITS)).toBeNull();
    expect(pressure({ ...quiet, diskFree: 9.96 * GB }, DEFAULT_LIMITS)).toBe('disk 9.96 GB free');
    expect(pressure({ ...quiet, diskFree: 0 }, DEFAULT_LIMITS)).toBe('disk 0 GB free');
  });

  it('names a 1-minute load above its limit times the cores, 12 on 8 cores not pausing', () => {
    expect(pressure({ ...quiet, load1: 14.23 }, DEFAULT_LIMITS)).toBe('load 14.2 on 8 cores');
    expect(pressure({ ...quiet, load1: 12 }, DEFAULT_LIMITS)).toBeNull();
    expect(pressure({ ...quiet, load1: 12.04 }, DEFAULT_LIMITS)).toBe('load 12.04 on 8 cores');
    expect(pressure({ ...quiet, load1: 2.5, cores: 1 }, DEFAULT_LIMITS)).toBe('load 2.5 on 1 core');
  });

  it('answers the first reason that holds, in the order memory, disk, load', () => {
    const all: Sample = { ...quiet, memUsed: 15 * GB, diskFree: 1 * GB, load1: 30 };
    expect(pressure(all, DEFAULT_LIMITS)).toBe('memory 94%');
    expect(pressure({ ...all, memUsed: 1 * GB }, DEFAULT_LIMITS)).toBe('disk 1 GB free');
    expect(pressure({ ...all, memUsed: 1 * GB, diskFree: 50 * GB }, DEFAULT_LIMITS)).toBe('load 30 on 8 cores');
  });

  it('pauses at the limits it is given', () => {
    const limits = { maxMemory: 70, minDiskGb: 20, maxLoad: 1 };
    expect(pressure({ ...quiet, memUsed: 0.75 * 16 * GB }, limits)).toBe('memory 75%');
    expect(pressure({ ...quiet, diskFree: 15 * GB }, limits)).toBe('disk 15 GB free');
    expect(pressure({ ...quiet, load1: 9 }, limits)).toBe('load 9 on 8 cores');
    expect(pressure({ ...quiet, memUsed: 16 * GB }, { ...limits, maxMemory: 100 })).toBeNull();
    expect(pressure({ ...quiet, diskFree: 0 }, { ...limits, minDiskGb: 0 })).toBeNull();
  });

  it('never pauses on a figure it could not read', () => {
    const blind: Sample = { cpu: null, load1: null, cores: null, memUsed: null, memTotal: null, diskFree: null, diskTotal: null };
    expect(pressure(blind, { maxMemory: 1, minDiskGb: 1000, maxLoad: 0.01 })).toBeNull();
    expect(pressure({ ...quiet, memUsed: 16 * GB, memTotal: null }, DEFAULT_LIMITS)).toBeNull();
    expect(pressure({ ...quiet, memTotal: 0, memUsed: 0 }, DEFAULT_LIMITS)).toBeNull();
    expect(pressure({ ...quiet, load1: 100, cores: null }, DEFAULT_LIMITS)).toBeNull();
    expect(pressure({ ...quiet, load1: 100, cores: 0 }, DEFAULT_LIMITS)).toBeNull();
  });
});

describe('nextPause()', () => {
  const running: PauseState = { reason: null, quiet: 0 };

  it('pauses on the first sample under pressure, and says so once', () => {
    const paused = nextPause(running, 'memory 91%');
    expect(paused).toEqual({ state: { reason: 'memory 91%', quiet: 0 }, change: 'paused' });
    expect(nextPause(paused.state, 'memory 92%')).toEqual({ state: { reason: 'memory 92%', quiet: 0 }, change: null });
    expect(nextPause(running, null)).toEqual({ state: running, change: null });
  });

  it('stays paused on one quiet sample, and resumes on the second in a row', () => {
    const paused = nextPause(running, 'disk 6 GB free').state;
    const once = nextPause(paused, null);
    expect(once).toEqual({ state: { reason: 'disk 6 GB free', quiet: 1 }, change: null });
    expect(nextPause(once.state, null)).toEqual({ state: { reason: null, quiet: 0 }, change: 'resumed' });
  });

  it('counts the quiet samples again after one under pressure', () => {
    const once = nextPause(nextPause(running, 'memory 91%').state, null).state;
    const again = nextPause(once, 'load 14.2 on 8 cores');
    expect(again).toEqual({ state: { reason: 'load 14.2 on 8 cores', quiet: 0 }, change: null });
    expect(nextPause(again.state, null).change).toBeNull();
  });
});

describe('the accounts in a report (PRD 2537, s6)', () => {
  const account = (id: string): Account => ({ id, agent: 'claude', instance: null, model: 'secret-model', secret: '/secret/path', budget: null, takes: null });
  const at = '2026-10-16T18:00:00.000Z';
  const hhmm = `${String(new Date(at).getUTCHours()).padStart(2, '0')}:${String(new Date(at).getUTCMinutes()).padStart(2, '0')}`;

  it('names each account\'s id, agent and state in the file\'s order, and nothing else of it', () => {
    const book = accountBook({ file: join(mkdtempSync(join(tmpdir(), 'omni-health-')), 'state.json'), now: () => Date.parse('2026-10-16T12:00:00.000Z') });
    book.markOut('b', at);
    book.activate('c');
    expect(accountsReport([account('a'), account('b'), account('c')], book)).toEqual([
      { id: 'a', agent: 'claude', state: 'ready' },
      { id: 'b', agent: 'claude', state: 'out', resetsAt: at },
      { id: 'c', agent: 'claude', state: 'active' },
    ]);
  });

  it('reads no tokens left, until the earliest reset, only when every account is out', () => {
    const out = (id: string, resetsAt: string): AccountReport => ({ id, agent: 'claude', state: 'out', resetsAt });
    expect(noTokensReason([out('a', '2026-10-16T20:00:00.000Z'), out('b', at)])).toBe(`no tokens left until ${hhmm}`);
    expect(noTokensReason([out('a', at), { id: 'b', agent: 'claude', state: 'ready' }])).toBeNull();
    expect(noTokensReason([out('a', at), { id: 'b', agent: 'claude', state: 'active' }])).toBeNull();
    expect(noTokensReason([])).toBeNull();
  });
});
