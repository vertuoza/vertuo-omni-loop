import type { Board, Job, Runner } from '../runners.contract';
import type { Fleet, RunnersPageView } from './model';

// The demo's runners (PRD 1830 s3), for development and OMNI_LOOP_DEMO=1: one runner in each state, a
// job in each status, the viewer a workspace owner, so every cell and every action shows. Every time is
// counted back from `now`, so the same `now` draws the same page.

const MIN = 60_000;
const DEMO_NAME = 'Acme';
const YOU = '00000000-0000-4000-8000-00000000d001';
const ADA = '00000000-0000-4000-8000-00000000d002';

const DEMO_RUNNERS = {
  agents: '00000000-0000-4000-8000-00000000d101',
  office: '00000000-0000-4000-8000-00000000d102',
  laptop: '00000000-0000-4000-8000-00000000d103',
} as const;

const FLEETS: Fleet[] = [{ name: 'comets', label: 'Comets' }, { name: 'nebula', label: 'Nebula' }];

export function demoRunnersPage(now: Date): RunnersPageView {
  const at = (minutes: number) => new Date(now.getTime() + minutes * MIN).toISOString();
  const runner = (over: Partial<Runner> & Pick<Runner, 'id' | 'name' | 'state'>): Runner => ({
    owner: YOU, fleet: null, slots: 2, used: 0, repos: ['acme/widgets'], version: '0.0.388', lastSeenAt: at(0), ...over,
  });
  let seq = 0;
  const job = (over: Partial<Job> & Pick<Job, 'line' | 'status'>): Job => {
    seq += 1;
    return {
      id: `00000000-0000-4000-8000-00000000d2${String(seq).padStart(2, '0')}`, repo: 'acme/widgets', toRunner: null, toFleet: null,
      sentBy: YOU, sentByLogin: 'you', runner: null, cancelRequested: false, logTail: '', prUrl: null, exitCode: null, reason: null,
      queuedAt: at(-30), claimedAt: null, runningAt: null, endedAt: null, ...over,
    };
  };
  const board: Board = {
    runners: [
      runner({ id: DEMO_RUNNERS.agents, name: 'acme-agents', state: 'busy', fleet: 'comets', slots: 1, used: 1 }),
      runner({ id: DEMO_RUNNERS.office, name: 'mac-mini-office', state: 'online', repos: ['acme/widgets', 'acme/mobile'] }),
      runner({ id: DEMO_RUNNERS.laptop, name: 'ada-laptop', state: 'offline', owner: ADA, slots: 1, lastSeenAt: at(-180), version: '0.0.385' }),
    ],
    jobs: [
      job({
        line: '/omni:yolo 1717', status: 'running', toRunner: DEMO_RUNNERS.agents, runner: DEMO_RUNNERS.agents, claimedAt: at(-12), runningAt: at(-12),
        logTail: 'wave 1 · slice s1 · tests green\nopened https://github.com/acme/widgets/pull/1841',
      }),
      job({ line: '/omni:pr-care 1801', status: 'queued', toFleet: 'comets', sentBy: ADA, sentByLogin: 'ada', queuedAt: at(-2) }),
      job({
        line: '/omni:bug-fix 1790', status: 'done', runner: DEMO_RUNNERS.office, prUrl: 'https://github.com/acme/widgets/pull/1838',
        logTail: 'fix pushed\nopened https://github.com/acme/widgets/pull/1838', exitCode: 0, endedAt: at(-20),
      }),
      job({ line: '/omni:yolo 1702', status: 'failed', toRunner: DEMO_RUNNERS.laptop, runner: DEMO_RUNNERS.laptop, reason: 'runner lost', endedAt: at(-178) }),
      job({ line: '/omni:plan 1699', status: 'cancelled', cancelRequested: true, endedAt: at(-240) }),
    ],
    viewer: { id: YOU, owner: true, fleet: 'comets' },
  };
  return { kind: 'board', name: DEMO_NAME, board, fleets: FLEETS, now: now.toISOString() };
}
