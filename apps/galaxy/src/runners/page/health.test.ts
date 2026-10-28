import { describe, expect, it } from 'vitest';
import type { Runner } from '../runners.contract';
import { accountChips, asOfWords, gaugesOf, gbWords, jobTokensWords, sparkPoints, stateTone, tokenFigure, tokenSplit, tokenTotal, waitingWords } from './health';
import { stateWords } from './model';

// The health line's words and numbers (PRD 2102 s3): each gauge, each state of the line, the paused state and both
// sentences of the queued reason.

const GB = 1024 ** 3;
const NOW = new Date('2026-10-16T12:00:00Z');
const LIMITS = { maxMemory: 85, minDiskGb: 10, maxLoad: 1.5 };

type Health = NonNullable<Runner['health']>;
const health = (over: Partial<Health> = {}): Health => ({
  cpu: 63.5, load1: 7.9, cores: 8, memUsed: 8 * GB, memTotal: 16 * GB, diskFree: 40 * GB, diskTotal: 233 * GB,
  paused: null, limits: LIMITS, at: '2026-10-16T11:59:50Z', ...over,
});
const gauge = (over: Partial<Health>, key: string) => {
  const found = gaugesOf({ health: health(over), samples: [] })?.find((g) => g.key === key);
  if (!found) throw new Error(key);
  return found;
};

describe('the gauges', () => {
  it('reads each figure in the page\'s words: percent and load, GB used of total, GB free of total', () => {
    expect(gauge({}, 'cpu').value).toBe('64% · load 7.9 / 8');
    expect(gauge({}, 'memory').value).toBe('8.0 of 16.0 GB');
    expect(gauge({}, 'disk').value).toBe('40.0 GB free of 233');
    expect(gauge({}, 'tokens').value).toBe('—');
  });

  it('shows one decimal under 100 GB and none above', () => {
    expect(gbWords(13 * GB)).toBe('13.0');
    expect(gbWords(99.94 * GB)).toBe('99.9');
    expect(gbWords(233 * GB)).toBe('233');
  });

  it('fills each bar by its share; the tokens gauge has no bar', () => {
    expect(gauge({}, 'cpu').fill).toBe(63.5);
    expect(gauge({}, 'memory').fill).toBe(50);
    expect(gauge({}, 'disk').fill).toBeCloseTo(82.8, 1);
    expect(gauge({}, 'tokens').fill).toBeNull();
  });

  it('shows a figure it could not read as — with no bar', () => {
    const none = { cpu: null, memUsed: null, diskFree: null } as const;
    for (const key of ['cpu', 'memory', 'disk']) {
      expect(gauge(none, key).value).toBe('—');
      expect(gauge(none, key).fill).toBeNull();
      expect(gauge(none, key).over).toBe(false);
    }
  });

  it('keeps the load out of the CPU words when the runner could not read it', () => {
    expect(gauge({ load1: null }, 'cpu').value).toBe('64%');
    expect(gauge({ cores: null }, 'cpu').value).toBe('64% · load 7.9');
  });

  it('is over only past the runner\'s own limit, exactly', () => {
    expect(gauge({ memUsed: 13.6 * GB }, 'memory').over).toBe(false);
    expect(gauge({ memUsed: 13.7 * GB }, 'memory').over).toBe(true);
    expect(gauge({ diskFree: 10 * GB }, 'disk').over).toBe(false);
    expect(gauge({ diskFree: 10 * GB - 1 }, 'disk').over).toBe(true);
    expect(gauge({ load1: 12 }, 'cpu').over).toBe(false);
    expect(gauge({ load1: 12.1 }, 'cpu').over).toBe(true);
  });

  it('follows the limits the runner sent, not the defaults', () => {
    const limits = { maxMemory: 40, minDiskGb: 50, maxLoad: 0.5 };
    expect(gauge({ limits }, 'memory').over).toBe(true);
    expect(gauge({ limits }, 'disk').over).toBe(true);
    expect(gauge({ limits }, 'cpu').over).toBe(true);
  });

  it('warns nothing for a runner that sent no limits', () => {
    const bare = health({ memUsed: 16 * GB, diskFree: 1, load1: 99 });
    delete bare.limits;
    expect(gaugesOf({ health: bare, samples: [] })?.some((g) => g.over)).toBe(false);
  });

  it('has no gauges for a runner that never reported', () => {
    expect(gaugesOf({ health: null, samples: [] })).toBeNull();
    expect(gaugesOf({})).toBeNull();
  });
});

describe('the sparklines', () => {
  it('draws none from fewer than two readings, and skips unread ones', () => {
    expect(sparkPoints([])).toBeNull();
    expect(sparkPoints([5])).toBeNull();
    expect(sparkPoints([null, 5, null])).toBeNull();
    expect(sparkPoints([null, 5, 6])).not.toBeNull();
  });

  it('runs oldest to newest across the box, high values high', () => {
    expect(sparkPoints([0, 100], 100)).toBe('0.0,16.0 100.0,2.0');
    expect(sparkPoints([10, 20, 10])).toBe('0.0,16.0 50.0,2.0 100.0,16.0');
  });

  it('gives a gauge its hour of samples, and none without them', () => {
    const at = (i: number) => `2026-10-16T11:${String(i).padStart(2, '0')}:00Z`;
    const samples = [0, 1, 2].map((i) => ({ at: at(i), cpu: 10 * i, memUsed: 4 * GB * (i + 1), memTotal: 16 * GB, diskFree: 50 * GB - i * GB, tokens5h: 100 * i }));
    const gauges = gaugesOf({ health: health(), samples }) ?? [];
    expect(gauges.map((g) => g.spark !== null)).toEqual([true, true, true, true]);
    expect((gaugesOf({ health: health(), samples: [] }) ?? []).map((g) => g.spark)).toEqual([null, null, null, null]);
  });
});

describe('the paused state', () => {
  const runner = (state: Runner['state'], paused: string | null) => ({ state, lastSeenAt: '2026-10-16T11:59:00Z', health: health({ paused }) });

  it('reads Paused: <reason> in place of Online or Busy', () => {
    expect(stateWords(runner('online', 'memory 91%'), NOW)).toBe('Paused: memory 91%');
    expect(stateWords(runner('busy', 'disk 6 GB free'), NOW)).toBe('Paused: disk 6 GB free');
    expect(stateTone(runner('busy', 'disk 6 GB free'))).toBe('paused');
  });

  it('reads Online or Busy while no reason is held, and for a runner that never reported', () => {
    expect(stateWords(runner('online', null), NOW)).toBe('Online');
    expect(stateWords({ state: 'busy', lastSeenAt: '2026-10-16T11:59:00Z' }, NOW)).toBe('Busy');
    expect(stateTone(runner('online', null))).toBe('online');
  });

  it('lets Offline win', () => {
    expect(stateWords(runner('offline', 'memory 91%'), NOW)).toBe('Offline, 1 min ago');
    expect(stateTone(runner('offline', 'memory 91%'))).toBe('offline');
  });
});

describe('an offline runner', () => {
  it('reads as of <age> under its last figures', () => {
    const state = 'offline' as const;
    expect(asOfWords({ state, health: health({ at: '2026-10-16T11:48:00Z' }) }, NOW)).toBe('as of 12 min ago');
    expect(asOfWords({ state, health: health({ at: '2026-10-16T09:00:00Z' }) }, NOW)).toBe('as of 3 h ago');
    expect(asOfWords({ state, health: health({ at: '2026-10-14T12:00:00Z' }) }, NOW)).toBe('as of 2 d ago');
    expect(asOfWords({ state, health: health({ at: '2026-10-16T11:59:30Z' }) }, NOW)).toBe('as of now');
  });

  it('says nothing for a live runner or one that never reported', () => {
    expect(asOfWords({ state: 'online', health: health() }, NOW)).toBeNull();
    expect(asOfWords({ state: 'offline', health: null }, NOW)).toBeNull();
  });
});

describe('why a queued job waits', () => {
  const runner = (id: string, fleet: string | null, state: Runner['state'], paused: string | null) =>
    ({ id, name: `runner-${id}`, fleet, state, repos: ['acme/widgets'], health: health({ paused }) });
  const queued = { status: 'queued' as const, toRunner: null, toFleet: null, repo: 'acme/widgets' };

  it('names the one runner a job can go to', () => {
    const runners = [runner('a', null, 'online', 'memory 91%'), runner('b', null, 'online', null)];
    expect(waitingWords({ ...queued, toRunner: 'a' }, runners)).toBe('Waiting: runner-a paused (memory 91%)');
  });

  it('says every runner is paused when it can go to several, naming the first reason', () => {
    const runners = [runner('a', null, 'online', 'memory 91%'), runner('b', null, 'busy', 'disk 6 GB free')];
    expect(waitingWords(queued, runners)).toBe('Waiting: every runner paused (memory 91%)');
  });

  it('follows a fleet\'s runners only', () => {
    const runners = [runner('a', 'comets', 'online', 'load 14.2 on 8 cores'), runner('b', null, 'online', null)];
    expect(waitingWords({ ...queued, toFleet: 'comets' }, runners)).toBe('Waiting: runner-a paused (load 14.2 on 8 cores)');
    expect(waitingWords(queued, runners)).toBeNull();
  });

  it('ignores, for a job sent to any runner, a paused runner that has a fleet, as the claim does', () => {
    expect(waitingWords(queued, [runner('a', 'comets', 'online', 'memory 91%')])).toBeNull();
    expect(waitingWords(queued, [runner('a', 'comets', 'online', 'memory 91%'), runner('b', null, 'online', 'disk 6 GB free')])).toBe('Waiting: runner-b paused (disk 6 GB free)');
  });

  it('ignores a runner that does not hold the job\'s repository', () => {
    expect(waitingWords({ ...queued, repo: 'acme/gadgets' }, [runner('a', null, 'online', 'memory 91%')])).toBeNull();
  });

  it('shows nothing when some unpaused runner could take it, or one is offline', () => {
    expect(waitingWords(queued, [runner('a', null, 'online', 'memory 91%'), runner('b', null, 'online', null)])).toBeNull();
    expect(waitingWords(queued, [runner('a', null, 'online', 'memory 91%'), runner('b', null, 'offline', 'memory 91%')])).toBeNull();
  });

  it('shows nothing for a job no runner could take, or one that is not queued', () => {
    expect(waitingWords({ ...queued, toFleet: 'nebula' }, [runner('a', 'comets', 'online', 'memory 91%')])).toBeNull();
    expect(waitingWords(queued, [])).toBeNull();
    expect(waitingWords({ ...queued, status: 'running' as const }, [runner('a', null, 'online', 'memory 91%')])).toBeNull();
  });
});

// The tokens (PRD 2102 s4): the Tokens gauge's two windows and its split, a job's tokens beside its status.
describe('the tokens', () => {
  const COUNTS = { input: 81_234, output: 402_118, cacheRead: 9_120_443, cacheWrite: 611_002 };
  const TODAY = { input: 120_113, output: 655_001, cacheRead: 14_002_118, cacheWrite: 902_114 };

  it('reads a figure in the page\'s words: whole, thousands, then millions and billions with one decimal', () => {
    expect([0, 999, 1000, 81_234, 611_002, 999_499, 999_500, 1_000_000, 9_120_443, 10_214_797, 999_949_999, 999_950_000, 1_200_000_000].map(tokenFigure))
      .toEqual(['0', '999', '1k', '81k', '611k', '999k', '1.0M', '1.0M', '9.1M', '10.2M', '999.9M', '1.0B', '1.2B']);
  });

  it('adds the four counts, the cache reads with them', () => {
    expect(tokenTotal(COUNTS)).toBe(10_214_797);
    expect(tokenSplit(COUNTS)).toBe('input 81k · output 402k · cache read 9.1M · cache write 611k');
  });

  it('fills the Tokens gauge with the last 5 h and today, the split of both in its title, and no bar', () => {
    const tokens = gauge({ tokens: { last5h: COUNTS, today: TODAY } }, 'tokens');
    expect(tokens.value).toBe('10.2M in 5 h · 15.7M today');
    expect(tokens.title).toBe(`Last 5 h: ${tokenSplit(COUNTS)}\nToday: ${tokenSplit(TODAY)}`);
    expect(tokens.fill).toBeNull();
    expect(tokens.over).toBe(false);
  });

  it('reads a window the runner could not read as —, and keeps the other', () => {
    expect(gauge({ tokens: { last5h: null, today: TODAY } }, 'tokens').value).toBe('— in 5 h · 15.7M today');
    expect(gauge({ tokens: { last5h: null, today: TODAY } }, 'tokens').title).toBe(`Today: ${tokenSplit(TODAY)}`);
    const none = gauge({ tokens: { last5h: null, today: null } }, 'tokens');
    expect([none.value, none.title]).toEqual(['—', null]);
  });

  it('reads a runner that sends no tokens as — with no title', () => {
    const none = gauge({}, 'tokens');
    expect([none.value, none.title]).toEqual(['—', null]);
  });

  it('draws the sparkline from the samples\' 5 h sums', () => {
    const samples = [1, 2, 3].map((i) => ({ at: `2026-10-16T11:0${String(i)}:00Z`, cpu: null, memUsed: null, memTotal: null, diskFree: null, tokens5h: 1000 * i }));
    expect(gaugesOf({ health: health(), samples })?.find((g) => g.key === 'tokens')?.spark).toBe('0.0,16.0 50.0,9.0 100.0,2.0');
  });

  it('shows a job\'s tokens beside its status once a report carried them', () => {
    expect(jobTokensWords({ tokens: { input: 31_002, output: 190_455, cacheRead: 1_150_330, cacheWrite: 84_012 } })).toEqual({
      text: '1.5M tokens', title: 'input 31k · output 190k · cache read 1.2M · cache write 84k',
    });
    expect(jobTokensWords({ tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } })?.text).toBe('0 tokens');
    expect(jobTokensWords({ tokens: null })).toBeNull();
    expect(jobTokensWords({})).toBeNull();
  });
});

describe('the account chips (PRD 2537 s6)', () => {
  const accounts: NonNullable<Health['accounts']> = [
    { id: 'claude-1', agent: 'claude', state: 'out', resetsAt: '2026-10-16T18:00:00Z' },
    { id: 'codex-1', agent: 't3', state: 'active' },
    { id: 'spare', agent: 'claude', state: 'ready' },
  ];

  it('lists each account in the file\'s order, its state as its tone and its agent and state in the title', () => {
    expect(accountChips({ health: health({ accounts }) })).toEqual([
      { id: 'claude-1', tone: 'out', title: 'claude · out until 18:00 UTC' },
      { id: 'codex-1', tone: 'active', title: 't3 · active' },
      { id: 'spare', tone: 'ready', title: 'claude · ready' },
    ]);
  });

  it('has no chip for a runner that reported no accounts or never reported', () => {
    expect(accountChips({ health: health() })).toEqual([]);
    expect(accountChips({ health: null })).toEqual([]);
  });

  it('reads an out account without a reset time as out', () => {
    expect(accountChips({ health: health({ accounts: [{ id: 'a', agent: 'claude', state: 'out' }] }) })[0]?.title).toBe('claude · out');
  });
});

describe('a queued job when every runner is out of tokens (PRD 2537 s6)', () => {
  const out = (id: string, until: string): { id: string; name: string; fleet: null; state: Runner['state']; repos: string[]; health: Health } =>
    ({ id, name: `runner-${id}`, fleet: null, state: 'online', repos: ['acme/widgets'], health: health({ paused: 'no tokens left until 00:00', accounts: [{ id: 'a', agent: 'claude', state: 'out', resetsAt: until }] }) });
  const queued = { status: 'queued' as const, toRunner: null, toFleet: null, repo: 'acme/widgets' };

  it('names the earliest reset of all the runners the job could go to', () => {
    expect(waitingWords(queued, [out('a', '2026-10-16T20:00:00Z'), out('b', '2026-10-16T18:00:00Z')])).toBe('Waiting: every runner out of tokens until 18:00');
  });

  it('keeps the memory reasons for a pause that is not about tokens', () => {
    const mixed = [out('a', '2026-10-16T18:00:00Z'), { ...out('b', '2026-10-16T18:00:00Z'), health: health({ paused: 'memory 91%' }) }];
    expect(waitingWords(queued, mixed)).toBe('Waiting: every runner paused (no tokens left until 00:00)');
  });

  it('says it without a time when no runner reported a reset', () => {
    const bare = { ...out('a', 'x'), health: health({ paused: 'no tokens left' }) };
    expect(waitingWords(queued, [bare])).toBe('Waiting: every runner out of tokens');
  });
});
