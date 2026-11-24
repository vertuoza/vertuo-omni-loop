import type { Board, Job, Runner } from '../../runners/runners.contract';
import type { Fleet, PrdTitles } from '../../runners/page/model';

// The demo board of the AI fleets' runners view (PRD 3233 s2): Orion, Nova and Atlas, so the tests of the view, the list and the tab
// draw the same three fleets. Orion has a busy runner of its own and a Shared runner running its work; Nova has no runner of its own;
// Atlas's only runner is offline with two jobs waiting. Every time is counted back from `now`.

const MIN = 60_000;
const YOU = '00000000-0000-4000-8000-00000000f001';

export const DEMO_FLEETS: readonly Fleet[] = [
  { name: 'orion', label: 'Orion' }, { name: 'nova', label: 'Nova' }, { name: 'atlas', label: 'Atlas' },
];

/** The ids of each demo fleet's mission. */
export const DEMO_MISSIONS = { orion: 'mission-orion', nova: 'mission-nova', atlas: 'mission-atlas' } as const;

export const DEMO_PRDS: PrdTitles = { 'acme/storefront-api#412': 'Checkout totals', 'acme/storefront-api#430': 'Order export' };

export function demoFleetBoard(now: Date): Board {
  const at = (minutes: number) => new Date(now.getTime() + minutes * MIN).toISOString();
  const runner = (over: Partial<Runner> & Pick<Runner, 'id' | 'name' | 'state'>): Runner => ({
    owner: YOU, fleet: null, slots: 2, used: 0, repos: ['acme/storefront-api'], version: '0.0.697', lastSeenAt: at(0), githubApp: true, ...over,
  });
  let seq = 0;
  const job = (over: Partial<Job> & Pick<Job, 'line' | 'status'>): Job => {
    seq += 1;
    return {
      id: `00000000-0000-4000-8000-00000000f2${String(seq).padStart(2, '0')}`, repo: 'acme/storefront-api', toRunner: null, toFleet: null,
      sentBy: null, sentByLogin: null, sentByApp: 'omni-app', sentByKey: null, runner: null, cancelRequested: false, logTail: '', prUrl: null,
      exitCode: null, reason: null, queuedAt: at(-30), claimedAt: null, runningAt: null, endedAt: null, missionId: null, role: null, ...over,
    };
  };
  return {
    runners: [
      runner({ id: 'r-orbit-1', name: 'orbit-1', state: 'busy', fleet: 'orion', slots: 3, used: 3 }),
      runner({ id: 'r-shared-mac-3', name: 'shared-mac-3', state: 'busy', slots: 2, used: 1, repos: ['acme/storefront-api', 'acme/mobile'] }),
      runner({ id: 'r-box-west', name: 'box-west', state: 'busy', slots: 2, used: 1, repos: ['acme/mobile'] }),
      runner({ id: 'r-atlas-1', name: 'atlas-1', state: 'offline', fleet: 'atlas', slots: 2, lastSeenAt: at(-120), repos: ['acme/atlas'] }),
    ],
    jobs: [
      job({
        line: '/omni:yolo 412', status: 'running', toFleet: 'orion', runner: 'r-orbit-1', claimedAt: at(-18), runningAt: at(-18),
        missionId: DEMO_MISSIONS.orion, role: 'engineer',
      }),
      // No runner of Orion holds acme/mobile: the job went to a Shared runner.
      job({
        line: '/omni:yolo 430', repo: 'acme/mobile', status: 'running', runner: 'r-shared-mac-3', claimedAt: at(-5), runningAt: at(-5),
        missionId: DEMO_MISSIONS.orion, role: 'qa',
      }),
      job({
        line: '/omni:yolo 77', repo: 'acme/mobile', status: 'running', runner: 'r-box-west', claimedAt: at(-9), runningAt: at(-9),
        missionId: DEMO_MISSIONS.nova, role: 'pm',
      }),
      job({ line: '/omni:yolo 31', repo: 'acme/atlas', status: 'queued', toFleet: 'atlas', queuedAt: at(-40), missionId: DEMO_MISSIONS.atlas, role: 'engineer' }),
      job({ line: '/omni:yolo 32', repo: 'acme/atlas', status: 'queued', toFleet: 'atlas', queuedAt: at(-10), missionId: DEMO_MISSIONS.atlas, role: 'reviewer' }),
    ],
    viewer: { id: YOU, owner: true, fleet: null },
  };
}
