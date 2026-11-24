import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, Job, Runner } from '../runners.contract';
import { gaugesOf, kitBlocks, slotFleets, summaryWords } from './health';
import type { Fleet, RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// The runner card (PRD 3232 s3): the summary under the title, the slots and who uses them, the limit ticks and the kit that blocks.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2027-01-20T12:00:00Z');
const GB = 1024 ** 3;
const id = (n: number) => `00000000-0000-4000-8000-00000000e${String(n).padStart(3, '0')}`;
const FLEETS: Fleet[] = [{ name: 'cyan', label: 'Cyan' }];
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();

const runner = (over: Partial<Runner> & Pick<Runner, 'id' | 'name'>): Runner => ({
  owner: id(900), fleet: null, slots: 3, used: 0, repos: ['acme/widgets'], version: '0.0.640', lastSeenAt: NOW.toISOString(), state: 'online', githubApp: true, ...over,
});
const job = (over: Partial<Job> & Pick<Job, 'id' | 'line'>): Job => ({
  repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: null, sentByLogin: 'ada', sentByKey: null, status: 'queued', runner: null, cancelRequested: false, logTail: '',
  prUrl: null, exitCode: null, reason: null, queuedAt: NOW.toISOString(), claimedAt: null, runningAt: null, endedAt: null, ...over,
});

const BOX = runner({ id: id(1), name: 'box-1', state: 'busy', used: 2, fleet: 'cyan' });
const BOARD_JOBS = [
  job({ id: id(10), line: '/omni:wave 1', status: 'running', runner: BOX.id, toFleet: 'cyan' }),
  job({ id: id(11), line: '/omni:wave 2', status: 'running', runner: BOX.id }),
  job({ id: id(12), line: '/omni:wave 3', status: 'done', runner: BOX.id, endedAt: NOW.toISOString() }),
];

function page(runners: Runner[], jobs: Job[]): string {
  const board: Board = { runners, jobs, saves: [], viewer: { id: id(900), owner: true, fleet: null } };
  const view: RunnersPageView = { kind: 'board', name: 'Acme', board, fleets: FLEETS, prds: {}, now: NOW.toISOString(), answered: [] };
  return renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null, jobs: 'all' }));
}

describe('slotFleets', () => {
  it('AC-8: names the fleet of each job using a slot: a fleet\'s label, Any runner, or the runner it was sent to', () => {
    expect(slotFleets(BOX, BOARD_JOBS, [BOX], FLEETS)).toEqual(['Cyan', 'Any runner']);
    const sent = job({ id: id(13), line: '/omni:wave 4', status: 'claimed', runner: BOX.id, toRunner: BOX.id });
    expect(slotFleets(BOX, [sent], [BOX], FLEETS)).toEqual(['box-1']);
  });

  it('counts no ended or queued job, nor a job of another runner', () => {
    expect(slotFleets({ id: id(2) }, BOARD_JOBS, [BOX], FLEETS)).toEqual([]);
  });
});

describe('the card', () => {
  const html = page([BOX], BOARD_JOBS);

  it('AC-8: reads 2 of 3 slots, one pip each, each busy pip titled, and who uses them', () => {
    expect(text(html)).toContain('2 of 3 slots Used by Cyan, Any runner');
    expect(html).toContain('<i class="runners-pip is-used" title="Cyan"></i><i class="runners-pip is-used" title="Any runner"></i><i class="runners-pip"></i>');
  });

  it('AC-9: says Runners once, with the counts under it, and no section heading', () => {
    expect(html.match(/>Runners</g)).toHaveLength(1);
    expect(text(html)).toContain('Runners 1 runner · 1 online · 2 of 3 slots in use');
    expect(html).not.toContain('<h2>Runners</h2>');
  });

  it('keeps the offline and Paused words', () => {
    expect(text(page([{ ...BOX, state: 'offline', used: 0, lastSeenAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString() }], []))).toContain('Offline, 3 h ago 0 of 3 slots');
  });
});

describe('summaryWords', () => {
  it('counts the runners, the online ones and the slots of the online ones in use', () => {
    expect(summaryWords([{ state: 'online', slots: 2, used: 0 }, { state: 'busy', slots: 3, used: 2 }, { state: 'offline', slots: 4, used: 4 }])).toBe('3 runners · 2 online · 2 of 5 slots in use');
    expect(summaryWords([{ state: 'busy', slots: 1, used: 1 }])).toBe('1 runner · 1 online · 1 of 1 slot in use');
  });
});

describe('the limit tick', () => {
  const health = (over: Partial<NonNullable<Runner['health']>> = {}): NonNullable<Runner['health']> => ({
    cpu: 40, load1: 2, cores: 8, memUsed: 8 * GB, memTotal: 16 * GB, diskFree: 40 * GB, diskTotal: 200 * GB, paused: null,
    limits: { maxMemory: 85, minDiskGb: 20, maxLoad: 1.5 }, at: NOW.toISOString(), ...over,
  });
  const limit = (over: Partial<NonNullable<Runner['health']>>, key: string) => gaugesOf({ health: health(over), samples: [] })?.find((g) => g.key === key)?.limit;

  it('puts the tick where the runner\'s own limit sits on each bar', () => {
    expect(limit({}, 'cpu')).toBe(100);
    expect(limit({}, 'memory')).toBe(85);
    expect(limit({}, 'disk')).toBe(90);
    expect(limit({}, 'tokens')).toBeNull();
  });

  it('draws no tick for a runner that sent no limit', () => {
    const { limits: _limits, ...bare } = health();
    expect(gaugesOf({ health: bare, samples: [] })?.map((g) => g.limit)).toEqual([null, null, null, null]);
  });

  it('draws the tick and reads in red with an icon past the limit', () => {
    const over = runner({ id: id(3), name: 'box-3', health: health({ memUsed: 15 * GB }) });
    const html = page([over], []);
    expect(html).toContain('runners-gauge-limit');
    expect(html).toContain('runners-gauge is-over" data-gauge="memory"');
    expect(html).toContain('<i class="runners-icon" aria-hidden="true">▲ </i>15.0 of 16.0 GB');
  });
});

describe('kitBlocks', () => {
  const old = runner({ id: id(4), name: 'old-box', githubApp: false });
  const queued = (over: Partial<Job> = {}) => job({ id: id(20), line: '/omni:wave 9', ...over });

  it('counts the queued jobs the runner could take that read Update the runner\'s kit', () => {
    expect(kitBlocks(old, [queued(), queued({ id: id(21) })], [old], [])).toBe(2);
  });

  it('counts none when another runner could take them, or when this one could not', () => {
    const fresh = runner({ id: id(5), name: 'fresh' });
    expect(kitBlocks(old, [queued()], [old, fresh], [])).toBe(0);
    expect(kitBlocks(old, [queued({ repo: 'acme/other' })], [old], [])).toBe(0);
    expect(kitBlocks(old, [queued({ status: 'running' })], [old], [])).toBe(0);
  });

  it('reads the kit in red with blocks <n> job(s) only for a runner it blocks', () => {
    const html = page([old, runner({ id: id(6), name: 'fine', fleet: 'cyan' })], [queued()]);
    expect(text(html)).toContain('▲ 0.0.640 · blocks 1 job');
    expect(html.match(/runners-kit is-blocking/g)).toHaveLength(1);
  });
});
